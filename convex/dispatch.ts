import {internalMutation,internalQuery,query} from './_generated/server';
import type {MutationCtx} from './_generated/server';
import {v} from 'convex/values';
import {compareDispatchPriority} from './dispatchPriority';

const ROOT='01a09321-0212-73f0-b32b-c3045945d6c6';
const LEASE_MS=5*60_000;
const STALL_MS=2*60_000;
const MAX_RETRIES=3;
const phase=v.union(v.literal('triage'),v.literal('work'),v.literal('qa'),v.literal('accept'));
const result=v.union(v.literal('submitted'),v.literal('changes_requested'),v.literal('accepted'),v.literal('needs_input'),v.literal('failed'));
const brief=(s:string)=>s.trim().slice(0,3000);
const key=(taskKey:string,stepKey:string)=>`${taskKey}/${stepKey}`;
const event=async(ctx:MutationCtx,itemKey:string,kind:string,actor:string,detail:string,leaseId?:string)=>ctx.db.insert('projectDispatchEvents',{itemKey,kind,actor,detail:brief(detail),at:Date.now(),...(leaseId?{leaseId}:{})});

/** Reconcile the durable queue with the live checklist, without changing recorded work. */
export const sync=internalMutation({args:{},handler:async ctx=>{
 const [tasks,readiness,items]=await Promise.all([ctx.db.query('projectTasks').collect(),ctx.db.query('projectStepExecution').collect(),ctx.db.query('projectDispatchItems').collect()]);
 const old=new Map(items.map(i=>[i.key,i]));const ready=new Map(readiness.map(r=>[key(r.taskKey,r.stepKey),r]));let inserted=0,closed=0,routed=0;
 for(const task of tasks){if(task.status==='superseded')continue;for(const step of task.checklist??[]){const itemKey=key(task.key,step.key),prior=old.get(itemKey);if(step.done){if(prior&&prior.state!=='accepted'){await ctx.db.patch(prior._id,{state:'accepted',acceptedAt:step.completedAt??Date.now(),leaseId:undefined,leaseUntil:undefined,activeActorName:undefined,activeActorKey:undefined,activeSessionId:undefined,updatedAt:Date.now()});await event(ctx,itemKey,'already_completed','scoreboard','Checklist step was completed outside this dispatcher');closed++;}continue;}
  if(prior){
   if(!prior.leaseId&&prior.state==='ready'&&prior.lead==='Orion'&&['research','implementation'].includes(prior.team)){
    const lead=prior.team==='research'?'Iris':'Rowan';
    await ctx.db.patch(prior._id,{lead,updatedAt:Date.now()});
    await event(ctx,itemKey,'routing_repaired','Orion',`${lead} inherited the already recorded ${prior.team} team route; no new model run required`);
    routed++;
   }
   if(!prior.leaseId&&prior.label!==step.label.en)await ctx.db.patch(prior._id,{label:step.label.en,updatedAt:Date.now()});
   continue;
  }
  const r=ready.get(itemKey);const blocked=r?.readiness==='blocked'||r?.readiness==='waiting_input'||r?.readiness==='waiting_review';
  const state=blocked?'blocked':'triage_ready';
  await ctx.db.insert('projectDispatchItems',{key:itemKey,taskKey:task.key,stepKey:step.key,label:step.label.en,acceptance:step.label.en,lead:'Orion',team:'implementation',state,attempt:0,qaAttempt:0,acceptAttempt:0,blockedReason:blocked?(r?.reason?.en??`Existing readiness: ${r?.readiness}`):undefined,nextAction:blocked?'Resolve the recorded prerequisite before dispatch':undefined,createdAt:Date.now(),updatedAt:Date.now()});
  await event(ctx,itemKey,'queued','Orion',state==='triage_ready'?'Awaiting Orion readiness and team routing':state==='blocked'?'Existing prerequisite blocks execution':'Ready for assignment');inserted++;
 }}
 return {inserted,closed,routed,total:items.length+inserted};
}});

/** A finite stop never releases an existing user pause. Only model ceilings permit final non-model acceptance. */
export const stopPilot=internalMutation({args:{reason:v.string(),modelOnly:v.boolean()},handler:async(ctx,args)=>{
 const monitor=await ctx.db.query('projectLeadMonitor').withIndex('by_key',q=>q.eq('key',ROOT)).unique();
 if(!monitor)throw Error('Monitor unavailable');
 if(monitor.dispatchPaused&&!monitor.pauseReason.en.startsWith('Pilot model ceiling:')){
  if(!monitor.pauseReason.en.includes('Pilot finite stop:'))await ctx.db.patch(monitor._id,{pauseReason:{en:brief(`${monitor.pauseReason.en}; Pilot finite stop: ${args.reason}`),es:brief(`${monitor.pauseReason.es}; Pilot finite stop: ${args.reason}`),pt:brief(`${monitor.pauseReason.pt}; Pilot finite stop: ${args.reason}`)}});
  return {preserved:true};
 }
 const reason=brief(`${args.modelOnly?'Pilot model ceiling:':'Pilot budget/deadline stop:'} ${args.reason}`);
 await ctx.db.patch(monitor._id,{dispatchPaused:true,pauseReason:{en:reason,es:reason,pt:reason}});
 return {preserved:false};
}});

