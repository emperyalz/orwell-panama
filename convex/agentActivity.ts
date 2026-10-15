import {query,mutation,internalMutation} from './_generated/server';
import {v} from 'convex/values';

const text=v.object({en:v.string(),es:v.string(),pt:v.string()});
const team=v.union(v.literal('research'),v.literal('qa'),v.literal('implementation'));
const status=v.union(v.literal('running'),v.literal('completed'),v.literal('blocked'),v.literal('error'),v.literal('idle'));
const binding=v.object({taskKey:v.string(),stepKey:v.string(),rosterKey:v.optional(v.string()),evidence:v.string(),observedAt:v.number()});
const kind=v.union(v.literal('assigned'),v.literal('progress'),v.literal('completed'),v.literal('error'),v.literal('model_changed'));

export const snapshot=query({args:{},handler:async ctx=>{
 const agents=await ctx.db.query('projectAgents').collect();
 const recent=await ctx.db.query('projectAgentEvents').withIndex('by_time').order('desc').take(120);
 // Repeated generic tool categories must not bury assignments, model changes or outcomes.
 const seen=new Set<string>();
 const events=recent.filter(event=>{
  if(event.kind!=='progress')return true;
  const key=`${event.agentKey}:${event.summary.en}`;
  if(seen.has(key))return false;
  seen.add(key);return true;
 }).slice(0,30);
 return {agents:agents.sort((a,b)=>b.lastActivityAt-a.lastActivityAt).map(({key,parentKey,name,team,model,reasoning,assignment,status,lastActivityAt,runStartedAt,updatedAt,issue,report,estimate,work,binding})=>({key,parentKey,name,team,model,reasoning,assignment,status,lastActivityAt,runStartedAt,updatedAt,issue,report,estimate,work,binding})),events:events.map(({agentKey,summary,kind,occurredAt})=>({agentKey,summary,kind,occurredAt})),receivedAt:recent.reduce((latest,event)=>Math.max(latest,event.receivedAt),0)};
}});

/** Retain a plain-language diagnosis separately from the agent's raw runtime status. */
export const explainIssue=internalMutation({args:{key:v.string(),message:text,recovery:text,replacementKey:v.optional(v.string()),resolvedAt:v.optional(v.number())},handler:async(ctx,args)=>{
 const agent=await ctx.db.query('projectAgents').withIndex('by_key',q=>q.eq('key',args.key)).unique();
 if(!agent)throw Error('Agent not found');
 if(args.resolvedAt&&args.resolvedAt>Date.now())throw Error('Recovery must already have occurred');
 const replacementKey=args.replacementKey;
 if(replacementKey){const replacement=await ctx.db.query('projectAgents').withIndex('by_key',q=>q.eq('key',replacementKey)).unique();if(!replacement)throw Error('Record replacement before linking recovery');}
 const {key,...issue}=args;
 await ctx.db.patch(agent._id,{issue,updatedAt:Date.now()});
 const failures=await ctx.db.query('projectAgentFailures').withIndex('by_agent',q=>q.eq('agentKey',key)).collect();
 for(const failure of failures)await ctx.db.patch(failure._id,{replacementKey,updatedAt:Date.now()});
 return {key,explained:true};
}});

