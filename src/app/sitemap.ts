import type {MetadataRoute} from 'next';
import {fetchQuery} from 'convex/nextjs';
import {api} from '../../convex/_generated/api';
import {siteUrl} from '@/lib/site';
export const dynamic='force-dynamic';
export default async function sitemap():Promise<MetadataRoute.Sitemap>{
 const [people,parties,bills]=await Promise.all([fetchQuery(api.politicians.list,{}),fetchQuery(api.parties.list,{}),fetchQuery(api.bills.sitemap,{})]);
 const paths=['/','/oficinas','/partidos','/territorios','/comisiones','/destacados','/proyectos','/metodologia'];
 return [...paths.map(path=>({url:siteUrl(path),changeFrequency:'daily' as const})),...people.map(p=>({url:siteUrl(`/politician/${p.externalId}`),lastModified:new Date(p.updatedAt),changeFrequency:'weekly' as const})),...parties.map(p=>({url:siteUrl(`/partidos/${p.code.toLowerCase()}`),lastModified:new Date(p.updatedAt),changeFrequency:'weekly' as const})),...bills.map(b=>({url:siteUrl(`/proyectos/${b.ficha}`),lastModified:new Date(b.checkedAt),changeFrequency:'daily' as const}))];
}
