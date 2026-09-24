import type {Metadata} from 'next';
import Link from 'next/link';
import {getDirectory} from '@/lib/reference-data';
import review from '@/data/portrait-review.json';
import './portrait-review.css';

export const dynamic='force-dynamic';
export const metadata:Metadata={title:'Revisión de retratos | ORWELL Política',robots:{index:false,follow:false}};

function Section({category,title,people}:{category:'missing'|'replace';title:string;people:Awaited<ReturnType<typeof getDirectory>>}){
 const byId=new Map(people.map(person=>[person.externalId,person]));
 const entries=review.entries.filter(entry=>entry.category===category);
 return <section className="portrait-review-section" id={category}>
  <div className="portrait-review-section-heading"><h2>{title}</h2><span>{entries.length} perfiles</span></div>
  <div className="portrait-review-list">{entries.map(entry=>{
   const person=byId.get(entry.id);
   if(!person)return null;
   return <article className="portrait-review-person" id={entry.id} key={entry.id}>
    <div className="portrait-review-person-heading"><div><span className="portrait-review-id">{entry.id}</span><h3>{person.name}</h3><p>{person.role} · {person.province}</p></div><Link href={`/politician/${entry.id}`}>Ver perfil ↗</Link></div>
    <div className="portrait-review-images">
     <figure className="portrait-review-current"><div className="portrait-review-image">{person.hasHeadshot&&person.headshot?<img src={person.headshot} alt={`Retrato actual de ${person.name}`} loading="lazy"/>:<span>Sin fotografía</span>}</div><figcaption><strong>Actual</strong><span>{person.hasHeadshot?'En el perfil':'Espacio vacío'}</span></figcaption></figure>
     {entry.references.map(reference=><figure key={reference.number}><a className="portrait-review-image" href={reference.sourcePage} target="_blank" rel="noreferrer"><img src={reference.imageUrl} alt={`Referencia ${reference.number} de ${person.name}`} loading="lazy" referrerPolicy="no-referrer"/></a><figcaption><strong>Referencia {reference.number}</strong><a href={reference.sourcePage} target="_blank" rel="noreferrer">{reference.sourceHost} ↗</a></figcaption></figure>)}
    </div>
   </article>;
  })}</div>
 </section>;
}

export default async function PortraitReview(){
 const people=await getDirectory();
 return <div className="reference-world portrait-review"><div className="reference-wrap">
  <header className="portrait-review-intro"><span className="portrait-review-eyebrow">Revisión temporal · 24 septiembre 2026</span><h1>Retratos por revisar.</h1><p>17 perfiles: 8 sin fotografía y 9 con una imagen que no encaja con la presentación del directorio. Reunimos referencias visuales antes de editar o sustituir los retratos.</p><nav aria-label="Secciones de retratos"><a href="#missing">Sin fotografía · 8</a><a href="#replace">Por mejorar · 9</a></nav><p className="portrait-review-disclosure">Estas imágenes son referencias de investigación, no retratos aprobados para publicación. Cada imagen enlaza a su fuente. Los derechos de reutilización deben comprobarse antes de adoptar una foto o usarla como material de edición.</p></header>
  <Section category="missing" title="Sin fotografía" people={people}/>
  <Section category="replace" title="Por mejorar" people={people}/>
 </div></div>;
}