/** Trusted local collector only. Never accepts public browser writes. */
export const record=internalMutation({args:{key:v.string(),parentKey:v.optional(v.string()),name:v.string(),team,model:v.string(),reasoning:v.string(),assignment:text,status,lastActivityAt:v.number(),eventId:v.string(),kind,summary:text,binding:v.optional(binding)},handler:async(ctx,args)=>{
 if(!args.key.trim()||!args.eventId.trim())throw Error('Agent and event identifiers are required');
 if(args.lastActivityAt>Date.now()+60_000)throw Error('Activity cannot be in the future');
 if(await ctx.db.query('projectAgentEvents').withIndex('by_event',q=>q.eq('eventId',args.eventId)).unique())return {duplicate:true};
 if(args.binding){
  const b=args.binding;
  if(!b.evidence.trim()||!Number.isFinite(b.observedAt)||b.observedAt>args.lastActivityAt)throw Error('Binding requires evidence observed no later than activity');
  if(b.rosterKey===args.key)throw Error('Actual run ID must be distinct from configured roster identity');
  const task=await ctx.db.query('projectTasks').withIndex('by_key',q=>q.eq('key',b.taskKey)).unique();
  if(!task||task.status==='done'||task.status==='superseded'||!task.checklist?.some(step=>step.key===b.stepKey&&!step.done))throw Error('Binding must identify an open task and step');
 }
 const {eventId,kind,summary,...agent}=args;
 const existing=await ctx.db.query('projectAgents').withIndex('by_key',q=>q.eq('key',args.key)).unique();
 if(!existing||args.lastActivityAt>=existing.lastActivityAt){
  const newFailure=args.status==='error'&&existing?.issue?.resolvedAt&&args.lastActivityAt>existing.issue.resolvedAt;
  // Only a genuine task_started event can begin a timed run. Progress after an
  // unobserved start remains untimed rather than inventing a start time.
  const runStartedAt=args.status!=='running'?undefined:
   args.kind==='assigned'?args.lastActivityAt:
   existing?.status==='running'?existing.runStartedAt:undefined;
  const value={...agent,runStartedAt,assignment:args.binding?agent.assignment:existing?.contextAssignment??agent.assignment,
   ...(args.binding?{contextAssignment:agent.assignment,work:{assignmentEn:agent.assignment.en,tasks:[{taskKey:args.binding.taskKey,stepKeys:[args.binding.stepKey]}],recordedAt:args.binding.observedAt}}:{}),updatedAt:Date.now(),...(newFailure?{issue:undefined}:{})};
  if(existing)await ctx.db.patch(existing._id,value);else await ctx.db.insert('projectAgents',value);
 }
 if(args.status==='error'&&kind==='error'&&!/^capacity probe\s+\d+$/i.test(args.name)){
  const tasks=await ctx.db.query('projectTasks').collect();const mapped=(existing?.work?.assignmentEn===agent.assignment.en?existing.work.tasks:[]).flatMap(work=>work.stepKeys.map(stepKey=>({taskKey:work.taskKey,stepKey}))).filter(item=>tasks.some(task=>task.key===item.taskKey&&task.checklist?.some(step=>step.key===item.stepKey&&!step.done)));
  await ctx.db.insert('projectAgentFailures',{eventId,agentKey:args.key,assignment:agent.assignment.en,taskSteps:mapped,occurredAt:args.lastActivityAt,status:mapped.length?'ready':'needs_mapping',message:summary.en,updatedAt:Date.now()});
  for(const item of mapped){const row=await ctx.db.query('projectStepExecution').withIndex('by_step',q=>q.eq('taskKey',item.taskKey).eq('stepKey',item.stepKey)).unique();if(row)await ctx.db.patch(row._id,{readiness:'ready',ownerKeys:[],waitingSince:Date.now(),handoffAt:Date.now(),reason:{en:'Agent failed; this step needs reassignment.',es:'El agente falló; este paso necesita reasignación.',pt:'O agente falhou; esta etapa precisa de nova atribuição.'}});else await ctx.db.insert('projectStepExecution',{taskKey:item.taskKey,stepKey:item.stepKey,firstObservedAt:Date.now(),observedAt:Date.now(),waitingSince:Date.now(),handoffAt:Date.now(),ownerKeys:[],readiness:'ready',reason:{en:'Agent failed; this step needs reassignment.',es:'El agente falló; este paso necesita reasignación.',pt:'O agente falhou; esta etapa precisa de nova atribuição.'}});}
 }
 await ctx.db.insert('projectAgentEvents',{eventId,agentKey:args.key,kind,summary,occurredAt:args.lastActivityAt,receivedAt:Date.now()});
 return {duplicate:false};
}});

