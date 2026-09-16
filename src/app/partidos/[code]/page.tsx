import Link from 'next/link';
import {notFound} from 'next/navigation';
import {ArrowLeft,ArrowUpRight} from 'lucide-react';
import {getDirectory} from '@/lib/reference-data';
import {PARTY_LABELS,normalizePartyCode,getPartyLogoPath} from '@/lib/constants';
import {Portrait} from '@/components/reference/Portrait';
export default async function Party({params}:{params:Promise<{code:string}>}){
 const {code}=await params;const party=normalizePartyCode(code);const people=(await getDirectory()).filter(p=>normalizePartyCode(p.party)===party);if(!people.length&&!PARTY_LABELS[party])notFound();
 return <div className="reference-world"><div className="reference-wrap entity-page party-detail"><Link className="directory-back-pill" href="/partidos"><ArrowLeft size={16}/>Todos los partidos</Link><div className="entity-title"><img src={getPartyLogoPath(party)} alt=""/><div><h1 data-no-translate={party==='IND'?undefined:true}>{PARTY_LABELS[party]||party}</h1><p><span>{people.length} perfiles</span> <span>vinculados en el directorio</span></p></div></div><p className="biography">La agrupación corresponde al registro del directorio. Los cambios de afiliación requieren una fuente y fecha propias.</p><div className="related-grid">{people.map(p=><Link className="related-person" key={p.externalId} href={`/politician/${p.externalId}`}><Portrait src={p.hasHeadshot?p.headshot:undefined} name={p.name}/><div><strong data-no-translate>{p.name}</strong><span>{p.role} · <span data-no-translate>{p.province}</span></span></div><ArrowUpRight size={18}/></Link>)}</div></div></div>;
}
