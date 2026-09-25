'use client';

import {useEffect,useMemo,useRef,useState} from 'react';
import Link from 'next/link';
import {useSession} from 'next-auth/react';
import {ChevronLeft,ChevronRight,Plus,Trash2,UploadCloud} from 'lucide-react';
import type {Id} from '../../../convex/_generated/dataModel';
import {usePortraitReview} from '@/hooks/usePortraitReview';

type StartingReference={number:number;title:string;sourcePage:string;imageUrl:string;sourceHost:string};
type Person={id:string;category:'missing'|'replace';name:string;role:string;province:string;headshot:string|null;hasHeadshot:boolean;references:StartingReference[];pilot:string|null;fullDraft:string|null;variants:{label:string;src:string}[]};
type Reference={_id?:Id<'portraitReviewReferences'>;kind:'source'|'upload';title:string;sourcePage?:string;imageUrl?:string;sortOrder:number};

function PersonCard({person,references,canEdit,upload,remove}:{person:Person;references:Reference[];canEdit:boolean;upload:(id:string,file:File)=>Promise<void>;remove:(id:Id<'portraitReviewReferences'>)=>Promise<void>}){
 const input=useRef<HTMLInputElement>(null);
 const scroller=useRef<HTMLDivElement>(null);
 const isApproved=['ALC-001','ALC-002','ALC-003','ALC-004','ALC-005','ALC-006','ALC-010','DEP-009','DEP-025','LDR-ALZ','LDR-CD','LDR-MOCA','LDR-MOLIRENA','LDR-PP','LDR-PRD','LDR-RM'].includes(person.id);
 const [dragging,setDragging]=useState(false);
 const [busy,setBusy]=useState(false);
 const [progress,setProgress]=useState('');
 const [error,setError]=useState('');
 const [position,setPosition]=useState({left:false,right:false});
 useEffect(()=>{const el=scroller.current;if(!el)return;const refresh=()=>setPosition({left:el.scrollLeft>4,right:el.scrollLeft+el.clientWidth<el.scrollWidth-4});const observer=new ResizeObserver(refresh);observer.observe(el);const frame=requestAnimationFrame(refresh);return ()=>{observer.disconnect();cancelAnimationFrame(frame);};},[references.length,person.pilot,person.fullDraft,person.variants.length]);
 function updatePosition(){const el=scroller.current;if(el)setPosition({left:el.scrollLeft>4,right:el.scrollLeft+el.clientWidth<el.scrollWidth-4});}
 async function addFiles(files:FileList|File[]){
  const items=Array.from(files);if(!items.length||!canEdit)return;
  setBusy(true);setError('');
  const failures:string[]=[];
  for(let i=0;i<items.length;i++){
   setProgress(`Subiendo ${i+1} de ${items.length}…`);
   try{await upload(person.id,items[i]);}catch(e){failures.push(e instanceof Error?e.message:items[i].name);}
  }
  setBusy(false);setProgress('');
  if(failures.length)setError(failures.join(' · '));
  if(input.current)input.current.value='';
  requestAnimationFrame(updatePosition);
 }
 async function deleteReference(id:Id<'portraitReviewReferences'>){
  setError('');
  try{await remove(id);}catch(e){setError(e instanceof Error?e.message:'No se pudo eliminar la imagen');}
 }
 function scroll(direction:-1|1){scroller.current?.scrollBy({left:direction*(scroller.current.clientWidth*.85),behavior:'smooth'});}
 return <article className="portrait-review-person" id={person.id}>
  <div className="portrait-review-person-heading"><div><span className="portrait-review-id">{person.id}</span><h3>{person.name}</h3><p>{person.role} · {person.province}</p></div><Link href={`/politician/${person.id}`}>Ver perfil ↗</Link></div>
  <div className="portrait-review-images">
   <figure className="portrait-review-current"><div className="portrait-review-image">{person.hasHeadshot&&person.headshot?<img src={person.headshot} alt={`Retrato actual de ${person.name}`} loading="lazy"/>:<span>Sin fotografía</span>}</div><figcaption><strong>Actual</strong><span>{person.hasHeadshot?'En el perfil':'Espacio vacío'}</span></figcaption></figure>
   <div className={`portrait-review-gallery${dragging?' is-dragging':''}`} onDragEnter={e=>{if(canEdit){e.preventDefault();setDragging(true);}}} onDragOver={e=>{if(canEdit)e.preventDefault();}} onDragLeave={e=>{if(!e.currentTarget.contains(e.relatedTarget as Node))setDragging(false);}} onDrop={e=>{if(!canEdit)return;e.preventDefault();setDragging(false);void addFiles(e.dataTransfer.files);}}>
    <div className="portrait-review-gallery-toolbar"><span>{isApproved?'Imagen aprobada · ':person.pilot?`${1+person.variants.length} ${person.variants.length?'borradores':'borrador'} · `:''}{person.fullDraft?'1 retrato de cuerpo completo · ':''}{references.length} {references.length===1?'imagen':'imágenes'} de referencia</span><div className="portrait-review-actions">{canEdit&&<><input ref={input} type="file" accept="image/jpeg,image/png,image/webp,image/avif" multiple hidden onChange={e=>{if(e.target.files)void addFiles(e.target.files);}}/><button type="button" className="portrait-review-upload" onClick={()=>input.current?.click()} disabled={busy}><Plus size={16}/> Añadir fotos</button></>}<button type="button" aria-label={`Desplazar las referencias de ${person.name} a la izquierda`} onClick={()=>scroll(-1)} disabled={!position.left}><ChevronLeft size={17}/></button><button type="button" aria-label={`Desplazar las referencias de ${person.name} a la derecha`} onClick={()=>scroll(1)} disabled={!position.right}><ChevronRight size={17}/></button></div></div>
    <div className="portrait-review-scroller" ref={scroller} onScroll={updatePosition}>{person.pilot&&<figure className="portrait-review-reference portrait-review-pilot"><a className="portrait-review-image" href={person.pilot} target="_blank" rel="noreferrer" aria-label={`Abrir imagen de ${person.name}`}><img src={person.pilot} alt={`Imagen de ${person.name}`} loading="lazy"/></a><figcaption><strong>{isApproved?'Imagen aprobada':'Borrador IA'}</strong><a href={person.pilot} target="_blank" rel="noreferrer">Ver completo ↗</a></figcaption></figure>}{person.variants.map(variant=><figure className="portrait-review-reference portrait-review-pilot" key={variant.src}><a className="portrait-review-image" href={variant.src} target="_blank" rel="noreferrer" aria-label={`Abrir ${variant.label} de ${person.name}`}><img src={variant.src} alt={`${person.name}: ${variant.label}`} loading="lazy"/></a><figcaption><strong>{variant.label}</strong><a href={variant.src} target="_blank" rel="noreferrer">Ver completo ↗</a></figcaption></figure>)}{person.fullDraft&&<figure className="portrait-review-reference portrait-review-full-draft"><a className="portrait-review-image" href={person.fullDraft} target="_blank" rel="noreferrer" aria-label={`Abrir retrato de cuerpo completo de ${person.name}`}><img src={person.fullDraft} alt={`Retrato de cuerpo completo de ${person.name}`} loading="lazy"/></a><figcaption><strong>Cuerpo completo · revisión</strong><a href={person.fullDraft} target="_blank" rel="noreferrer">Ver completo ↗</a></figcaption></figure>}{references.map((reference,index)=><figure className="portrait-review-reference" key={reference._id??`initial-${index}`}>
     <div className="portrait-review-image">{reference.sourcePage?<a href={reference.sourcePage} target="_blank" rel="noreferrer" aria-label={`Ver fuente de referencia ${index+1}`}><img src={reference.imageUrl} alt={`Referencia ${index+1} de ${person.name}`} loading="lazy" referrerPolicy="no-referrer"/></a>:<img src={reference.imageUrl} alt={`Referencia ${index+1} de ${person.name}`} loading="lazy"/>}</div>
     <figcaption><strong>{reference.kind==='upload'?'Foto añadida':`Referencia ${index+1}`}</strong>{reference.sourcePage?<a href={reference.sourcePage} target="_blank" rel="noreferrer">{new URL(reference.sourcePage).hostname.replace(/^www\./,'')} ↗</a>:<span title={reference.title}>{reference.title}</span>}</figcaption>
     {canEdit&&reference._id&&<button type="button" className="portrait-review-delete" onClick={()=>void deleteReference(reference._id!)} aria-label={`Eliminar referencia ${index+1} de ${person.name}`} title="Eliminar foto"><Trash2 size={14}/> Eliminar</button>}
    </figure>)}</div>
    {canEdit&&<div className="portrait-review-drop-hint"><UploadCloud size={16}/>{busy?progress:'Arrastra una o varias fotos aquí · JPG, PNG, WebP o AVIF · máximo 8 MB cada una'}</div>}
    {dragging&&<div className="portrait-review-drop-overlay"><UploadCloud size={28}/> Suelta las fotos de {person.name}</div>}
    {error&&<p className="portrait-review-error" role="alert">{error}</p>}
   </div>
  </div>
 </article>;
}

