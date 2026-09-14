import Link from 'next/link';
import {getDirectory} from '@/lib/reference-data';
import {ROLE_CATEGORIES} from '@/lib/constants';
export const metadata={title:'Cargos públicos | ORWELL Política'};
export default async function Offices(){const people=await getDirectory();return <div className="reference-world"><div className="reference-wrap entity-page"><h1>Cargos públicos de Panamá</h1><p className="biography">Explora los perfiles disponibles por función. Las cifras muestran la cobertura del directorio.</p><div className="office-list">{ROLE_CATEGORIES.map(r=><Link key={r.value} href={`/?role=${encodeURIComponent(r.value)}`}><h2>{r.label}</h2><span>{people.filter(p=>p.roleCategory===r.value||(r.value==='Party Leader'&&p.isPartyLeader)).length} perfiles</span></Link>)}</div></div></div>}
