import {query,internalMutation} from './_generated/server';
import {v} from 'convex/values';
import {leadMetrics} from './leadMetrics';
const text=v.object({en:v.string(),es:v.string(),pt:v.string()});
const readiness=v.union(v.literal('ready'),v.literal('waiting_input'),v.literal('waiting_review'),v.literal('blocked'),v.literal('unclassified'));
const ROOT='01a09321-0212-73f0-b32b-c3045945d6c6';
const FRESH=300_000;
const FULL_WHEN_PAUSED=600_000;

/** Trusted observation, not a dispatcher. Wait clocks begin when first observed. */
export const observe=internalMutation({args:{},handler:async ctx=>{
 const now=Date.now();
 let monitor=await ctx.db.query('projectLeadMonitor').withIndex('by_key',q=>q.eq('key',ROOT)).unique();
 // While dispatch is paused nothing claims work, so the wait clocks only need a full pass every
 // FULL_WHEN_PAUSED; the heartbeat alone keeps capacity freshness. Unpausing gets a full pass at once.
 if(monitor?.dispatchPaused&&now-(monitor.fullObservedAt??0)<FULL_WHEN_PAUSED){await ctx.db.patch(monitor._id,{observedAt:now});return {observed:0,heartbeat:true};}
 const [tasks,agents,records,dispatchItems]=await Promise.all([ctx.db.query('projectTasks').collect(),ctx.db.query('projectAgents').collect(),ctx.db.query('projectStepExecution').collect(),ctx.db.query('projectDispatchItems').collect()]);
 if(!monitor){const id=await ctx.db.insert('projectLeadMonitor',{key:ROOT,startedAt:now,observedAt:now,capacity:4,dispatchPaused:true,pauseReason:{en:'Eric paused new agent dispatches while discussing orchestration.',es:'Eric pausó nuevas asignaciones mientras revisa la coordinación.',pt:'Eric pausou novas atribuições enquanto discute a coordenação.'}});monitor=await ctx.db.get(id);}
 if(monitor)await ctx.db.patch(monitor._id,{observedAt:now,fullObservedAt:now});
 const indexed=new Map(records.map(row=>[`${row.taskKey}/${row.stepKey}`,row]));
 const active=agents.filter(agent=>agent.status==='running'&&now-agent.lastActivityAt<=FRESH&&agent.work?.assignmentEn===agent.assignment.en);
 let observed=0;
 for(const task of tasks.filter(task=>task.status==='doing'||task.status==='todo'||task.status==='blocked'))for(const step of task.checklist??[]){
  if(step.done)continue;
  const previous=indexed.get(`${task.key}/${step.key}`);
  const dispatched=dispatchItems.find(item=>item.taskKey===task.key&&item.stepKey===step.key&&item.leaseUntil&&item.leaseUntil>now&&['running','qa_running','accept_running'].includes(item.state));
  const ownerKeys=active.filter(agent=>agent.work?.tasks.some(work=>work.taskKey===task.key&&work.stepKeys.includes(step.key))).map(agent=>agent.key).sort();
  if(dispatched?.activeSessionId&&!ownerKeys.length)ownerKeys.push(dispatched.activeSessionId);
  const waitingSince=ownerKeys.length?undefined:previous?.waitingSince??now;
  const handoffAt=ownerKeys.length?undefined:previous?.ownerKeys.length?now:previous?.handoffAt;
  const value={taskKey:task.key,stepKey:step.key,firstObservedAt:previous?.firstObservedAt??now,observedAt:now,ownerKeys,waitingSince,handoffAt,readiness:previous?.readiness??'unclassified' as const};
  // An unchanged row is only re-stamped every FULL_WHEN_PAUSED: each patch re-runs every snapshot subscriber.
  const unchanged=previous&&previous.waitingSince===value.waitingSince&&previous.handoffAt===value.handoffAt&&previous.ownerKeys.join()===value.ownerKeys.join()&&now-previous.observedAt<FULL_WHEN_PAUSED;
  if(previous){
   if(!unchanged)await ctx.db.patch(previous._id,value);
  }else await ctx.db.insert('projectStepExecution',value);
  observed++;
 }
 return {observed};
}});