/** One atomic claim across all runners. Production is serialized until admission is load-tested. */
export const claimNext=internalMutation({args:{leaseId:v.string(),smokeItemKey:v.optional(v.string()),onlyItemKeys:v.optional(v.array(v.string())),reviewedAcceptanceOnly:v.optional(v.boolean())},handler:async(ctx,{leaseId,smokeItemKey,onlyItemKeys,reviewedAcceptanceOnly})=>{
 if(!/^[a-zA-Z0-9-]{16,100}$/.test(leaseId))throw Error('Valid unique lease ID required');
 if(smokeItemKey&&!/^[a-z0-9-]+\/[a-z0-9-]+$/.test(smokeItemKey))throw Error('Smoke item key must identify one bounded checklist step');
 const monitor=await ctx.db.query('projectLeadMonitor').withIndex('by_key',q=>q.eq('key',ROOT)).unique();
 if(!monitor||(monitor.dispatchPaused&&!(reviewedAcceptanceOnly&&monitor.pauseReason.en.startsWith('Pilot model ceiling:'))))return {state:'paused' as const,reason:monitor?.pauseReason.en??'Monitor unavailable'};
 const now=Date.now(),[all,tasks]=await Promise.all([ctx.db.query('projectDispatchItems').collect(),ctx.db.query('projectTasks').collect()]);
 if(all.some(i=>i.leaseUntil&&i.leaseUntil>now))return {state:'busy' as const};
 const taskByKey=new Map(tasks.map(task=>[task.key,task]));
 const priority=(i:typeof all[number])=>{const task=taskByKey.get(i.taskKey);return {...i,taskStatus:task?.status,taskOrder:task?.order,stepOrder:task?.checklist?.findIndex(step=>step.key===i.stepKey)};};
 const item=all.filter(i=>(!reviewedAcceptanceOnly||i.state==='accept_ready')&&['qa_ready','accept_ready','ready','triage_ready'].includes(i.state)&&['doing','todo'].includes(taskByKey.get(i.taskKey)?.status??'')&&taskByKey.get(i.taskKey)?.checklist?.some(step=>step.key===i.stepKey&&!step.done)&&(!smokeItemKey||i.key===smokeItemKey)&&(!onlyItemKeys||onlyItemKeys.includes(i.key))&&(!i.retryAt||i.retryAt<=now)).sort((a,b)=>compareDispatchPriority(priority(a),priority(b))).at(0);
 if(!item)return {state:'empty' as const};
 const nextState=item.state==='qa_ready'?'qa_running':item.state==='accept_ready'?'accept_running':'running';
 const phase=item.state==='qa_ready'?'qa':item.state==='accept_ready'?'accept':item.lead==='Orion'?'triage':'work';
 await ctx.db.patch(item._id,{state:nextState,leaseId,leaseUntil:now+LEASE_MS,activeActorName:phase==='qa'?'Ada':phase==='work'?item.lead:'Orion',activeActorKey:undefined,activeSessionId:undefined,lastProgressAt:now,retryAt:undefined,updatedAt:now});
 await event(ctx,item.key,'assigned',phase==='qa'?'Ada':phase==='accept'||phase==='triage'?'Orion':item.lead,`Phase ${phase} assigned; attempt ${phase==='qa'?item.qaAttempt+1:phase==='accept'?item.acceptAttempt+1:item.attempt+1}`,leaseId);
 return {state:'claimed' as const,phase,leaseId,leaseUntil:now+LEASE_MS,item:{key:item.key,taskKey:item.taskKey,stepKey:item.stepKey,label:item.label,acceptance:item.acceptance,taskTitle:taskByKey.get(item.taskKey)?.title.en,taskDetail:taskByKey.get(item.taskKey)?.detail.en,taskStatus:taskByKey.get(item.taskKey)?.status,lead:item.lead,team:item.team,checkpoint:item.checkpoint,evidence:item.evidence,qaEvidence:item.qaEvidence,submissionRevision:item.submissionRevision,qaRevision:item.qaRevision,workerProvider:item.workerProvider,qaProvider:item.qaProvider,workerSessionId:item.workerSessionId,qaSessionId:item.qaSessionId,attempt:item.attempt,qaAttempt:item.qaAttempt,acceptAttempt:item.acceptAttempt}};
}});

export const checkpoint=internalMutation({args:{itemKey:v.string(),leaseId:v.string(),checkpoint:v.string(),sessionId:v.optional(v.string()),actorName:v.optional(v.string()),actorKey:v.optional(v.string())},handler:async(ctx,args)=>{
 const item=await ctx.db.query('projectDispatchItems').withIndex('by_key',q=>q.eq('key',args.itemKey)).unique();
 if(!item||item.leaseId!==args.leaseId||!item.leaseUntil||item.leaseUntil<=Date.now()||!['running','qa_running','accept_running'].includes(item.state))throw Error('Lease no longer owns this step');
 if(!args.checkpoint.trim())throw Error('Substantive checkpoint required');
 const now=Date.now();await ctx.db.patch(item._id,{checkpoint:brief(args.checkpoint),...(args.sessionId?{activeSessionId:args.sessionId}:{}),...(item.state==='running'&&item.lead!=='Orion'&&args.sessionId?{workerSessionId:args.sessionId}:{}),...(args.actorName?{activeActorName:args.actorName}:{}),...(args.actorKey?{activeActorKey:args.actorKey}:{}),leaseUntil:now+LEASE_MS,lastProgressAt:now,updatedAt:now});
 await event(ctx,item.key,'checkpoint',args.actorName??'runner',`${args.checkpoint}${args.sessionId?` (run ${args.sessionId})`:''}`,args.leaseId);return {leaseUntil:now+LEASE_MS};
}});

