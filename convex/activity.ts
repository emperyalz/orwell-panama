import {query,internalQuery,internalMutation} from './_generated/server';
import {v} from 'convex/values';
export const list=query({args:{politicianId:v.optional(v.id('politicians')),kind:v.optional(v.union(v.literal('news'),v.literal('social'))),limit:v.optional(v.number())},handler:async(ctx,args)=>{
 const limit=Math.min(args.limit||12,50);
 const rows=args.politicianId?await ctx.db.query('activity').withIndex('by_politician_date',q=>q.eq('politicianId',args.politicianId!)).order('desc').filter(q=>args.kind?q.eq(q.field('kind'),args.kind):true).take(limit):await ctx.db.query('activity').withIndex('by_published').order('desc').filter(q=>args.kind?q.eq(q.field('kind'),args.kind):true).take(limit*3);
 const unique=rows.filter((r,i)=>rows.findIndex(x=>x.sourceUrl===r.sourceUrl)===i).slice(0,limit);
 return Promise.all(unique.map(async r=>({...r,person:await ctx.db.get(r.politicianId)})));
}});
export const people=internalQuery({args:{},handler:ctx=>ctx.db.query('politicians').collect()});
export const ingest=internalMutation({args:{items:v.array(v.object({politicianId:v.id('politicians'),kind:v.union(v.literal('news'),v.literal('social')),sourceUrl:v.string(),sourceName:v.string(),title:v.string(),summary:v.optional(v.string()),platform:v.optional(v.string()),publishedAt:v.number(),imageUrl:v.optional(v.string())}))},handler:async(ctx,{items})=>{
 let inserted=0;for(const item of items){if(!/^https:\/\//.test(item.sourceUrl)||!Number.isFinite(item.publishedAt)||item.publishedAt>Date.now()+86400000)continue;const old=await ctx.db.query('activity').withIndex('by_politician_url',q=>q.eq('politicianId',item.politicianId).eq('sourceUrl',item.sourceUrl)).first();if(!old){await ctx.db.insert('activity',{...item,collectedAt:Date.now()});inserted++;}}return inserted;
}});
export const logRun=internalMutation({args:{kind:v.string(),inserted:v.number(),errors:v.array(v.string())},handler:(ctx,args)=>ctx.db.insert('collectionRuns',{...args,checkedAt:Date.now()})});
