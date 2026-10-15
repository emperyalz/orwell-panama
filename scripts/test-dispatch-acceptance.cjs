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

const finish=moduleRef.exports.finish.handler;
const revision='sha256:'+'a'.repeat(64),other='sha256:'+'b'.repeat(64);
const now=Date.now();
const item={_id:'item',key:'task/step',taskKey:'task',stepKey:'step',state:'qa_running',activeSessionId:'review-real',leaseId:'lease-123456789012',leaseUntil:now+60000,workerSessionId:'worker-real',contributorKey:'author',workerProvider:'codex',submissionRevision:revision,qaAttempt:0,acceptAttempt:0,attempt:0,team:'implementation'};
const reviewer={key:'qa',team:'qa',name:'Reviewer',status:'running',lastActivityAt:now,binding:{taskKey:'task',stepKey:'step',rosterKey:'qa',observedAt:now-100,evidence:'Actual claude CLI session review-real; lease lease-123456789012'}};
function context(data=item,review=reviewer,events=[{kind:'checkpoint',leaseId:item.leaseId,actor:'Reviewer',detail:'Actual QA session (run review-real)'}]){return {db:{query:table=>{let selected;return ({withIndex:(_index,callback)=>{if(callback)callback({eq(_field,value){selected=value;return this}});return ({unique:async()=>table==='projectDispatchItems'?data:table==='projectAgents'?(selected==='review-real'?{...review,key:'review-real',status:'completed'}:review):null,collect:async()=>table==='runtimeTeamPositions'?[{tier:'worker',team:'qa',runKeys:['qa']}]:table==='projectDispatchEvents'?events:[]})},collect:async()=>table==='runtimeTeamPositions'?[{tier:'worker',team:'qa',runKeys:['qa']}]:[]})},patch:async()=>{},insert:async()=>{}}};}
const args={itemKey:'task/step',leaseId:item.leaseId,phase:'qa',result:'accepted',detail:'Reviewed source',evidence:'Actual checks',sessionId:'review-real',reviewerKey:'qa',provider:'claude',artifactRevision:revision};
(async()=>{
 await assert.rejects(()=>finish(context(),{...args,sessionId:'worker-real'}),/own work|observed active session/);
 await assert.rejects(()=>finish(context(),{...args,provider:'codex'}),/different provider/);
 await assert.rejects(()=>finish(context(),{...args,artifactRevision:other}),/exact submitted revision/);
 await assert.rejects(()=>finish(context({...item,leaseUntil:now-1}),args),/Lease no longer/);
 await assert.rejects(()=>finish(context(item,{...reviewer,binding:{...reviewer.binding,evidence:'unrelated'}}),args),/fresh observed session/);
 await assert.rejects(()=>finish(context(item,reviewer,[]),args),/event history/);
 await assert.rejects(()=>finish(context(item,{...reviewer,lastActivityAt:now-600000}),args),/fresh observed session/);
 assert.equal((await finish(context(),args)).state,'accept_ready');
 assert.equal((await finish(context({...item,leaseId:undefined,lastFinishedLeaseId:args.leaseId,lastFinishedResult:'accepted',state:'accept_ready'}),args)).replayed,true);
 const accepted={...item,state:'accept_running',qaProvider:'claude',qaRevision:other,qaSessionId:'review-real',qaReviewerKey:'qa'};
 await assert.rejects(()=>finish(context(accepted),{...args,phase:'accept',sessionId:'controller:actual'}),/unchanged revision/);
 await assert.rejects(()=>finish(context({...item,lastFinishedLeaseId:args.leaseId,lastFinishedResult:'changes_requested'}),args),/different result/);
 // Replay actual saved native sessions at their measured completion times.
 if(fs.existsSync('/opt/orwell-evidence/session-contract.json')){
  const saved=JSON.parse(fs.readFileSync('/opt/orwell-evidence/session-contract.json','utf8'));
  for(const session of saved.agents.filter(a=>a.binding)){
   const roster=saved.agents.find(a=>a.key===session.binding.rosterKey);
   const measured=session.lastActivityAt,realLease=session.binding.evidence.match(/lease ([^;]+)/)[1];
   const isQa=session.team==='qa',phase=isQa?'qa':'work';
   const realItem={...item,key:`${session.binding.taskKey}/${session.binding.stepKey}`,taskKey:session.binding.taskKey,stepKey:session.binding.stepKey,state:isQa?'qa_running':'running',lead:'Rowan',team:'implementation',activeSessionId:session.key,leaseId:realLease,leaseUntil:measured+60000};
   const records=new Map(saved.agents.map(a=>[a.key,a]));
   const ctx={db:{query(table){let selected;const rows={unique:async()=>table==='projectDispatchItems'?realItem:records.get(selected),collect:async()=>table==='runtimeTeamPositions'?[{tier:'worker',team:roster.team,runKeys:[roster.key]}]:[{kind:'checkpoint',leaseId:realLease,actor:session.name,detail:`Actual saved session (run ${session.key})`}]};return {...rows,withIndex(_name,cb){const q={eq(_f,val){selected=val;return q}};cb(q);return rows}}},patch:async()=>{},insert:async()=>{}}};
   const originalNow=Date.now;Date.now=()=>measured;
   try{assert.equal((await finish(ctx,{...args,itemKey:realItem.key,leaseId:realLease,phase,result:isQa?'accepted':'submitted',sessionId:session.key,...(isQa?{reviewerKey:roster.key,provider:'claude'}:{contributorKey:roster.key,provider:'codex'})})).state,isQa?'accept_ready':'qa_ready');}finally{Date.now=originalNow;}
  }
 }
 // Persistent finite stops preserve user pauses and restrict model-ceiling bypass to acceptance.
 const stop=moduleRef.exports.stopPilot.handler,claim=moduleRef.exports.claimNext.handler;
 let monitor={_id:'monitor',dispatchPaused:false,pauseReason:{en:'',es:'',pt:''}};
 const stopCtx={db:{query:()=>({withIndex:()=>({unique:async()=>monitor})}),patch:async(_id,patch)=>{monitor={...monitor,...patch}}}};
 await stop(stopCtx,{reason:'24 runs reached',modelOnly:true});assert.equal(monitor.dispatchPaused,true);
 const ready={...item,state:'ready',taskKey:'task',stepKey:'step'};
 const accept={...ready,key:'task/final',stepKey:'final',state:'accept_ready'};
 let claimed;
 const claimCtx={db:{query:table=>table==='projectLeadMonitor'?{withIndex:()=>({unique:async()=>monitor})}:{collect:async()=>table==='projectDispatchItems'?[ready,accept].map(i=>({...i,leaseUntil:undefined})):[{key:'task',status:'doing',title:{en:'Task'},detail:{en:'Fixture'},checklist:[{key:'step',done:false},{key:'final',done:false}]}]},patch:async(id,patch)=>{claimed=patch},insert:async()=>{}}};
 assert.equal((await claim(claimCtx,{leaseId:'fixture-lease-123456'})).state,'paused');
 assert.equal((await claim(claimCtx,{leaseId:'fixture-lease-123456',reviewedAcceptanceOnly:true})).phase,'accept');assert.equal(claimed.state,'accept_running');
 monitor={...monitor,pauseReason:{en:'Eric paused dispatch',es:'Eric paused dispatch',pt:'Eric paused dispatch'}};
 await stop(stopCtx,{reason:'deadline reached',modelOnly:false});assert.ok(monitor.pauseReason.en.startsWith('Eric paused dispatch'));
 assert.equal((await claim(claimCtx,{leaseId:'fixture-lease-123456',reviewedAcceptanceOnly:true})).state,'paused');
 console.log('PASS self-review, wrong provider, stale revision, expired lease, unknown/stale/unobserved reviewer, contradictory replay and stale executive acceptance rejected; fresh exact-revision QA allowed');
})().catch(error=>{console.error(error);process.exitCode=1;});