export const renewLease=internalMutation({args:{itemKey:v.string(),leaseId:v.string()},handler:async(ctx,args)=>{
 const item=await ctx.db.query('projectDispatchItems').withIndex('by_key',q=>q.eq('key',args.itemKey)).unique();
 if(!item||item.leaseId!==args.leaseId||!item.leaseUntil||item.leaseUntil<=Date.now()||!['running','qa_running','accept_running'].includes(item.state))throw Error('Lease no longer owns this step');
 const until=Date.now()+LEASE_MS;await ctx.db.patch(item._id,{leaseUntil:until,updatedAt:Date.now()});return {leaseUntil:until};
}});

/** Attribute model traffic to the actual leased run before its result is recorded. */
export const recordUsage=internalMutation({args:{itemKey:v.string(),leaseId:v.string(),sessionId:v.string(),model:v.string(),inputTokens:v.number(),cachedInputTokens:v.number(),outputTokens:v.number(),totalTokens:v.number()},handler:async(ctx,args)=>{
 const item=await ctx.db.query('projectDispatchItems').withIndex('by_key',q=>q.eq('key',args.itemKey)).unique();
 if(!item||item.leaseId!==args.leaseId||item.activeSessionId!==args.sessionId)throw Error('Usage must belong to the active leased run');
 if([args.inputTokens,args.cachedInputTokens,args.outputTokens,args.totalTokens].some(n=>!Number.isSafeInteger(n)||n<0)||args.cachedInputTokens>args.inputTokens)throw Error('Invalid token usage');
 const detail=`${args.model}: ${args.totalTokens} total tokens (${args.inputTokens} input, ${args.cachedInputTokens} cached input, ${args.outputTokens} output). Token counts are not a dollar cost.`;
 await event(ctx,item.key,'usage',args.sessionId,detail,args.leaseId);
 return {recorded:true};
}});

