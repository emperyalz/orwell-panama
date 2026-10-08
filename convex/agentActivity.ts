import {query,internalMutation} from './_generated/server';
import {v} from 'convex/values';

const text=v.object({en:v.string(),es:v.string(),pt:v.string()});
const team=v.union(v.literal('research'),v.literal('qa'),v.literal('implementation'));
const status=v.union(v.literal('running'),v.literal('completed'),v.literal('blocked'),v.literal('error'),v.literal('idle'));
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
 return {agents:agents.sort((a,b)=>b.lastActivityAt-a.lastActivityAt).map(({key,name,team,model,reasoning,assignment,status,lastActivityAt,updatedAt,issue,report,estimate})=>({key,name,team,model,reasoning,assignment,status,lastActivityAt,updatedAt,issue,report,estimate})),events:events.map(({agentKey,summary,kind,occurredAt})=>({agentKey,summary,kind,occurredAt})),receivedAt:recent.reduce((latest,event)=>Math.max(latest,event.receivedAt),0)};
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
 return {key,explained:true};
}});

/** Trusted local collector only. Never accepts public browser writes. */
export const record=internalMutation({args:{key:v.string(),name:v.string(),team,model:v.string(),reasoning:v.string(),assignment:text,status,lastActivityAt:v.number(),eventId:v.string(),kind,summary:text},handler:async(ctx,args)=>{
 if(!args.key.trim()||!args.eventId.trim())throw Error('Agent and event identifiers are required');
 if(args.lastActivityAt>Date.now()+60_000)throw Error('Activity cannot be in the future');
 if(await ctx.db.query('projectAgentEvents').withIndex('by_event',q=>q.eq('eventId',args.eventId)).unique())return {duplicate:true};
 const {eventId,kind,summary,...agent}=args;
 const existing=await ctx.db.query('projectAgents').withIndex('by_key',q=>q.eq('key',args.key)).unique();
 if(!existing||args.lastActivityAt>=existing.lastActivityAt){
  const newFailure=args.status==='error'&&existing?.issue?.resolvedAt&&args.lastActivityAt>existing.issue.resolvedAt;
  const value={...agent,updatedAt:Date.now(),...(newFailure?{issue:undefined}:{})};
  if(existing)await ctx.db.patch(existing._id,value);else await ctx.db.insert('projectAgents',value);
 }
 await ctx.db.insert('projectAgentEvents',{eventId,agentKey:args.key,kind,summary,occurredAt:args.lastActivityAt,receivedAt:Date.now()});
 return {duplicate:false};
}});

/** A reviewed, sanitized checkpoint is distinct from a completed runtime turn. */
export const saveContext=internalMutation({args:{key:v.string(),assignment:v.optional(text),estimate:v.optional(text),result:text,remaining:text,evidence:v.string()},handler:async(ctx,args)=>{
 const agent=await ctx.db.query('projectAgents').withIndex('by_key',q=>q.eq('key',args.key)).unique();
 if(!agent)throw Error('Agent not found');
 if(!args.evidence.trim())throw Error('Record source evidence for agent outcomes');
 await ctx.db.patch(agent._id,{...(args.assignment?{assignment:args.assignment}:{}),...(args.estimate?{estimate:{label:args.estimate,assignmentEn:args.assignment?.en??agent.assignment.en,recordedAt:Date.now()}}:{}),report:{assignmentEn:args.assignment?.en??agent.assignment.en,result:args.result,remaining:args.remaining,evidence:args.evidence,recordedAt:Date.now()},updatedAt:Date.now()});
 return {saved:true};
}});
