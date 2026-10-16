import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm,cp,readdir,lstat,chmod,symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {recoverBlockedWorkspace} from './workspace-recovery.mjs';
import {sourceRevision as revision} from './source-commit.mjs';
import {sourceManifest} from './product-release.mjs';

async function fixture(run){
 const dir=await mkdtemp(join(tmpdir(),'orwell-owned-recovery-')),workspace=join(dir,'work'),stateDir=join(dir,'state'),key='profile-facts-audit/directory';
 try{
  await mkdir(join(workspace,'docs/product-audits'),{recursive:true});await mkdir(join(stateDir,'runs'),{recursive:true});
  await writeFile(join(workspace,'docs/product-audits/existing.md'),'Original owned baseline\n');
  await writeFile(join(workspace,'docs/product-audits/deleted.md'),'Restore this baseline file\n');
  await chmod(join(workspace,'docs/product-audits/existing.md'),0o640);
  await writeFile(join(workspace,'unrelated-ui.txt'),'Concurrent pre-existing dirty UI work\n');
  let count=0;
  const addRun=async mutate=>{
   const leaseId=randomUUID(),directory=join(stateDir,'runs',leaseId),baselineDirectory=join(dir,'frozen-'+(++count));
   const before=await revision(workspace),beforeManifest=await sourceManifest(workspace);await cp(workspace,baselineDirectory,{recursive:true});
   async function freeze(directory){await chmod(directory,0o755);for(const entry of await readdir(directory,{withFileTypes:true})){const path=join(directory,entry.name);if(entry.isDirectory())await freeze(path);else await chmod(path,0o444);}}
   await freeze(baselineDirectory);await mutate();
   const after=await revision(workspace),afterManifest=await sourceManifest(workspace),job={phase:'work',leaseId,item:{key}},startedAt=1700000000000+count*1000;
   const execution={job,before,beforeManifest,baselineDirectory,startedAt},receipt={job,before,after,afterManifest,finishedAt:startedAt+500,finish:{state:'qa_ready'}};
   await mkdir(directory);await writeFile(join(directory,'execution.json'),JSON.stringify(execution));await writeFile(join(directory,'receipt.json'),JSON.stringify(receipt));
   return {execution,receipt,directory};
  };
  const options={workspace,stateDir,item:{key,state:'blocked'},allowedPaths:['docs/product-audits/'],revision,sourceManifest};
  await run({dir,workspace,stateDir,addRun,options});
 }finally{await rm(dir,{recursive:true,force:true});}
}

test('blocked work is archived and exact pre-existing dirty baseline bytes, modes and ownership survive',async()=>fixture(async({workspace,addRun,options})=>{
 const baseline=await revision(workspace),manifest=(await sourceManifest(workspace)).revision,owner=await lstat(workspace);
 await addRun(async()=>{
  await writeFile(join(workspace,'docs/product-audits/existing.md'),'Rejected owned edit\n');await chmod(join(workspace,'docs/product-audits/existing.md'),0o755);
  await rm(join(workspace,'docs/product-audits/deleted.md'));await writeFile(join(workspace,'docs/product-audits/new.md'),'Unaccepted new research\n');
 });
 const result=await recoverBlockedWorkspace(options);assert.equal(result.state,'recovered');assert.equal(result.restoredRevision,baseline);assert.equal(await revision(workspace),baseline);assert.equal((await sourceManifest(workspace)).revision,manifest);
 assert.equal(await readFile(join(workspace,'unrelated-ui.txt'),'utf8'),'Concurrent pre-existing dirty UI work\n');
 assert.equal((await lstat(join(workspace,'docs/product-audits/existing.md'))).mode&0o777,0o640);assert.equal((await lstat(join(workspace,'docs/product-audits/deleted.md'))).uid,owner.uid);
 assert.equal(await readFile(join(result.archiveDirectory,'files/docs/product-audits/existing.md'),'utf8'),'Rejected owned edit\n');
 assert.equal(await readFile(join(result.archiveDirectory,'files/docs/product-audits/new.md'),'utf8'),'Unaccepted new research\n');
 assert.equal((await lstat(result.archiveDirectory)).mode&0o077,0);assert.equal((await lstat(join(result.archiveDirectory,'files/docs/product-audits/new.md'))).mode&0o077,0);
 assert.equal(JSON.parse(await readFile(join(result.archiveDirectory,'recovery.json'),'utf8')).state,'recovered');
 const repeated=await recoverBlockedWorkspace(options);assert.equal(repeated.alreadyRecovered,true);assert.equal(repeated.archiveDirectory,result.archiveDirectory);
}));

test('a repair chain restores the first workspace baseline, including edits inherited by later repairs',async()=>fixture(async({workspace,addRun,options})=>{
 const before=await revision(workspace);
 const first=await addRun(()=>writeFile(join(workspace,'docs/product-audits/new.md'),'First unaccepted research\n'));
 const second=await addRun(async()=>{await writeFile(join(workspace,'docs/product-audits/new.md'),'Repaired but still rejected research\n');await writeFile(join(workspace,'docs/product-audits/repair.md'),'Second turn only\n');});
 const result=await recoverBlockedWorkspace(options);assert.equal(await revision(workspace),before);assert.deepEqual(result.leases,[first.execution.job.leaseId,second.execution.job.leaseId]);
 await assert.rejects(readFile(join(workspace,'docs/product-audits/new.md')),/ENOENT/);await assert.rejects(readFile(join(workspace,'docs/product-audits/repair.md')),/ENOENT/);
}));