export const finish=internalMutation({args:{itemKey:v.string(),leaseId:v.string(),phase,result,detail:v.string(),evidence:v.optional(v.string()),sessionId:v.optional(v.string()),contributorKey:v.optional(v.string()),reviewerKey:v.optional(v.string()),provider:v.optional(v.union(v.literal('codex'),v.literal('claude'))),artifactRevision:v.optional(v.string()),acceptanceProof:v.optional(v.object({itemKey:v.string(),leaseId:v.string(),revision:v.string(),checksHash:v.string(),deploymentHash:v.string(),deploymentUrl:v.string(),checks:v.array(v.object({name:v.string(),code:v.number()}))})),team:v.optional(v.union(v.literal('research'),v.literal('implementation')))},handler:async(ctx,args)=>{
 const item=await ctx.db.query('projectDispatchItems').withIndex('by_key',q=>q.eq('key',args.itemKey)).unique();
 if(item?.lastFinishedLeaseId===args.leaseId){if(item.lastFinishedResult!==args.result)throw Error('Lease already finished with a different result');return {state:item.state,replayed:true};}
 if(!item||item.leaseId!==args.leaseId||!item.leaseUntil||item.leaseUntil<=Date.now())throw Error('Lease no longer owns this step');
 const actualPhase=item.state==='qa_running'?'qa':item.state==='accept_running'?'accept':item.state==='running'?(item.lead==='Orion'?'triage':'work'):null;
 if(!actualPhase||actualPhase!==args.phase)throw Error('Finish phase does not match active lease');
 if(!args.detail.trim())throw Error('A bounded result detail is required');
 if(['work','qa'].includes(args.phase)&&!['failed','needs_input'].includes(args.result)&&(!args.sessionId||args.sessionId!==item.activeSessionId))throw Error('Result must name the observed active session');
 const now=Date.now(),base={lastFinishedLeaseId:args.leaseId,lastFinishedResult:args.result,leaseId:undefined,leaseUntil:undefined,activeActorName:undefined,activeActorKey:undefined,activeSessionId:undefined,lastProgressAt:now,updatedAt:now};
 if(args.phase==='triage'){
  if(args.result==='failed'){const next=item.attempt+1,exhausted=next>=2;await ctx.db.patch(item._id,{...base,state:exhausted?'blocked':'triage_ready',attempt:next,retryAt:exhausted?undefined:now+Math.min(60_000*2**Math.min(next,6),60*60_000),checkpoint:brief(args.detail),blockedReason:exhausted?brief(`Orion routing failed twice: ${args.detail}`):undefined,nextAction:exhausted?'Repair the routing failure and explicitly return this step to the queue':undefined});await event(ctx,item.key,exhausted?'triage_exhausted':'triage_retry','Orion',args.detail,args.leaseId);return {state:exhausted?'blocked':'triage_ready'};}
  if(args.result==='needs_input'){await ctx.db.patch(item._id,{...base,state:'blocked',blockedReason:brief(args.detail),nextAction:brief(args.evidence??'Eric or a lead must clarify this item')});await event(ctx,item.key,'blocked','Orion',args.detail,args.leaseId);return {state:'blocked'};}
  if(args.result!=='submitted'||!args.team)throw Error('Orion triage must choose a team or state a prerequisite');
  const lead=args.team==='research'?'Iris':'Rowan';await ctx.db.patch(item._id,{...base,state:'ready',team:args.team,lead,acceptance:brief(args.evidence??item.acceptance),checkpoint:brief(args.detail)});await event(ctx,item.key,'routed','Orion',`${lead}: ${args.detail}`,args.leaseId);return {state:'ready'};
 }
 if(args.result==='needs_input'){await ctx.db.patch(item._id,{...base,state:'blocked',blockedReason:brief(args.detail),nextAction:brief(args.evidence??'Resolve prerequisite and return to ready')});await event(ctx,item.key,'blocked',item.lead,args.detail,args.leaseId);return {state:'blocked'};}
 if(args.result==='failed'){
  const attempt=args.phase==='qa'?item.qaAttempt+1:args.phase==='accept'?item.acceptAttempt+1:item.attempt+1;
  const retryState=args.phase==='qa'?'qa_ready' as const:args.phase==='accept'?'accept_ready' as const:'ready' as const;
  const exhausted=attempt>=MAX_RETRIES;
  const patch={...base,state:exhausted?'blocked' as const:retryState,checkpoint:brief(args.detail),retryAt:exhausted?undefined:now+Math.min(60_000*2**Math.min(attempt-1,6),60*60_000),blockedReason:exhausted?brief(`${args.phase} failed ${attempt} times: ${args.detail}`):undefined,nextAction:exhausted?'Orion must inspect the failed runs and choose a concrete repair or fallback before releasing this step':undefined,...(args.phase==='qa'?{qaAttempt:attempt}:args.phase==='accept'?{acceptAttempt:attempt}:{attempt})};
  await ctx.db.patch(item._id,patch);await event(ctx,item.key,exhausted?'retry_exhausted':'retry_scheduled',args.sessionId??'runner',args.detail,args.leaseId);return {state:patch.state};
 }
 if(args.phase==='work'){
  if(args.result!=='submitted'||!args.evidence?.trim()||!args.sessionId||!args.contributorKey)throw Error('Work submission requires evidence, actual run session and a roster contributor');
  if(!args.provider||!args.artifactRevision||!/^sha256:[a-f0-9]{64}$/.test(args.artifactRevision))throw Error('Submission requires a measured revision and provider');
  const contributor=await ctx.db.query('projectAgents').withIndex('by_key',q=>q.eq('key',args.contributorKey!)).unique();
  const position=(await ctx.db.query('runtimeTeamPositions').collect()).find(p=>p.tier==='worker'&&p.team===item.team&&p.runKeys.includes(args.contributorKey!));
  const session=await ctx.db.query('projectAgents').withIndex('by_key',q=>q.eq('key',args.sessionId!)).unique();
  if(!contributor||!position||contributor.team!==item.team||!contributor.name.trim()||!session||session.key!==args.sessionId||session.name!==contributor.name||session.team!==item.team||!['running','completed'].includes(session.status)||session.lastActivityAt<now-LEASE_MS||session.lastActivityAt>now||session.binding?.taskKey!==item.taskKey||session.binding?.stepKey!==item.stepKey||session.binding?.rosterKey!==args.contributorKey||session.binding.observedAt>now||session.binding.observedAt<now-LEASE_MS||!session.binding.evidence.includes(args.sessionId!)||!session.binding.evidence.includes(args.leaseId))throw Error('Contributor must have a fresh observed session bound to this exact checklist step');
  const observed=await ctx.db.query('projectDispatchEvents').withIndex('by_item_time',q=>q.eq('itemKey',item.key)).collect();
  if(!observed.some(e=>e.kind==='checkpoint'&&e.leaseId===args.leaseId&&e.actor===contributor.name&&e.detail.includes(`(run ${args.sessionId})`)))throw Error('Contributor session must appear in this lease event history');
  await ctx.db.patch(item._id,{...base,state:'qa_ready',attempt:item.attempt+1,evidence:brief(args.evidence),checkpoint:brief(args.detail),workerSessionId:args.sessionId,contributorKey:args.contributorKey,workerProvider:args.provider,submissionRevision:args.artifactRevision,qaRevision:undefined,qaProvider:undefined,qaEvidence:undefined,qaReviewerKey:undefined,qaSessionId:undefined});await event(ctx,item.key,'submitted',args.contributorKey,`${args.detail} (run ${args.sessionId})`,args.leaseId);return {state:'qa_ready'};
 }
 if(args.phase==='qa'){
  if(!args.sessionId||!args.reviewerKey)throw Error('Independent QA needs an actual run session and named reviewer');
  if(args.sessionId===item.workerSessionId)throw Error('Author cannot approve own work');
  if(!args.provider||args.provider===item.workerProvider||!item.submissionRevision||args.artifactRevision!==item.submissionRevision)throw Error('QA requires a different provider and the exact submitted revision');
  const reviewer=await ctx.db.query('projectAgents').withIndex('by_key',q=>q.eq('key',args.reviewerKey!)).unique();
  const position=(await ctx.db.query('runtimeTeamPositions').collect()).find(p=>p.tier==='worker'&&p.team==='qa'&&p.runKeys.includes(args.reviewerKey!));
  const session=await ctx.db.query('projectAgents').withIndex('by_key',q=>q.eq('key',args.sessionId!)).unique();
  if(!reviewer||!position||reviewer.team!=='qa'||!reviewer.name.trim()||args.reviewerKey===item.contributorKey||!session||session.key!==args.sessionId||session.name!==reviewer.name||session.team!=='qa'||!['running','completed'].includes(session.status)||session.lastActivityAt<now-LEASE_MS||session.lastActivityAt>now||session.binding?.taskKey!==item.taskKey||session.binding?.stepKey!==item.stepKey||session.binding?.rosterKey!==args.reviewerKey||session.binding.observedAt>now||session.binding.observedAt<now-LEASE_MS||!session.binding.evidence.includes(args.sessionId!)||!session.binding.evidence.includes(args.leaseId))throw Error('QA must have a fresh observed session bound to this exact checklist step');
  const observed=await ctx.db.query('projectDispatchEvents').withIndex('by_item_time',q=>q.eq('itemKey',item.key)).collect();
  if(!observed.some(e=>e.kind==='checkpoint'&&e.leaseId===args.leaseId&&e.actor===reviewer.name&&e.detail.includes(`(run ${args.sessionId})`)))throw Error('QA session must appear in this lease event history');
  if(args.result==='changes_requested'){const exhausted=item.qaAttempt+1>=MAX_RETRIES;await ctx.db.patch(item._id,{...base,state:exhausted?'blocked':'ready',blockedReason:exhausted?'Three independent QA rejections; lead must choose a concrete next approach':undefined,qaAttempt:item.qaAttempt+1,checkpoint:brief(args.detail),qaEvidence:brief(args.evidence??args.detail),qaReviewerKey:args.reviewerKey,qaSessionId:args.sessionId,qaProvider:args.provider,qaRevision:undefined});await event(ctx,item.key,'changes_requested',args.reviewerKey,`${args.detail} (run ${args.sessionId})`,args.leaseId);return {state:exhausted?'blocked':'ready'};}
  if(args.result!=='accepted'||!args.evidence?.trim())throw Error('QA must accept with evidence or request changes');
  await ctx.db.patch(item._id,{...base,state:'accept_ready',qaAttempt:item.qaAttempt+1,qaEvidence:brief(args.evidence),qaReviewerKey:args.reviewerKey,qaSessionId:args.sessionId,qaProvider:args.provider,qaRevision:args.result==='accepted'?args.artifactRevision:undefined});await event(ctx,item.key,'qa_accepted',args.reviewerKey,`${args.detail} (run ${args.sessionId})`,args.leaseId);return {state:'accept_ready'};
 }
 if(args.phase==='accept'){
  if(args.result==='changes_requested'){await ctx.db.patch(item._id,{...base,state:'ready',acceptAttempt:item.acceptAttempt+1,checkpoint:brief(args.detail)});await event(ctx,item.key,'executive_returned',args.sessionId??'Orion',args.detail,args.leaseId);return {state:'ready'};}
  if(args.result!=='accepted'||args.sessionId!==`controller:${args.leaseId}`||!args.acceptanceProof)throw Error('Only the trusted controller may finalize after deterministic checks and deployment evidence');
  if(item.state!=='accept_running'||item.activeSessionId!==args.sessionId)throw Error('Controller acceptance must use the active acceptance lease');
  if(!/^sha256:[a-f0-9]{64}$/.test(args.artifactRevision??'')||args.artifactRevision!==item.submissionRevision||args.artifactRevision!==item.qaRevision)throw Error('Controller acceptance requires the unchanged reviewed source revision');
  const proof=args.acceptanceProof,required=['pilot','live-contract','acceptance','pause','typecheck','original-policy'];
  if(proof.itemKey!==item.key||proof.leaseId!==args.leaseId||proof.revision!==args.artifactRevision||![proof.checksHash,proof.deploymentHash].every(h=>/^sha256:[a-f0-9]{64}$/.test(h))||!/^https:\/\/[^\s/]+$/.test(proof.deploymentUrl)||proof.checks.length!==required.length||required.some(name=>proof.checks.filter(c=>c.name===name&&c.code===0).length!==1))throw Error('Controller acceptance requires successful saved deterministic checks and production deployment records');
  if(args.result!=='accepted'||!args.sessionId||!args.evidence?.trim()||!item.qaReviewerKey||!item.qaSessionId||!item.workerSessionId||!item.contributorKey)throw Error('Orion acceptance requires independent QA and actual run evidence');
  if(!item.submissionRevision||item.qaRevision!==item.submissionRevision||args.artifactRevision!==item.submissionRevision||!item.workerProvider||!item.qaProvider||item.workerProvider===item.qaProvider)throw Error('Acceptance requires unchanged revision and independent provider QA');
  const task=await ctx.db.query('projectTasks').withIndex('by_key',q=>q.eq('key',item.taskKey)).unique();const step=task?.checklist?.find(s=>s.key===item.stepKey);
  const contributor=await ctx.db.query('projectAgents').withIndex('by_key',q=>q.eq('key',item.contributorKey!)).unique();
  const reviewer=await ctx.db.query('projectAgents').withIndex('by_key',q=>q.eq('key',item.qaReviewerKey!)).unique();
  if(!task||!step||step.done||!contributor||!reviewer||reviewer.team!=='qa'||contributor.key===reviewer.key)throw Error('Live step and separately recorded contributor and QA identity required');
  const checklist=task.checklist!.map(s=>s.key===item.stepKey?{...s,done:true,evidence:`${item.evidence}; QA: ${item.qaEvidence}; Orion: ${args.evidence}`,completedAt:now,completedBy:[contributor.name],completedByKeys:[contributor.key],review:{reviewerKey:reviewer.key,reviewedAt:now,evidence:item.qaEvidence!,outcome:'accepted' as const}}:s);
  const allDone=checklist.every(s=>s.done);
  await ctx.db.patch(task._id,{checklist,status:allDone?'done':task.status==='todo'?'doing':task.status,updatedAt:now,...(allDone?{completedAt:now,evidence:`All checklist steps accepted; latest: ${args.evidence}`}:{})});
  await ctx.db.patch(item._id,{...base,deterministicRevision:proof.revision,deterministicEvidence:JSON.stringify({hash:proof.checksHash,checks:proof.checks,leaseId:proof.leaseId}),deploymentRevision:proof.revision,deploymentEvidence:JSON.stringify({hash:proof.deploymentHash,url:proof.deploymentUrl,leaseId:proof.leaseId}),state:'accepted',acceptedAt:now,acceptAttempt:item.acceptAttempt+1});await event(ctx,item.key,'accepted',args.sessionId,args.detail,args.leaseId);return {state:'accepted'};
 }
 throw Error('Unsupported result');
}});

