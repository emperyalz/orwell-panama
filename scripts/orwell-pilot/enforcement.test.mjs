import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,mkdir,rm,chmod,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {admission,initializeAllocation} from './admission.mjs';
import {readCodexMeter} from './codex-meter.mjs';
import {receiptBudget,legalOutcome,finiteModelCeiling} from './receipts.mjs';

const fixture=async fn=>{const dir=await mkdtemp(join(tmpdir(),'orwell-admission-'));try{return await fn(dir);}finally{await rm(dir,{recursive:true,force:true});}};
const resetAt=Math.floor(Date.now()/1000)+86400;
const meter=async()=>({provider:'codex',observedAt:Date.now(),windows:[{id:'codex/primary',usedPercent:22,durationMinutes:10080,resetsAt:resetAt}]});

test('real admission refuses missing allocation, active leases and quota rollover',async()=>fixture(async directory=>{
 assert.equal((await admission({directory,meter,active:async()=>0})).allowed,false);
 await initializeAllocation({directory,meter,active:async()=>0});
 assert.equal((await admission({directory,meter,active:async()=>0})).allowed,true);
 assert.equal((await admission({directory,meter,active:async()=>1})).allowed,false);
 assert.equal((await admission({directory,meter,active:async()=>{throw Error('outage');}})).allowed,false);
 const p=JSON.parse(await readFile(join(directory,'policy.json'),'utf8'));
 p.allocationPercentagePoints=50;await writeFile(join(directory,'policy.json'),JSON.stringify(p));
 assert.equal((await admission({directory,meter,active:async()=>0})).allowed,false);
}));
test('reinitialization cannot silently renew an existing allocation',async()=>fixture(async directory=>{
 await initializeAllocation({directory,meter,active:async()=>0});
 await assert.rejects(initializeAllocation({directory,meter,active:async()=>0}),/EEXIST/);
}));
test('missing and interrupted run accounting blocks further spending',async()=>fixture(async directory=>{
 await mkdir(join(directory,'interrupted'));
 await writeFile(join(directory,'interrupted','execution.json'),'{}');
 let b=await receiptBudget(directory);assert.equal(b.unknownUsageRuns,1);assert.equal(b.exceeded,true);
 await writeFile(join(directory,'interrupted','receipt.json'),JSON.stringify({usage:{input_tokens:100,cached_input_tokens:80,output_tokens:5},finish:null,usagePersisted:true}));
 b=await receiptBudget(directory);assert.equal(b.tokens,105);assert.equal(b.unreconciledRuns,1);assert.equal(b.exceeded,true);
 await writeFile(join(directory,'interrupted','receipt.json'),JSON.stringify({usage:{input_tokens:100,cached_input_tokens:80,output_tokens:5},finish:{state:'qa_ready'},usagePersisted:false}));
 b=await receiptBudget(directory);assert.equal(b.unreconciledRuns,1);assert.equal(b.exceeded,true);
}));
test('work cannot self-accept and QA result must match the structured contract',()=>{
 const answer={result:'accepted',detail:'Evidence inspected',evidence:'artifact hash',team:'none'};
 assert.equal(legalOutcome('work',answer),false);
 assert.equal(legalOutcome('triage',answer),false);
 assert.equal(legalOutcome('qa',answer),true);
 assert.equal(legalOutcome('qa',{...answer,detail:''}),false);
 assert.equal(legalOutcome('qa',{...answer,team:'invented'}),false);
});

async function fakeServer(directory,{auth='chatgpt',hang=false}={}){
 const path=join(directory,'fake-codex.mjs');
 await writeFile(path,`#!/usr/bin/env node\nimport {createInterface} from 'node:readline';\ncreateInterface({input:process.stdin}).on('line',line=>{const q=JSON.parse(line);if(!q.id||${hang})return;let result={};if(q.method==='account/read')result={account:{type:${JSON.stringify(auth)},planType:'test'}};if(q.method==='account/rateLimits/read')result={rateLimits:{primary:{usedPercent:22,windowDurationMins:10080,resetsAt:Math.floor(Date.now()/1000)+86400}}};process.stdout.write(JSON.stringify({id:q.id,result})+'\\n');});\n`);
 await chmod(path,0o700);return path;
}
test('meter protocol accepts ChatGPT and rejects API-key auth without model calls',async()=>fixture(async dir=>{
 let command=await fakeServer(dir);const s=await readCodexMeter({command});
 assert.equal(s.authType,'chatgpt');assert.equal(s.windows[0].usedPercent,22);
 command=await fakeServer(dir,{auth:'apiKey'});
 await assert.rejects(readCodexMeter({command}),/API billing is disallowed/);
}));
test('unresponsive meter fails closed and cleans up its child',async()=>fixture(async dir=>{
 const command=await fakeServer(dir,{hang:true});
 await assert.rejects(readCodexMeter({command,timeoutMs:100}),/timed out/);
}));

test('admission automatically persists expired short reconciliation and retains original weekly baseline',async()=>fixture(async directory=>{
 const now=Date.now(),weekly={id:'week',durationMinutes:10080,resetsAt:Math.floor(now/1000)+86400,usedPercent:20};
 const short={id:'short',durationMinutes:300,resetsAt:Math.floor(now/1000)-1,usedPercent:90};
 const baseline={provider:'codex',observedAt:now-1000,windows:[weekly,short]};
 const policy={subscriptionOnly:true,allowPaidFallback:false,allocationPercentagePoints:30,reservePercentagePoints:3,startedAt:now-1000,endsAt:now+60000,baselines:{codex:baseline}};
 await writeFile(join(directory,'policy.json'),JSON.stringify(policy));
 const meter=async()=>({provider:'codex',observedAt:Date.now(),windows:[{...weekly,usedPercent:24},{...short,resetsAt:Math.floor(now/1000)+18000,usedPercent:2}]});
 assert.equal((await admission({directory,meter,active:async()=>0})).allowed,true);
 let saved=JSON.parse(await readFile(join(directory,'policy.json'),'utf8'));
 assert.deepEqual(saved.baselines.codex.windows[0],weekly);assert.equal(saved.shortWindowReconciliations.length,1);
 assert.equal((await admission({directory,meter,active:async()=>0})).allowed,true);
 saved=JSON.parse(await readFile(join(directory,'policy.json'),'utf8'));assert.equal(saved.shortWindowReconciliations.length,1);
}));


test('cache-aware receipt ceilings allow cached history but stop fresh spending',async()=>fixture(async directory=>{
 await mkdir(join(directory,'run'));
 const put=async(input,cached)=>writeFile(join(directory,'run','receipt.json'),JSON.stringify({usage:{input_tokens:input,cached_input_tokens:cached,output_tokens:0},finish:{state:'qa_ready'},usagePersisted:true}));
 await put(6_000_000,5_900_000);assert.equal((await receiptBudget(directory)).exceeded,false);
 await put(15_000_000,14_900_000);assert.equal((await receiptBudget(directory)).exceeded,true);
 await put(1_100_000,100_000);assert.equal((await receiptBudget(directory)).exceeded,true);
}));


test('finite run and since-acceptance limits remain independent of caching',()=>{
 const base={runs:23,tokens:14_999_999,freshTokens:999_999,withoutAcceptance:11};
 assert.equal(finiteModelCeiling(base),false);
 for(const tokens of [undefined,NaN,-1])assert.equal(finiteModelCeiling({...base,tokens}),true);
 for(const change of [{runs:24},{tokens:15_000_000},{freshTokens:1_000_000},{withoutAcceptance:12}])assert.equal(finiteModelCeiling({...base,...change}),true);
});
