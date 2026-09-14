'use client';
import dynamic from 'next/dynamic';
const WorkshopClient=dynamic(()=>import('./WorkshopClient'),{ssr:false,loading:()=> <p className="p-8">Abriendo Multiplayer…</p>});
export function WorkshopLoader(props:React.ComponentProps<typeof WorkshopClient>){return <WorkshopClient {...props}/>}
