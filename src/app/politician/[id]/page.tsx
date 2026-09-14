import type {Metadata} from 'next';
import {getProfile} from '@/lib/reference-data';
import ProfilePage from '@/components/reference/ProfilePage';
type Props={params:Promise<{id:string}>};
export async function generateMetadata({params}:Props):Promise<Metadata>{const {id}=await params;const data=await getProfile(id);if(!data)return {title:'Perfil no encontrado'};const p=data.person;return {title:`${p.name}, ${p.role} | ORWELL Política`,description:`Perfil de ${p.name}: partido, trayectoria, documentos públicos y archivo de votaciones. Consulta fuentes y cobertura.`,alternates:{canonical:`https://orwell-panama.vercel.app/politician/${id}`},openGraph:{type:'profile',title:`${p.name} | ORWELL Política`}};}
export default function Page({params}:Props){return <ProfilePage params={params}/>;}
