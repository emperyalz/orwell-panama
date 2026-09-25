import type {Metadata} from 'next';
import {getDirectory} from '@/lib/reference-data';
import {PortraitReviewBoard} from '@/components/portrait-review/PortraitReviewBoard';
import review from '@/data/portrait-review.json';
import pilots from '@/data/portrait-pilots.json';
import fullDrafts from '@/data/portrait-full-drafts.json';
import variants from '@/data/portrait-variants.json';
import './portrait-review.css';

export const dynamic='force-dynamic';
export const metadata:Metadata={title:'Revisión de retratos | ORWELL Política',robots:{index:false,follow:false}};

export default async function PortraitReview(){
 const directory=await getDirectory();
 const byId=new Map(directory.map(person=>[person.externalId,person]));
 const people=review.entries.flatMap(entry=>{const person=byId.get(entry.id);return person?[{id:entry.id,category:entry.category as 'missing'|'replace',name:person.name,role:person.role,province:person.province,headshot:person.headshot??null,hasHeadshot:person.hasHeadshot,references:entry.references,pilot:pilots[entry.id as keyof typeof pilots]??null,fullDraft:fullDrafts[entry.id as keyof typeof fullDrafts]??null,variants:variants[entry.id as keyof typeof variants]??[]}]:[];});
 return <div className="reference-world portrait-review"><div className="reference-wrap">
  <header className="portrait-review-intro"><span className="portrait-review-eyebrow">Revisión temporal · 24 septiembre 2026</span><h1>Retratos por revisar.</h1><p>Auditoría inicial de 17 perfiles: 8 sin fotografía y 9 con una imagen que no encajaba con la presentación del directorio. Aquí se comparan los retratos aprobados, los borradores y sus referencias.</p><nav aria-label="Secciones de retratos"><a href="#missing">Sin fotografía inicial · 8</a><a href="#replace">Por mejorar · 9</a></nav><p className="portrait-review-disclosure">Las fotos de referencia enlazan a sus fuentes. Los derechos de reutilización deben comprobarse antes de adoptar una foto o usarla como material de edición.</p></header>
  <PortraitReviewBoard people={people}/>
 </div></div>;
}
