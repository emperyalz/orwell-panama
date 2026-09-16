'use client';
import {useQuery} from 'convex/react';
import {ArrowUpRight} from 'lucide-react';
import {api} from '../../../convex/_generated/api';
import {displayDate} from '@/lib/reference';
export function LegislativeFeed(){const rows=useQuery(api.legislativeFeed.latest,{});return <section className="activity-feed"><header><h2>Actividad legislativa</h2></header>{!rows?<p role="status">Cargando actividad…</p>:<div className="activity-grid">{rows.map(r=><article key={r.id} className="activity-card"><div className="activity-source"><span>Asamblea Nacional</span><time dateTime={new Date(r.date).toISOString()}>{displayDate(r.date)}</time></div><a href={r.sourceUrl} target="_blank" rel="noreferrer"><h3 data-no-translate>{r.title}</h3><ArrowUpRight size={17}/></a></article>)}</div>}<p className="source-note">Votaciones publicadas por la Asamblea Nacional. El título conserva la redacción del registro oficial; no acredita la aprobación final de una ley.</p></section>;}
