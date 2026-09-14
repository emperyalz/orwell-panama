'use client';
import {useMemo,useState} from 'react';
import Link from 'next/link';
import {Search,ArrowUpRight} from 'lucide-react';
import type {VoteRecord} from '@/lib/types';
import {displayDate} from '@/lib/reference';
const labels:Record<string,string>={a_favor:'A favor',en_contra:'En contra',abstencion:'Abstención'};
export function RecentVotes({votes,politicianId}:{votes:VoteRecord[];politicianId?:string}){
 const [search,setSearch]=useState('');const [count,setCount]=useState(10);
 const filtered=useMemo(()=>votes.filter(v=>`${v.votingTitle} ${v.questionText}`.toLowerCase().includes(search.toLowerCase())),[votes,search]);
 return <div><label className="vote-search"><Search size={16}/><input aria-label="Buscar en votaciones del archivo" value={search} onChange={e=>{setSearch(e.target.value);setCount(10)}} placeholder="Buscar proyecto o pregunta"/></label><p className="source-note">{filtered.length} resultados en los {votes.length} registros más recientes disponibles.</p><div className="vote-list">{filtered.slice(0,count).map((v,i)=><div className="vote-row" key={`${v.votingId}-${v.questionId}-${i}`}><time>{displayDate(v.sessionDate)}</time><div>{politicianId?<Link href={`/politician/${politicianId}/voto/${v.questionId}`}><strong>{v.votingTitle}</strong> <ArrowUpRight size={12}/></Link>:<strong>{v.votingTitle}</strong>}<details><summary>Ver pregunta</summary><p>{v.questionText}</p><p>Resultado de la pregunta: {v.questionPassed?'aprobada':'rechazada'}. No equivale por sí solo a la sanción de una ley.</p></details></div><span className={`vote-label ${v.vote}`}>{labels[v.vote]||v.vote}</span></div>)}</div>{!filtered.length&&<p className="record-empty">Sin resultados en esta muestra.</p>}{count<filtered.length&&<button className="record-button" onClick={()=>setCount(c=>c+10)}>Mostrar {Math.min(10,filtered.length-count)} registros más</button>}</div>;
}
