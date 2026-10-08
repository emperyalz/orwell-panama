import {query} from './_generated/server';

// Describes the stored archive. It never estimates audience, sentiment or reach.
export const archive=query({args:{},handler:async ctx=>{
 const [posts,people,accounts,runs,lastSocialImport]=await Promise.all([
  ctx.db.query('activity').filter(q=>q.eq(q.field('kind'),'social')).collect(),
  ctx.db.query('politicians').collect(),ctx.db.query('accounts').collect(),
  ctx.db.query('collectionRuns').order('desc').take(20),
  ctx.db.query('collectionRuns').withIndex('by_kind',q=>q.eq('kind','social-archive')).order('desc').first(),
 ]);
 const buckets=new Map<string,{person:string;platform:string;month:string;format:string;count:number;latest:number}>();
 const examples=new Map<string,{person:string;platform:string;url:string;title:string;date:number;format:string}>();
 for(const post of posts){
  if(!Number.isFinite(post.publishedAt))continue;
  const person=String(post.politicianId),platform=post.platform||'unknown';
  const month=new Date(post.publishedAt).toISOString().slice(0,7);
  const format=/tiktok\.com\/@[^/]+\/video\/|\/reel\/|\/reels\/|\/shorts\//i.test(post.sourceUrl)?'short':post.mediaKind==='video'?'video':post.mediaKind==='image'?'image':'unspecified';
  const key=[person,platform,month,format].join(':');
  const old=buckets.get(key)||{person,platform,month,format,count:0,latest:0};
  old.count++;old.latest=Math.max(old.latest,post.publishedAt);buckets.set(key,old);
  const exampleKey=[person,platform,format].join(':');
  if(!examples.has(exampleKey)||examples.get(exampleKey)!.date<post.publishedAt)examples.set(exampleKey,{person,platform,format,url:post.sourceUrl,title:post.title,date:post.publishedAt});
 }
 return {people:people.map(p=>({id:String(p._id),externalId:p.externalId,name:p.name,portrait:p.headshot,party:p.party,province:p.province})),
  buckets:[...buckets.values()].sort((a,b)=>a.month.localeCompare(b.month)),
  examples:[...examples.values()].sort((a,b)=>b.date-a.date),
  accounts:accounts.map(a=>{const identified=a.platform==='tiktok'||a.platform==='x_twitter';const handle=a.handle.replace(/^@/,'').toLowerCase();const records=posts.filter(p=>{if(p.politicianId!==a.politicianId||p.platform!==a.platform)return false;if(!identified)return true;const match=a.platform==='tiktok'?p.sourceUrl.match(/tiktok\.com\/@([^/?#]+)/i):p.sourceUrl.match(/(?:x|twitter)\.com\/([^/?#]+)\/status\//i);return match?.[1].toLowerCase()===handle;});return {person:String(a.politicianId),platform:a.platform,handle:a.handle,url:a.profileUrl,avatar:a.avatar,verdict:a.verdict,posts:records.length,latest:records.reduce((max,p)=>Math.max(max,p.publishedAt),0),scope:identified?'account':'person-platform'};}),
  runs:runs.map(r=>({kind:r.kind,date:r.checkedAt,inserted:r.inserted,errors:r.errors.length})),
  lastSocialImport:lastSocialImport?{date:lastSocialImport.checkedAt,inserted:lastSocialImport.inserted,errors:lastSocialImport.errors.length}:null,
 };
}});
