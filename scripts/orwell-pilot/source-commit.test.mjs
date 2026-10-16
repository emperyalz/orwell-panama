import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm,readFile,chmod,symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {sourceRevision,commitReviewedSource} from './source-commit.mjs';

test('release Git records only reviewed runtime changes after a task/file checklist',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'orwell-release-git-')),workspace=join(dir,'work'),state=join(dir,'state');
 try{
  await mkdir(join(workspace,'scripts/orwell-pilot'),{recursive:true});await mkdir(state);
  const git=args=>execFileSync('/usr/bin/git',['-c','core.hooksPath=/dev/null','-c','commit.gpgSign=false','-c','user.name=Fixture','-c','user.email=fixture@invalid',...args],{cwd:workspace,env:{HOME:dir,PATH:'/usr/bin:/bin'},encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
  await writeFile(join(workspace,'scripts/orwell-pilot/example.mjs'),'export const value=1;\n');
  git(['init']);git(['add','--','scripts/orwell-pilot/example.mjs']);
  console.log('Fixture pre-commit checklist: fixture baseline -> scripts/orwell-pilot/example.mjs');git(['commit','-m','test: fixture baseline']);
  await writeFile(join(workspace,'scripts/orwell-pilot/example.mjs'),'export const value=2;\n');
  await writeFile(join(workspace,'unrelated-ui.txt'),'Existing concurrent UI work\n');
  await writeFile(join(workspace,'.env.private'),'PRIVATE_FIXTURE=not-a-real-secret\n');
  const revision=await sourceRevision(workspace),deployment={revision,itemKey:'fixture/step',worker:'actual-worker-fixture',reviewer:'actual-review-fixture'};
  await writeFile(join(state,'deployment.json'),JSON.stringify(deployment));
  const logs=[];const result=await commitReviewedSource({workspace,state,home:dir,log:line=>logs.push(JSON.parse(line))});
  assert.equal(result.state,'committed');assert.equal(logs[0].kind,'pre_commit_checklist');assert.deepEqual(logs[0].files,['scripts/orwell-pilot/example.mjs']);
  assert.equal(git(['show','--format=','--name-only','HEAD']),'scripts/orwell-pilot/example.mjs');
  assert.match(git(['status','--porcelain']),/unrelated-ui/);assert.doesNotMatch(git(['ls-files']),/env.private/);
  const head=git(['rev-parse','HEAD']);
  await writeFile(join(workspace,'scripts/orwell-pilot/example.mjs'),'export const value=3;\n');
  assert.equal((await commitReviewedSource({workspace,state,home:dir})).state,'unreleased_work_preserved');assert.equal(git(['rev-parse','HEAD']),head);
  assert.equal(JSON.parse(await readFile(join(state,'source-commit.json'),'utf8')).commit,result.commit);
 }finally{await rm(dir,{recursive:true,force:true});}
});