export const configure=internalMutation({args:{dispatchPaused:v.boolean(),reason:text},handler:async(ctx,args)=>{
 const monitor=await ctx.db.query('projectLeadMonitor').withIndex('by_key',q=>q.eq('key',ROOT)).unique();
 if(!monitor)throw Error('Observe the queue before configuring the monitor');
 await ctx.db.patch(monitor._id,{dispatchPaused:args.dispatchPaused,pauseReason:args.reason});
}});

export const classifyStep=internalMutation({args:{taskKey:v.string(),stepKey:v.string(),readiness,reason:text},handler:async(ctx,args)=>{
 const task=await ctx.db.query('projectTasks').withIndex('by_key',q=>q.eq('key',args.taskKey)).unique();
 if(!task?.checklist?.some(step=>step.key===args.stepKey&&!step.done))throw Error('Classify an existing unfinished step');
 const row=await ctx.db.query('projectStepExecution').withIndex('by_step',q=>q.eq('taskKey',args.taskKey).eq('stepKey',args.stepKey)).unique();
 if(!row)throw Error('Observe the step before classifying it');
 await ctx.db.patch(row._id,{readiness:args.readiness,reason:args.reason});
}});

export const recordReview=internalMutation({args:{key:v.string(),taskKey:v.string(),title:text,status:v.union(v.literal('pending'),v.literal('reviewed')),evidence:v.string()},handler:async(ctx,args)=>{
 if(!args.evidence.trim())throw Error('Review queue entries require evidence');
 const task=await ctx.db.query('projectTasks').withIndex('by_key',q=>q.eq('key',args.taskKey)).unique();
 if(!task)throw Error('Unknown review task');
 const previous=await ctx.db.query('projectReviewQueue').withIndex('by_key',q=>q.eq('key',args.key)).unique();
 if(previous)await ctx.db.patch(previous._id,args);else await ctx.db.insert('projectReviewQueue',{...args,requestedAt:Date.now()});
}});

/** The dispatch pause alone, from the one monitor row. Pause gates poll this every minute; snapshot reads six tables. */
export const pause=query({args:{},handler:async ctx=>{
 const monitor=await ctx.db.query('projectLeadMonitor').withIndex('by_key',q=>q.eq('key',ROOT)).unique();
 return {monitor:monitor?{startedAt:monitor.startedAt,observedAt:monitor.observedAt,dispatchPaused:monitor.dispatchPaused,pauseReason:monitor.pauseReason}:null};
}});

