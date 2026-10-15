import {query,internalMutation} from './_generated/server';
import {v} from 'convex/values';
import initialTasks from '../src/data/scoreboard.json';

const text=v.object({en:v.string(),es:v.string(),pt:v.string()});
const checklist=v.array(v.object({key:v.string(),label:text,done:v.boolean(),evidence:v.optional(v.string()),completedAt:v.optional(v.number()),completedBy:v.optional(v.array(v.string())),completedByKeys:v.optional(v.array(v.string())),review:v.optional(v.object({reviewerKey:v.string(),reviewedAt:v.number(),evidence:v.string(),outcome:v.union(v.literal('accepted'),v.literal('changes_requested'))}))}));
function verifyChecklist(items:{key:string;done:boolean;evidence?:string}[]|undefined,done:boolean){
 if(!items?.length)throw Error('Every task requires checklist items');
 if(new Set(items.map(item=>item.key)).size!==items.length)throw Error('Checklist keys must be unique');
 if(items.some(item=>item.done&&!item.evidence?.trim()))throw Error('Checked items need verification evidence');
 if(done&&items.some(item=>!item.done))throw Error('Complete every checklist item before marking the task done');
}
const status=v.union(v.literal('todo'),v.literal('doing'),v.literal('done'),v.literal('blocked'));

/** Public status only. Updating the board is restricted to trusted internal calls. */
export const list=query({args:{},handler:async ctx=>{
 const tasks=await ctx.db.query('projectTasks').withIndex('by_order').collect();
 return tasks.map(({key,title,detail,status,icon,order,href,evidence,checklist,updatedAt,completedAt,supersededBy,supersededAt,supersededReason})=>({key,title,detail,status,icon,order,href,evidence,checklist,updatedAt,completedAt,supersededBy,supersededAt,supersededReason}));
}});

/** Idempotent: deployments must never reset progress already recorded. */
export const seed=internalMutation({args:{},handler:async ctx=>{
 let inserted=0;
 for(const task of initialTasks){
  if(await ctx.db.query('projectTasks').withIndex('by_key',q=>q.eq('key',task.key)).unique())continue;
  if(!['todo','doing','done','blocked'].includes(task.status))throw Error('Invalid task status');
  verifyChecklist(task.checklist,task.status==='done');
  if(task.status==='done'&&!task.evidence)throw Error('Completed tasks need verification evidence');
  await ctx.db.insert('projectTasks',{...task,status:task.status as 'todo'|'doing'|'done'|'blocked',updatedAt:Date.now(),...(task.status==='done'?{completedAt:Date.now()}:{} )});
  inserted++;
 }
 return {inserted};
}});

