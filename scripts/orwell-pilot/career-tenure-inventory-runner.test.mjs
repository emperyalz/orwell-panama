import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';
import {buildCareerTenureInventory,readCareerTenureSources,renderCareerTenureArtifacts,validateCareerTenureInventory,prepareCareerTenureArtifacts,persistCareerTenureArtifacts,runCareerTenureInventoryJob,CAREER_TENURE_ITEM,CAREER_TENURE_SOURCES,CAREER_TENURE_OUTPUTS} from './career-tenure-inventory-runner.mjs';

const require=createRequire(import.meta.url),fixture=require('../../docs/accepted-career-histories-2026-10-08.json');
const componentPath=join(process.cwd(),'src/components/reference/CareerHistory.tsx');
const hash=value=>createHash('sha256').update(value).digest('hex');
async function workspace(){const root=await mkdtemp(join(tmpdir(),'career-tenure-'));for(const path of CAREER_TENURE_SOURCES.slice(0,2)){const target=join(root,path);await mkdir(join(target,'..'),{recursive:true});await writeFile(target,path.endsWith('.json')?JSON.stringify(fixture):await readFile(componentPath));}return root;}
function policy(){return {enabled:true,provider:'groq',allowPaidFallback:false,sourceAuditOnly:true,itemKeys:[CAREER_TENURE_ITEM],authorModel:'openai/gpt-oss-120b',reviewerModel:'qwen/qwen3.8-27b',maxTokensPerMinute:8000,maxTokensPerRequest:7600,sourcePaths:CAREER_TENURE_SOURCES,allowedPaths:CAREER_TENURE_OUTPUTS};}
function mockClient({qaAccepted=true,sessionId=null}={}){const calls=[];return {calls,async complete(args){calls.push(args);const data=JSON.parse(args.messages[1].content),isQa=data.phase==='qa',output=JSON.stringify(isQa?{accepted:qaAccepted,issues:qaAccepted?[]:['deliberate test issue']}:{memo:`Batch ${data.batchIndex+1} covers supplied recorded date rows only.`});return {provider:'groq',model:args.model,requestId:randomUUID(),sessionId:sessionId??randomUUID(),usage:{total_tokens:120},rateLimitHeaders:{},outputSha256:hash(output),inputSha256:args.inputSha256,output};}};}
function authors(){return Array.from({length:6},(_,index)=>({provider:'groq',model:'openai/gpt-oss-120b',sessionId:`author-${index}`,memo:`Batch ${index+1} covers supplied recorded date rows only.`}));}

test('deterministically covers all fixture rows and derives fallback categories from current UI maps',async()=>{
 const root=await workspace();try{const loaded=await readCareerTenureSources(root),inventory=buildCareerTenureInventory({fixture,component:(await readFile(componentPath,'utf8')),sourceFiles:loaded.files,sourceHash:loaded.sourceHash});
  assert.equal(inventory.metrics.factCount,32);assert.equal(inventory.metrics.unknownEndCount,6);assert.deepEqual(inventory.metrics.fallbackCategories,['dated_office_status_evidence','inauguration_event','party_founder','party_leadership','presidential_candidacy','presidential_precandidacy']);assert.equal(Object.keys(inventory.metrics.categoryGroups).length,13);assert.equal(inventory.sources[2].present,false);assert.equal(validateCareerTenureInventory(inventory,{fixture,component:await readFile(componentPath,'utf8'),sourceFiles:loaded.files,sourceHash:loaded.sourceHash}).valid,true);
 }finally{await rm(root,{recursive:true,force:true});}
});

test('artifact output is deterministic, all facts retain source/date fields, and validator script parses without executing it',async()=>{
 const root=await workspace();try{const prepared=await prepareCareerTenureArtifacts({workspace:root,sourceRevision:(await readCareerTenureSources(root)).sourceHash,notes:['A constrained note.']});assert.equal(Object.keys(prepared.artifacts).length,3);const json=JSON.parse(prepared.artifacts[CAREER_TENURE_OUTPUTS[0]]);assert.equal(json.facts.length,32);assert.ok(json.facts.every(f=>Array.isArray(f.sourceURLs)&&typeof f.datePrecision==='string'&&Object.hasOwn(f,'endDate')));const require=createRequire(import.meta.url);assert.doesNotThrow(()=>new (require('node:vm').Script)(prepared.artifacts[CAREER_TENURE_OUTPUTS[2]]));assert.equal(prepared.artifactHash.length,64);assert.equal(prepared.artifacts[CAREER_TENURE_OUTPUTS[1]].includes('original item'),false);
 }finally{await rm(root,{recursive:true,force:true});}
});

