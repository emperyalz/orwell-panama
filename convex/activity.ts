import {query,internalQuery,internalMutation} from './_generated/server';
import {v} from 'convex/values';
import {paginationOptsValidator} from 'convex/server';
import type {Doc} from './_generated/dataModel';
const fingerprint=(value:string)=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+-\s+[^-]{2,35}$/,'').replace(/[^a-z0-9]+/g,' ').trim();
type Enriched=Doc<'activity'>&{person:Doc<'politicians'>|null};
function diverse(rows:Enriched[],limit:number,kind?:'news'|'social'){
 const seen=new Set<string>(),titles:string[]=[];const near=(a:string,b:string)=>{const aa=new Set(a.split(' ').filter(word=>word.length>2)),bb=new Set(b.split(' ').filter(word=>word.length>2));if(aa.size<4||bb.size<4)return false;const common=[...aa].filter(word=>bb.has(word)).length;return common/new Set([...aa,...bb]).size>=.82;};const candidates=rows.filter(row=>{const hasImage=Boolean(row.imageUrl)&&!row.imageUrl!.includes('/Uploads/noticias/banners/');const hasVisual=hasImage||/(?:instagram\.com|tiktok\.com|youtube\.com|youtu\.be)/i.test(row.sourceUrl);if(!hasVisual)return false;const key=fingerprint(row.title);const signature=key.length>12&&key!=='publicacion'?key:row.sourceUrl;if(seen.has(signature)||titles.some(title=>near(title,key)))return false;seen.add(signature);if(key.length>12)titles.push(key);return true;});
 const selected:Enriched[]=[];const counts={person:new Map<string,number>(),party:new Map<string,number>(),publisher:new Map<string,number>(),platform:new Map<string,number>(),day:new Map<string,number>()};
 const count=(map:Map<string,number>,key:string)=>map.get(key)||0;const add=(map:Map<string,number>,key:string)=>map.set(key,count(map,key)+1);
 const choose=(wanted:'news'|'social',relaxed=false)=>{const row=candidates.find(item=>!selected.includes(item)&&item.kind===wanted&&(relaxed||(count(counts.person,item.politicianId)<1&&count(counts.party,item.person?.partyFull||item.person?.party||'Sin partido')<2&&count(counts.publisher,item.sourceName)<2&&count(counts.day,new Date(item.publishedAt).toISOString().slice(0,10))<2&&(wanted==='news'||count(counts.platform,item.platform||'social')<2))));if(!row)return false;selected.push(row);add(counts.person,row.politicianId);add(counts.party,row.person?.partyFull||row.person?.party||'Sin partido');add(counts.publisher,row.sourceName);add(counts.platform,row.platform||'news');add(counts.day,new Date(row.publishedAt).toISOString().slice(0,10));return true;};
 if(kind){while(selected.length<limit&&choose(kind)){}while(selected.length<limit&&choose(kind,true)){}return selected;}
 const socialTarget=Math.min(Math.max(1,Math.ceil(limit/4)),candidates.filter(row=>row.kind==='social').length);let social=0;for(let slot=0;slot<limit;slot++){const wantSocial=social<socialTarget&&(slot%4===3||limit-slot<=socialTarget-social);if(wantSocial&&choose('social'))social++;else if(!choose('news')&&choose('social'))social++;}while(selected.length<limit&&(choose('news',true)||choose('social',true))){}return selected;
}
export const paginated=query({args:{politicianId:v.optional(v.id('politicians')),kind:v.optional(v.union(v.literal('news'),v.literal('social'))),paginationOpts:paginationOptsValidator},handler:async(ctx,args)=>{const base=args.politicianId?ctx.db.query('activity').withIndex('by_politician_date',q=>q.eq('politicianId',args.politicianId!)):ctx.db.query('activity').withIndex('by_published');const page=await base.order('desc').filter(q=>args.kind?q.eq(q.field('kind'),args.kind):true).paginate(args.paginationOpts);return {...page,page:await Promise.all(page.page.map(async r=>({...r,person:await ctx.db.get(r.politicianId)})))};}});
export const list=query({args:{politicianId:v.optional(v.id('politicians')),kind:v.optional(v.union(v.literal('news'),v.literal('social'))),limit:v.optional(v.number())},handler:async(ctx,args)=>{
 const limit=Math.min(args.limit||12,50);
 const take=Math.max(limit*8,100);
 const readKind=(kind:'news'|'social')=>args.politicianId
  ?ctx.db.query('activity').withIndex('by_politician_date',q=>q.eq('politicianId',args.politicianId!)).order('desc').filter(q=>q.eq(q.field('kind'),kind)).take(take)
  :ctx.db.query('activity').withIndex('by_published').order('desc').filter(q=>q.eq(q.field('kind'),kind)).take(take);
 const [news,social]=await Promise.all([
  args.kind==='social'?Promise.resolve([]):readKind('news'),
  args.kind==='news'?Promise.resolve([]):readKind('social'),
 ]);
 const rows=[...news,...social].sort((a,b)=>b.publishedAt-a.publishedAt);
 const enriched=await Promise.all(rows.map(async r=>({...r,person:await ctx.db.get(r.politicianId)})));
 return diverse(enriched,limit,args.kind);
}});
export const people=internalQuery({args:{},handler:ctx=>ctx.db.query('politicians').collect()});
export const ingest=internalMutation({args:{items:v.array(v.object({politicianId:v.id('politicians'),kind:v.union(v.literal('news'),v.literal('social')),sourceUrl:v.string(),sourceName:v.string(),title:v.string(),summary:v.optional(v.string()),platform:v.optional(v.string()),publishedAt:v.number(),imageUrl:v.optional(v.string()),sourceLogoUrl:v.optional(v.string()),mediaKind:v.optional(v.union(v.literal('image'),v.literal('video')))}))},handler:async(ctx,{items})=>{
 let inserted=0;for(const item of items){if(!/^https:\/\//.test(item.sourceUrl)||!Number.isFinite(item.publishedAt)||item.publishedAt>Date.now()+86400000)continue;const old=await ctx.db.query('activity').withIndex('by_politician_url',q=>q.eq('politicianId',item.politicianId).eq('sourceUrl',item.sourceUrl)).first();if(!old){await ctx.db.insert('activity',{...item,collectedAt:Date.now()});inserted++;}else if(item.imageUrl&&!old.imageUrl){await ctx.db.patch(old._id,{imageUrl:item.imageUrl,mediaKind:item.mediaKind});}}return inserted;
}});
export const logRun=internalMutation({args:{kind:v.string(),inserted:v.number(),errors:v.array(v.string())},handler:(ctx,args)=>ctx.db.insert('collectionRuns',{...args,checkedAt:Date.now()})});
