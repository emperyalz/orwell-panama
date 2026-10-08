import {query,internalMutation} from './_generated/server';
import {v} from 'convex/values';
import initialTasks from '../src/data/scoreboard.json';

const text=v.object({en:v.string(),es:v.string(),pt:v.string()});
const checklist=v.array(v.object({key:v.string(),label:text,done:v.boolean(),evidence:v.optional(v.string()),completedAt:v.optional(v.number()),completedBy:v.optional(v.array(v.string()))}));
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
 return tasks.map(({key,title,detail,status,icon,order,href,evidence,checklist,updatedAt,completedAt})=>({key,title,detail,status,icon,order,href,evidence,checklist,updatedAt,completedAt}));
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
 const items=args.checklist.map(item=>{
  if(!item.done)return {...item,completedAt:undefined,completedBy:undefined};
  const previous=task?.checklist?.find(step=>step.key===item.key);
  const completedAt=item.completedAt??previous?.completedAt??(!previous?.done?Date.now():undefined);
  const completedBy=item.completedBy??previous?.completedBy;
  if(!previous?.done&&(!completedBy?.length||completedBy.some(name=>!name.trim())))throw Error('Newly completed steps need named contributors');
  if(completedAt&&completedAt>Date.now())throw Error('Step completion cannot be in the future');
  return {...item,...(completedAt?{completedAt}:{}),...(completedBy?.length?{completedBy}: {})};
 });
 const value={...args,checklist:items,updatedAt:Date.now(),completedAt:args.status==='done'?(task?.completedAt??Date.now()):undefined};
 if(task)await ctx.db.patch(task._id,value);else await ctx.db.insert('projectTasks',value);
 return {key:args.key,status:args.status};
}});