/** Backfill actual parent links for existing runtime rows without changing activity clocks. */
export const syncParents=internalMutation({args:{mappings:v.array(v.object({key:v.string(),parentKey:v.string()}))},handler:async(ctx,{mappings})=>{
 const keys=new Set<string>();
 for(const item of mappings){
  if(!item.key.trim()||!item.parentKey.trim())throw Error('Agent and parent identifiers are required');
  if(item.key===item.parentKey)throw Error('An agent cannot manage itself');
  if(keys.has(item.key))throw Error(`Duplicate parent mapping for ${item.key}`);
  keys.add(item.key);
 }
 const agents=await ctx.db.query('projectAgents').collect();
 const byKey=new Map(agents.map(agent=>[agent.key,agent]));
 const valid=mappings.filter(item=>byKey.has(item.key)&&byKey.has(item.parentKey));
 const proposed=new Map(agents.map(agent=>[agent.key,agent.parentKey]));
 for(const item of valid)proposed.set(item.key,item.parentKey);
 for(const item of valid){
  const seen=new Set<string>();let current:string|undefined=item.key;
  while(current){
   if(seen.has(current))throw Error(`Parent mapping creates a cycle for ${item.key}`);
   seen.add(current);current=proposed.get(current);
  }
 }
 let changed=0;
 for(const item of valid){
  const child=byKey.get(item.key)!;
  if(child.parentKey===item.parentKey)continue;
  await ctx.db.patch(child._id,{parentKey:item.parentKey});changed++;
 }
 return {synced:valid.map(item=>item.key),missing:mappings.filter(item=>!byKey.has(item.key)||!byKey.has(item.parentKey)).map(item=>item.key),changed};
}});

/** A reviewed, sanitized checkpoint is distinct from a completed runtime turn. */
export const saveContext=internalMutation({args:{key:v.string(),assignment:v.optional(text),estimate:v.optional(text),work:v.optional(v.array(v.object({taskKey:v.string(),stepKeys:v.array(v.string())}))),result:text,remaining:text,evidence:v.string()},handler:async(ctx,args)=>{
 const agent=await ctx.db.query('projectAgents').withIndex('by_key',q=>q.eq('key',args.key)).unique();
 if(!agent)throw Error('Agent not found');
 if(!args.evidence.trim())throw Error('Record source evidence for agent outcomes');
 if(args.work){
  if(new Set(args.work.map(item=>item.taskKey)).size!==args.work.length)throw Error('Work task keys must be unique');
  for(const item of args.work){
   if(!item.taskKey.trim()||new Set(item.stepKeys).size!==item.stepKeys.length)throw Error('Work keys must be nonempty and unique');
   const task=await ctx.db.query('projectTasks').withIndex('by_key',q=>q.eq('key',item.taskKey)).unique();
   if(!task)throw Error(`Unknown work task: ${item.taskKey}`);
   if(task.status==='done'||task.status==='superseded')throw Error(`Closed task cannot be current work: ${item.taskKey}`);
   for(const stepKey of item.stepKeys){
    if(!stepKey.trim()||!task.checklist?.some(step=>step.key===stepKey&&!step.done))throw Error(`Unknown or completed work step: ${item.taskKey}/${stepKey}`);
   }
  }
 }
 await ctx.db.patch(agent._id,{...(args.assignment?{assignment:args.assignment,contextAssignment:args.assignment}:{}),...(args.estimate?{estimate:{label:args.estimate,assignmentEn:args.assignment?.en??agent.assignment.en,recordedAt:Date.now()}}:{}),...(args.work?{work:{assignmentEn:args.assignment?.en??agent.assignment.en,tasks:args.work,recordedAt:Date.now()}}:{}),report:{assignmentEn:args.assignment?.en??agent.assignment.en,result:args.result,remaining:args.remaining,evidence:args.evidence,recordedAt:Date.now()},updatedAt:Date.now()});
 return {saved:true};
}});

/** Identity metadata only: preserve event history and all execution timestamps. */
export const renameIdentities=internalMutation({args:{identities:v.array(v.object({key:v.string(),name:v.string()}))},handler:async(ctx,{identities})=>{
 const agents=await ctx.db.query('projectAgents').collect();
 if(new Set(identities.map(x=>x.key)).size!==identities.length)throw Error('Duplicate identity key');
 const proposed=new Map(agents.map(a=>[a.key,a.name]));
 for(const item of identities){if(!item.name.trim()||item.name!==item.name.trim())throw Error('Use a nonempty trimmed personal name');if(!proposed.has(item.key))throw Error('Record actual identity first');proposed.set(item.key,item.name);}
 for(const item of identities){if([...proposed.entries()].some(([key,name])=>key!==item.key&&name===item.name))throw Error('Personal name already belongs to another recorded identity');}
 for(const item of identities){const agent=agents.find(a=>a.key===item.key)!;if(agent.name!==item.name)await ctx.db.patch(agent._id,{name:item.name});}
 return {renamed:identities.map(x=>x.key),activityUnchanged:true};
}});

