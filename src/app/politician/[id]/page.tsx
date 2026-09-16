import {siteUrl} from '@/lib/site';
import type {Metadata} from 'next';
import {getProfile} from '@/lib/reference-data';
import ProfilePage from '@/components/reference/ProfilePage';
type Props={params:Promise<{id:string}>};
export async function generateMetadata({params}:Props):Promise<Metadata>{const {id}=await params;const data=await getProfile(id);if(!data)return {title:'Perfil no encontrado'};const p=data.person;return {title:`${p.name}, ${p.role} | ORWELL Política`,description:`Perfil de ${p.name}: partido, trayectoria, documentos públicos y archivo de votaciones. Consulta fuentes y cobertura.`,alternates:{canonical:siteUrl(`/politician/${id}`)},openGraph:{type:'profile',title:`${p.name} | ORWELL Política`}};}
export default async function Page({params}:Props){const {id}=await params;const data=await getProfile(id);const structured=data?{'@context':'https://schema.org','@type':'Person',name:data.person.name,jobTitle:data.person.role,url:siteUrl(`/politician/${id}`),birthDate:data.facts?.birthDate,birthPlace:data.facts?.birthPlace}:null;return <>{structured&&<script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(structured).replace(/</g,'\\u003c')}}/>}<ProfilePage params={Promise.resolve({id})}/></>;}
