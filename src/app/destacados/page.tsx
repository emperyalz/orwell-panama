import {ActivityFeed} from '@/components/reference/ActivityFeed';
import {LegislativeFeed} from '@/components/reference/LegislativeFeed';
import {BillFeed} from '@/components/reference/BillFeed';
import '@/components/reference/profile-index.css';
export const metadata={title:'Actividad política | ORWELL Panamá',description:'Noticias, publicaciones y votaciones de la política panameña con fecha y fuente.'};
export default function Highlights(){return <div className="reference-world"><div className="reference-wrap explore-page"><header><span className="eyebrow">Panamá</span><h1>Actividad política</h1><p>Noticias, publicaciones y registros legislativos, reunidos desde sus fuentes.</p></header><ActivityFeed/><LegislativeFeed/><BillFeed/></div></div>;}
