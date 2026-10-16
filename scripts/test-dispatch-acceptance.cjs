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
const item={_id:'item',key:'task/step',taskKey:'task',stepKey:'step',state:'qa_running',lead:'Rowan',activeSessionId:'review-real',leaseId:'lease-123456789012',leaseUntil:now+60000,workerSessionId:'worker-real',contributorKey:'author',workerProvider:'codex',submissionRevision:revision,qaAttempt:0,acceptAttempt:0,attempt:0,team:'implementation'};
const reviewer={key:'qa',team:'qa',name:'Reviewer',status:'running',lastActivityAt:now,binding:{taskKey:'task',stepKey:'step',rosterKey:'qa',observedAt:now-100,evidence:'Actual claude CLI session review-real; lease lease-123456789012'}};
function context(data=item,review=reviewer,events=[{kind:'checkpoint',leaseId:item.leaseId,actor:'Reviewer',detail:'Actual QA session (run review-real)'}]){return {db:{query:table=>{let selected;return ({withIndex:(_index,callback)=>{if(callback)callback({eq(_field,value){selected=value;return this}});return ({unique:async()=>table==='projectDispatchItems'?data:table==='projectAgents'?(selected==='review-real'?{...review,key:'review-real',status:'completed'}:review):null,collect:async()=>table==='runtimeTeamPositions'?[{tier:'worker',team:'qa',runKeys:['qa']}]:table==='projectDispatchEvents'?events:[]})},collect:async()=>table==='runtimeTeamPositions'?[{tier:'worker',team:'qa',runKeys:['qa']}]:[]})},patch:async()=>{},insert:async()=>{}}};}
const args={itemKey:'task/step',leaseId:item.leaseId,phase:'qa',result:'accepted',detail:'Reviewed source',evidence:'Actual checks',sessionId:'review-real',reviewerKey:'qa',provider:'claude',artifactRevision:revision};
(async()=>{
 await assert.rejects(()=>finish(context(),{...args,sessionId:'worker-real'}),/own work|observed active session/);
 await assert.rejects(()=>finish(context(),{...args,provider:'codex'}),/different provider/);
 await assert.rejects(()=>finish(context(),{...args,artifactRevision:other}),/exact submitted revision/);
 await assert.rejects(()=>finish(context({...item,leaseUntil:now-1}),args),/Lease no longer/);
 await assert.rejects(()=>finish(context({...item,leaseId:'reassigned-lease-123456',activeSessionId:'new-session'}),args),/Lease no longer/,'A prior lease cannot finish after reassignment');
 await assert.rejects(()=>finish(context(item,{...reviewer,binding:{...reviewer.binding,evidence:'unrelated'}}),args),/fresh observed session/);
 await assert.rejects(()=>finish(context(item,reviewer,[]),args),/event history/);
 await assert.rejects(()=>finish(context(item,{...reviewer,lastActivityAt:now-600000}),args),/fresh observed session/);
 const rejectionPatches=[];const rejectedContext=context();rejectedContext.db.patch=async(id,patch)=>rejectionPatches.push({id,patch});
 const rejection={...args,result:'changes_requested',detail:'Please correct the gap',evidence:'Add the missing stale-revision assertion and verify it fails before approval'};
 assert.equal((await finish(rejectedContext,rejection)).state,'ready');
 const returned=rejectionPatches.find(p=>p.id==='item').patch;
 assert.equal(returned.lead,'Rowan','QA rejection must preserve the original implementation owner');
 assert.match(returned.nextAction,/stale-revision assertion/,'Actionable QA findings must be returned to the owner');
 assert.match(returned.checkpoint,/return to Rowan/);
 await assert.rejects(()=>finish(context(),{...rejection,evidence:'Needs changes'}),/actionable findings/,'Vague rejection must not return work without actionable findings');
 assert.equal((await finish(context(),args)).state,'accept_ready');
 const replayed=await finish(context({...item,leaseId:undefined,lastFinishedLeaseId:args.leaseId,lastFinishedResult:'accepted',state:'accept_ready'}),args);
 assert.equal(replayed.replayed,true);
 assert.equal((await finish(context({...item,leaseId:undefined,lastFinishedLeaseId:args.leaseId,lastFinishedResult:'accepted',state:'accept_ready'}),args)).state,'accept_ready','Same receipt replay remains idempotent');
 const proof={itemKey:item.key,leaseId:item.leaseId,revision,checksHash:revision,deploymentHash:other,deploymentUrl:'https://prod.convex.cloud',checks:['pilot','live-contract','acceptance','pause','typecheck','original-policy'].map(name=>({name,code:0}))};
 const accepted={...item,state:'accept_running',activeSessionId:`controller:${item.leaseId}`,qaProvider:'claude',qaRevision:revision,qaSessionId:'review-real',qaReviewerKey:'qa',leaseUntil:now+60000};
 await assert.rejects(()=>finish(context(accepted),{...args,phase:'accept',sessionId:'review-real',artifactRevision:revision,evidence:'Review passed'}),/trusted controller/,'Reviewer cannot directly complete task');
 await assert.rejects(()=>finish(context(accepted),{...args,phase:'accept',sessionId:`controller:${item.leaseId}`,artifactRevision:revision,evidence:'Deterministic acceptance: checks complete'}),/deployment evidence/,'Checks without deployment cannot complete task');
 await assert.rejects(()=>finish(context({...accepted,qaRevision:other}),{...args,phase:'accept',acceptanceProof:proof,sessionId:`controller:${item.leaseId}`,artifactRevision:revision,evidence:'Deterministic acceptance: checks complete; deployment https://prod; tests checks passed'}),/unchanged reviewed source revision/,'Stale review revision cannot complete task');
 await assert.rejects(()=>finish(context(),{...args,reviewerKey:'author'}),/fresh observed session/,'Author cannot act as QA');
 for(const patch of [{revision:other},{leaseId:'other'},{checksHash:'invented'},{checks:proof.checks.map(c=>({...c,code:1}))}])await assert.rejects(()=>finish(context(accepted),{...args,phase:'accept',sessionId:`controller:${item.leaseId}`,acceptanceProof:{...proof,...patch}}),/saved deterministic checks/);
 await assert.rejects(()=>finish(context({...item,lastFinishedLeaseId:args.leaseId,lastFinishedResult:'changes_requested'}),args),/different result/);
 const successfulCtx=context(accepted),query=successfulCtx.db.query;const patches=[];
 successfulCtx.db.query=table=>{if(table==='projectTasks')return {withIndex:()=>({unique:async()=>({_id:'task',status:'doing',checklist:[{key:'step',done:false}]})})};if(table==='projectAgents')return {withIndex:(_name,cb)=>{let key;cb({eq(_field,value){key=value;return this}});return {unique:async()=>key==='author'?{key:'author',name:'Author',team:'implementation'}:{key:'qa',name:'Reviewer',team:'qa'}}}};return query(table);};
 successfulCtx.db.patch=async(id,patch)=>patches.push({id,patch});
 assert.equal((await finish(successfulCtx,{...args,phase:'accept',sessionId:`controller:${item.leaseId}`,acceptanceProof:proof})).state,'accepted');
 assert.equal(patches.find(p=>p.id==='item').patch.deploymentRevision,revision);
 assert.equal(patches.find(p=>p.id==='task').patch.checklist[0].review.reviewerKey,'qa');
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
 console.log('PASS independent different-provider QA, exact revision and observed reviewer; actionable rejection returns to Rowan; vague rejection, stale acceptance, replay conflicts and unobserved review rejected');
})().catch(error=>{console.error(error);process.exitCode=1;});
