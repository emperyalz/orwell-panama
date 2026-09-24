import {getServerSession} from 'next-auth';
import {ConvexHttpClient} from 'convex/browser';
import {NextRequest,NextResponse} from 'next/server';
import {authOptions} from '../../../../lib/auth';
import {api} from '../../../../convex/_generated/api';
import type {Id} from '../../../../convex/_generated/dataModel';

export const dynamic='force-dynamic';

export async function POST(request:NextRequest){
 const origin=request.headers.get('origin');
 if(origin&&origin!==request.nextUrl.origin)return NextResponse.json({error:'Invalid origin'},{status:403});
 const session=await getServerSession(authOptions);
 const role=(session?.user as {role?:string}|undefined)?.role;
 if(!session?.user?.email||!['king_admin','admin','editor'].includes(role||''))return NextResponse.json({error:'Sign in as an editor to change this gallery'},{status:401});
 const secret=process.env.PORTRAIT_REVIEW_WRITE_SECRET;
 const url=process.env.NEXT_PUBLIC_CONVEX_URL;
 if(!secret||!url)return NextResponse.json({error:'Portrait editor is not configured'},{status:503});
 let input:Record<string,unknown>;
 try{input=await request.json();}catch{return NextResponse.json({error:'Invalid request'},{status:400});}
 const client=new ConvexHttpClient(url);
 try{
  if(input.action==='upload-url'){
   const uploadUrl=await client.mutation(api.portraitReview.issueUploadUrl,{secret});
   return NextResponse.json({uploadUrl});
  }
  if(input.action==='add'&&typeof input.externalId==='string'&&typeof input.storageId==='string'&&typeof input.title==='string'){
   const id=await client.mutation(api.portraitReview.addUploaded,{secret,externalId:input.externalId,storageId:input.storageId as Id<'_storage'>,title:input.title});
   return NextResponse.json({id});
  }
  if(input.action==='remove'&&typeof input.id==='string'){
   await client.mutation(api.portraitReview.remove,{secret,id:input.id as Id<'portraitReviewReferences'>});
   return NextResponse.json({ok:true});
  }
  return NextResponse.json({error:'Invalid request'},{status:400});
 }catch(error){
  return NextResponse.json({error:error instanceof Error?error.message:'Could not update gallery'},{status:400});
 }
}
