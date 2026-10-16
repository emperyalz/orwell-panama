import test from 'node:test';
import assert from 'node:assert/strict';
import {estimatePromptTokens,rollingWindowWaitMs,GROQ_FREE_MODELS} from './groq-free-client.mjs';

test('free client only exposes the two models that passed account qualification',()=>{
 assert.deepEqual(GROQ_FREE_MODELS,['openai/gpt-oss-120b','qwen/qwen3.8-27b']);
});

test('prompt bound covers serialized UTF-8 content and framing',()=>{
 const messages=[{role:'user',content:'career history: é and 🧭'}];
 assert.ok(estimatePromptTokens(messages)>=Buffer.byteLength(JSON.stringify(messages),'utf8')+48);
 assert.throws(()=>estimatePromptTokens([]),/messages/);
});

test('rolling TPM wait uses injected timestamps and naturally expires old reservations',()=>{
 const base=1_800_000_000_000;
 const events=[{at:base-59_000,tokens:5000},{at:base-20_000,tokens:2000}];
 assert.equal(rollingWindowWaitMs(events,base,2000),1_000);
 assert.equal(rollingWindowWaitMs(events,base+41_001,2000),0);
 assert.equal(rollingWindowWaitMs([],base,7600),0);
 assert.equal(rollingWindowWaitMs([{at:base-1_000,tokens:1000}],base,7600),59_000);
});

import {mkdtemp,readFile,writeFile,mkdir,rm,stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {createGroqFreeClient} from './groq-free-client.mjs';

async function fixture(t,{fetchImpl,clock=()=>Date.now(),sleepImpl=async()=>{},onRequestState=async()=>{}}={}){
 const root=await mkdtemp(join(tmpdir(),'groq-client-test-')),keyPath=join(root,'key'),stateDir=join(root,'state');await mkdir(stateDir,{mode:0o700});await writeFile(keyPath,'test-key\n',{mode:0o600});
 t.after(()=>rm(root,{recursive:true,force:true}));
 const client=createGroqFreeClient({keyPath,stateDir,fetchImpl,clock,sleepImpl,testMode:true,dailyMaxTokens:10000,maxTokensPerRequest:7600,onRequestState});
 return {client,stateDir,keyPath};
}
function request(messages=[{role:'user',content:'hello'}]){const input=JSON.stringify(messages);return {model:'openai/gpt-oss-120b',messages,taskId:'test/task',inputSha256:createHash('sha256').update(input).digest('hex'),estimatedPromptTokens:estimatePromptTokens(messages),maxCompletionTokens:200};}
function response({status=200,headers={},usage={prompt_tokens:20,completion_tokens:10,total_tokens:30},content='ok'}={}){return new Response(JSON.stringify({model:'openai/gpt-oss-120b',usage,choices:[{message:{content}}]}),{status,headers:{'content-type':'application/json','x-request-id':'req-test',...headers}});}

test('complete persists actual receipt and admission is read-only',async t=>{
 let calls=0;const {client,stateDir}=await fixture(t,{fetchImpl:async()=>{calls++;return response();}});const before=await client.admission({estimatedTokens:300,model:'openai/gpt-oss-120b'});assert.equal(before.allowed,true);assert.equal(calls,0);
 const receipt=await client.complete(request());assert.equal(receipt.provider,'groq');assert.equal(receipt.model,'openai/gpt-oss-120b');assert.equal(receipt.usage.total_tokens,30);assert.equal(receipt.completed,true);assert.equal(receipt.productAccepted,false);assert.equal(calls,1);
 const saved=JSON.parse((await readFile(join(stateDir,'usage.jsonl'),'utf8')).trim());assert.equal(saved.requestId,'req-test');assert.equal(saved.usage.total_tokens,30);
});

test('unknown network outcome retains its conservative reservation in daily and minute ledgers',async t=>{
 const {client,stateDir}=await fixture(t,{fetchImpl:async()=>{throw Error('socket closed after request send');}});await assert.rejects(client.complete(request()),e=>e.name==='GroqFreeRateLimitError'&&e.receipt?.httpStatus===null&&e.receipt?.completed===false);
 const state=JSON.parse(await readFile(join(stateDir,'groq-free-budget.json'),'utf8'));assert.equal(state.usedRequests,1);assert.equal(state.usedTokens,estimatePromptTokens(request().messages)+200);assert.equal(state.minuteEvents[0].tokens,state.usedTokens);assert.ok((await readFile(join(stateDir,'usage.jsonl'),'utf8')).includes('socket closed'));
});

test('HTTP 429 records provider retry and never falls back to another model',async t=>{
 let calls=0;const {client,stateDir}=await fixture(t,{fetchImpl:async()=>{calls++;return response({status:429,headers:{'retry-after':'2','x-ratelimit-remaining-tokens':'0'}});}});await assert.rejects(client.complete(request()),e=>e.retryAfterMs===2000&&e.receipt?.provider==='groq');assert.equal(calls,1);const state=JSON.parse(await readFile(join(stateDir,'groq-free-budget.json'),'utf8'));assert.equal(state.usedRequests,1);assert.equal(state.minuteEvents[0].tokens,0);
});

test('stale token headers expire after one bounded wait and do not recurse on unchanged headers',async t=>{
 let now=1_800_000_000_000,calls=0,waits=0;const {client,stateDir}=await fixture(t,{clock:()=>now,sleepImpl:async ms=>{waits++;now+=ms;},fetchImpl:async()=>{calls++;return response();}});const day=new Date(now).toISOString().slice(0,10),messages=request().messages;const state={schema:1,day,usedRequests:0,usedTokens:0,minuteEvents:[],models:{'openai/gpt-oss-120b':{observedAt:now,rateLimitHeaders:{'x-ratelimit-remaining-tokens':'0','x-ratelimit-reset-tokens':'2s'}}},pending:null};await writeFile(join(stateDir,'groq-free-budget.json'),JSON.stringify(state));await client.complete(request(messages));assert.equal(waits,1);assert.equal(calls,1);
});

test('zero provider requests with no reset duration fail closed',async t=>{
 let calls=0;const now=1_800_000_000_000,{client,stateDir}=await fixture(t,{clock:()=>now,fetchImpl:async()=>{calls++;return response();}});const day=new Date(now).toISOString().slice(0,10);await writeFile(join(stateDir,'groq-free-budget.json'),JSON.stringify({schema:1,day,usedRequests:0,usedTokens:0,minuteEvents:[],models:{'openai/gpt-oss-120b':{observedAt:now,rateLimitHeaders:{'x-ratelimit-remaining-requests':'0'}}},pending:null}));await assert.rejects(client.complete(request()),e=>e.name==='GroqFreeRateLimitError'&&e.retryAfterMs===null);assert.equal(calls,0);
});


test('active lifecycle starts only after the actual fetch call begins',async t=>{
 let calls=0;const events=[];const {client}=await fixture(t,{fetchImpl:async()=>{calls++;return response();},onRequestState:async event=>{events.push(event.status);if(event.status==='running')assert.equal(calls,1);}});await client.complete(request());assert.deepEqual(events,['running','completed']);
});
