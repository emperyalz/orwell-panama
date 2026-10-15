import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm,readFile} from 'node:fs/promises';
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