/** Upsert tasks as Eric adds requests. No public mutation exposes these writes. */
export const setTask=internalMutation({args:{key:v.string(),title:text,detail:text,status,icon:v.string(),order:v.number(),checklist,href:v.optional(v.string()),evidence:v.optional(v.string())},handler:async(ctx,args)=>{
 verifyChecklist(args.checklist,args.status==='done');
 if(args.status==='done'&&!args.evidence?.trim())throw Error('Verify the result before marking it done');
 if(args.href&&!args.href.startsWith('/')&&!args.href.startsWith('https://'))throw Error('Use a site path or HTTPS evidence link');
 const task=await ctx.db.query('projectTasks').withIndex('by_key',q=>q.eq('key',args.key)).unique();
 if(task?.status==='superseded')throw Error('Superseded task is historical; update its replacement');
 const items=await Promise.all(args.checklist.map(async item=>{
  if(!item.done)return {...item,completedAt:undefined,completedBy:undefined,completedByKeys:undefined};
  const previous=task?.checklist?.find(step=>step.key===item.key);
  const completedAt=item.completedAt??previous?.completedAt??(!previous?.done?Date.now():undefined);
  const completedBy=item.completedBy??previous?.completedBy;
  if(!previous?.done&&(!completedBy?.length||completedBy.some(name=>!name.trim())))throw Error('Newly completed steps need named contributors');
  if(!previous?.done){
   if(!item.completedByKeys?.length)throw Error('New completions need contributor agent identifiers');
   if(!item.review||item.review.outcome!=='accepted'||!item.review.evidence.trim())throw Error('Independent QA must accept every newly completed step');
   if(item.review.reviewedAt>Date.now()||item.review.reviewedAt<=0)throw Error('QA review time must already have occurred');
   if(item.completedByKeys.includes(item.review.reviewerKey))throw Error('Contributors cannot independently review their own step');
   const currentReview=item.review;
   const reviewer=await ctx.db.query('projectAgents').withIndex('by_key',q=>q.eq('key',item.review!.reviewerKey)).unique();
   if(!reviewer||reviewer.team!=='qa')throw Error('Independent review requires a recorded QA agent');

   const dispatch=(await ctx.db.query('projectDispatchItems').withIndex('by_key',q=>q.eq('key',`${args.key}/${item.key}`)).unique());
   if(!dispatch||dispatch.state!=='accepted'||!dispatch.workerSessionId||!dispatch.qaSessionId||dispatch.contributorKey!==item.completedByKeys[0]||dispatch.qaReviewerKey!==currentReview.reviewerKey||dispatch.qaRevision!==dispatch.submissionRevision||dispatch.qaEvidence!==currentReview.evidence)throw Error('New completion must match the accepted independent dispatch review and exact artifact revision');
   const session=await ctx.db.query('projectAgents').withIndex('by_key',q=>q.eq('key',dispatch.qaSessionId!)).unique();
   if(!session||session.key!==dispatch.qaSessionId||session.name!==reviewer.name||session.team!=='qa'||!['running','completed'].includes(session.status)||session.lastActivityAt<Date.now()-5*60_000||session.binding?.taskKey!==args.key||session.binding?.stepKey!==item.key||session.binding?.rosterKey!==reviewer.key||session.binding.observedAt>currentReview.reviewedAt||!session.binding.evidence.trim())throw Error('Review must be backed by fresh observed QA session evidence for this exact step');
   if(!dispatch.workerProvider||!dispatch.qaProvider||dispatch.workerProvider===dispatch.qaProvider||dispatch.workerSessionId===dispatch.qaSessionId||!dispatch.submissionRevision||!dispatch.qaEvidence?.trim())throw Error('Independent providers and exact artifact evidence required');
   const worker=await ctx.db.query('projectAgents').withIndex('by_key',q=>q.eq('key',dispatch.workerSessionId!)).unique();
   if(!worker||worker.key!==dispatch.workerSessionId||worker.binding?.taskKey!==args.key||worker.binding?.stepKey!==item.key||worker.binding?.rosterKey!==dispatch.contributorKey||!['running','completed'].includes(worker.status))throw Error('Contributor needs an actual observed session for this step');
   const events=await ctx.db.query('projectDispatchEvents').withIndex('by_item_time',q=>q.eq('itemKey',dispatch.key)).collect();
   if(!events.some(e=>e.kind==='submitted'&&e.actor===dispatch.contributorKey&&e.detail.includes(`(run ${dispatch.workerSessionId})`))||!events.some(e=>e.kind==='qa_accepted'&&e.actor===currentReview.reviewerKey&&e.detail.includes(`(run ${dispatch.qaSessionId})`)))throw Error('Contributor and reviewer sessions need recorded source/test evidence');
   for(const key of item.completedByKeys){if(!await ctx.db.query('projectAgents').withIndex('by_key',q=>q.eq('key',key)).unique())throw Error('Record each contributing agent before completion');}
  }
  if(completedAt&&completedAt>Date.now())throw Error('Step completion cannot be in the future');
  return {...item,...(completedAt?{completedAt}:{}),...(completedBy?.length?{completedBy}: {}),...((item.completedByKeys??previous?.completedByKeys)?{completedByKeys:item.completedByKeys??previous?.completedByKeys}:{}),...((item.review??previous?.review)?{review:item.review??previous?.review}:{})};
 }));
 const value={...args,checklist:items,updatedAt:Date.now(),completedAt:args.status==='done'?(task?.completedAt??Date.now()):undefined};
 if(task)await ctx.db.patch(task._id,value);else await ctx.db.insert('projectTasks',value);
 return {key:args.key,status:args.status};
}});

