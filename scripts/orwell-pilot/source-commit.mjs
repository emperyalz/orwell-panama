/** Preserve every reviewed VPS release in local Git; never push or include secrets. */
import {spawn} from 'node:child_process';
import {readFile,readdir,lstat,writeFile,rename} from 'node:fs/promises';
import {join,relative,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';

const excluded=new Set(['node_modules','.git','.next','.vercel','.impeccable','artifacts','tmp','output']);
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
export async function commitReviewedSource({workspace,state,uid,gid,home,log=console.log}) {
 let deployment;
 try{deployment=JSON.parse(await readFile(join(state,'deployment.json'),'utf8'));}catch{return {state:'no_release'};}
 if(await sourceRevision(workspace)!==deployment.revision)return {state:'unreleased_work_preserved'};
 try{await lstat(join(workspace,'.git'));}catch{return {state:'awaiting_git_bootstrap'};}
 const paths=['scripts/orwell-pilot','scripts/orwell-dispatcher.mjs','scripts/test-dispatch-acceptance.cjs','scripts/test-dispatch-live-contract.cjs','scripts/test-dispatch-pause.cjs','convex/dispatch.ts','convex/dispatchPriority.ts','convex/schema.ts','convex/scoreboard.ts','convex/agentActivity.ts','convex/leadAccountability.ts','convex/leadMetrics.ts','docs/subscription-agent-pilot-2026-10-15.md','docs/vps-team-execution-2026-10-15.md'];
 const run=args=>new Promise((accept,reject)=>{
  const child=spawn('/usr/bin/git',['-c','core.hooksPath=/dev/null','-c','commit.gpgSign=false',...args],{cwd:workspace,uid,gid,env:{HOME:home,USER:'orwell',PATH:'/usr/bin:/bin',LANG:'C.UTF-8'},stdio:['ignore','pipe','pipe']});let out='',err='';
  child.stdout.on('data',d=>out+=d);child.stderr.on('data',d=>err+=d);child.on('error',reject);child.on('close',code=>code===0?accept(out.trim()):reject(Error(`Release Git failed: ${err.slice(-1200)}`)));
 });
 const changed=(await run(['diff','--name-only','HEAD','--',...paths])).split('\n');
 const added=(await run(['ls-files','--others','--exclude-standard','--',...paths])).split('\n');
 const files=[...new Set([...changed,...added].filter(Boolean))].sort();
 if(files.some(path=>path.split('/').some(part=>part.startsWith('.env'))))throw Error('Credential path refused');
 const checklist={kind:'pre_commit_checklist',task:deployment.itemKey,revision:deployment.revision,worker:deployment.worker,reviewer:deployment.reviewer,files};
 log(JSON.stringify(checklist)); // Mandatory task-to-file checklist precedes every commit.
 if(files.length){
  await run(['add','--',...files]);
  await run(['-c','user.name=Orwell Controller','-c','user.email=orwell@localhost','commit','--only','-m',`fix(orwell): deliver ${deployment.itemKey}`,'-m',`Reviewed revision ${deployment.revision}\nWorker ${deployment.worker}\nIndependent QA ${deployment.reviewer}\n\n${files.map(path=>`${deployment.itemKey} -> ${path}`).join('\n')}`,'--',...files]);
 }
 const commit=await run(['rev-parse','HEAD']);
 if(await sourceRevision(workspace)!==deployment.revision)throw Error('Source changed during release commit');
 const record={state:'committed',commit,revision:deployment.revision,itemKey:deployment.itemKey,at:Date.now(),files};
 const path=join(state,'source-commit.json'),temporary=path+'.tmp';await writeFile(temporary,JSON.stringify(record,null,2),{mode:0o600});await rename(temporary,path);return record;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{console.log(JSON.stringify(await commitReviewedSource({workspace:'/home/orwell/build',state:'/var/lib/orwell-agent-controller',uid:1001,gid:1001,home:'/home/orwell'})));}
 catch(error){console.error(error.message);process.exitCode=1;}
}
