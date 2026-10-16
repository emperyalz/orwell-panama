import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {acceptanceProof,digest} from './acceptance-proof.mjs';
test('proof hashes actual saved successful records and rejects stale, failed and missing records',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'orwell-proof-'));
 try{
 const identity={itemKey:'task/step',leaseId:'lease',revision:'sha256:'+'a'.repeat(64)};
 const checksPath=join(dir,'checks.json'),deploymentPath=join(dir,'deployment.json');
 const checks={...identity,commands:['pilot','live-contract','acceptance','pause','typecheck','original-policy'].map(name=>({name,code:0}))};
 const deployment={...identity,code:0,deployment:'https://prod.convex.cloud'};
 await writeFile(checksPath,JSON.stringify(checks));await writeFile(deploymentPath,JSON.stringify(deployment));
 const args={...identity,checksPath,deploymentPath};
 const proof=await acceptanceProof(args);assert.equal(proof.checksHash,digest(JSON.stringify(checks)));assert.equal(proof.deploymentHash,digest(JSON.stringify(deployment)));
 for(const change of [{revision:'stale'},{leaseId:'other'},{code:1}]){await writeFile(deploymentPath,JSON.stringify({...deployment,...change}));await assert.rejects(acceptanceProof(args));}
 await writeFile(deploymentPath,JSON.stringify(deployment));checks.commands[0].code=1;await writeFile(checksPath,JSON.stringify(checks));await assert.rejects(acceptanceProof(args));
 await assert.rejects(acceptanceProof({...args,checksPath:join(dir,'missing')}));
 }finally{await rm(dir,{recursive:true,force:true});}
});