/** Correct open display wording without rewriting ownership, QA, or completion history. */
export const renameOpenTaskStep=internalMutation({args:{key:v.string(),stepKey:v.string(),title:text,label:text},handler:async(ctx,args)=>{
 const task=await ctx.db.query('projectTasks').withIndex('by_key',q=>q.eq('key',args.key)).unique();
 const step=task?.checklist?.find(item=>item.key===args.stepKey);
 if(!task||!step||step.done||task.status==='done'||task.status==='superseded')throw Error('Only an existing open checklist step may be renamed');
 if(Object.values(args.title).some(value=>!value.trim())||Object.values(args.label).some(value=>!value.trim()))throw Error('Every locale needs nonempty wording');
 await ctx.db.patch(task._id,{title:args.title,checklist:task.checklist!.map(item=>item.key===args.stepKey?{...item,label:args.label}:item),updatedAt:Date.now()});
 return {key:args.key,stepKey:args.stepKey,renamed:true};
}});

/** Consolidate an unstarted duplicate into an existing task; retain completed history. */
export const removeUnstartedDuplicate=internalMutation({args:{key:v.string(),canonicalKey:v.string()},handler:async(ctx,{key,canonicalKey})=>{
 if(key===canonicalKey)throw Error('Canonical task must differ');
 const task=await ctx.db.query('projectTasks').withIndex('by_key',q=>q.eq('key',key)).unique();
 const canonical=await ctx.db.query('projectTasks').withIndex('by_key',q=>q.eq('key',canonicalKey)).unique();
 if(!task||!canonical)throw Error('Both task records must exist');
 if(task.status==='done'||!task.checklist||task.checklist.some(item=>item.done||item.completedAt||item.completedBy?.length||item.review))throw Error('Preserve recorded work history');
 const agents=await ctx.db.query('projectAgents').collect();if(agents.some(a=>a.work?.tasks?.some(t=>t.taskKey===key)))throw Error('Clear duplicate assignments first');
 await ctx.db.delete(task._id);return {removed:key,canonicalKey};
}});

/** Preserve an obsolete unstarted request and its event trail without treating it as completed. */
export const supersedeUnstartedTask=internalMutation({args:{key:v.string(),replacementKey:v.string(),reason:text},handler:async(ctx,args)=>{
 if(args.key===args.replacementKey||Object.values(args.reason).some(value=>!value.trim()))throw Error('A distinct replacement and reason in every language are required');
 const [task,replacement,dispatchItems,agents]=await Promise.all([
  ctx.db.query('projectTasks').withIndex('by_key',q=>q.eq('key',args.key)).unique(),
  ctx.db.query('projectTasks').withIndex('by_key',q=>q.eq('key',args.replacementKey)).unique(),
  ctx.db.query('projectDispatchItems').collect(),ctx.db.query('projectAgents').collect(),
 ]);
 if(!task||!replacement||replacement.status==='superseded')throw Error('Original and active replacement tasks are required');
 if(task.status==='superseded'){
  if(task.supersededBy!==args.replacementKey)throw Error('Task was superseded by a different request');
  return {key:args.key,replacementKey:args.replacementKey,changed:false};
 }
 if(task.status==='done'||!task.checklist?.length||task.checklist.some(step=>step.done||step.completedAt||step.completedBy?.length||step.review))throw Error('Only wholly uncompleted requests may be superseded');
 const oldItems=dispatchItems.filter(item=>item.taskKey===args.key);
 if(oldItems.some(item=>item.leaseId||item.leaseUntil&&item.leaseUntil>Date.now()||!['blocked','triage_ready','ready'].includes(item.state)))throw Error('Active, submitted or accepted dispatch work must be reconciled separately');
 if(agents.some(agent=>agent.status==='running'&&agent.work?.tasks.some(work=>work.taskKey===args.key)))throw Error('A running agent still owns this request');
 const at=Date.now();
 await ctx.db.patch(task._id,{status:'superseded',supersededBy:args.replacementKey,supersededAt:at,supersededReason:args.reason,updatedAt:at});
 for(const item of oldItems){
  await ctx.db.patch(item._id,{state:'superseded',supersededBy:args.replacementKey,supersededAt:at,blockedReason:undefined,nextAction:undefined,retryAt:undefined,updatedAt:at});
  await ctx.db.insert('projectDispatchEvents',{itemKey:item.key,kind:'superseded',actor:'Orion',at,detail:`Scope replaced by ${args.replacementKey}. ${args.reason.en}`});
 }
 return {key:args.key,replacementKey:args.replacementKey,changed:true,dispatchItems:oldItems.length};
}});
