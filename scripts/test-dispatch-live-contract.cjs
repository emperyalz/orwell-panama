/* eslint-disable @typescript-eslint/no-require-imports -- This CommonJS harness evaluates transpiled Convex handlers in a VM. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const ts=require('typescript');
const moduleRef={exports:{}};
const validator=new Proxy({}, {get:()=>()=>({})});
const source=ts.transpileModule(fs.readFileSync('convex/dispatch.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
vm.runInNewContext(source,{module:moduleRef,exports:moduleRef.exports,Date,require:name=>{
 if(name==='./_generated/server')return {internalMutation:x=>x,internalQuery:x=>x,query:x=>x};
 if(name==='convex/values')return {v:validator};
 if(name==='./dispatchPriority')return {compareDispatchPriority:()=>0};
 throw Error(name);
}});

const finish=moduleRef.exports.finish.handler,now=Date.now(),rev='sha256:'+'c'.repeat(64),lease='fixture-lease-123456';
const stableAuthor={key:'author',name:'Lin',team:'implementation',status:'completed',lastActivityAt:now-86400000,binding:null};
const stableReviewer={key:'reviewer',name:'Rawls',team:'qa',status:'completed',lastActivityAt:now-86400000,binding:null};
const run=(key,rosterKey,team,name)=>({key,name,team,status:'completed',lastActivityAt:now-100,binding:{taskKey:'task',stepKey:'step',rosterKey,observedAt:now-100,evidence:`Actual CLI session ${key}; lease ${lease}`}});
const worker=run('worker-real','author','implementation','Lin'),review=run('review-real','reviewer','qa','Rawls');
function context(item,omitRun=false){
 const agents=new Map([['author',stableAuthor],['reviewer',stableReviewer],...(omitRun?[]:[['worker-real',worker],['review-real',review]])]);
 return {db:{query(table){let selected;const row={unique:async()=>table==='projectDispatchItems'?item:table==='projectAgents'?agents.get(selected)??null:null,collect:async()=>table==='runtimeTeamPositions'?[{tier:'worker',team:'implementation',runKeys:['author']},{tier:'worker',team:'qa',runKeys:['reviewer']}]:table==='projectDispatchEvents'?[{kind:'checkpoint',leaseId:lease,actor:'Lin',detail:'Actual run (run worker-real)'},{kind:'checkpoint',leaseId:lease,actor:'Rawls',detail:'Actual run (run review-real)'}]:[]};return {...row,withIndex(_name,callback){if(callback){const q={eq(_field,value){selected=value;return q}};callback(q)}return row}}},patch:async()=>{},insert:async()=>{}}};
}
const base={_id:'item',key:'task/step',taskKey:'task',stepKey:'step',leaseId:lease,leaseUntil:now+60000,lead:'Rowan',team:'implementation',attempt:0,qaAttempt:0,acceptAttempt:0};
(async()=>{
 const workItem={...base,state:'running',activeSessionId:'worker-real'};
 const workArgs={itemKey:base.key,leaseId:lease,phase:'work',result:'submitted',detail:'Meaningful verified implementation',evidence:'Focused source and test evidence',sessionId:'worker-real',contributorKey:'author',provider:'codex',artifactRevision:rev};
 assert.equal((await finish(context(workItem),workArgs)).state,'qa_ready','A completed actual worker run is distinct from its historical roster identity');
 await assert.rejects(()=>finish(context(workItem,true),workArgs),/session|recorded|observed/,'A historical roster record cannot substitute for an actual run');
 const qaItem={...base,state:'qa_running',activeSessionId:'review-real',workerSessionId:'worker-real',contributorKey:'author',workerProvider:'codex',submissionRevision:rev};
 const qaArgs={itemKey:base.key,leaseId:lease,phase:'qa',result:'accepted',detail:'Independent checks passed',evidence:'Reopened source and ran checks',sessionId:'review-real',reviewerKey:'reviewer',provider:'claude',artifactRevision:rev};
 assert.equal((await finish(context(qaItem),qaArgs)).state,'accept_ready','Completed reviewer runs bind to stable identities without rewriting historical profiles');
 await assert.rejects(()=>finish(context(qaItem,true),qaArgs),/session|recorded|observed/);
 assert.equal(stableAuthor.binding,null);assert.equal(stableReviewer.binding,null);
 console.log('PASS actual completed CLI sessions, separate historical roster identities, and missing-run rejection match production telemetry semantics');
})().catch(error=>{console.error(error);process.exitCode=1;});