/** A watchdog changes only expired leases, so a late result cannot overwrite reassigned work. */
export const recoverExpired=internalMutation({args:{},handler:async ctx=>{
 const now=Date.now(),items=await ctx.db.query('projectDispatchItems').collect();let recovered=0;
 for(const item of items.filter(i=>i.leaseId&&i.leaseUntil&&(i.leaseUntil<=now||now-(i.lastProgressAt??i.updatedAt??i.leaseUntil!)>=STALL_MS))){
  const state=item.state==='qa_running'?'qa_ready':item.state==='accept_running'?'accept_ready':item.lead==='Orion'?'triage_ready':'ready';
  const runEvidence=item.activeSessionId?` (run ${item.activeSessionId})`:'';const stalled=now<item.leaseUntil!;const detail=stalled?`Run stalled: no substantive checkpoint for ${Math.floor((now-(item.lastProgressAt??item.updatedAt??item.leaseUntil!))/1000)}s; lease renewed only for process liveness. Preserved: ${item.checkpoint??'no saved checkpoint'}${runEvidence}`:`Lease expired after ${new Date(item.leaseUntil!).toISOString()}; preserved: ${item.checkpoint??'no saved checkpoint'}${runEvidence}`;
  await ctx.db.patch(item._id,{state,leaseId:undefined,leaseUntil:undefined,activeActorName:undefined,activeActorKey:undefined,activeSessionId:undefined,checkpoint:brief(detail),retryAt:now+60_000,updatedAt:now});await event(ctx,item.key,stalled?'run_stalled':'lease_expired','watchdog',detail,item.leaseId);recovered++;
 }
 return {recovered};
}});