/** Historical issue import preserves unknown task mapping for review. */
export const backfillFailures=internalMutation({args:{},handler:async ctx=>{const agents=await ctx.db.query('projectAgents').collect();let inserted=0;for(const agent of agents.filter(a=>a.status==='error'&&a.issue&&!/^capacity probe\s+\d+$/i.test(a.name))){const eventId=`historical:${agent.key}`;if(await ctx.db.query('projectAgentFailures').withIndex('by_event',q=>q.eq('eventId',eventId)).unique())continue;await ctx.db.insert('projectAgentFailures',{eventId,agentKey:agent.key,assignment:agent.assignment.en,taskSteps:[],occurredAt:agent.lastActivityAt,status:'needs_mapping',message:agent.issue!.message.en,replacementKey:agent.issue!.replacementKey,updatedAt:Date.now()});inserted++;}return {inserted};}});
export const failureQueue=query({args:{},handler:async ctx=>{const [failures,tasks]=await Promise.all([ctx.db.query('projectAgentFailures').collect(),ctx.db.query('projectTasks').collect()]);return failures.map(f=>{const openSteps=f.taskSteps.filter(s=>tasks.some(t=>t.key===s.taskKey&&t.checklist?.some(c=>c.key===s.stepKey&&!c.done)));return {...f,status:f.taskSteps.length&&!openSteps.length?'complete':f.status,openSteps};});}});

/** Editor-approved mapping from a historical failure to a still-open checklist step. */
export const mapFailure=mutation({args:{secret:v.string(),eventId:v.string(),taskKey:v.string(),stepKey:v.string(),evidence:v.string()},handler:async(ctx,args)=>{
 if(!process.env.PORTRAIT_REVIEW_WRITE_SECRET||args.secret!==process.env.PORTRAIT_REVIEW_WRITE_SECRET)throw Error('Unauthorized');
 if(!args.evidence.trim()||args.evidence.length>500)throw Error('Source evidence is required for a failure mapping');
 const failure=await ctx.db.query('projectAgentFailures').withIndex('by_event',q=>q.eq('eventId',args.eventId)).unique();if(!failure)throw Error('Failure not found');
 const task=await ctx.db.query('projectTasks').withIndex('by_key',q=>q.eq('key',args.taskKey)).unique();if(!task?.checklist?.some(step=>step.key===args.stepKey&&!step.done))throw Error('Choose an open step');
 const mapping={taskKey:args.taskKey,stepKey:args.stepKey};
 if(!failure.taskSteps.some(step=>step.taskKey===mapping.taskKey&&step.stepKey===mapping.stepKey))await ctx.db.patch(failure._id,{taskSteps:[...failure.taskSteps,mapping],status:'ready',mappingEvidence:args.evidence.trim(),updatedAt:Date.now()});
 const row=await ctx.db.query('projectStepExecution').withIndex('by_step',q=>q.eq('taskKey',args.taskKey).eq('stepKey',args.stepKey)).unique();
 const reason={en:'Failed run needs reassignment; original step remains open.',es:'La ejecución fallida necesita reasignación; el paso sigue abierto.',pt:'A execução com falha precisa de nova atribuição; a etapa segue aberta.'};
 if(row)await ctx.db.patch(row._id,{readiness:'ready',reason,waitingSince:row.waitingSince??Date.now()});else await ctx.db.insert('projectStepExecution',{taskKey:args.taskKey,stepKey:args.stepKey,firstObservedAt:Date.now(),observedAt:Date.now(),waitingSince:Date.now(),ownerKeys:[],readiness:'ready',reason});
 return {mapped:mapping};
}});