async function releaseFixture(run){
 const dir=await mkdtemp(join(tmpdir(),'orwell-product-release-')),workspace=join(dir,'work'),state=join(dir,'state');
 try{
  await mkdir(join(workspace,'docs/product-audits'),{recursive:true});await mkdir(join(workspace,'scripts/product-audits'),{recursive:true});await mkdir(state);
  const git=args=>execFileSync('/usr/bin/git',['--literal-pathspecs','-c','core.hooksPath=/dev/null','-c','commit.gpgSign=false','-c','user.name=Fixture','-c','user.email=fixture@invalid',...args],{cwd:workspace,env:{HOME:dir,PATH:'/usr/bin:/bin'},encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
  await writeFile(join(workspace,'docs/product-audits/old.md'),'Previous reviewed audit\n');
  await writeFile(join(workspace,'unrelated-ui.txt'),'Existing UI baseline\n');
  git(['init']);git(['add','--','docs/product-audits/old.md','unrelated-ui.txt']);
  console.log('Fixture pre-commit checklist: fixture baseline -> docs/product-audits/old.md, unrelated-ui.txt');git(['commit','-m','test: product baseline']);
  const itemKey='profile-facts-audit/directory';
  const release=async scope=>{
   await writeFile(join(state,'scope.json'),JSON.stringify(scope));
   await writeFile(join(state,'deployment.json'),JSON.stringify({revision:await sourceRevision(workspace),itemKey,worker:'product-author-session',reviewer:'independent-review-session'}));
  };
  await run({dir,workspace,state,git,itemKey,release});
 }finally{await rm(dir,{recursive:true,force:true});}
}

test('product scope commits exact reviewed additions, changes and deletions without taking staged unrelated work',async()=>{
 await releaseFixture(async({dir,workspace,state,git,itemKey,release})=>{
  await rm(join(workspace,'docs/product-audits/old.md'));
  await writeFile(join(workspace,'docs/product-audits/Directory evidence.json'),'[{"source":"fixture"}]\n');
  await writeFile(join(workspace,'scripts/product-audits/inspect.mjs'),'export const inspection=true;\n');
  await writeFile(join(workspace,'unrelated-ui.txt'),'Concurrent staged UI change\n');git(['add','--','unrelated-ui.txt']);
  await mkdir(join(workspace,'docs/another-task'),{recursive:true});await writeFile(join(workspace,'docs/another-task/report.md'),'Other task owns this\n');
  await writeFile(join(workspace,'scope.json'),JSON.stringify({allowedPaths:{[itemKey]:['unrelated-ui.txt']}}));
  await release({allowedPaths:{[itemKey]:['docs/product-audits/','scripts/product-audits/'],'another-task/step':['docs/another-task/']}});
  const logs=[];const result=await commitReviewedSource({workspace,state,home:dir,log:line=>logs.push(JSON.parse(line))});
  const expected=['docs/product-audits/Directory evidence.json','docs/product-audits/old.md','scripts/product-audits/inspect.mjs'];
  assert.deepEqual(result.files,expected);assert.deepEqual(logs[0].files,expected);assert.equal(logs[0].task,itemKey);
  assert.deepEqual(git(['show','--format=','--name-only','HEAD']).split('\n'),expected);
  assert.equal(git(['diff','--cached','--name-only']),'unrelated-ui.txt');
  assert.match(git(['status','--porcelain']),/docs\/another-task/);
  assert.match(git(['show','--format=%B','--no-patch','HEAD']),/profile-facts-audit\/directory -> scripts\/product-audits\/inspect.mjs/);
 });
});

test('release scope refuses path traversal, secret paths and Git pathspec tricks before staging',async()=>{
 await releaseFixture(async({dir,workspace,state,git,itemKey,release})=>{
  await writeFile(join(workspace,'docs/product-audits/evidence.md'),'Reviewed fixture\n');
  const head=git(['rev-parse','HEAD']);
  for(const path of ['/etc/passwd','../outside','docs/../unrelated-ui.txt','docs//product-audits','docs/.env.production','docs/credentials.json','docs/auth.json','docs/key.pem','.git/config','node_modules','artifacts/unchecked','docs/*',':(glob)**','C:\\private','docs/line\nbreak']){
   await release({allowedPaths:{[itemKey]:[path]}});
   await assert.rejects(commitReviewedSource({workspace,state,home:dir}),/release path refused/);
   assert.equal(git(['rev-parse','HEAD']),head);assert.equal(git(['diff','--cached','--name-only']),'');
  }
 });
});

test('release scope must be a controller-owned non-writable regular file in trusted state',async()=>{
 await releaseFixture(async({dir,workspace,state,git,itemKey,release})=>{
  await writeFile(join(workspace,'docs/product-audits/evidence.md'),'Reviewed fixture\n');
  await release({allowedPaths:{[itemKey]:['docs/product-audits/']}});
  const file=join(state,'scope.json'),head=git(['rev-parse','HEAD']);
  await chmod(file,0o666);await assert.rejects(commitReviewedSource({workspace,state,home:dir}),/Untrusted release scope/);await chmod(file,0o600);
  await chmod(state,0o777);await assert.rejects(commitReviewedSource({workspace,state,home:dir}),/Untrusted release scope/);await chmod(state,0o700);
  const target=join(dir,'model-scope.json');await writeFile(target,await readFile(file));await rm(file);await symlink(target,file);
  await assert.rejects(commitReviewedSource({workspace,state,home:dir}),/Untrusted release scope/);
  assert.equal(git(['rev-parse','HEAD']),head);assert.equal(git(['diff','--cached','--name-only']),'');
 });
});

test('a broad approved directory cannot accidentally include credential files',async()=>{
 await releaseFixture(async({dir,workspace,state,itemKey,release})=>{
  await writeFile(join(workspace,'docs/product-audits/evidence.md'),'Reviewed fixture\n');
  await writeFile(join(workspace,'docs/product-audits/credentials.json'),'FIXTURE ONLY\n');
  await release({allowedPaths:{[itemKey]:['docs/product-audits/']}});
  await assert.rejects(commitReviewedSource({workspace,state,home:dir}),/Credential or dangerous release path refused/);
 });
});
