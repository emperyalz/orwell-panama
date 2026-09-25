import Link from 'next/link';
import {fetchQuery} from 'convex/nextjs';
import {api} from '../../../convex/_generated/api';
import {displayDate,PLATFORM_NAMES,platformIcon} from '@/lib/reference';
export const dynamic='force-dynamic';
export const metadata={title:'Fuentes y metodología | ORWELL Política'};
const official=[
 {name:'Asamblea Nacional de Panamá',scope:'Perfiles de diputados, votaciones electrónicas, reportes plenarios y seguimiento de proyectos de ley.',url:'https://www.asamblea.gob.pa/'},
 {name:'Ministerio de Gobierno',scope:'Perfiles y nombramientos de gobernadores publicados por la institución.',url:'https://www.mingob.gob.pa/'},
 {name:'Espacio Cívico',scope:'Biografías, comisiones, hojas de vida, declaraciones y documentos públicos enlazados.',url:'https://espaciocivico.org/'},
 {name:'ORWELL Monitor',scope:'Archivo histórico de publicaciones de cuentas identificadas. Conserva la fecha y el enlace del contenido original.',url:'https://orwellpanama.com/'},
 {name:'Google News RSS',scope:'Descubrimiento de noticias por nombre. Cada resultado enlaza al medio que publicó la nota.',url:'https://news.google.com/'},
 {name:'Instituto Geográfico Nacional Tommy Guardia',scope:'Geometrías cartográficas de provincias y comarcas servidas a través de ArcGIS.',url:'https://ignpanama.anati.gob.pa/'},
];
// Pair the publisher's own mark with its source name in the visual directory.
const publisherMarks: Record<string,string> = {
 'La Estrella de Panamá':'laestrella.png', 'laestrella.com.pa':'laestrella.png',
 'Telemetro':'telemetro.svg', 'tvn-2.com':'tvn.svg',
 'La Prensa Panamá':'laprensa.svg', 'www.ecotvpanama.com':'ecotv.svg',
 'Panamá América':'panamaamerica.png', 'Destino Panamá':'destinopanama.png',
 'El Siglo Panamá':'elsiglo-icon.png', 'midiario.com':'midiario.svg',
 'Mi Diario':'midiario.svg', 'ElCapitalFinanciero.com':'capitalfinanciero-mark.png',
 'El Universo':'eluniverso.svg', 'www.metrolibre.com':'metrolibre-icon.png',
 'CRÍTICA':'critica-red.png', 'Infobae':'infobae.svg',
};
const publisherLabels: Record<string,string> = {
 'tvn-2.com':'TVN', 'www.ecotvpanama.com':'ECO TV Panamá',
 'midiario.com':'Mi Diario', 'ElCapitalFinanciero.com':'El Capital Financiero',
 'www.metrolibre.com':'Metro Libre', 'laestrella.com.pa':'La Estrella de Panamá',
 'Ellas.pa':'Ellas', 'facebook.com':'Facebook', 'expreso.ec':'Expreso',
 'instagram.com':'Instagram', 'panamahoy.com.pa':'Panamá Hoy',
 'sdpnoticias':'SDP Noticias',
};
function publisherLabel(name:string){return publisherLabels[name]||name;}
const publisherDomains: Record<string,string> = {
 'Asamblea Nacional de Panamá':'asamblea.gob.pa', 'Ellas.pa':'ellas.pa',
 'facebook.com':'facebook.com', '617 News':'617news.com', 'CSS Noticias':'css.gob.pa',
 'El Comercio Perú':'elcomercio.pe', 'El Digital Panamá':'eldigitalpanama.com',
 'expreso.ec':'expreso.ec', 'Gob MX':'gob.mx', 'instagram.com':'instagram.com',
 'Ministerio de Gobierno':'mingob.gob.pa', 'Mupa':'mupa.gob.pa',
 'NODAL - Noticias de América Latina y el Caribe':'nodal.am', 'NTN24':'ntn24.com',
 'panamahoy.com.pa':'panamahoy.com.pa', 'Primicias':'primicias.ec',
 'sdpnoticias':'sdpnoticias.com', 'Servicio Nacional de Migración':'migracion.gob.pa',
 'Telemundo':'telemundo.com', 'Vistazo':'vistazo.com', 'YouTube':'youtube.com',
};
function publisherMark(name:string){
 const local=publisherMarks[name];
 if(local) return `/icons/media/${local}`;
 const domain=publisherDomains[name];
 return domain ? `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=128` : undefined;
}
export default async function Methodology(){
 const registry=await fetchQuery(api.sourceRegistry.summary,{});
 return <div className="reference-world"><article className="reference-wrap methodology source-methodology"><Link className="source-link" href="/">Volver a Panamá</Link><h1>El dato y su contexto.</h1><p className="biography">ORWELL reúne perfiles y registros públicos para facilitar su consulta. Cada fuente conserva su alcance; los vacíos permanecen visibles.</p><div className="source-totals"><div><strong>{registry.totals.profiles}</strong><span>perfiles públicos</span></div><div><strong>{registry.totals.news}</strong><span>noticias archivadas</span></div><div><strong>{registry.totals.social}</strong><span>publicaciones sociales</span></div><div><strong>{registry.totals.bills}</strong><span>proyectos seguidos</span></div></div><h2>Registro de fuentes institucionales</h2><div className="source-directory">{official.map(source=><a key={source.name} href={source.url} target="_blank" rel="noreferrer"><strong data-no-translate>{source.name}</strong><p>{source.scope}</p><span>Visitar fuente ↗</span></a>)}</div><h2>Medios de noticias en el archivo</h2><p>Estos son los medios que aparecen actualmente en los datos. El logotipo y el nombre identifican al editor de la noticia; el enlace abre una nota original de ese medio.</p><div className="source-table"><div className="source-table-head"><span>Medio</span><span>Noticias</span><span>Más reciente</span></div>{registry.publishers.map(source=><a key={source.name} href={source.url} target="_blank" rel="noreferrer" aria-label={publisherLabel(source.name)} title={publisherLabel(source.name)}><span className="publisher-identity">{publisherMark(source.name)&&<img className="publisher-mark" src={publisherMark(source.name)} alt=""/>}<strong data-no-translate>{publisherLabel(source.name)}</strong></span><span>{source.count}</span><time>{displayDate(source.latest)}</time></a>)}</div><h2>Plataformas y cuentas sociales</h2><p>Los autores sociales son las personas y cuentas del directorio; no son medios periodísticos. Los conteos describen el archivo disponible.</p><div className="source-table"><div className="source-table-head"><span>Plataforma</span><span>Cuentas</span><span>Publicaciones</span></div>{registry.platforms.map(source=><div key={source.platform}><span className="platform-identity"><img className="platform-mark" src={platformIcon(source.platform)} alt=""/><strong>{PLATFORM_NAMES[source.platform]||source.platform}</strong></span><span>{source.accounts}</span><span>{source.posts}</span></div>)}</div><h2>Directorio de cuentas sociales</h2><div className="source-table source-table-accounts"><div className="source-table-head"><span>Persona</span><span>Plataforma</span><span>Cuenta</span><span>Archivo</span></div>{registry.socialAccounts.map(source=><a key={`${source.personName}-${source.platform}-${source.handle}`} href={source.profileUrl} target="_blank" rel="noreferrer"><span className="account-person"><img className="account-avatar" src={source.avatar||platformIcon(source.platform)} alt={source.avatar?`${source.handle} avatar`:`${PLATFORM_NAMES[source.platform]||source.platform} icon`} loading="lazy"/><strong data-no-translate>{source.personName}</strong></span><span className="account-platform"><img className="platform-mark" src={platformIcon(source.platform)} alt={PLATFORM_NAMES[source.platform]||source.platform} title={PLATFORM_NAMES[source.platform]||source.platform}/></span><span data-no-translate>@{source.handle.replace(/^@/,'')}</span><span>{source.posts} publicaciones</span></a>)}</div><p className="source-note">Actividad disponible para {registry.totals.profilesWithActivity} perfiles. Las cifras se calculan desde el registro en vivo y cambian al ingresar nuevas fuentes.</p><h2>Qué significa cada fecha</h2><p>La última modificación del directorio indica cuándo se guardó su registro. No certifica que el cargo siga vigente. Las votaciones muestran la fecha de la sesión en UTC. Una importación sin fecha de corte se identifica como tal.</p><h2>Archivo legislativo</h2><p>Los registros combinan la importación histórica y nuevos reportes públicos del sistema electrónico de la Asamblea Nacional, comprobados diariamente. Incluyen titulares y suplentes de diferentes períodos. Una fecha con voto registrado acredita actividad en ese archivo; no permite calcular por sí sola una tasa de asistencia.</p><h2>Documentos y finanzas</h2><p>Los resúmenes extraídos automáticamente se distinguen del documento original. La planilla del despacho es un gasto de personal; no es el salario personal del diputado. El patrimonio declarado se mantiene separado de cualquier estimación de riqueza.</p><h2>Redes y actividad</h2><p>Las publicaciones se reutilizan del archivo de ORWELL Monitor, con su fecha original y enlace al autor. Su recogida histórica no acredita actividad reciente. Las noticias se deduplican por perfil y URL; ORWELL no genera el texto de las noticias.</p><h2>Cobertura y correcciones</h2><p>“No documentado” significa que falta evidencia en esta aplicación. No significa cero, ausencia de actividad o incumplimiento. Los números del directorio describen sus perfiles, no un censo completo del gobierno. Consulta siempre la fuente antes de citar un dato.</p></article></div>;
}