test('edits outside the item scope are never archived away or restored',async()=>fixture(async({workspace,addRun,options})=>{
 await addRun(async()=>{await writeFile(join(workspace,'unrelated-ui.txt'),'Unexpected outside edit\n');await writeFile(join(workspace,'docs/product-audits/existing.md'),'Owned edit\n');});
 const current=await revision(workspace);await assert.rejects(recoverBlockedWorkspace(options),/outside the blocked item scope/);assert.equal(await revision(workspace),current);assert.equal(await readFile(join(workspace,'unrelated-ui.txt'),'utf8'),'Unexpected outside edit\n');
}));

test('post-receipt content and permission conflicts fail closed',async()=>fixture(async({workspace,addRun,options})=>{
 await addRun(()=>writeFile(join(workspace,'docs/product-audits/existing.md'),'Owned edit\n'));
 await writeFile(join(workspace,'docs/product-audits/existing.md'),'Later actor edit\n');await assert.rejects(recoverBlockedWorkspace(options),/conflicts with the last work receipt/);
 await writeFile(join(workspace,'docs/product-audits/existing.md'),'Owned edit\n');await chmod(join(workspace,'docs/product-audits/existing.md'),0o755);await assert.rejects(recoverBlockedWorkspace(options),/permissions conflict/);
 assert.equal(await readFile(join(workspace,'docs/product-audits/existing.md'),'utf8'),'Owned edit\n');
}));

test('source and frozen baseline symlinks cannot redirect recovery writes or reads',async()=>fixture(async({dir,workspace,addRun,options})=>{
 const run=await addRun(()=>writeFile(join(workspace,'docs/product-audits/existing.md'),'Owned edit\n'));
 const outside=join(dir,'outside.txt');await writeFile(outside,'Outside must survive\n');
 await rm(join(workspace,'docs/product-audits/existing.md'));await symlink(outside,join(workspace,'docs/product-audits/existing.md'));await assert.rejects(recoverBlockedWorkspace(options),/symlink/i);
 await rm(join(workspace,'docs/product-audits/existing.md'));await writeFile(join(workspace,'docs/product-audits/existing.md'),'Owned edit\n');await chmod(join(workspace,'docs/product-audits/existing.md'),0o640);
 const frozen=join(run.execution.baselineDirectory,'docs/product-audits/existing.md');await rm(frozen);await symlink(outside,frozen);await assert.rejects(recoverBlockedWorkspace(options),/symlink/i);
 assert.equal(await readFile(outside,'utf8'),'Outside must survive\n');
}));

test('unsafe scopes, private-state permissions and incomplete receipts never authorize restoration',async()=>fixture(async({workspace,stateDir,addRun,options})=>{
 const run=await addRun(()=>writeFile(join(workspace,'docs/product-audits/existing.md'),'Owned edit\n')),before=await revision(workspace);
 for(const path of ['/tmp/outside','../outside','docs/../unrelated-ui.txt','.git/','docs/.env.private','docs/*'])await assert.rejects(recoverBlockedWorkspace({...options,allowedPaths:[path]}),/recovery path/i);
 await chmod(stateDir,0o777);await assert.rejects(recoverBlockedWorkspace(options),/Untrusted private recovery state/);await chmod(stateDir,0o700);
 await rm(join(run.directory,'receipt.json'));await assert.rejects(recoverBlockedWorkspace(options),/ENOENT/);assert.equal(await revision(workspace),before);
}));

test('a changed frozen baseline or discontinuous work history cannot overwrite current work',async()=>fixture(async({workspace,addRun,options})=>{
 const first=await addRun(()=>writeFile(join(workspace,'docs/product-audits/existing.md'),'First owned edit\n'));
 const frozen=join(first.execution.baselineDirectory,'docs/product-audits/existing.md');await chmod(frozen,0o644);await writeFile(frozen,'Corrupted baseline\n');await assert.rejects(recoverBlockedWorkspace(options),/Frozen baseline content hash conflict/);
 await writeFile(join(workspace,'unrelated-ui.txt'),'Separate actor changed work between turns\n');
 await addRun(()=>writeFile(join(workspace,'docs/product-audits/existing.md'),'Second owned edit\n'));
 const before=await revision(workspace);await assert.rejects(recoverBlockedWorkspace(options),/baseline chain is discontinuous/);assert.equal(await revision(workspace),before);
}));

test('active work and missing historical baselines remain held',async()=>fixture(async({workspace,addRun,options})=>{
 const run=await addRun(()=>writeFile(join(workspace,'docs/product-audits/existing.md'),'Owned edit\n'));
 for(const item of [{...options.item,state:'ready'},{...options.item,leaseId:randomUUID()},{...options.item,leaseUntil:Date.now()+100000}])await assert.rejects(recoverBlockedWorkspace({...options,item}),/blocked unleased item/);
 delete run.execution.beforeManifest;await writeFile(join(run.directory,'execution.json'),JSON.stringify(run.execution));await assert.rejects(recoverBlockedWorkspace(options),/Saved source manifest is required/);
}));
