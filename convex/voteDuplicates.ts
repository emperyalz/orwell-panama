import {internalMutation} from './_generated/server';
import {v} from 'convex/values';

/** One-off: remove votingRecords rows that are field-for-field copies of another row
 * (the March seed ran twice). Works one deputy per call: pass the previous deputyId as
 * `after`, repeat until `next` is null. Returns the removed rows so the caller can keep
 * them as a restorable backup. */
export const deleteDuplicateVotes=internalMutation({args:{after:v.optional(v.number()),dryRun:v.boolean(),ignoreTimestamps:v.optional(v.boolean())},handler:async(ctx,{after,dryRun,ignoreTimestamps})=>{
 const first=await ctx.db.query('votingRecords').withIndex('by_deputyId',q=>after===undefined?q:q.gt('deputyId',after)).first();
 if(!first)return {next:null,removed:[]};
 const rows=await ctx.db.query('votingRecords').withIndex('by_deputyId',q=>q.eq('deputyId',first.deputyId)).collect();
 const seen=new Set<string>(),removed=[];
 for(const row of rows){
  const {_id,_creationTime,...all}=row;
  // The seed stamped createdAt/updatedAt per run, so a re-seeded copy differs only there.
  const {createdAt,updatedAt,...rest}=all,fields=ignoreTimestamps?rest:all;
  const key=JSON.stringify(Object.keys(fields).sort().map(k=>[k,(fields as any)[k]]));
  if(!seen.has(key)){seen.add(key);continue;}
  removed.push(row);
  if(!dryRun)await ctx.db.delete(_id);
 }
 return {next:first.deputyId,scanned:rows.length,removed};
}});
