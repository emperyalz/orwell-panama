/** Root scheduler primitives. All scopes and roster positions must come from private policy. */
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdir,readFile,writeFile,rename,rm,lstat,chmod,copyFile,readdir} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {sourceManifest as fullManifest,assertScopedChanges} from './product-release.mjs';
const privatePart=name=>name.startsWith('.env')||['.npmrc','.pnpmrc','.yarnrc','.yarnrc.yml','.netrc','.playwright-cli','.playwright','.browser','.claude','.codex','.aws','.ssh','.vercel','auth.json','credentials.json','storageState.json','cookies.json'].includes(name)||/\.(?:pem|key|p12|pfx)$/i.test(name)||/^(?:credentials?|secrets?)(?:$|[.-])/i.test(name);
async function sourceManifest(path){const original=await fullManifest(path),files=Object.fromEntries(Object.entries(original.files).filter(([file])=>!file.split('/').some(privatePart)));return {files,revision:'sha256:'+createHash('sha256').update(JSON.stringify(files)).digest('hex')};}
async function scrub(directory){for(const entry of await readdir(directory,{withFileTypes:true})){if(entry.name==='.git')continue;const path=join(directory,entry.name);if(privatePart(entry.name))await rm(path,{recursive:true,force:true});else if(entry.isDirectory())await scrub(path);}}
const exec=promisify(execFile);
const git=async(cwd,...args)=>(await exec('git',['-c',`safe.directory=${cwd}`,...args],{cwd,maxBuffer:16*1024*1024})).stdout.trim();
const safe=value=>typeof value==='string'&&/^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,150}$/.test(value);
const scopePath=p=>{if(typeof p!=='string'||!p||p.startsWith('/')||p.split('/').some(x=>!x||x==='.'||x==='..')||/[\\\x00-\x1f]/.test(p)||p.split('/').some(x=>x==='.git'||x==='node_modules'||x.startsWith('.env')))throw Error('Unsafe ownership path');return p.replace(/\/$/,'');};
export function scopesOverlap(a,b){return a.some(x=>b.some(y=>{x=scopePath(x.replace(/\/$/,''));y=scopePath(y.replace(/\/$/,''));return x===y||x.startsWith(y+'/')||y.startsWith(x+'/');}));}
export function selectParallelItems({items,active=[],accepted=[],maxAuthors=2}){
 if(!Number.isInteger(maxAuthors)||maxAuthors<1||maxAuthors>2)throw Error('Maximum two author lanes');
 const chosen=[],done=new Set(accepted);
 for(const item of items){
  if(chosen.length+active.length>=maxAuthors)break;
  if(!item.allowedPaths?.length||!item.positionKey||item.dependencies?.some(key=>!done.has(key)))continue;
  if([...active,...chosen].some(other=>other.itemKey===item.itemKey||other.positionKey===item.positionKey||scopesOverlap(other.allowedPaths,item.allowedPaths)))continue;
  item.allowedPaths.forEach(p=>scopePath(p.replace(/\/$/,'')));chosen.push(item);
 }
 return chosen;
}
export class WorkspacePool{
 constructor({repository,stateDir,root,uid,gid}){this.repository=resolve(repository);this.stateDir=resolve(stateDir);this.root=resolve(root);this.uid=uid;this.gid=gid;}
 async initialize(){await mkdir(this.stateDir,{recursive:true,mode:0o700});await mkdir(this.root,{recursive:true,mode:0o755});}
 async locked(name,fn){await this.initialize();const path=join(this.stateDir,name+'.lock');try{await mkdir(path,{mode:0o700});}catch(e){if(e.code==='EEXIST')throw Error('Workspace operation already locked: '+name);throw e;}try{return await fn();}finally{await rm(path,{recursive:true,force:true});}}
 async records(){try{return JSON.parse(await readFile(join(this.stateDir,'lanes.json'),'utf8'));}catch(e){if(e.code==='ENOENT')return [];throw e;}}
 async save(records){const tmp=join(this.stateDir,randomUUID()+'.tmp');await writeFile(tmp,JSON.stringify(records,null,2),{mode:0o600});await rename(tmp,join(this.stateDir,'lanes.json'));}
 async acquire({itemKey,positionKey,leaseId,allowedPaths,dependencies=[],accepted=[],base='HEAD',overlayDirectory=this.repository}){return this.locked('allocation',async()=>{
  if(!safe(leaseId)||!safe(positionKey)||typeof itemKey!=='string')throw Error('Invalid lane identity');
  const lanes=await this.records();if(lanes.some(l=>l.leaseId===leaseId))throw Error('Lease already exists');
  const active=lanes.filter(l=>l.state!=='released');const item={itemKey,positionKey,allowedPaths,dependencies};
  if(!selectParallelItems({items:[item],active,accepted}).length)throw Error('Lane capacity, dependency, position or scope conflict');
  const path=join(this.root,leaseId),baseCommit=await git(this.repository,'rev-parse','--verify',base+'^{commit}');
  await git(this.repository,'worktree','add','--detach',path,baseCommit);
  try{await scrub(path);const current=await sourceManifest(overlayDirectory),clean=await sourceManifest(path);for(const file of Object.keys(clean.files))if(!current.files[file])await rm(join(path,file));for(const [file,info]of Object.entries(current.files)){const target=join(path,file);await mkdir(join(target,'..'),{recursive:true,mode:0o755});await copyFile(join(overlayDirectory,file),target);await chmod(target,info.mode);}const before=await sourceManifest(path);if(before.revision!==current.revision)throw Error('Workspace overlay source changed');const lane={...item,leaseId,path,baseCommit,before,state:'author',createdAt:Date.now()};await this.save([...lanes,lane]);return lane;}catch(e){await git(this.repository,'worktree','remove','--force',path);throw e;}
 });}
 async verify(lane){const stored=(await this.records()).find(l=>l.leaseId===lane.leaseId);if(!stored||stored.state==='released'||stored.path!==lane.path)throw Error('Unknown or released lane');const after=await sourceManifest(lane.path);assertScopedChanges({before:stored.before,after,itemKey:stored.itemKey,scope:{allowedPaths:{[stored.itemKey]:stored.allowedPaths}}});return after;}
 async snapshot(lane,reviewLeaseId){if(!safe(reviewLeaseId))throw Error('Invalid review lease');const manifest=await this.verify(lane),path=join(this.root,'qa-'+reviewLeaseId);await mkdir(path,{mode:0o700});try{for(const file of Object.keys(manifest.files)){const target=join(path,file);await mkdir(join(target,'..'),{recursive:true,mode:0o755});await copyFile(join(lane.path,file),target);}const after=await sourceManifest(path);if(after.revision!==manifest.revision)throw Error('QA snapshot source changed');const directories=new Set([path]);for(const file of Object.keys(manifest.files)){let parent=join(path,file,'..');while(parent.startsWith(path)&&parent!==path){directories.add(parent);parent=resolve(parent,'..');}}for(const file of Object.keys(manifest.files))await chmod(join(path,file),0o444);const snapshotRevision=(await sourceManifest(path)).revision;for(const directory of [...directories].sort((a,b)=>b.length-a.length))await chmod(directory,0o555);return {path,revision:manifest.revision,snapshotRevision,reviewLeaseId,authorLeaseId:lane.leaseId,createdAt:Date.now()};}catch(e){await rm(path,{recursive:true,force:true});throw e;}}
 async withIntegration(lane,review,fn){return this.locked('integration',async()=>{const current=await this.verify(lane);if(review.authorLeaseId!==lane.leaseId||review.revision!==current.revision||review.reviewLeaseId===lane.leaseId)throw Error('Fresh exact-source independent review required');if((await sourceManifest(review.path)).revision!==review.snapshotRevision)throw Error('Review snapshot changed');return fn({lane,review,manifest:current});});}
 async release(lane){return this.locked('allocation',async()=>{const lanes=await this.records(),stored=lanes.find(l=>l.leaseId===lane.leaseId);if(!stored||stored.state==='released')throw Error('Unknown or released lease');await git(this.repository,'worktree','remove','--force',stored.path);stored.state='released';stored.releasedAt=Date.now();await this.save(lanes);});}
}
