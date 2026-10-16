/** Quarantine a blocked step's owned edits, then restore its exact pre-work source. */
import {constants} from 'node:fs';
import {lstat,readdir,readFile,writeFile,mkdir,open,rename,unlink,chown,chmod} from 'node:fs/promises';
import {join,resolve,relative} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';

const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const excluded=new Set(['.git','node_modules','.next','.vercel','.impeccable','artifacts','tmp','output']);
const contains=(root,path)=>{const rest=relative(root,path);return rest===''||(rest!=='..'&&!rest.startsWith('../'));};
const same=(a,b)=>a===undefined&&b===undefined||Boolean(a&&b&&a.sha256===b.sha256&&a.mode===b.mode);
function safePath(path,{scope=false}={}){
 if(typeof path!=='string'||!path||path!==path.trim()||path.startsWith('/')||/[\\:*?\[\]{}\x00-\x1f\x7f]/.test(path))throw Error('Unsafe recovery path');
 const trimmed=scope&&path.endsWith('/')?path.slice(0,-1):path,parts=trimmed.split('/');
 if(parts.some(p=>!p||p==='.'||p==='..'||excluded.has(p)||p.startsWith('.env')||/^(?:credentials?|secrets?|id_rsa|id_ed25519)(?:$|[.-])/i.test(p)||p==='auth.json'||/\.(?:pem|key|p12|pfx)$/i.test(p)))throw Error('Dangerous recovery path');
 return trimmed;
}
async function pathInfo(root,path){
 const parts=safePath(path).split('/');let directory=root;
 for(let i=0;i<parts.length;i++){
  directory=join(directory,parts[i]);let info;try{info=await lstat(directory);}catch(error){if(error.code==='ENOENT')return null;throw error;}
  if(info.isSymbolicLink())throw Error('Recovery symlink refused');
  if(i<parts.length-1&&!info.isDirectory())throw Error('Recovery parent is not a directory');
  if(i===parts.length-1)return info;
 }
}
async function trustedDirectory(path){
 const info=await lstat(path);
 if(!info.isDirectory()||info.isSymbolicLink()||info.uid!==(process.getuid?.()??0)||(info.mode&0o022))throw Error('Untrusted private recovery state');
 return info;
}
async function privateJson(path){
 const info=await lstat(path);
 if(!info.isFile()||info.isSymbolicLink()||info.uid!==(process.getuid?.()??0)||(info.mode&0o022))throw Error('Untrusted private recovery record');
 return JSON.parse(await readFile(path,'utf8'));
}
async function bytesFor(root,path,expected,{ignoreMode=false}={}){
 const info=await pathInfo(root,path);
 if(!expected){if(info)throw Error(`Recovery hash conflict: ${path}`);return null;}
 if(!info?.isFile()||(!ignoreMode&&(info.mode&0o777)!==expected.mode))throw Error(`Recovery file or mode conflict: ${path}`);
 const file=await open(join(root,path),constants.O_RDONLY|constants.O_NOFOLLOW);
 try{
  const actual=await file.stat();
  if(actual.ino!==info.ino||actual.dev!==info.dev)throw Error(`Recovery file changed while reading: ${path}`);
  const bytes=await file.readFile();if(hash(bytes)!==expected.sha256)throw Error(`Recovery hash conflict: ${path}`);return bytes;
 }finally{await file.close();}
}
function validateManifest(manifest){
 if(!manifest?.files||!/^sha256:[a-f0-9]{64}$/.test(manifest.revision))throw Error('Saved source manifest is required');
 for(const [path,entry]of Object.entries(manifest.files)){
  // Unchanged root configuration may contain dotfiles. It is never restored
  // unless it passes the separate owned-scope and per-file safety checks.
  if(typeof path!=='string'||path.startsWith('/')||path.split('/').some(p=>!p||p==='.'||p==='..')||/[\\\x00-\x1f\x7f]/.test(path)||!entry||!/^[a-f0-9]{64}$/.test(entry.sha256)||!Number.isSafeInteger(entry.mode)||entry.mode<0||entry.mode>0o777)throw Error('Invalid saved source manifest');
 }
 const actual=`sha256:${hash(JSON.stringify(manifest.files))}`;
 if(actual!==manifest.revision)throw Error('Saved source manifest hash conflict');
}
async function atomicJson(path,value){const temporary=path+'.'+randomUUID()+'.tmp';await writeFile(temporary,JSON.stringify(value,null,2),{mode:0o600,flag:'wx'});await rename(temporary,path);}
async function ensureParent(root,path,owner){
 let directory=root;
 for(const part of safePath(path).split('/').slice(0,-1)){
  directory=join(directory,part);let info;try{info=await lstat(directory);}catch(error){if(error.code!=='ENOENT')throw error;await mkdir(directory,{mode:0o755});await chown(directory,owner.uid,owner.gid);info=await lstat(directory);}
  if(!info.isDirectory()||info.isSymbolicLink())throw Error('Recovery parent is unsafe');
 }
}