export function PortraitReviewBoard({people}:{people:Person[]}){
 const {data:session,status}=useSession();
 const role=(session?.user as {role?:string}|undefined)?.role;
 const canEdit=!!role&&['king_admin','admin','editor'].includes(role);
 const ids=useMemo(()=>people.map(person=>person.id),[people]);
 const {references,upload,remove}=usePortraitReview(ids);
 const byPerson=useMemo(()=>{
  const map=new Map<string,Reference[]>();
  if(references)for(const reference of references){const rows=map.get(reference.externalId)??[];rows.push(reference);map.set(reference.externalId,rows);}
  return map;
 },[references]);
 function rowsFor(person:Person):Reference[]{
  if(references)return byPerson.get(person.id)??[];
  return person.references.map((reference,index)=>({kind:'source',title:reference.title,sourcePage:reference.sourcePage,imageUrl:reference.imageUrl,sortOrder:index+1}));
 }
 return <>
  <div className="portrait-review-access">{canEdit?<span>Editor activo. Puedes subir, arrastrar o eliminar fotos en cada perfil.</span>:status==='unauthenticated'?<span>Para cambiar estas fotos, <Link href="/login?callbackUrl=%2Fretratos">inicia sesión</Link>.</span>:null}</div>
  {([['missing','Sin fotografía'],['replace','Por mejorar']] as const).map(([category,title])=>{const group=people.filter(person=>person.category===category);return <section className="portrait-review-section" id={category} key={category}><div className="portrait-review-section-heading"><h2>{title}</h2><span>{group.length} perfiles</span></div><div className="portrait-review-list">{group.map(person=><PersonCard key={person.id} person={person} references={rowsFor(person)} canEdit={canEdit} upload={upload} remove={remove}/>)}</div></section>;})}
 </>;
}
