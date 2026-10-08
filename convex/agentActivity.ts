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
 return {agents:agents.sort((a,b)=>b.lastActivityAt-a.lastActivityAt).map(({key,name,team,model,reasoning,assignment,status,lastActivityAt,updatedAt})=>({key,name,team,model,reasoning,assignment,status,lastActivityAt,updatedAt})),events:events.map(({agentKey,summary,kind,occurredAt})=>({agentKey,summary,kind,occurredAt})),receivedAt:recent.reduce((latest,event)=>Math.max(latest,event.receivedAt),0)};
}});

/** Trusted local collector only. Never accepts public browser writes. */
export const record=internalMutation({args:{key:v.string(),name:v.string(),team,model:v.string(),reasoning:v.string(),assignment:text,status,lastActivityAt:v.number(),eventId:v.string(),kind,summary:text},handler:async(ctx,args)=>{
 if(!args.key.trim()||!args.eventId.trim())throw Error('Agent and event identifiers are required');
 if(args.lastActivityAt>Date.now()+60_000)throw Error('Activity cannot be in the future');
 if(await ctx.db.query('projectAgentEvents').withIndex('by_event',q=>q.eq('eventId',args.eventId)).unique())return {duplicate:true};
 const {eventId,kind,summary,...agent}=args;
 const existing=await ctx.db.query('projectAgents').withIndex('by_key',q=>q.eq('key',args.key)).unique();
 if(!existing||args.lastActivityAt>=existing.lastActivityAt){
  const value={...agent,updatedAt:Date.now()};
  if(existing)await ctx.db.patch(existing._id,value);else await ctx.db.insert('projectAgents',value);
 }
 await ctx.db.insert('projectAgentEvents',{eventId,agentKey:args.key,kind,summary,occurredAt:args.lastActivityAt,receivedAt:Date.now()});
 return {duplicate:false};
}});