/** One-time recovery of the first paused claim made with the wrong phase. */
export const repairFirstClaim=internalMutation({args:{},handler:async ctx=>{
 const item=await ctx.db.query('projectDispatchItems').withIndex('by_key',q=>q.eq('key','lead-orchestration-accountability/lead')).unique();
 if(!item||item.state!=='running'||item.lead!=='Orion'||!item.leaseId)return {repaired:false};
 const oldLease=item.leaseId;
 await ctx.db.patch(item._id,{state:'triage_ready',leaseId:undefined,leaseUntil:undefined,activeActorName:undefined,activeActorKey:undefined,activeSessionId:undefined,workerSessionId:undefined,checkpoint:'Incorrect pre-fix worker run terminated. Orion triage is required before assigning work.',retryAt:undefined,updatedAt:Date.now()});
 await event(ctx,item.key,'phase_repaired','watchdog','Wrong-phase Lin run was terminated; prior lease invalidated and step returned to Orion triage',oldLease);
 return {repaired:true};
}});

/** Trusted operator recovery after confirming the runner and child process are gone. */
export const recoverAbandoned=internalMutation({args:{itemKey:v.string(),leaseId:v.string(),reason:v.string()},handler:async(ctx,args)=>{
 if(!args.reason.trim())throw Error('Recovery reason required');
 const item=await ctx.db.query('projectDispatchItems').withIndex('by_key',q=>q.eq('key',args.itemKey)).unique();
 if(!item||item.leaseId!==args.leaseId||!item.leaseUntil||item.leaseUntil<=Date.now()||!['running','qa_running','accept_running'].includes(item.state))throw Error('Specified active lease no longer exists');
 const next=item.state==='qa_running'?'qa_ready':item.state==='accept_running'?'accept_ready':item.lead==='Orion'?'triage_ready':'ready';
 await ctx.db.patch(item._id,{state:next,leaseId:undefined,leaseUntil:undefined,activeActorName:undefined,activeActorKey:undefined,activeSessionId:undefined,checkpoint:brief(args.reason),retryAt:undefined,updatedAt:Date.now()});
 await event(ctx,item.key,'abandoned_recovered','watchdog',args.reason,args.leaseId);
 return {state:next};
}});

