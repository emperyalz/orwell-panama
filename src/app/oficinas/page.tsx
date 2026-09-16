import Link from 'next/link';
import {Plus,ArrowUpRight} from 'lucide-react';
import {getDirectory} from '@/lib/reference-data';
import {ROLE_CATEGORIES} from '@/lib/constants';
import {Portrait} from '@/components/reference/Portrait';
export const metadata={title:'Cargos públicos | ORWELL Política'};
export default async function Offices(){
 const people=await getDirectory();
 return <div className="reference-world"><div className="reference-wrap explore-page offices-page"><header><span className="eyebrow">Explorar Panamá</span><h1>Cargos públicos de Panamá</h1><p>Explora los perfiles disponibles por función. Las cifras muestran la cobertura del directorio.</p></header><div className="explore-groups">{ROLE_CATEGORIES.map(role=>{const members=people.filter(p=>p.roleCategory===role.value||(role.value==='Party Leader'&&p.isPartyLeader));return <details key={role.value}><summary><div className="office-avatar-stack" aria-hidden="true">{members.slice(0,4).map(p=><Portrait key={p._id} src={p.hasHeadshot?p.headshot:undefined} name={p.name}/>)}</div><strong>{role.label}</strong><span>{members.length} perfiles</span><Plus size={20} aria-hidden="true"/></summary><div className="related-grid">{members.map(p=><Link className="related-person" key={p._id} href={`/politician/${p.externalId}`}><Portrait src={p.hasHeadshot?p.headshot:undefined} name={p.name}/><div><strong data-no-translate>{p.name}</strong><span>{p.role} · <span data-no-translate>{p.province}</span></span></div><ArrowUpRight size={18}/></Link>)}{!members.length&&<p>No hay perfiles registrados en este cargo.</p>}</div></details>})}</div></div></div>;
}
