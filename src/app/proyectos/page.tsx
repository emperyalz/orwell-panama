import {BillFeed} from '@/components/reference/BillFeed';
import '@/components/reference/profile-index.css';
import {siteUrl} from '@/lib/site';
export const metadata={title:'Proyectos y políticas | ORWELL Panamá',description:'Seguimiento de proyectos y anteproyectos, etapas oficiales y proponentes de la Asamblea Nacional.',alternates:{canonical:siteUrl('/proyectos')}};
export default function Bills(){return <div className="reference-world"><div className="reference-wrap explore-page"><header><span className="eyebrow">Asamblea Nacional</span><h1>Proyectos y políticas</h1><p>Consulta las fichas y sigue sus cambios de etapa.</p></header><BillFeed/></div></div>;}