/** Root-only caller supplies actual queue state and the controller's hash callbacks. */
export async function recoverBlockedWorkspace({workspace,stateDir,item,allowedPaths,revision,sourceManifest}){
 if(item?.state!=='blocked'||typeof item.key!=='string'||item.leaseId||item.leaseUntil>Date.now())throw Error('Recovery requires a blocked unleased item');
 if(typeof revision!=='function'||typeof sourceManifest!=='function'||!Array.isArray(allowedPaths)||!allowedPaths.length)throw Error('Recovery scope and source callbacks are required');
 const paths=allowedPaths.map(path=>({path:safePath(path,{scope:true}),directory:path.endsWith('/')}));
 const owns=file=>paths.some(path=>path.directory?file.startsWith(path.path+'/'):file===path.path);
 workspace=resolve(workspace);stateDir=resolve(stateDir);
 if(contains(workspace,stateDir))throw Error('Private recovery state must be outside the workspace');
 const owner=await lstat(workspace);if(!owner.isDirectory()||owner.isSymbolicLink())throw Error('Workspace root is unsafe');
 await trustedDirectory(stateDir);await trustedDirectory(join(stateDir,'runs'));
 const currentRevision=await revision(workspace),current=await sourceManifest(workspace);validateManifest(current);
 const recoveryRoot=join(stateDir,'workspace-recovery');await mkdir(recoveryRoot,{recursive:true,mode:0o700});await trustedDirectory(recoveryRoot);
 const latestFile=join(recoveryRoot,hash(item.key).slice(0,24)+'.json');
 try{
  const previous=await privateJson(latestFile);
  if(previous.itemKey===item.key&&previous.state==='recovered'&&previous.restoredRevision===currentRevision&&previous.restoredManifest===current.revision)return {...previous,alreadyRecovered:true};
 }catch(error){if(error.code!=='ENOENT')throw error;}
 const runs=[];
 for(const name of await readdir(join(stateDir,'runs'))){
  if(!/^[a-zA-Z0-9-]{1,160}$/.test(name))throw Error('Unsafe recovery run directory');
  const directory=join(stateDir,'runs',name);await trustedDirectory(directory);
  let execution;try{execution=await privateJson(join(directory,'execution.json'));}catch(error){if(error.code==='ENOENT')continue;throw error;}
  if(execution.job?.phase!=='work'||execution.job.item?.key!==item.key)continue;
  const receipt=await privateJson(join(directory,'receipt.json'));
  if(receipt.job?.phase!=='work'||receipt.job.item?.key!==item.key||execution.job.leaseId!==receipt.job.leaseId||!receipt.finish||!Number.isFinite(execution.startedAt)||!Number.isFinite(receipt.finishedAt)||receipt.finishedAt<execution.startedAt||receipt.before!==execution.before||!/^sha256:[a-f0-9]{64}$/.test(receipt.after))throw Error('Unreconciled work receipt prevents recovery');
  runs.push({execution,receipt});
 }
 runs.sort((a,b)=>a.execution.startedAt-b.execution.startedAt||a.receipt.finishedAt-b.receipt.finishedAt);
 let index=runs.length-1;while(index>=0&&runs[index].receipt.after!==currentRevision)index--;
 if(index<0||index!==runs.length-1)throw Error('Current workspace conflicts with the last work receipt');
 const last=runs[index],chain=[last];
 for(let prior=index-1;prior>=0;prior--){
  if(runs[prior].receipt.after!==chain[0].execution.before||runs[prior].receipt.finishedAt>chain[0].execution.startedAt)throw Error('Work baseline chain is discontinuous');
  chain.unshift(runs[prior]);
 }
 if(last.receipt.afterManifest&&last.receipt.afterManifest.revision!==current.revision)throw Error('Current source permissions conflict with the work receipt');
 const first=chain[0],baseline=first.execution.beforeManifest,baselineDirectory=first.execution.baselineDirectory;
 validateManifest(baseline);
 if(typeof baselineDirectory!=='string'||!baselineDirectory.startsWith('/')||contains(workspace,resolve(baselineDirectory))||contains(resolve(baselineDirectory),workspace))throw Error('Frozen baseline directory is required');
 await trustedDirectory(baselineDirectory);
 if(await revision(baselineDirectory)!==first.execution.before)throw Error('Frozen baseline content hash conflict');
 const frozen=await sourceManifest(baselineDirectory);
 const oldFiles=Object.keys(baseline.files).sort(),frozenFiles=Object.keys(frozen.files).sort();
 if(JSON.stringify(oldFiles)!==JSON.stringify(frozenFiles)||oldFiles.some(path=>baseline.files[path].sha256!==frozen.files[path].sha256))throw Error('Frozen baseline differs from its saved source manifest');
 const files=[...new Set([...Object.keys(baseline.files),...Object.keys(current.files)])].sort().filter(path=>!same(baseline.files[path],current.files[path]));
 if(files.some(file=>!owns(file)))throw Error('Recovery refuses changes outside the blocked item scope');
 for(const file of files){safePath(file);await bytesFor(workspace,file,current.files[file]);if(baseline.files[file])await bytesFor(baselineDirectory,file,baseline.files[file],{ignoreMode:true});}
 const archiveDirectory=join(recoveryRoot,randomUUID());await mkdir(archiveDirectory,{mode:0o700});
 const plan={state:'archived',itemKey:item.key,at:Date.now(),beforeRevision:currentRevision,beforeManifest:current.revision,restoredRevision:first.execution.before,restoredManifest:baseline.revision,leases:chain.map(run=>run.execution.job.leaseId),files:files.map(path=>({path,before:current.files[path]??null,restore:baseline.files[path]??null})),archiveDirectory};
 for(const file of files){
  if(!current.files[file])continue;
  const bytes=await bytesFor(workspace,file,current.files[file]),target=join(archiveDirectory,'files',file);await mkdir(join(target,'..'),{recursive:true,mode:0o700});await writeFile(target,bytes,{mode:0o600,flag:'wx'});
 }
 await atomicJson(join(archiveDirectory,'recovery.json'),plan);
 if(await revision(workspace)!==currentRevision||(await sourceManifest(workspace)).revision!==current.revision)throw Error(`Workspace changed before recovery; archive preserved at ${archiveDirectory}`);
 try{
  for(const file of files){
   const actual=await pathInfo(workspace,file);await bytesFor(workspace,file,current.files[file]);
   if(!baseline.files[file]){await unlink(join(workspace,file));continue;}
   const bytes=await bytesFor(baselineDirectory,file,baseline.files[file],{ignoreMode:true});await ensureParent(workspace,file,owner);
   const target=join(workspace,file),temporary=target+'.orwell-recovery-'+randomUUID();
   await writeFile(temporary,bytes,{mode:0o600,flag:'wx'});await chown(temporary,actual?.uid??owner.uid,actual?.gid??owner.gid);await chmod(temporary,baseline.files[file].mode);await rename(temporary,target);
  }
  if(await revision(workspace)!==first.execution.before||(await sourceManifest(workspace)).revision!==baseline.revision)throw Error('Full source restoration verification failed');
 }catch(error){throw Error(`${error.message}; owned source archive preserved at ${archiveDirectory}`);}
 const result={...plan,state:'recovered',finishedAt:Date.now()};await atomicJson(join(archiveDirectory,'recovery.json'),result);await atomicJson(latestFile,result);return result;
}
