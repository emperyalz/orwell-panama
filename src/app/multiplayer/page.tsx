import type {Metadata} from 'next';
import ProfilePage from '@/components/reference/ProfilePage';
import {getDirectory} from '@/lib/reference-data';
import {WorkshopLoader} from '@/components/workshop/WorkshopLoader';
export const metadata:Metadata={title:'Multiplayer | ORWELL Panamá',robots:{index:false,follow:false}};
const tabs=['perfil','trayectoria','votaciones','propuestas','finanzas','redes','fuentes'];
export default async function Multiplayer({searchParams}:{searchParams:Promise<{politician?:string;tab?:string;session?:string}>}){
 const query=await searchParams;const people=await getDirectory();const id=query.politician||'DEP-018';const person=people.find(p=>p.externalId===id);const tab=tabs.includes(query.tab||'')?query.tab!:'perfil';
 return <WorkshopLoader politicianId={id} name={person?.name||id} initialTab={tab} versionSession={query.session}><ProfilePage params={Promise.resolve({id})} initialPanel={tab}/></WorkshopLoader>;
}
