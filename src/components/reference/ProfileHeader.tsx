'use client';
import Link from 'next/link';
import {usePathname} from 'next/navigation';
import {useSyncExternalStore} from 'react';
import {Search,ArrowLeft} from 'lucide-react';
import {LanguageSwitcher} from '@/components/i18n/LanguageRuntime';
import './profile-index.css';
const navigation=[{href:'/',label:'Personas'},{href:'/oficinas',label:'Cargos'},{href:'/partidos',label:'Partidos'},{href:'/destacados',label:'Actividad'},{href:'/proyectos',label:'Proyectos'},{href:'/metodologia',label:'Fuentes'},{href:'/retratos',label:'Retratos'}];
const subscribeLocation=(notify:()=>void)=>{window.addEventListener('popstate',notify);return()=>window.removeEventListener('popstate',notify);};
function editorLocation(){const query=new URLSearchParams(window.location.search);return query.get('path')||(query.has('politician')?`/politician/${query.get('politician')}`:'/');}
export function ProfileHeader({publicPath}:{publicPath?:string}){
 const pathname=usePathname();const editorPath=useSyncExternalStore(subscribeLocation,editorLocation,()=>publicPath||'/');
 const path=(pathname==='/multiplayer'?editorPath:pathname).split('?')[0];
 const active=path.startsWith('/retratos')?'/retratos':path.startsWith('/proyectos')?'/proyectos':path.startsWith('/partidos')?'/partidos':path.startsWith('/oficinas')?'/oficinas':/^\/(destacados|noticias)/.test(path)?'/destacados':path.startsWith('/metodologia')?'/metodologia':/^\/(politician|comparar)/.test(path)||path==='/'?'/':null;
 return <header className="index-header"><Link href="/" aria-label="ORWELL, directorio de Panamá"><img src="/icons/branding/orwell-black.svg" alt="ORWELL" width={161} height={32}/></Link><Link className="index-country" href="/">Panamá</Link><nav aria-label="Navegación principal">{navigation.map(item=><Link key={item.href} href={item.href} aria-current={active===item.href?'page':undefined}>{item.label}</Link>)}</nav><LanguageSwitcher compact/><form action="/" role="search"><Search size={19}/><input type="search" name="search" aria-label="Buscar políticos" placeholder="Buscar un nombre"/><button type="submit" aria-label="Buscar"><ArrowLeft size={16} style={{transform:'rotate(180deg)'}}/></button></form></header>;
}
