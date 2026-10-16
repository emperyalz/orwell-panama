/** Trusted release adapter. The model never chooses deployment credentials or routing. */
import * as nativeFs from 'node:fs/promises';
import {isAbsolute,join,parse,resolve} from 'node:path';

export const FRONTEND_TARGET=Object.freeze({projectId:'prj_4CV6QZHLWPOAliUm2h9XRELZAzSV',orgId:'team_a06hPQt8eiGGuT4QIVLOmoPY',productionUrl:'https://orwell-panama.vercel.app'});
const keys=new Set(['cliPath','nodePath','projectId','orgId','productionUrl']);
export function frontendConfig(config={}){
 if(!config||typeof config!=='object'||Array.isArray(config)||Object.keys(config).some(key=>!keys.has(key)))throw Error('Unexpected frontend release configuration');
 for(const key of ['projectId','orgId','productionUrl'])if(config[key]!==undefined&&config[key]!==FRONTEND_TARGET[key])throw Error(`Wrong frontend target: ${key}`);
 const result={...FRONTEND_TARGET,cliPath:config.cliPath,nodePath:config.nodePath??'/opt/paperclip-runtime/bin/node'};
 for(const key of ['cliPath','nodePath'])if(typeof result[key]!=='string'||!isAbsolute(result[key])||/[\0\r\n]/.test(result[key]))throw Error(`Invalid trusted ${key}`);
 return result;
}
async function noSymlinks(path,io){
 const absolute=resolve(path),root=parse(absolute).root;let cursor=root;
 for(const part of absolute.slice(root.length).split('/').filter(Boolean)){
  cursor=join(cursor,part);const info=await io.lstat(cursor);
  if(info.isSymbolicLink())throw Error(`Release path symlink refused: ${cursor}`);
 }
}
export function validateNativeAuthMetadata({path,expectedPath,info}){
 if(path!==expectedPath||!info||info.isSymbolicLink()||!info.isFile()||info.uid!==0||(info.mode&0o777)!==0o600)throw Error('Native Vercel auth must be the derived root-owned 0600 regular file');
 return true;
}
function deploymentUrl(output){
 const urls=String(output).match(/https:\/\/[^\s<>"']+/g)??[];
 for(const raw of urls){
  let url;try{url=new URL(raw.replace(/[),.;]+$/,''));}catch{continue;}
  if(url.protocol==='https:'&&!url.username&&!url.password&&!url.port&&url.pathname==='/'&&!url.search&&!url.hash&&/^orwell-panama-[a-z0-9-]+\.vercel\.app$/.test(url.hostname))return url.origin;
 }
 throw Error('Vercel CLI did not return an immutable HTTPS deployment URL for Orwell Panama');
}
export function validateFrontendProof({proof,url,startedAt,now=Date.now()}){
 if(!proof||proof.ready!==true||proof.status!=='READY'||proof.projectId!==FRONTEND_TARGET.projectId||proof.orgId!==FRONTEND_TARGET.orgId||proof.deploymentUrl!==url||proof.productionUrl!==FRONTEND_TARGET.productionUrl||typeof proof.deploymentId!=='string'||!/^dpl_[a-zA-Z0-9]+$/.test(proof.deploymentId)||proof.productionStatus!==200||!Number.isFinite(proof.checkedAt)||proof.checkedAt<startedAt||proof.checkedAt>now+5000||typeof proof.evidence!=='string'||proof.evidence.trim().length<10)throw Error('Missing or mismatched live READY deployment proof');
 return true;
}

/** Root-only live verifier: native auth reaches Vercel API, never the public probe. */
export async function verifyFrontendLive({deploymentUrl:deployed,productionUrl,projectId,orgId,startedAt,stateDir,fetchImpl=globalThis.fetch,io=nativeFs}){
 if(productionUrl!==FRONTEND_TARGET.productionUrl||projectId!==FRONTEND_TARGET.projectId||orgId!==FRONTEND_TARGET.orgId||!isAbsolute(stateDir??'')||!Number.isFinite(startedAt)||typeof fetchImpl!=='function')throw Error('Invalid trusted live verification target');
 if(deploymentUrl(deployed)!==deployed)throw Error('Invalid immutable deployment URL');
 const authHome=join(stateDir,'vercel-data'),authPath=join(authHome,'com.vercel.cli/auth.json');
 await noSymlinks(authPath,io);
 for(const path of [stateDir,authHome,join(authHome,'com.vercel.cli')]){const info=await io.lstat(path);if(!info.isDirectory()||info.uid!==0||(info.mode&0o022))throw Error('Untrusted native authentication directory');}
 validateNativeAuthMetadata({path:authPath,expectedPath:join(stateDir,'vercel-data/com.vercel.cli/auth.json'),info:await io.lstat(authPath)});
 const auth=JSON.parse(await io.readFile(authPath,'utf8'));
 if(typeof auth.token!=='string'||auth.token.length<16)throw Error('Native Vercel authentication is unavailable');
 const inspect=async hostname=>{
  const response=await fetchImpl(`https://api.vercel.com/v13/deployments/${encodeURIComponent(hostname)}?teamId=${orgId}`,{headers:{Authorization:`Bearer ${auth.token}`},signal:AbortSignal.timeout(30000),redirect:'error'});
  if(!response.ok)throw Error(`Vercel deployment inspection failed (HTTP ${response.status})`);
  const data=await response.json();
  if(data.projectId!==projectId||data.ownerId!==orgId||data.readyState!=='READY'||data.target!=='production'||typeof data.id!=='string')throw Error('Vercel API did not establish the trusted production READY deployment');
  return data;
 };
 const deployment=await inspect(new URL(deployed).hostname),alias=await inspect(new URL(productionUrl).hostname);
 if(deployment.id!==alias.id||deployment.url!==new URL(deployed).hostname)throw Error('Production alias does not point to the released deployment');
 const response=await fetchImpl(productionUrl,{method:'GET',signal:AbortSignal.timeout(30000),redirect:'error',headers:{'Cache-Control':'no-cache'}});
 const proof={ready:true,status:'READY',deploymentId:deployment.id,projectId,orgId,deploymentUrl:deployed,productionUrl,productionStatus:response.status,checkedAt:Date.now(),evidence:`Vercel v13 API verified ${deployment.id} READY in ${projectId}/${orgId}; production alias resolves to the same deployment; public GET returned HTTP ${response.status}.`};
 await response.body?.cancel?.();
 validateFrontendProof({proof,url:deployed,startedAt});
 return proof;
}

/** io is an OS adapter for isolated tests; production uses native filesystem operations. */
export async function releaseFrontend({workspace,stateDir,itemKey,leaseId,revision,config,runCommand,verifyLive,io=nativeFs}){
 const target=frontendConfig(config);
 if(!isAbsolute(workspace??'')||!isAbsolute(stateDir??'')||typeof itemKey!=='string'||!itemKey.includes('/')||typeof leaseId!=='string'||!leaseId||!/^sha256:[a-f0-9]{64}$/.test(revision??'')||typeof runCommand!=='function'||typeof verifyLive!=='function')throw Error('Incomplete trusted frontend release context or live verifier');
 const startedAt=Date.now(),authHome=join(stateDir,'vercel-data'),authPath=join(authHome,'com.vercel.cli','auth.json');
 await noSymlinks(workspace,io);await noSymlinks(stateDir,io);await noSymlinks(authPath,io);
 for(const path of [stateDir,authHome,join(authHome,'com.vercel.cli')]){const info=await io.lstat(path);if(!info.isDirectory()||info.uid!==0||(info.mode&0o022)!==0)throw Error('Native auth and release state directories must be root-owned and not writable by other users');}
 validateNativeAuthMetadata({path:authPath,expectedPath:join(stateDir,'vercel-data','com.vercel.cli','auth.json'),info:await io.lstat(authPath)});
 // Do not read auth contents, use --token, or forward the controller environment.
 const projectDirectory=join(workspace,'.vercel'),projectPath=join(projectDirectory,'project.json');
 try{const info=await io.lstat(projectDirectory);if(info.isSymbolicLink()||!info.isDirectory())throw Error('Invalid .vercel directory');}catch(error){if(error.code!=='ENOENT')throw error;await io.mkdir(projectDirectory,{mode:0o700});}
 await noSymlinks(projectDirectory,io);await io.chown(projectDirectory,0,0);await io.chmod(projectDirectory,0o700);
 try{
  const info=await io.lstat(projectPath);if(info.isSymbolicLink()||!info.isFile())throw Error('Invalid Vercel project file');
  const current=JSON.parse(await io.readFile(projectPath,'utf8'));
  if(current.projectId!==target.projectId||current.orgId!==target.orgId)throw Error('Existing Vercel project points at a different trusted target');
 }catch(error){if(error.code!=='ENOENT')throw error;}
 await io.writeFile(projectPath,JSON.stringify({projectId:target.projectId,orgId:target.orgId})+'\n',{mode:0o600});await io.chown(projectPath,0,0);await io.chmod(projectPath,0o600);
 const env={HOME:stateDir,XDG_DATA_HOME:authHome,USER:'root',LOGNAME:'root',PATH:'/opt/paperclip-runtime/bin:/usr/local/bin:/usr/bin:/bin',LANG:'C.UTF-8',CI:'1',NO_COLOR:'1',VERCEL_ORG_ID:target.orgId,VERCEL_PROJECT_ID:target.projectId};
 const args=[target.cliPath,'deploy','--yes','--prod','--archive=tgz'];
 const result=await runCommand(target.nodePath,args,{cwd:workspace,uid:0,gid:0,shell:false,env,timeoutMs:600000});
 const command={binary:target.nodePath,args,code:result?.code??null,out:String(result?.out??''),err:String(result?.err??'')};
 if(command.code!==0||result?.signal){const error=Error(`Frontend deployment failed (exit ${command.code})`);error.command=command;throw error;}
 let url,proof;
 try{
  url=deploymentUrl(command.out+'\n'+command.err);
  proof=await verifyLive({deploymentUrl:url,productionUrl:target.productionUrl,projectId:target.projectId,orgId:target.orgId,itemKey,leaseId,revision,startedAt});
  validateFrontendProof({proof,url,startedAt});
 }catch(error){error.command=command;throw error;}
 const record={kind:'frontend',state:'deployed',itemKey,leaseId,revision,projectId:target.projectId,orgId:target.orgId,deploymentUrl:url,productionUrl:target.productionUrl,command,proof,at:Date.now()};
 const recordPath=join(stateDir,'frontend-deployment.json'),temporary=recordPath+'.tmp';
 for(const path of [recordPath,temporary]){try{const info=await io.lstat(path);if(info.isSymbolicLink()||!info.isFile()||info.uid!==0)throw Error('Unsafe frontend release record path');}catch(error){if(error.code!=='ENOENT')throw error;}}
 await io.writeFile(temporary,JSON.stringify(record,null,2)+'\n',{mode:0o600});await io.chown(temporary,0,0);await io.chmod(temporary,0o600);await io.rename(temporary,recordPath);
 return record;
}