export const activeLease=internalQuery({args:{itemKey:v.string()},handler:async(ctx,{itemKey})=>{
 const item=await ctx.db.query('projectDispatchItems').withIndex('by_key',q=>q.eq('key',itemKey)).unique();
 return item?{state:item.state,leaseId:item.leaseId,leaseUntil:item.leaseUntil}:null;
}});

/** Acceptance can be revoked by concrete later evidence; retain the audit trail. */
export const reopenRejectedAcceptance=internalMutation({args:{itemKey:v.string(),reason:v.string(),evidence:v.string()},handler:async(ctx,args)=>{
 if(!args.reason.trim()||!args.evidence.trim())throw Error('Concrete rejection and evidence required');
 const item=await ctx.db.query('projectDispatchItems').withIndex('by_key',q=>q.eq('key',args.itemKey)).unique();
 if(!item||item.leaseId||item.state!=='accepted')throw Error('Only an unleased accepted item can be reopened');
 const task=await ctx.db.query('projectTasks').withIndex('by_key',q=>q.eq('key',item.taskKey)).unique();
 if(!task?.checklist?.some(s=>s.key===item.stepKey))throw Error('Original checklist step missing');
 const now=Date.now();
 const checklist=task.checklist.map(s=>s.key===item.stepKey?{key:s.key,label:s.label,done:false,evidence:brief(`Prior acceptance revoked: ${args.reason}. ${args.evidence}`)}:s);
 await ctx.db.patch(task._id,{checklist,status:'doing',completedAt:undefined,updatedAt:now});
 await ctx.db.patch(item._id,{state:'ready',acceptedAt:undefined,qaRevision:undefined,qaEvidence:brief(`${args.reason}. ${args.evidence}`),checkpoint:brief('Concrete post-review defect requires implementation repair and fresh independent QA'),lastFinishedLeaseId:undefined,lastFinishedResult:undefined,updatedAt:now});
 await event(ctx,item.key,'acceptance_revoked','controller',`${args.reason}. ${args.evidence}`);
 return {state:'ready'};
}});

/** Recovery is an observation, never a fabricated final token count or approval. */
export const recordInterruptedReconciliation=internalMutation({args:{itemKey:v.string(),leaseId:v.string(),sessionId:v.string(),detail:v.string()},handler:async(ctx,args)=>{
 const history=await ctx.db.query('projectDispatchEvents').withIndex('by_item_time',q=>q.eq('itemKey',args.itemKey)).collect();
 if(!history.some(e=>e.kind==='checkpoint'&&e.leaseId===args.leaseId&&e.detail.includes(`(run ${args.sessionId})`)))throw Error('Actual interrupted session must be recorded on this lease');
 await event(ctx,args.itemKey,'interrupted_usage_reconciled',args.sessionId,args.detail,args.leaseId);
 return {recorded:true};
}});

/** Internal prerequisite resolution requires a fresh worker and a new QA decision. */
export const releaseResolvedPrerequisite=internalMutation({args:{itemKey:v.string(),evidence:v.string()},handler:async(ctx,args)=>{
 if(!args.evidence.trim())throw Error('Concrete prerequisite resolution required');
 const item=await ctx.db.query('projectDispatchItems').withIndex('by_key',q=>q.eq('key',args.itemKey)).unique();
 if(!item||item.leaseId||!['ready','blocked','qa_ready','accept_ready'].includes(item.state))throw Error('Only unleased open work may resume');
 await ctx.db.patch(item._id,{state:'ready',lead:item.team==='research'?'Iris':'Rowan',blockedReason:undefined,nextAction:undefined,retryAt:undefined,qaRevision:undefined,checkpoint:brief(args.evidence),updatedAt:Date.now()});
 await event(ctx,item.key,'prerequisite_resolved','controller',args.evidence);
 return {state:'ready'};
}});

