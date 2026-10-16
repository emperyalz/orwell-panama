import {internalMutation,query} from './_generated/server';
import {statusFields} from './controllerStatusData';

/** Only the root-owned controller can publish measurements. No public writes. */
export const publish=internalMutation({args:statusFields,handler:async(ctx,args)=>{
 const now=Date.now();
 if(args.observedAt>now+5000||args.observedAt<now-120000||args.scopeItemKeys.length>200||args.providers.length>2||args.reason.length>2000)throw Error('Invalid controller observation');
 const previous=await ctx.db.query('projectControllerStatus').withIndex('by_key',q=>q.eq('key','hostinger')).unique();
 if(previous&&previous.observedAt>args.observedAt)return {ignored:true};
 if(previous)await ctx.db.replace(previous._id,{key:'hostinger',...args});
 else await ctx.db.insert('projectControllerStatus',{key:'hostinger',...args});
 return {recorded:true};
}});

/** Reactive queue observations are joined to measured budget data, never simulated. */
export const snapshot=query({args:{},handler:async ctx=>{
 const status=await ctx.db.query('projectControllerStatus').withIndex('by_key',q=>q.eq('key','hostinger')).unique();
 if(!status)return null;
 const now=Date.now(),[items,agents,tasks,events,monitors]=await Promise.all([
  ctx.db.query('projectDispatchItems').collect(),ctx.db.query('projectAgents').collect(),ctx.db.query('projectTasks').collect(),
  ctx.db.query('projectDispatchEvents').withIndex('by_time').order('desc').take(100),ctx.db.query('projectLeadMonitor').collect(),
 ]);
 const keys=new Set(status.scopeItemKeys),scoped=items.filter(i=>keys.has(i.key));
 const active=scoped.filter(i=>i.leaseUntil&&i.leaseUntil>now&&['running','qa_running','accept_running'].includes(i.state)).map(i=>({key:i.key,label:i.label,state:i.state,owner:i.activeActorName??i.lead,model:agents.find(a=>a.key===i.activeSessionId)?.model??(i.state==='accept_running'?'Deterministic checks':'Starting session'),lastProgressAt:i.lastProgressAt??i.updatedAt,leaseUntil:i.leaseUntil!}));
 const checked=new Set(tasks.flatMap(task=>(task.checklist??[]).filter(step=>step.done).map(step=>`${task.key}/${step.key}`)));
 const progress={total:keys.size,completed:[...keys].filter(key=>checked.has(key)).length,remaining:[...keys].filter(key=>!checked.has(key)).length};
 const blockers=scoped.filter(item=>item.state==='blocked').map(item=>({key:item.key,label:item.label,reason:item.blockedReason??'Missing recorded prerequisite',nextAction:item.nextAction??'',updatedAt:item.updatedAt}));
 const open=scoped.filter(i=>!['accepted','superseded'].includes(i.state));
 const monitor=monitors.at(0),paused=monitor?.dispatchPaused;
 return {observedAt:status.observedAt,state:active.length?'working':paused?'held':status.state,reason:paused?monitor.pauseReason.en:status.reason,scopeLabel:status.scopeLabel,scopeItemKeys:status.scopeItemKeys,allocation:status.allocation,providers:status.providers,runs:status.runs,active,progress,blockers,
  queue:{ready:open.filter(i=>['ready','triage_ready'].includes(i.state)).length,qa:open.filter(i=>['qa_ready','qa_running'].includes(i.state)).length,accept:open.filter(i=>['accept_ready','accept_running'].includes(i.state)).length,blocked:open.filter(i=>i.state==='blocked').length,scopeOpen:open.length,nonPilotOpen:tasks.filter(t=>t.status!=='superseded'&&!t.key.startsWith('subscription-agent-pilot')).reduce((n,t)=>n+(t.checklist??[]).filter(c=>!c.done).length,0)},
  events:events.filter(e=>keys.has(e.itemKey)).slice(0,10).map(e=>({itemKey:e.itemKey,kind:e.kind,actor:e.actor,at:e.at,detail:e.detail})),
 };
}});
