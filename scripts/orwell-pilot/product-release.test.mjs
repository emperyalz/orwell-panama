import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm,symlink,chmod} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {sourceManifest,assertScopedChanges,verifyProductArtifact} from './product-release.mjs';

const itemKey='profile-facts-audit/directory';
const scope={allowedPaths:{[itemKey]:['docs/product-audits/','scripts/product-audits/']},productChecks:{[itemKey]:[['node',['scripts/product-audits/profile-facts-inventory.mjs','--verify']]]}};
async function fixture(t){const dir=await mkdtemp(join(tmpdir(),'orwell-product-release-'));t.after(()=>rm(dir,{recursive:true,force:true}));await mkdir(join(dir,'docs/product-audits'),{recursive:true});await writeFile(join(dir,'outside.txt'),'original');return dir;}

test('tracks allowed additions with immutable content hashes and detects unauthorized modification, deletion and addition',async t=>{
 for(const operation of ['modify','delete','add'])await t.test(operation,async t=>{
  const workspace=await fixture(t),before=await sourceManifest(workspace);
  assert.ok(Object.isFrozen(before.files));
  if(operation==='modify')await writeFile(join(workspace,'outside.txt'),'changed');
  if(operation==='delete')await rm(join(workspace,'outside.txt'));
  if(operation==='add')await writeFile(join(workspace,'new.txt'),'new');
  const after=await sourceManifest(workspace);
  assert.throws(()=>assertScopedChanges({before,after,itemKey,scope}),/outside/);
 });
 const workspace=await fixture(t),before=await sourceManifest(workspace);
 await writeFile(join(workspace,'docs/product-audits/inventory.json'),'{}');
 const after=await sourceManifest(workspace);
 assert.deepEqual(assertScopedChanges({before,after,itemKey,scope}),['docs/product-audits/inventory.json']);
});

test('rejects a symlink to secrets even inside the permitted artifact directory',async t=>{
 const workspace=await fixture(t);await writeFile(join(workspace,'.env.local'),'secret');
 await symlink(join(workspace,'.env.local'),join(workspace,'docs/product-audits/stolen.json'));
 await assert.rejects(sourceManifest(workspace),/symlink refused/);
});

test('directory boundary, traversal and excluded directories cannot widen the scope',async t=>{
 const workspace=await fixture(t),before=await sourceManifest(workspace);
 await mkdir(join(workspace,'docs/product-audits-other'));await writeFile(join(workspace,'docs/product-audits-other/file'),'changed');
 const after=await sourceManifest(workspace);
 assert.throws(()=>assertScopedChanges({before,after,itemKey,scope}),/outside/);
 for(const path of ['../','docs/../','/tmp/','docs//','docs/*','.env.local','node_modules/','.'])assert.throws(()=>assertScopedChanges({before,after,itemKey,scope:{allowedPaths:{[itemKey]:[path]}}}),/Invalid/);
});

test('source permission changes count while build output and credentials remain excluded',async t=>{
 const workspace=await fixture(t);await chmod(join(workspace,'outside.txt'),0o644);const before=await sourceManifest(workspace);
 await mkdir(join(workspace,'node_modules'));await writeFile(join(workspace,'node_modules/generated'),'ignored');await writeFile(join(workspace,'.env.local'),'ignored');
 assert.equal((await sourceManifest(workspace)).revision,before.revision);
 await chmod(join(workspace,'outside.txt'),0o755);
 const after=await sourceManifest(workspace);assert.throws(()=>assertScopedChanges({before,after,itemKey,scope}),/outside/);
});

test('runs trusted command without a shell and returns saved stdout/stderr evidence',async t=>{
 const workspace=await fixture(t),calls=[];
 const result=await verifyProductArtifact({workspace,itemKey,scope,runCommand:async(...args)=>{calls.push(args);return {code:0,out:'91 profiles verified\n',err:'source limits recorded\n'};}});
 assert.deepEqual(calls,[['node',['scripts/product-audits/profile-facts-inventory.mjs','--verify'],{cwd:workspace,shell:false}]]);
 assert.equal(result.checks[0].out,'91 profiles verified\n');assert.equal(result.checks[0].err,'source limits recorded\n');assert.match(result.revision,/^sha256:/);
});

test('nonzero checker fails with retained outputs; invalid config runs no commands',async t=>{
 const workspace=await fixture(t);
 await assert.rejects(verifyProductArtifact({workspace,itemKey,scope,runCommand:async()=>({code:1,out:'missing profiles',err:'count mismatch'})}),error=>error.checks[0].err==='count mismatch');
 let calls=0;
 for(const command of [[],[['node',[null]]],[['node',[]],['node','--verify']], [['node\0',[]]]])await assert.rejects(verifyProductArtifact({workspace,itemKey,scope:{...scope,productChecks:{[itemKey]:command}},runCommand:async()=>{calls++;return{code:0};}}));
 assert.equal(calls,0);
});

test('even an allowed artifact rewrite during verification invalidates acceptance',async t=>{
 const workspace=await fixture(t);
 await assert.rejects(verifyProductArtifact({workspace,itemKey,scope,runCommand:async()=>{await writeFile(join(workspace,'docs/product-audits/generated.json'),'{}');return{code:0,out:'passed'};}}),error=>/changed source/.test(error.message)&&error.checks[0].out==='passed');
});
