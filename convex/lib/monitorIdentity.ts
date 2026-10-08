/** A collected post belongs to a directory account only through its verified handle. */
export const monitorPlatform=(platform:string)=>platform==='twitter'?'x_twitter':platform;
const handle=(value:string)=>value.trim().replace(/^@/,'').toLowerCase();
type Account={politicianId:string;platform:string;handle:string;verdict:string};
export function matchMonitorAccount(post:{platform:string;accountUsername?:string;postUrl:string},accounts:Account[]){
 const platform=monitorPlatform(post.platform),username=handle(post.accountUsername||'');
 if(!username||username==='unknown')return null;
 const matches=accounts.filter(account=>account.verdict==='CONFIRMED'&&account.platform===platform&&handle(account.handle)===username);
 if(matches.length!==1)return null;
 let url:URL;try{url=new URL(post.postUrl);}catch{return null;}
 if(url.protocol!=='https:')return null;
 const host=url.hostname.toLowerCase().replace(/^www\./,'');
 const hosts:Record<string,string[]>={x_twitter:['x.com','twitter.com'],instagram:['instagram.com'],tiktok:['tiktok.com'],facebook:['facebook.com','fb.watch']};
 if(!hosts[platform]?.includes(host))return null;
 // These platform URLs identify their author. Reject stale or cross-account source links.
 if(platform==='x_twitter'||platform==='tiktok'){
  const author=url.pathname.split('/')[1];
  if(handle(author||'')!==username)return null;
 }
 return matches[0];
}
