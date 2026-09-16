import Bills from '@/app/proyectos/page';
import BillDetail from '@/app/proyectos/[ficha]/page';
import Vote from '@/app/politician/[id]/voto/[question]/page';
import Territories from '@/app/territorios/page';
import Committees from '@/app/comisiones/page';
import type {Metadata} from 'next';
import ProfilePage from '@/components/reference/ProfilePage';
import {getDirectory} from '@/lib/reference-data';
import {WorkshopLoader} from '@/components/workshop/WorkshopLoader';
import HomePage from '@/app/page';
import Offices from '@/app/oficinas/page';
import PartidosPage from '@/app/partidos/page';
import PartyPage from '@/app/partidos/[code]/page';
import Methodology from '@/app/metodologia/page';
import Highlights from '@/app/destacados/page';
import Compare from '@/app/comparar/page';
export const metadata:Metadata={title:'Multiplayer | ORWELL Panamá',robots:{index:false,follow:false}};
const tabs=['perfil','trayectoria','votaciones','propuestas','finanzas','redes','fuentes'];

type Query={politician?:string;tab?:string;session?:string;path?:string};
function pathSession(pathname:string){
 if(pathname==='/')return {id:'orwell-panama-site-personas',name:'Personas'};
 const vote=pathname.match(/^\/politician\/([^/]+)\/voto\/(\d+)$/);if(vote)return {id:`orwell-panama-${vote[1]}-vote-${vote[2]}`,name:'Votación'};
 if(pathname==='/territorios')return {id:'orwell-panama-site-territorios',name:'Territorios'};
 if(pathname.startsWith('/proyectos'))return {id:'orwell-panama-site-proyectos',name:'Proyectos'};
 if(pathname==='/comisiones')return {id:'orwell-panama-site-comisiones',name:'Comisiones'};
 if(pathname==='/destacados')return {id:'orwell-panama-site-destacados',name:'Actividad'};
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
  const vote=pathname.match(/^\/politician\/([^/]+)\/voto\/(\d+)$/);
  if(vote)content=<Vote params={Promise.resolve({id:vote[1],question:vote[2]})}/>;
  else if(pathname==='/territorios')content=<Territories searchParams={Promise.resolve(Object.fromEntries(requested.searchParams))}/>;
  else if(pathname==='/comisiones')content=<Committees searchParams={Promise.resolve({name:requested.searchParams.get('name')||undefined})}/>;
  else if(pathname==='/oficinas')content=<Offices/>;
  else if(pathname==='/partidos')content=<PartidosPage searchParams={Promise.resolve({name:requested.searchParams.get('name')||undefined})}/>;
  else if(pathname==='/proyectos')content=<Bills/>;
  else if(/^\/proyectos\/\d+$/.test(pathname))content=<BillDetail params={Promise.resolve({ficha:pathname.split('/')[2]})}/>;
  else if(pathname==='/metodologia')content=<Methodology/>;
  else if(pathname==='/destacados')content=<Highlights/>;
  else if(pathname==='/comparar')content=<Compare searchParams={Promise.resolve({a:requested.searchParams.get('a')||'',b:requested.searchParams.get('b')||''})}/>;
  else if(/^\/partidos\/[^/]+$/.test(pathname))content=<PartyPage params={Promise.resolve({code:pathname.split('/')[2]})}/>;
  else content=<HomePage/>;
  const page=pathSession(pathname);
  return <WorkshopLoader pageSessionId={page.id} name={page.name} publicPath={`${pathname}${requested.search}`} versionSession={query.session}>{content}</WorkshopLoader>;
 }
 const people=await getDirectory();const id=query.politician||'DEP-018';const person=people.find(p=>p.externalId===id);const tab=tabs.includes(query.tab||'')?query.tab!:'perfil';
 return <WorkshopLoader politicianId={id} name={person?.name||id} initialTab={tab} publicPath={`/politician/${id}`} versionSession={query.session}><ProfilePage params={Promise.resolve({id})} initialPanel={tab}/></WorkshopLoader>;
}
