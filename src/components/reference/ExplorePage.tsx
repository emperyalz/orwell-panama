import Link from 'next/link';
import {ArrowUpRight,Plus} from 'lucide-react';
import {fetchQuery} from 'convex/nextjs';
import {api} from '../../../convex/_generated/api';
import {getDirectory} from '@/lib/reference-data';
import {Portrait} from './Portrait';
import {getPartyLogoPath,normalizePartyCode} from '@/lib/constants';
import {ProvinceMap} from './ProvinceMap';
import './profile-index.css';

export async function ExplorePage({kind,query={}}:{kind:'territory'|'committee'|'party';query?:{province?:string;circuit?:string;district?:string;name?:string}}){
 const people=await getDirectory();
 const memberships=kind==='committee'?await fetchQuery(api.transparency.listMemberships,{}):[];
 const groups=new Map<string,typeof people>();
 if(kind==='committee'){for(const row of memberships)for(const name of row.commissions){const person=people.find(p=>p._id===row.politicianId);if(person)groups.set(name,[...(groups.get(name)||[]),person]);}}
 else for(const p of people){const name=kind==='party'?p.partyFull:query.circuit!==undefined?p.circuit:query.district!==undefined?p.district:p.province;if(name)groups.set(name,[...(groups.get(name)||[]),p]);}
 const selected=query.name||query.circuit||query.district||query.province;
 const title=kind==='committee'?'Comisiones':kind==='party'?'Partidos':query.circuit!==undefined?'Circuitos electorales':query.district!==undefined?'Distritos':'Provincias';
 const description=kind==='committee'?'Encuentra las personas vinculadas a cada comisión registrada, en todos los cargos del directorio.':kind==='party'?'Encuentra las personas vinculadas a cada partido o agrupación, en todos los cargos del directorio.':'Encuentra las personas vinculadas a cada territorio, en todos los cargos del directorio.';
 const territoryMode=query.circuit!==undefined?'circuit':query.district!==undefined?'district':'province';
 return <div className="reference-world"><div className="reference-wrap explore-page"><header><span className="eyebrow">Explorar Panamá</span><h1>{title}</h1><p>{description}</p></header>{kind==='territory'&&<nav className="explore-switch" aria-label="Tipo de territorio"><Link aria-current={territoryMode==='province'?'page':undefined} href="/territorios">Provincias</Link><Link aria-current={territoryMode==='circuit'?'page':undefined} href="/territorios?circuit=">Circuitos</Link><Link aria-current={territoryMode==='district'?'page':undefined} href="/territorios?district=">Distritos</Link></nav>}<div className="explore-groups">{[...groups].sort(([a],[b])=>a.localeCompare(b,'es')).map(([name,members])=><details key={name} open={selected===name}><summary>{kind==='party'?<img src={getPartyLogoPath(normalizePartyCode(members[0].party))} alt="" width={48} height={48}/>:kind==='territory'&&query.circuit===undefined&&query.district===undefined?<ProvinceMap name={name}/>:null}<strong data-no-translate>{name}</strong><span>{members.length} perfiles</span><Plus className="explore-disclosure" size={20} aria-hidden="true"/></summary><div className="related-grid">{members.map(p=><Link className="related-person" key={p._id} href={`/politician/${p.externalId}`}><Portrait src={p.hasHeadshot?p.headshot:undefined} name={p.name}/><div><strong data-no-translate>{p.name}</strong><span>{p.role} · <span data-no-translate>{p.province}</span>{p.circuit?` · ${p.circuit}`:''}</span></div><ArrowUpRight size={18}/></Link>)}</div></details>)}</div>{kind==='committee'&&<p className="source-note">Membresía importada de Espacio Cívico. El período no está publicado en este registro. <Link href="/metodologia">Consultar cobertura</Link></p>}{kind==='territory'&&<p className="source-note">Los circuitos electorales y los distritos administrativos son ámbitos distintos. Solo se muestran asociaciones documentadas en el directorio. Mapas: Instituto Geográfico Nacional Tommy Guardia, a través de ArcGIS.</p>}</div></div>;
}
