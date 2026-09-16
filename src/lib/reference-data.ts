import { cache } from 'react';
import { fetchQuery } from 'convex/nextjs';
import { api } from '../../convex/_generated/api';
export const getDirectory = cache(()=>fetchQuery(api.politicians.list,{}));
export const getPerson = cache((id:string)=>fetchQuery(api.politicians.getByExternalId,{externalId:id}));
export const getProfile = cache(async(id:string)=>{
 const person=await getPerson(id);
 if(!person) return null;
 const facts=await fetchQuery(api.politicianFacts.get,{politicianId:person._id});
 let dashboard=null;
 let unavailable=false;
 if(person.roleCategory==='Deputy') {
  try {dashboard=await fetchQuery(api.voting.getDeputyDashboard,{politicianId:person._id});} catch {unavailable=true;}
 }
 return {person,dashboard,unavailable,facts};
});

export const getProfileParty = cache((code:string)=>fetchQuery(api.parties.getByCode,{code}));
