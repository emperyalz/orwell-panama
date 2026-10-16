/** Preserve every reviewed VPS release in local Git; never push or include secrets. */
import {spawn} from 'node:child_process';
import {readFile,readdir,lstat,writeFile,rename} from 'node:fs/promises';
import {dirname,join,relative,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';

const excluded=new Set(['node_modules','.git','.next','.vercel','.impeccable','artifacts','tmp','output']);
const controlPaths=['src/components/reference/ControllerStatus.tsx','convex/controllerStatusData.ts','convex/_generated/api.d.ts','scripts/orwell-pilot','scripts/orwell-dispatcher.mjs','scripts/test-dispatch-acceptance.cjs','scripts/test-dispatch-live-contract.cjs','scripts/test-dispatch-pause.cjs','convex/dispatch.ts','convex/dispatchPriority.ts','convex/schema.ts','convex/scoreboard.ts','convex/agentActivity.ts','convex/leadAccountability.ts','convex/leadMetrics.ts','convex/controllerStatus.ts','convex/controllerStatusData.ts','docs/subscription-agent-pilot-2026-10-15.md','docs/vps-team-execution-2026-10-15.md','docs/vps-backlog-execution-2026-10-15.md'];

function reviewedPath(value){
 if(typeof value!=='string'||!value||value!==value.trim()||value.length>500||/[\\:*?\[\]\x00-\x1f\x7f]/.test(value)||value.startsWith('/'))throw Error('Unsafe release path refused');
 const path=value.endsWith('/')?value.slice(0,-1):value;
 const parts=path.split('/');
 if(parts.some(part=>!part||part==='.'||part==='..'||part.startsWith('.')||excluded.has(part)||/^(?:(?:credentials?|secrets?|id_rsa|id_ed25519)(?:$|[.-])|auth\.json$)/i.test(part)||/\.(?:pem|key|p12|pfx|keystore)$/i.test(part)))throw Error('Credential or dangerous release path refused');
 return path;
}

async function scopedPaths(state,itemKey){
 const file=join(state,'scope.json');
 let info;
 try{info=await lstat(file);}catch(error){if(error.code==='ENOENT')return [];throw error;}
 // The root controller owns this private state on the VPS. Local fixtures use
 // the test process owner; a model child can never supply its own scope file.
 const owner=process.getuid?.()??0,directory=await lstat(state);
 if(!directory.isDirectory()||directory.isSymbolicLink()||directory.uid!==owner||(directory.mode&0o022)||!info.isFile()||info.isSymbolicLink()||info.uid!==owner||(info.mode&0o022))throw Error('Untrusted release scope refused');
 const scope=JSON.parse(await readFile(file,'utf8'));
 if(scope.allowedPaths===undefined)return [];
 if(!scope.allowedPaths||typeof scope.allowedPaths!=='object'||Array.isArray(scope.allowedPaths))throw Error('Invalid release scope');
 if(!Object.hasOwn(scope.allowedPaths,itemKey))return [];
 const paths=scope.allowedPaths[itemKey];
 if(!Array.isArray(paths)||paths.length>100)throw Error('Invalid release scope paths');
 return paths.map(reviewedPath);
}
export async function sourceRevision(workspace) {
 const hash=createHash('sha256');
 async function visit(directory){
  for(const name of (await readdir(directory)).sort()){
   if(excluded.has(name)||name.startsWith('.env')||name.endsWith('.tsbuildinfo'))continue;
   const path=join(directory,name),info=await lstat(path);
   if(info.isSymbolicLink())throw Error('Source symlink rejected');
   if(info.isDirectory())await visit(path);
   else if(info.isFile()){hash.update(relative(workspace,path));hash.update('\0');hash.update(await readFile(path));hash.update('\0');}
  }
 }
 await visit(workspace);return `sha256:${hash.digest('hex')}`;
}
export function validateReleaseAuthor(authorIdentity){
 if(!authorIdentity||typeof authorIdentity.name!=='string'||authorIdentity.name!==authorIdentity.name.trim()||!authorIdentity.name||authorIdentity.name.length>120||/[<>\x00-\x1f\x7f]/.test(authorIdentity.name)||typeof authorIdentity.email!=='string'||authorIdentity.email.length>200||!/^[^\s<>@\x00-\x1f]+@[^\s<>@\x00-\x1f]+$/.test(authorIdentity.email))throw Error('Invalid trusted release author identity');
 return {name:authorIdentity.name,email:authorIdentity.email};
}
export async function loadReleaseAuthor({path='/etc/orwell-agent-controller/frontend.json',ownerUid=0}={}){
 const info=await lstat(path),directory=await lstat(dirname(path));
 if(!directory.isDirectory()||directory.isSymbolicLink()||directory.uid!==ownerUid||(directory.mode&0o022)||!info.isFile()||info.isSymbolicLink()||info.uid!==ownerUid||(info.mode&0o777)!==0o600)throw Error('Untrusted canonical release author configuration');
 return validateReleaseAuthor(JSON.parse(await readFile(path,'utf8')).authorIdentity);
}
export async function commitReviewedSource({workspace,state,uid,gid,home,authorIdentity,log=console.log}) {
 const author=validateReleaseAuthor(authorIdentity??{name:'Orwell Controller',email:'orwell@localhost'});
 let deployment;
 try{deployment=JSON.parse(await readFile(join(state,'deployment.json'),'utf8'));}catch{return {state:'no_release'};}
 if(await sourceRevision(workspace)!==deployment.revision)return {state:'unreleased_work_preserved'};
 try{await lstat(join(workspace,'.git'));}catch{return {state:'awaiting_git_bootstrap'};}
 const paths=[...new Set([...controlPaths,...await scopedPaths(state,deployment.itemKey)])];
 const run=args=>new Promise((accept,reject)=>{
  const child=spawn('/usr/bin/git',['--literal-pathspecs','-c','core.hooksPath=/dev/null','-c','commit.gpgSign=false',...args],{cwd:workspace,uid,gid,env:{HOME:home,USER:'orwell',PATH:'/usr/bin:/bin',LANG:'C.UTF-8'},stdio:['ignore','pipe','pipe']});let out='',err='';
  child.stdout.on('data',d=>out+=d);child.stderr.on('data',d=>err+=d);child.on('error',reject);child.on('close',code=>code===0?accept(out):reject(Error(`Release Git failed: ${err.slice(-1200)}`)));
 });
 const changed=(await run(['diff','--name-only','-z','HEAD','--',...paths])).split('\0');
 const added=(await run(['ls-files','-z','--others','--exclude-standard','--',...paths])).split('\0');
 const files=[...new Set([...changed,...added].filter(Boolean))].sort();
 for(const file of files)reviewedPath(file);
 const checklist={kind:'pre_commit_checklist',task:deployment.itemKey,revision:deployment.revision,worker:deployment.worker,reviewer:deployment.reviewer,files};
 log(JSON.stringify(checklist)); // Mandatory task-to-file checklist precedes every commit.
 if(files.length){
  await run(['add','--',...files]);
  await run(['-c',`user.name=${author.name}`,'-c',`user.email=${author.email}`,'commit','--only','-m',`fix(orwell): deliver ${deployment.itemKey}`,'-m',`Reviewed revision ${deployment.revision}\nWorker ${deployment.worker}\nIndependent QA ${deployment.reviewer}\n\n${files.map(path=>`${deployment.itemKey} -> ${path}`).join('\n')}\n\nAutomation: Orwell Controller\nOrwell-Task: ${deployment.itemKey}\nWorker-Session: ${String(deployment.worker).replace(/[\r\n]/g,' ')}\nIndependent-QA-Session: ${String(deployment.reviewer).replace(/[\r\n]/g,' ')}`,'--',...files]);
 }
 const commit=(await run(['rev-parse','HEAD'])).trim();
 if(await sourceRevision(workspace)!==deployment.revision)throw Error('Source changed during release commit');
 const record={state:'committed',commit,revision:deployment.revision,itemKey:deployment.itemKey,at:Date.now(),files,authorIdentity:author,automation:'Orwell Controller'};
 const path=join(state,'source-commit.json'),temporary=path+'.tmp';await writeFile(temporary,JSON.stringify(record,null,2),{mode:0o600});await rename(temporary,path);return record;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{const authorIdentity=await loadReleaseAuthor();console.log(JSON.stringify(await commitReviewedSource({workspace:'/home/orwell/build',state:'/var/lib/orwell-agent-controller',uid:1001,gid:1001,home:'/home/orwell',authorIdentity})));}
 catch(error){console.error(error.message);process.exitCode=1;}
}
