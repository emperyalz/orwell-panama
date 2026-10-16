import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm,chmod} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {WorkspacePool,selectParallelItems,scopesOverlap} from './workspace-pool.mjs';
test('scheduler enforces two stable roster leases, disjoint ownership and completed dependencies',()=>{
 const a={itemKey:'a',positionKey:'position:a',allowedPaths:['src/a/']},b={itemKey:'b',positionKey:'position:b',allowedPaths:['src/b/']};
 assert.equal(scopesOverlap(['src/a/'],['src/ab']),false);
 assert.equal(scopesOverlap(['src/a/'],['src/a/file']),true);
 assert.deepEqual(selectParallelItems({items:[a,{...b,dependencies:['a']},b]}),[a,b]);
 assert.deepEqual(selectParallelItems({items:[{...b,positionKey:a.positionKey}],active:[a]}),[]);
 assert.throws(()=>selectParallelItems({items:[],maxAuthors:3}));
});
test('real worktrees isolate mutations, reject cross-scope writes and bind immutable independent QA',async()=>{
 const temp=await mkdtemp(join(tmpdir(),'orwell-lanes-')),repository=join(temp,'repo');await mkdir(repository);
 const git=(...args)=>execFileSync('git',args,{cwd:repository,stdio:'pipe'}).toString().trim();
 try{git('init');git('config','user.name','Lane test');git('config','user.email','test@example.invalid');await mkdir(join(repository,'src'));await writeFile(join(repository,'src/a'),'original');await writeFile(join(repository,'src/b'),'original');await writeFile(join(repository,'.npmrc'),'//registry.invalid/:_authToken=fixture-secret');await mkdir(join(repository,'.playwright-cli'));await writeFile(join(repository,'.playwright-cli/cookies.json'),'fixture-secret');git('add','.');git('commit','-m','fixture');
 const pool=new WorkspacePool({repository,stateDir:join(temp,'state'),root:join(temp,'lanes')});
 const a=await pool.acquire({itemKey:'a',positionKey:'position:a',leaseId:'author-a',allowedPaths:['src/a']}),b=await pool.acquire({itemKey:'b',positionKey:'position:b',leaseId:'author-b',allowedPaths:['src/b']});
 await assert.rejects(readFile(join(a.path,'.npmrc')),/ENOENT/);await assert.rejects(readFile(join(a.path,'.playwright-cli/cookies.json')),/ENOENT/);await writeFile(join(a.path,'src/a'),'authored');assert.equal(await readFile(join(b.path,'src/a'),'utf8'),'original');assert.equal(await readFile(join(repository,'src/a'),'utf8'),'original');
 await assert.rejects(pool.acquire({itemKey:'c',positionKey:'position:c',leaseId:'author-c',allowedPaths:['src/c']}),/capacity/);
 await writeFile(join(a.path,'src/b'),'intrusion');await assert.rejects(pool.verify(a),/outside/);await writeFile(join(a.path,'src/b'),'original');
 const qa=await pool.snapshot(a,'review-a');assert.equal(await readFile(join(qa.path,'src/a'),'utf8'),'authored');await pool.withIntegration(a,qa,async()=>{});
 await assert.rejects(pool.withIntegration(a,{...qa,reviewLeaseId:a.leaseId},async()=>{}),/independent/);
 await writeFile(join(a.path,'src/a'),'changed after review');await assert.rejects(pool.withIntegration(a,qa,async()=>{}),/exact-source/);
 await pool.release(a);await pool.release(b);
 }finally{execFileSync('chmod',['-R','u+w',temp]);await rm(temp,{recursive:true,force:true});}
});