test('one Groq work call handles one batch and returns a receipt without claiming checklist completion',async()=>{
 const root=await workspace();try{const loaded=await readCareerTenureSources(root),client=mockClient(),result=await runCareerTenureInventoryJob({client,policy:policy(),item:{key:CAREER_TENURE_ITEM},phase:'work',workspace:root,sourceRevision:loaded.sourceHash,batchIndex:0});assert.equal(client.calls.length,1);assert.equal(client.calls[0].model,'openai/gpt-oss-120b');assert.equal(result.receipt.provider,'groq');assert.equal(result.done,false);assert.equal(result.validation.factCount,32);assert.equal(result.originalItemCompleted,false);
 }finally{await rm(root,{recursive:true,force:true});}
});

test('QA reopens persisted JSON, Markdown and script and binds bytes to exact author hash',async()=>{
 const root=await workspace();try{const loaded=await readCareerTenureSources(root),notes=authors().map(x=>x.memo),prepared=await prepareCareerTenureArtifacts({workspace:root,sourceRevision:loaded.sourceHash,notes});await persistCareerTenureArtifacts(root,prepared.artifacts);const client=mockClient();const result=await runCareerTenureInventoryJob({client,policy:policy(),item:{key:CAREER_TENURE_ITEM,authorNotes:notes,authorBatches:authors(),artifactHash:prepared.artifactHash,submissionRevision:prepared.validation.combinedHash},phase:'qa',workspace:root,sourceRevision:loaded.sourceHash,batchIndex:1});assert.equal(result.qa.accepted,true);assert.equal(client.calls[0].model,'qwen/qwen3.8-27b');assert.equal(client.calls[0].reasoningEffort,'none');const input=JSON.parse(client.calls[0].messages[1].content);assert.equal(input.sourceRows.length,6);assert.equal(input.persistedInventoryRows.length,6);assert.deepEqual(input.sourceRows,input.persistedInventoryRows);assert.equal(input.artifactHash,prepared.artifactHash);assert.equal(result.originalItemCompleted,false);
 }finally{await rm(root,{recursive:true,force:true});}
});

test('QA refuses modified artifact bytes, model identity collapse, and changed source revision before inference',async()=>{
 const root=await workspace();try{const loaded=await readCareerTenureSources(root),notes=authors().map(x=>x.memo),prepared=await prepareCareerTenureArtifacts({workspace:root,sourceRevision:loaded.sourceHash,notes});await persistCareerTenureArtifacts(root,prepared.artifacts);const qaItem={key:CAREER_TENURE_ITEM,authorNotes:notes,authorBatches:authors(),artifactHash:prepared.artifactHash,submissionRevision:prepared.validation.combinedHash};const client=mockClient();await writeFile(join(root,CAREER_TENURE_OUTPUTS[1]),'tampered');await assert.rejects(runCareerTenureInventoryJob({client,policy:policy(),item:qaItem,phase:'qa',workspace:root,sourceRevision:loaded.sourceHash,batchIndex:0}),/artifact bytes differ/);assert.equal(client.calls.length,0);const bad=policy();bad.reviewerModel=bad.authorModel;await assert.rejects(runCareerTenureInventoryJob({client,policy:bad,item:{key:CAREER_TENURE_ITEM},phase:'work',workspace:root,sourceRevision:loaded.sourceHash,batchIndex:0}),/distinct author and reviewer/);await assert.rejects(runCareerTenureInventoryJob({client,policy:policy(),item:{key:CAREER_TENURE_ITEM},phase:'work',workspace:root,sourceRevision:'0'.repeat(64),batchIndex:0}),/source hash changed/);assert.equal(client.calls.length,0);
 }finally{await rm(root,{recursive:true,force:true});}
});

test('QA changes are surfaced as requested changes and never converted to acceptance',async()=>{
 const root=await workspace();try{const loaded=await readCareerTenureSources(root),notes=authors().map(x=>x.memo),prepared=await prepareCareerTenureArtifacts({workspace:root,sourceRevision:loaded.sourceHash,notes});await persistCareerTenureArtifacts(root,prepared.artifacts);const result=await runCareerTenureInventoryJob({client:mockClient({qaAccepted:false}),policy:policy(),item:{key:CAREER_TENURE_ITEM,authorNotes:notes,authorBatches:authors(),artifactHash:prepared.artifactHash,submissionRevision:prepared.validation.combinedHash},phase:'qa',workspace:root,sourceRevision:loaded.sourceHash,batchIndex:0});assert.equal(result.qa.accepted,false);assert.deepEqual(result.qa.issues,['deliberate test issue']);assert.equal(result.originalItemCompleted,false);
 }finally{await rm(root,{recursive:true,force:true});}
});

