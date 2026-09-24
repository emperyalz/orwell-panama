'use client';

import {useQuery} from 'convex/react';
import {api} from '../../convex/_generated/api';
import type {Id} from '../../convex/_generated/dataModel';

const allowedTypes=new Set(['image/jpeg','image/png','image/webp','image/avif']);
const maxBytes=8_000_000;

async function editRequest(payload:Record<string,unknown>){
 const response=await fetch('/api/portrait-review',{
  method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',body:JSON.stringify(payload),
 });
 const result=await response.json() as Record<string,unknown>;
 if(!response.ok)throw new Error(typeof result.error==='string'?result.error:'No se pudo guardar el cambio');
 return result;
}

export function usePortraitReview(externalIds:string[]){
 const references=useQuery(api.portraitReview.listForPeople,{externalIds});

 async function upload(externalId:string,file:File){
  if(!allowedTypes.has(file.type))throw new Error(`${file.name}: usa JPG, PNG, WebP o AVIF`);
  if(file.size>maxBytes)throw new Error(`${file.name}: el máximo es 8 MB`);
  const {uploadUrl}=await editRequest({action:'upload-url'});
  if(typeof uploadUrl!=='string')throw new Error('No se pudo preparar la carga');
  const response=await fetch(uploadUrl,{method:'POST',headers:{'Content-Type':file.type},body:file});
  if(!response.ok)throw new Error(`${file.name}: falló la carga`);
  const uploaded=await response.json() as {storageId?:string};
  if(!uploaded.storageId)throw new Error(`${file.name}: no se recibió el archivo`);
  await editRequest({action:'add',externalId,storageId:uploaded.storageId,title:file.name});
 }

 async function remove(id:Id<'portraitReviewReferences'>){
  await editRequest({action:'remove',id});
 }

 return {references,upload,remove};
}
