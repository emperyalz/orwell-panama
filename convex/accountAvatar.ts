import {action, internalMutation} from './_generated/server';
import {api, internal} from './_generated/api';
import {v} from 'convex/values';

/** Refresh a TikTok account's own avatar after its profile URL is corrected. */
export const refreshTikTok=action({args:{id:v.id('accounts')},handler:async(ctx,{id})=>{
 const account=await ctx.runQuery(api.accounts.getById,{id});
 if(!account||account.platform!=='tiktok')throw Error('TikTok account not found');
 const profile=new URL(account.profileUrl);
 if(profile.protocol!=='https:'||!['www.tiktok.com','tiktok.com'].includes(profile.hostname))throw Error('Invalid TikTok profile URL');
 const handle=decodeURIComponent(profile.pathname.match(/^\/@([\w.]+)\/?$/)?.[1]||'');
 if(!handle)throw Error('TikTok profile URL needs an account handle');
 const page=await fetch(profile.toString(),{headers:{'user-agent':'Mozilla/5.0 (compatible; ORWELLProfileReview/1.0)'},redirect:'follow'});
 if(!page.ok)throw Error(`TikTok profile returned ${page.status}`);
 const html=await page.text();
 const user=html.match(new RegExp('"uniqueId":"'+handle.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'".{0,2000}?"avatarLarger":"([^"]+)"'));
 if(!user)throw Error('TikTok did not expose a verified avatar for this handle');
 const imageUrl=JSON.parse('"'+user[1]+'"') as string;
 const image=new URL(imageUrl);
 if(image.protocol!=='https:'||!image.hostname.endsWith('.tiktokcdn-us.com'))throw Error('Unexpected avatar host');
 const response=await fetch(imageUrl);
 const type=response.headers.get('content-type')?.split(';')[0];
 if(!response.ok||!type||!['image/jpeg','image/png','image/webp'].includes(type))throw Error('Profile avatar unavailable');
 const bytes=await response.arrayBuffer();
 if(bytes.byteLength>4_000_000)throw Error('Profile avatar exceeds 4 MB');
 const storageId=await ctx.storage.store(new Blob([bytes],{type}));
 const avatar=await ctx.storage.getUrl(storageId);
 if(!avatar)throw Error('Avatar storage URL unavailable');
 await ctx.runMutation(internal.accountAvatar.saveTikTok,{id,handle,profileUrl:profile.toString(),avatar,avatarStorageId:storageId});
 return avatar;
}});

export const saveTikTok=internalMutation({args:{id:v.id('accounts'),handle:v.string(),profileUrl:v.string(),avatar:v.string(),avatarStorageId:v.id('_storage')},handler:async(ctx,args)=>{
 const account=await ctx.db.get(args.id);
 if(!account||account.platform!=='tiktok'||account.profileUrl!==args.profileUrl)throw Error('Account changed during avatar refresh');
 await ctx.db.patch(args.id,{handle:args.handle,avatar:args.avatar,avatarStorageId:args.avatarStorageId,updatedAt:Date.now()});
}});