test('QA rejects a session reused from any author batch or prior QA batch',async()=>{
 const root=await workspace();try{const loaded=await readCareerTenureSources(root),notes=authors().map(x=>x.memo),prepared=await prepareCareerTenureArtifacts({workspace:root,sourceRevision:loaded.sourceHash,notes});await persistCareerTenureArtifacts(root,prepared.artifacts);const item={key:CAREER_TENURE_ITEM,authorNotes:notes,authorBatches:authors(),artifactHash:prepared.artifactHash,submissionRevision:prepared.validation.combinedHash,priorQaSessions:['prior-qa-1']};
  await assert.rejects(runCareerTenureInventoryJob({client:mockClient({sessionId:'author-4'}),policy:policy(),item,phase:'qa',workspace:root,sourceRevision:loaded.sourceHash,batchIndex:0}),/distinct from every author and prior QA/);
  await assert.rejects(runCareerTenureInventoryJob({client:mockClient({sessionId:'prior-qa-1'}),policy:policy(),item,phase:'qa',workspace:root,sourceRevision:loaded.sourceHash,batchIndex:0}),/distinct from every author and prior QA/);
 }finally{await rm(root,{recursive:true,force:true});}
});

test('all six author and QA batch prompts fit bounded completion reservations with maximum author memo',async()=>{
 const root=await workspace();try{const loaded=await readCareerTenureSources(root),client=mockClient(),notes=Array.from({length:6},()=> 'm'.repeat(700));
  for(let index=0;index<6;index++){const result=await runCareerTenureInventoryJob({client,policy:policy(),item:{key:CAREER_TENURE_ITEM,authorNotes:notes.slice(0,index)},phase:'work',workspace:root,sourceRevision:loaded.sourceHash,batchIndex:index});assert.equal(result.batchCount,6);assert.ok(client.calls.at(-1).estimatedPromptTokens+client.calls.at(-1).maxCompletionTokens<=7600);assert.ok(client.calls.at(-1).maxCompletionTokens>=768);assert.equal(client.calls.at(-1).reasoningEffort,'low');}
  const prepared=await prepareCareerTenureArtifacts({workspace:root,sourceRevision:loaded.sourceHash,notes});await persistCareerTenureArtifacts(root,prepared.artifacts);const authorBatches=authors().map(row=>({...row,memo:'m'.repeat(700)}));
  for(let index=0;index<6;index++){await runCareerTenureInventoryJob({client,policy:policy(),item:{key:CAREER_TENURE_ITEM,authorNotes:notes,authorBatches,artifactHash:prepared.artifactHash,submissionRevision:prepared.validation.combinedHash},phase:'qa',workspace:root,sourceRevision:loaded.sourceHash,batchIndex:index});assert.ok(client.calls.at(-1).estimatedPromptTokens+client.calls.at(-1).maxCompletionTokens<=7600);assert.ok(client.calls.at(-1).maxCompletionTokens>=384);assert.equal(client.calls.at(-1).reasoningEffort,'none');}
  assert.equal(client.calls.length,12);
 }finally{await rm(root,{recursive:true,force:true});}
});

test('rejects invalid item, broad or missing path grants, same-model review and unsupported phase',async()=>{
 const root=await workspace();try{const sourceHash=(await readCareerTenureSources(root)).sourceHash,client=mockClient();for(const changes of [{item:{key:'other/item'}},{policy:{...policy(),itemKeys:['anything']}},{policy:{...policy(),sourcePaths:['../secrets']}},{policy:{...policy(),sourcePaths:CAREER_TENURE_SOURCES.slice(0,2)}},{phase:'accept'}]){const args={client,policy:policy(),item:{key:CAREER_TENURE_ITEM},phase:'work',workspace:root,sourceRevision:sourceHash,batchIndex:0,...changes};await assert.rejects(runCareerTenureInventoryJob(args));}assert.equal(client.calls.length,0);
 }finally{await rm(root,{recursive:true,force:true});}
});
