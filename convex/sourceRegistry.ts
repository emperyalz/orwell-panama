import {query} from './_generated/server';

export const summary=query({args:{},handler:async ctx=>{
 const [activity,accounts,people,bills]=await Promise.all([
  ctx.db.query('activity').collect(),ctx.db.query('accounts').collect(),ctx.db.query('politicians').collect(),ctx.db.query('bills').collect(),
 ]);
 const publishers=new Map<string,{name:string;url:string;count:number;latest:number}>();
 const platforms=new Map<string,{platform:string;posts:number;accounts:number;latest:number}>();
 const socialStats=new Map<string,{posts:number;latest:number}>();
 const accountStats=new Map<string,{posts:number;latest:number}>();
 const add=(map:Map<string,{posts:number;latest:number}>,key:string,date:number)=>{const current=map.get(key)||{posts:0,latest:0};current.posts++;current.latest=Math.max(current.latest,date);map.set(key,current);};
 for(const row of activity){
  if(row.kind==='news'){
   const key=row.sourceName.trim().toLocaleLowerCase('es');const current=publishers.get(key);
   if(current){current.count++;current.latest=Math.max(current.latest,row.publishedAt);}else publishers.set(key,{name:row.sourceName,url:row.sourceUrl,count:1,latest:row.publishedAt});
  }else if(row.platform){const current=platforms.get(row.platform)||{platform:row.platform,posts:0,accounts:0,latest:0};current.posts++;current.latest=Math.max(current.latest,row.publishedAt);platforms.set(row.platform,current);add(socialStats,`${row.politicianId}:${row.platform}`,row.publishedAt);
   const match=row.platform==='tiktok'?row.sourceUrl.match(/tiktok\.com\/@([^/?#]+)/i):row.platform==='x_twitter'?row.sourceUrl.match(/(?:x|twitter)\.com\/([^/?#]+)\/status\//i):null;
   if(match)add(accountStats,`${row.politicianId}:${row.platform}:${match[1].toLocaleLowerCase()}`,row.publishedAt);
  }
 }
 for(const account of accounts){const current=platforms.get(account.platform)||{platform:account.platform,posts:0,accounts:0,latest:0};current.accounts++;platforms.set(account.platform,current);}
 const peopleById=new Map(people.map(person=>[String(person._id),person]));
 return {
  publishers:[...publishers.values()].sort((a,b)=>b.count-a.count||a.name.localeCompare(b.name,'es')),
  platforms:[...platforms.values()].sort((a,b)=>b.posts-a.posts),
  socialAccounts:accounts.map(account=>{const identified=account.platform==='tiktok'||account.platform==='x_twitter';const stats=identified?accountStats.get(`${account.politicianId}:${account.platform}:${account.handle.replace(/^@/,'').toLocaleLowerCase()}`):socialStats.get(`${account.politicianId}:${account.platform}`);return {personName:peopleById.get(String(account.politicianId))?.name||'Perfil sin identificar',platform:account.platform,handle:account.handle,profileUrl:account.profileUrl,avatar:account.avatar,posts:stats?.posts||0,lastArchivedAt:stats?.latest||null,archiveScope:identified?'account':'person-platform'};}).sort((a,b)=>a.personName.localeCompare(b.personName,'es')||a.platform.localeCompare(b.platform)),
  totals:{news:activity.filter(r=>r.kind==='news').length,social:activity.filter(r=>r.kind==='social').length,profilesWithActivity:new Set(activity.map(r=>String(r.politicianId))).size,accounts:accounts.length,profiles:people.length,bills:bills.length},
 };
}});
