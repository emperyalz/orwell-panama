import {mutation, query} from './_generated/server';
import {v} from 'convex/values';

function requireEditorSecret(secret:string){
 const expected=process.env.PORTRAIT_REVIEW_WRITE_SECRET;
 if(!expected||secret!==expected)throw new Error('Not authorized to edit portrait references');
}

export const listForPeople=query({
 args:{externalIds:v.array(v.string())},
 returns:v.array(v.object({
  _id:v.id('portraitReviewReferences'),externalId:v.string(),kind:v.union(v.literal('source'),v.literal('upload')),
  title:v.string(),sourcePage:v.optional(v.string()),imageUrl:v.optional(v.string()),storageId:v.optional(v.id('_storage')),
  sortOrder:v.number(),createdAt:v.number(),updatedAt:v.number(),
 })),
 handler:async(ctx,args)=>{
  if(args.externalIds.length>100)throw new Error('Too many profiles');
  const rows=await Promise.all(args.externalIds.map(externalId=>ctx.db.query('portraitReviewReferences').withIndex('by_externalId_order',q=>q.eq('externalId',externalId)).collect()));
  return rows.flat().filter(row=>!row.deletedAt).map(row=>({
   _id:row._id,externalId:row.externalId,kind:row.kind,title:row.title,sourcePage:row.sourcePage,imageUrl:row.imageUrl,
   storageId:row.storageId,sortOrder:row.sortOrder,createdAt:row.createdAt,updatedAt:row.updatedAt,
  }));
 },
});

export const seedInitial=mutation({
 args:{secret:v.string(),references:v.array(v.object({externalId:v.string(),title:v.string(),sourcePage:v.string(),imageUrl:v.string(),sortOrder:v.number()}))},
 returns:v.number(),
 handler:async(ctx,args)=>{
  requireEditorSecret(args.secret);
  if(args.references.length>100)throw new Error('Too many references');
  let inserted=0;const now=Date.now();
  for(const reference of args.references){
   const person=await ctx.db.query('politicians').withIndex('by_externalId',q=>q.eq('externalId',reference.externalId)).first();
   if(!person)continue;
   const existing=await ctx.db.query('portraitReviewReferences').withIndex('by_externalId_order',q=>q.eq('externalId',reference.externalId)).collect();
   if(existing.some(row=>row.sourcePage===reference.sourcePage&&row.imageUrl===reference.imageUrl))continue;
   await ctx.db.insert('portraitReviewReferences',{...reference,kind:'source',createdAt:now,updatedAt:now});inserted++;
  }
  return inserted;
 },
});

export const issueUploadUrl=mutation({
 args:{secret:v.string()},returns:v.string(),
 handler:async(ctx,args)=>{requireEditorSecret(args.secret);return ctx.storage.generateUploadUrl();},
});

export const addUploaded=mutation({
 args:{secret:v.string(),externalId:v.string(),storageId:v.id('_storage'),title:v.string()},
 returns:v.id('portraitReviewReferences'),
 handler:async(ctx,args)=>{
  requireEditorSecret(args.secret);
  const person=await ctx.db.query('politicians').withIndex('by_externalId',q=>q.eq('externalId',args.externalId)).first();
  if(!person)throw new Error('Profile not found');
  const metadata=await ctx.db.system.get('_storage',args.storageId);
  if(!metadata)throw new Error('Image not found');
  if(!['image/jpeg','image/png','image/webp','image/avif'].includes(metadata.contentType||''))throw new Error('Unsupported image type');
  if(metadata.size>8_000_000)throw new Error('Image exceeds 8 MB');
  const imageUrl=await ctx.storage.getUrl(args.storageId);
  if(!imageUrl)throw new Error('Image URL unavailable');
  const rows=await ctx.db.query('portraitReviewReferences').withIndex('by_externalId_order',q=>q.eq('externalId',args.externalId)).collect();
  const sortOrder=Math.max(0,...rows.map(row=>row.sortOrder))+1;
  const now=Date.now();
  return ctx.db.insert('portraitReviewReferences',{externalId:args.externalId,kind:'upload',title:args.title.slice(0,180),imageUrl,storageId:args.storageId,sortOrder,createdAt:now,updatedAt:now});
 },
});

export const remove=mutation({
 args:{secret:v.string(),id:v.id('portraitReviewReferences')},returns:v.null(),
 handler:async(ctx,args)=>{
  requireEditorSecret(args.secret);
  const row=await ctx.db.get(args.id);
  if(!row)throw new Error('Reference not found');
  await ctx.db.patch(args.id,{deletedAt:Date.now(),updatedAt:Date.now()});
  return null;
 },
});