export const snapshot=query({args:{},handler:async ctx=>{
 const [monitor,tasks,agents,records,reviews,dispatchItems]=await Promise.all([ctx.db.query('projectLeadMonitor').withIndex('by_key',q=>q.eq('key',ROOT)).unique(),ctx.db.query('projectTasks').collect(),ctx.db.query('projectAgents').collect(),ctx.db.query('projectStepExecution').collect(),ctx.db.query('projectReviewQueue').collect(),ctx.db.query('projectDispatchItems').collect()]);
 const now=Date.now();
 const running=agents.filter(agent=>agent.status==='running'&&now-agent.lastActivityAt<=FRESH);
 const indexed=new Map(records.map(row=>[`${row.taskKey}/${row.stepKey}`,row]));
 const dispatchByStep=new Map(dispatchItems.map(item=>[`${item.taskKey}/${item.stepKey}`,item]));
 const liveDispatch=new Map(dispatchItems.filter(item=>item.leaseUntil&&item.leaseUntil>now&&['running','qa_running','accept_running'].includes(item.state)).map(item=>[`${item.taskKey}/${item.stepKey}`,item]));
 const steps=tasks.filter(task=>task.status!=='done'&&task.status!=='superseded').flatMap(task=>(task.checklist??[]).filter(step=>!step.done).map(step=>{
  const observed=indexed.get(`${task.key}/${step.key}`);
  const dispatched=liveDispatch.get(`${task.key}/${step.key}`);
  const queueItem=dispatchByStep.get(`${task.key}/${step.key}`);
  const delayed=queueItem?.retryAt!==undefined&&queueItem.retryAt>now;
  const queueReadiness=queueItem&&(delayed?'scheduled_retry' as const:['qa_ready','qa_running','accept_ready','accept_running'].includes(queueItem.state)?'waiting_review' as const:queueItem.state==='blocked'?'blocked' as const:['ready','triage_ready'].includes(queueItem.state)?'ready' as const:undefined);
  const owners=running.filter(agent=>agent.work?.assignmentEn===agent.assignment.en&&agent.work.tasks.some(work=>work.taskKey===task.key&&work.stepKeys.includes(step.key)));
  const staleOwners=agents.filter(agent=>agent.work?.assignmentEn===agent.assignment.en&&agent.work.tasks.some(work=>work.taskKey===task.key&&work.stepKeys.includes(step.key))&&!running.some(active=>active.key===agent.key));
  const mappedOwners=owners.map(agent=>({key:agent.key,name:agent.name}));
  if(dispatched?.activeSessionId&&!mappedOwners.length)mappedOwners.push({key:dispatched.activeSessionId,name:dispatched.activeActorName??(dispatched.state==='qa_running'?'Ada':dispatched.lead)});
  return {taskKey:task.key,stepKey:step.key,title:task.title,label:step.label,lane:task.status,owners:mappedOwners,bindingEvidence:dispatched?{sessionId:dispatched.activeSessionId??null,rosterKey:dispatched.activeActorKey??null,status:dispatched.activeSessionId?'dispatch_session_observed':'session_unobserved'}:null,staleOwnerKeys:dispatched?[]:staleOwners.map(agent=>agent.key),waitingSince:mappedOwners.length?undefined:observed?.waitingSince,observationAt:observed?.observedAt,readiness:queueReadiness??observed?.readiness??'unclassified',dispatchState:dispatched?.state,retryAt:delayed?queueItem?.retryAt:undefined,reason:observed?.reason,handoffAt:dispatched?undefined:observed?.handoffAt};
 }));
 const coordinator=agents.find(agent=>agent.key===ROOT);
 const coordinatorAssignment=coordinator?{assignment:coordinator.assignment,work:coordinator.work?.assignmentEn===coordinator.assignment.en?{assignmentEn:coordinator.work.assignmentEn,recordedAt:coordinator.work.recordedAt,tasks:coordinator.work.tasks.map(work=>({taskKey:work.taskKey,stepKeys:work.stepKeys,taskTitle:tasks.find(task=>task.key===work.taskKey)?.title,steps:work.stepKeys.flatMap(stepKey=>{const step=tasks.find(task=>task.key===work.taskKey)?.checklist?.find(candidate=>candidate.key===stepKey&&!candidate.done);return step?[{key:step.key,label:step.label}]:[];})})).filter(work=>work.steps.length)}:null,status:coordinator.status,lastActivityAt:coordinator.lastActivityAt,updatedAt:coordinator.updatedAt}:null;
 const metrics=leadMetrics(agents,steps,now,1,monitor?.dispatchPaused??true);
 const liveCount=liveDispatch.size;
 // The claim gate is serialized; a stale collector or expired lease cannot prove free execution capacity.
 const capacityUnknown=!monitor||now-monitor.observedAt>60_000||dispatchItems.some(item=>['running','qa_running','accept_running'].includes(item.state)&&(!item.leaseUntil||item.leaseUntil<=now));
 const unusedSlots=capacityUnknown?null:Math.max(0,1-liveCount);
 const missedHandoffs=unusedSlots===null?null:!monitor?.dispatchPaused&&unusedSlots>0?steps.filter(step=>step.readiness==='ready'&&!step.owners.length&&step.handoffAt!==undefined&&now-step.handoffAt>=60_000).length:0;
 return {monitor:monitor?{startedAt:monitor.startedAt,observedAt:monitor.observedAt,dispatchPaused:monitor.dispatchPaused,pauseReason:monitor.pauseReason}:null,coordinatorAssignment,capacity:1,...metrics,running:liveCount,unusedSlots,missedHandoffs,steps,reviews:[...reviews.filter(row=>row.status==='pending'&&!dispatchItems.some(item=>item.taskKey===row.taskKey&&['qa_ready','qa_running'].includes(item.state))).map(({key,title,requestedAt})=>({key,title,requestedAt})),...dispatchItems.filter(item=>['qa_ready','qa_running'].includes(item.state)).map(item=>({key:`dispatch:${item.key}`,title:tasks.find(task=>task.key===item.taskKey)?.checklist?.find(step=>step.key===item.stepKey)?.label??{en:item.label,es:item.label,pt:item.label},requestedAt:item.updatedAt}))]};
}});
