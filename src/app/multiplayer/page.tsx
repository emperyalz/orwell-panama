import type {Metadata} from 'next';
import ProfilePage from '@/components/reference/ProfilePage';
import {getDirectory} from '@/lib/reference-data';
import {WorkshopLoader} from '@/components/workshop/WorkshopLoader';
import HomePage from '@/app/page';
import Offices from '@/app/oficinas/page';
import PartidosPage from '@/app/partidos/page';
import PartyPage from '@/app/partidos/[code]/page';
import Methodology from '@/app/metodologia/page';
import Compare from '@/app/comparar/page';
export const metadata:Metadata={title:'Multiplayer | ORWELL Panamá',robots:{index:false,follow:false}};
const tabs=['perfil','trayectoria','votaciones','propuestas','finanzas','redes','fuentes'];

type Query={politician?:string;tab?:string;session?:string;path?:string};
function pathSession(pathname:string){
 if(pathname==='/')return {id:'orwell-panama-site-personas',name:'Personas'};
 if(pathname==='/oficinas')return {id:'orwell-panama-site-cargos',name:'Cargos'};
 if(pathname==='/partidos')return {id:'orwell-panama-site-partidos',name:'Partidos'};
 if(pathname==='/metodologia')return {id:'orwell-panama-site-fuentes',name:'Fuentes'};
 if(pathname==='/comparar')return {id:'orwell-panama-site-comparar',name:'Comparar'};
 const party=pathname.match(/^\/partidos\/([^/]+)$/);if(party)return {id:`orwell-panama-party-${party[1].toLowerCase()}`,name:'Partido'};
 return {id:'orwell-panama-site-personas',name:'Personas'};
}

export default async function Multiplayer({searchParams}:{searchParams:Promise<Query>}){
 const query=await searchParams;
 if(query.path){
  const requested=new URL(query.path,'https://orwell.local');const pathname=requested.pathname;
  let content:React.ReactNode;
  if(pathname==='/oficinas')content=<Offices/>;
  else if(pathname==='/partidos')content=<PartidosPage/>;
  else if(pathname==='/metodologia')content=<Methodology/>;
  else if(pathname==='/comparar')content=<Compare searchParams={Promise.resolve({a:requested.searchParams.get('a')||'',b:requested.searchParams.get('b')||''})}/>;
  else if(/^\/partidos\/[^/]+$/.test(pathname))content=<PartyPage params={Promise.resolve({code:pathname.split('/')[2]})}/>;
  else content=<HomePage/>;
  const page=pathSession(pathname);
  return <WorkshopLoader pageSessionId={page.id} name={page.name} publicPath={`${pathname}${requested.search}`} versionSession={query.session}>{content}</WorkshopLoader>;
 }
 const people=await getDirectory();const id=query.politician||'DEP-018';const person=people.find(p=>p.externalId===id);const tab=tabs.includes(query.tab||'')?query.tab!:'perfil';
 return <WorkshopLoader politicianId={id} name={person?.name||id} initialTab={tab} publicPath={`/politician/${id}`} versionSession={query.session}><ProfilePage params={Promise.resolve({id})} initialPanel={tab}/></WorkshopLoader>;
}