/** Return an internally resolved deployment handoff to Ada without inventing a new run. */
export const resumeVerifiedHandoff=internalMutation({args:{itemKey:v.string(),workerSessionId:v.string(),contributorKey:v.string(),evidence:v.string()},handler:async(ctx,args)=>{
 if(!args.evidence.trim()||args.evidence.length>3000)throw Error('Deployment or prerequisite resolution evidence is required');
 const item=await ctx.db.query('projectDispatchItems').withIndex('by_key',q=>q.eq('key',args.itemKey)).unique();
 if(!item||item.state!=='blocked'||item.leaseId)throw Error('Only an unleased blocked item may resume');
 const agent=await ctx.db.query('projectAgents').withIndex('by_key',q=>q.eq('key',args.contributorKey)).unique();
 const position=(await ctx.db.query('runtimeTeamPositions').collect()).find(p=>p.tier==='worker'&&p.team===item.team&&p.runKeys.includes(args.contributorKey));
 if(!agent||!position||agent.team!==item.team)throw Error('Contributor must be a recorded worker on this team');
 const history=await ctx.db.query('projectDispatchEvents').withIndex('by_item_time',q=>q.eq('itemKey',item.key)).collect();
 if(!history.some(e=>e.kind==='checkpoint'&&e.detail.includes(`(run ${args.workerSessionId})`)))throw Error('The named actual CLI session must appear in this item\'s observed event history');
 await ctx.db.patch(item._id,{state:'qa_ready',workerSessionId:args.workerSessionId,contributorKey:args.contributorKey,evidence:brief(args.evidence),blockedReason:undefined,nextAction:undefined,updatedAt:Date.now()});
 await event(ctx,item.key,'handoff_resolved',args.contributorKey,`${args.evidence} (run ${args.workerSessionId})`);
 return {state:'qa_ready'};
}});

/** Recheck an unchanged submitted run after a deployment-only QA rejection. */
export const resumeVerifiedRelease=internalMutation({args:{itemKey:v.string(),workerSessionId:v.string(),contributorKey:v.string(),evidence:v.string()},handler:async(ctx,args)=>{
 if(!args.evidence.trim()||args.evidence.length>3000||!args.evidence.includes('https://'))throw Error('Concrete production deployment evidence is required');
 const item=await ctx.db.query('projectDispatchItems').withIndex('by_key',q=>q.eq('key',args.itemKey)).unique();
 if(!item||item.state!=='ready'||item.leaseId||item.workerSessionId!==args.workerSessionId||item.contributorKey!==args.contributorKey)throw Error('Only the same unleased worker submission rejected by QA may resume');
 const agent=await ctx.db.query('projectAgents').withIndex('by_key',q=>q.eq('key',args.contributorKey)).unique();
 const position=(await ctx.db.query('runtimeTeamPositions').collect()).find(p=>p.tier==='worker'&&p.team===item.team&&p.runKeys.includes(args.contributorKey));
 if(!agent||!position||agent.team!==item.team)throw Error('Contributor must still be a recorded worker on this team');
 const history=await ctx.db.query('projectDispatchEvents').withIndex('by_item_time',q=>q.eq('itemKey',item.key)).collect();
 const lastDecision=[...history].reverse().find(e=>['changes_requested','submitted','qa_accepted','accepted'].includes(e.kind));
 if(lastDecision?.kind!=='changes_requested'||!history.some(e=>e.kind==='submitted'&&e.actor===args.contributorKey&&e.detail.includes(`(run ${args.workerSessionId})`)))throw Error('A rejected submission from this actual worker session is required');
 await ctx.db.patch(item._id,{state:'qa_ready',evidence:brief(`${item.evidence??''} Release: ${args.evidence}`),checkpoint:brief('Production release verified; Ada must repeat independent QA'),qaEvidence:undefined,qaReviewerKey:undefined,qaSessionId:undefined,retryAt:undefined,updatedAt:Date.now()});
 await event(ctx,item.key,'release_resubmitted',args.contributorKey,`${args.evidence} (run ${args.workerSessionId})`);
 return {state:'qa_ready'};
}});

export const snapshot=query({args:{},handler:async ctx=>{
 const [items,events,tasks]=await Promise.all([ctx.db.query('projectDispatchItems').collect(),ctx.db.query('projectDispatchEvents').withIndex('by_time').order('desc').take(100),ctx.db.query('projectTasks').collect()]);
 const taskByKey=new Map(tasks.map(task=>[task.key,task]));
 return {items:items.map(({key,taskKey,stepKey,label,lead,team,state,attempt,qaAttempt,acceptAttempt,leaseUntil,activeActorName,activeActorKey,activeSessionId,lastProgressAt,retryAt,checkpoint,blockedReason,nextAction,updatedAt,createdAt,acceptedAt,supersededBy,supersededAt})=>({key,taskKey,stepKey,label,lead,team,state,attempt,qaAttempt,acceptAttempt,leaseUntil,activeActorName,activeActorKey,activeSessionId,lastProgressAt,retryAt,checkpoint,blockedReason,nextAction,updatedAt,createdAt,acceptedAt,supersededBy,supersededAt,taskStatus:taskByKey.get(taskKey)?.status,taskTitle:taskByKey.get(taskKey)?.title,taskOrder:taskByKey.get(taskKey)?.order})),events:events.map(({itemKey,kind,actor,at,detail})=>({itemKey,kind,actor,at,detail}))};
}});
