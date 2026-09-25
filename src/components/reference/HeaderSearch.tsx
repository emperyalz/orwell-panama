'use client';
import {useMemo,useState} from 'react';
import Link from 'next/link';
import {useQuery} from 'convex/react';
import {Search,ArrowRight} from 'lucide-react';
import {api} from '../../../convex/_generated/api';

const fold=(value:string)=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase().trim();

export function HeaderSearch(){
 const [search,setSearch]=useState('');
 const [focused,setFocused]=useState(false);
 const people=useQuery(api.politicians.list,{});
 const suggestions=useMemo(()=>{
  const query=fold(search);
  if(!query||!people)return [];
  return people.filter(person=>fold(person.name).includes(query)).slice(0,8);
 },[people,search]);
 return <div className="header-search" onBlur={event=>{if(!event.currentTarget.contains(event.relatedTarget))setFocused(false)}}>
  <form action="/" role="search"><Search size={19}/><input type="search" name="search" aria-label="Buscar políticos" placeholder="Buscar un nombre" autoComplete="off" value={search} onFocus={()=>setFocused(true)} onChange={event=>setSearch(event.target.value)}/><button type="submit" aria-label="Buscar"><ArrowRight size={16}/></button></form>
  {focused&&search.trim()&&<div className="header-search-results" role="listbox" aria-label="Perfiles que coinciden">
   {suggestions.length?suggestions.map(person=><Link key={person._id} role="option" aria-selected={false} href={`/politician/${person.externalId}`} onClick={()=>setFocused(false)}><img src={person.headshot} alt=""/><span><strong>{person.name}</strong><small>{person.role} · {person.province}</small></span></Link>):<p role="status">No encontramos ese perfil</p>}
  </div>}
 </div>;
}
