'use node';
import {internalAction} from './_generated/server';
import {internal} from './_generated/api';
import {v} from 'convex/values';
import {ConvexHttpClient} from 'convex/browser';
import {makeFunctionReference} from 'convex/server';
import type {Doc} from './_generated/dataModel';
import {load} from 'cheerio';
const normalize=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9 ]/g,' ').replace(/\s+/g,' ').trim();
export const primeNews=internalAction({args:{},handler:async(ctx):Promise<{scheduled:number}>=>{const people:Doc<'politicians'>[]=await ctx.runQuery(internal.activity.people,{});for(let i=0;i<people.length;i++)await ctx.scheduler.runAfter(i*1000,internal.activityActions.news,{externalId:people[i].externalId});return {scheduled:people.length};}});
// No paid API calls or AI enrichment. Rotate six precise name searches per hour.
export const news=internalAction({args:{externalId:v.optional(v.string())},handler:async(ctx,args):Promise<{inserted:number;checked:number;errors:string[]}>=>{
 const people:Doc<'politicians'>[]=await ctx.runQuery(internal.activity.people,{});const offset=(Math.floor(Date.now()/3600000)*6)%Math.max(people.length,1);const selected=args.externalId?people.filter(p=>p.externalId===args.externalId):Array.from({length:Math.min(6,people.length)},(_,i)=>people[(offset+i)%people.length]);const errors:string[]=[];let inserted=0;
 for(const p of selected)try{
  const name=p.name.normalize('NFD').replace(/[\u0300-\u036f]/g,'');const aliases=p.externalId==='GOV-006'?[name,'Aixa Santamaria']:[name];const query=aliases.map(alias=>'"'+alias+'"').join(' OR ');const url=`https://news.google.com/rss/search?q=${encodeURIComponent('('+query+') Panamá when:90d')}&hl=es-419&gl=PA&ceid=PA:es-419`;
  const response=await fetch(url,{signal:AbortSignal.timeout(20000)});if(!response.ok)throw Error(`HTTP ${response.status}`);const xml=load(await response.text(),{xmlMode:true});const items=xml('item').toArray().slice(0,15).flatMap(node=>{const item=xml(node);const publishedAt=Date.parse(item.find('pubDate').text());const title=item.find('title').text();const text=normalize(title+' '+item.find('description').text());if(!Number.isFinite(publishedAt)||!aliases.some(alias=>text.includes(normalize(alias))))return [];return [{politicianId:p._id,kind:'news' as const,sourceUrl:item.find('link').text().trim(),sourceName:item.find('source').text()||'Google News',title,summary:load(item.find('description').text()).text().trim().slice(0,350),publishedAt}];});inserted+=await ctx.runMutation(internal.activity.ingest,{items});
 }catch(e){errors.push(`${p.externalId}: ${String(e)}`);}await ctx.runMutation(internal.activity.logRun,{kind:'news',inserted,errors});return {inserted,checked:selected.length,errors};
}});
// Reuse Monitor's collected posts, never rescrape or backfill its accounts here.
export const socialArchive=internalAction({args:{},handler:async(ctx):Promise<{inserted:number;matched:number}>=>{
 const people:Doc<'politicians'>[]=await ctx.runQuery(internal.activity.people,{});const monitor=new ConvexHttpClient('https://graceful-perch-508.convex.cloud');const posts=await monitor.query(makeFunctionReference<'query',{limit:number;category:string},Array<{entityName:string;platform:string;postUrl:string;caption?:string;postedAt:number;thumbnailStorageId?:string;thumbnailUrl?:string}>>('queries:getFeed'),{limit:500,category:'Politics'}) as Array<{entityName:string;platform:string;postUrl:string;caption?:string;postedAt:number;thumbnailStorageId?:string;thumbnailUrl?:string}>;
 const items=posts.flatMap(post=>{const author=people.filter(p=>normalize(p.name)===normalize(post.entityName));const matches=author;return matches.length===1?[{politicianId:matches[0]._id,kind:'social' as const,sourceUrl:post.postUrl,sourceName:post.entityName,title:post.caption?Array.from(post.caption).slice(0,180).join(''):'Publicación',summary:post.caption?Array.from(post.caption).slice(0,700).join(''):undefined,platform:post.platform==='twitter'?'x_twitter':post.platform,publishedAt:post.postedAt,...(post.thumbnailUrl?.startsWith('https://')?{imageUrl:post.thumbnailUrl}:{})}]:[];});let inserted=0;for(let i=0;i<items.length;i+=50)inserted+=await ctx.runMutation(internal.activity.ingest,{items:items.slice(i,i+50)});await ctx.runMutation(internal.activity.logRun,{kind:'social-archive',inserted,errors:[]});return {inserted,matched:items.length};
}});
