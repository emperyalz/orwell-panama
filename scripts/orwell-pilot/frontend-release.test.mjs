import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {FRONTEND_TARGET,frontendConfig,validateNativeAuthMetadata,releaseFrontend,verifyFrontendLive} from './frontend-release.mjs';
const url='https://orwell-panama-abc123-erics-projects.vercel.app',revision='sha256:'+'a'.repeat(64);
async function fixture(t){
 const base=await fs.realpath(await fs.mkdtemp(join(tmpdir(),'frontend-release-')));t.after(()=>fs.rm(base,{recursive:true,force:true}));
 const workspace=join(base,'workspace'),stateDir=join(base,'state');await fs.mkdir(workspace);await fs.mkdir(join(stateDir,'vercel-data/com.vercel.cli'),{recursive:true});
 const authPath=join(stateDir,'vercel-data/com.vercel.cli/auth.json');await fs.writeFile(authPath,'credential contents must never be read',{mode:0o600});
 const calls=[],reads=[];
 const io={...fs,chown:async()=>{},lstat:async path=>{const actual=await fs.lstat(path);return new Proxy(actual,{get:(object,key)=>key==='uid'?0:typeof object[key]==='function'?object[key].bind(object):object[key]});},readFile:async(...args)=>{reads.push(args[0]);if(args[0]===authPath)throw Error('Credential read forbidden');return fs.readFile(...args);}};
 const options={workspace,stateDir,itemKey:'communication-trends/label-uncertainty-and-archive-gaps',leaseId:'trusted-lease',revision,config:{cliPath:'/opt/orwell-deploy/node_modules/vercel/dist/index.js'},io,
  runCommand:async(...args)=>{calls.push(args);return{code:0,out:`Production: ${url}\nAliased: ${FRONTEND_TARGET.productionUrl}`,err:''};},
  verifyLive:async ctx=>({ready:true,status:'READY',...FRONTEND_TARGET,deploymentUrl:ctx.deploymentUrl,deploymentId:'dpl_actual123',productionStatus:200,checkedAt:Date.now(),evidence:'Trusted Vercel API READY and production HTTP checks passed.'})};
 return {options,calls,reads,authPath};
}
test('targets the fixed project with native root auth, no shell or inference secrets, and saves matching release proof',async t=>{
 const f=await fixture(t),record=await releaseFrontend(f.options);
 const [binary,args,options]=f.calls[0];assert.equal(binary,'/opt/paperclip-runtime/bin/node');assert.deepEqual(args,[f.options.config.cliPath,'deploy','--yes','--prod','--archive=tgz']);assert.equal(options.uid,0);assert.equal(options.gid,0);assert.equal(options.shell,false);
 assert.equal(options.env.XDG_DATA_HOME,join(f.options.stateDir,'vercel-data'));assert.equal(options.env.VERCEL_PROJECT_ID,FRONTEND_TARGET.projectId);assert.equal(options.env.VERCEL_TOKEN,undefined);assert.equal(options.env.ANTHROPIC_API_KEY,undefined);assert.equal(options.env.OPENAI_API_KEY,undefined);assert.equal(f.reads.includes(f.authPath),false);
 const saved=JSON.parse(await fs.readFile(join(f.options.stateDir,'frontend-deployment.json'),'utf8'));assert.equal(saved.revision,revision);assert.equal(saved.leaseId,'trusted-lease');assert.equal(saved.itemKey,f.options.itemKey);assert.equal(saved.proof.status,'READY');assert.equal(record.deploymentUrl,url);
});
test('wrong projects and arbitrary auth paths/configuration are rejected',async t=>{
 for(const config of [{projectId:'other'},{orgId:'other'},{productionUrl:'https://evil.example'},{authPath:'/tmp/auth'},{token:'secret'}])assert.throws(()=>frontendConfig({cliPath:'/opt/vercel.js',...config}));
 const regular={uid:0,mode:0o100600,isSymbolicLink:()=>false,isFile:()=>true};
 assert.throws(()=>validateNativeAuthMetadata({path:'/wrong/auth',expectedPath:'/state/vercel-data/com.vercel.cli/auth.json',info:regular}));
 for(const patch of [{uid:1001},{mode:0o100644},{isSymbolicLink:()=>true}])assert.throws(()=>validateNativeAuthMetadata({path:'/correct',expectedPath:'/correct',info:{...regular,...patch}}));
 const f=await fixture(t);await fs.mkdir(join(f.options.workspace,'.vercel'));await fs.writeFile(join(f.options.workspace,'.vercel/project.json'),JSON.stringify({projectId:'wrong',orgId:FRONTEND_TARGET.orgId}));await assert.rejects(releaseFrontend(f.options),/different trusted target/);assert.equal(f.calls.length,0);
});
test('auth and project symlinks cannot be followed',async t=>{
 for(const target of ['auth','project'])await t.test(target,async t=>{
  const f=await fixture(t);
  if(target==='auth'){await fs.rm(f.authPath);await fs.symlink(join(f.options.workspace,'missing'),f.authPath);}
  else{await fs.mkdir(join(f.options.workspace,'.vercel'));await fs.symlink(f.authPath,join(f.options.workspace,'.vercel/project.json'));}
  await assert.rejects(releaseFrontend(f.options),/symlink|Invalid Vercel project/);assert.equal(f.calls.length,0);
 });
});
test('CLI failure retains command evidence and cannot write a deployment record',async t=>{
 const f=await fixture(t);let probes=0;f.options.runCommand=async()=>({code:1,out:'not deployed',err:'membership denied'});f.options.verifyLive=async()=>{probes++;};
 await assert.rejects(releaseFrontend(f.options),error=>error.command?.err==='membership denied');assert.equal(probes,0);await assert.rejects(fs.access(join(f.options.stateDir,'frontend-deployment.json')));
});
test('writable auth/state directories are refused before deployment',async t=>{
 const f=await fixture(t);await fs.chmod(join(f.options.stateDir,'vercel-data'),0o777);await assert.rejects(releaseFrontend(f.options),/root-owned and not writable/);assert.equal(f.calls.length,0);
});
test('wrong stdout host or absent/mismatched READY proof holds acceptance without a record',async t=>{
 for(const mutate of [f=>{f.options.runCommand=async()=>({code:0,out:'https://evil.example',err:''});},f=>{f.options.verifyLive=undefined;},f=>{f.options.verifyLive=async()=>({ready:true,evidence:'HTTP homepage was reachable'});},f=>{const verify=f.options.verifyLive;f.options.verifyLive=async ctx=>({...await verify(ctx),projectId:'wrong'});},f=>{const verify=f.options.verifyLive;f.options.verifyLive=async ctx=>({...await verify(ctx),status:'BUILDING'});}]){
  const f=await fixture(t);mutate(f);await assert.rejects(releaseFrontend(f.options));await assert.rejects(fs.access(join(f.options.stateDir,'frontend-deployment.json')));
 }
});
test('live verifier checks actual Vercel ownership/READY and alias identity, and never sends auth to public HTTP',async t=>{
 const f=await fixture(t),calls=[];
 const io={...f.options.io,readFile:path=>path===f.authPath?Promise.resolve(JSON.stringify({token:'fixture-native-token-not-real'})):fs.readFile(path,'utf8')};
 const live={deploymentUrl:url,...FRONTEND_TARGET,startedAt:Date.now()-10,stateDir:f.options.stateDir,io,fetchImpl:async(address,options)=>{
  calls.push({address,options});
  if(address.startsWith('https://api.vercel.com/'))return{ok:true,status:200,json:async()=>({id:'dpl_actual123',url:new URL(url).hostname,projectId:FRONTEND_TARGET.projectId,ownerId:FRONTEND_TARGET.orgId,readyState:'READY',target:'production'})};
  return {status:200};
 }};
 const proof=await verifyFrontendLive(live);assert.equal(proof.status,'READY');assert.equal(calls.length,3);assert.equal(calls[2].options.headers.Authorization,undefined);assert.match(calls[0].options.headers.Authorization,/^Bearer /);
 for(const patch of [{readyState:'BUILDING'},{ownerId:'wrong'},{projectId:'wrong'},{target:'preview'}])await assert.rejects(verifyFrontendLive({...live,fetchImpl:async()=>({ok:true,status:200,json:async()=>({id:'dpl_actual123',url:new URL(url).hostname,projectId:FRONTEND_TARGET.projectId,ownerId:FRONTEND_TARGET.orgId,readyState:'READY',target:'production',...patch})})}));
 let count=0;await assert.rejects(verifyFrontendLive({...live,fetchImpl:async()=>({ok:true,status:200,json:async()=>({id:++count===1?'dpl_one':'dpl_two',url:new URL(url).hostname,projectId:FRONTEND_TARGET.projectId,ownerId:FRONTEND_TARGET.orgId,readyState:'READY',target:'production'})})}),/alias/);
});
