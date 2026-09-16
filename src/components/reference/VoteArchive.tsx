'use client';
import {useState} from 'react';
import {useQuery} from 'convex/react';
import {api} from '../../../convex/_generated/api';
import {RecentVotes} from '@/components/politician-detail/dashboard/RecentVotes';
export function VoteArchive({deputyId,politicianId}:{deputyId:number;politicianId:string}){
 const [offset,setOffset]=useState(0);const data=useQuery(api.voting.getVotesByDeputyPaginated,{deputyId,cursor:offset,limit:20});
 return <div>{data?<><p className="source-note">Registros {offset+1} a {offset+data.votes.length}. Consulta las páginas para recorrer el archivo completo.</p><RecentVotes key={offset} votes={data.votes} politicianId={politicianId}/><nav className="archive-pagination" aria-label="Páginas del registro legislativo"><button className="record-button" disabled={offset===0} onClick={()=>setOffset(n=>Math.max(0,n-20))}>Anteriores</button><button className="record-button" disabled={data.nextCursor===null} onClick={()=>setOffset(data.nextCursor!)}>Siguientes</button></nav></>:<p role="status">Cargando votaciones…</p>}</div>;
}
