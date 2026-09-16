'use client';
import {useState} from 'react';
import {useQuery} from 'convex/react';
import Link from 'next/link';
import {ArrowUpRight,Newspaper} from 'lucide-react';
import {api} from '../../../convex/_generated/api';
import type {Id} from '../../../convex/_generated/dataModel';
import {displayDate,platformIcon,PLATFORM_NAMES} from '@/lib/reference';
export function ActivityFeed({politicianId,compact=false}:{politicianId?:Id<'politicians'>;compact?:boolean}){
 const [filter,setFilter]=useState<'all'|'news'|'social'>('all');const rows=useQuery(api.activity.list,{politicianId,kind:filter==='all'?undefined:filter,limit:compact?6:24});
 const visible=rows?.filter(r=>filter==='all'||r.kind===filter);
 return <section className="activity-feed" data-section-id="recent-activity"><header><div><span className="eyebrow">Noticias · publicaciones</span><h2>Actividad reciente</h2></div><nav aria-label="Tipo de actividad">{[['all','Todo'],['news','Noticias'],['social','Redes']].map(([id,label])=><button key={id} aria-pressed={filter===id} onClick={()=>setFilter(id as 'all'|'news'|'social')}>{label}</button>)}</nav></header>{!rows?<p role="status">Cargando actividad…</p>:visible?.length?<div className="activity-grid">{visible.map(r=><article key={r._id} className="activity-card"><div className="activity-source">{r.platform?<img src={platformIcon(r.platform)} alt="" width={20} height={20}/>:<Newspaper size={18}/>}<span>{r.platform?`${PLATFORM_NAMES[r.platform]||r.platform} · ${r.sourceName}`:r.sourceName}</span><time dateTime={new Date(r.publishedAt).toISOString()}>{displayDate(r.publishedAt)}</time></div><a href={r.sourceUrl} target="_blank" rel="noreferrer">{r.imageUrl&&<img className="activity-image" src={r.imageUrl} alt=""/>}<h3 data-no-translate>{r.title}</h3><ArrowUpRight size={17}/></a>{!compact&&r.summary&&<p data-no-translate>{r.summary}</p>}{!politicianId&&r.person&&<Link className="activity-person" href={`/politician/${r.person.externalId}`}>{r.person.name} · {r.person.role}</Link>}</article>)}</div>:<p className="record-empty">No hay publicaciones recogidas en esta categoría.</p>}<p className="source-note">Fecha original de publicación. Las noticias enlazan al medio; las publicaciones al autor. El archivo social conserva contenido histórico y no acredita actividad actual.</p></section>;
}
