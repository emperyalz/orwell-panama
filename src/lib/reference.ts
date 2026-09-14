import type { FunctionReturnType } from 'convex/server';
import type { api } from '../../convex/_generated/api';
export type DirectoryPerson = FunctionReturnType<typeof api.politicians.getByExternalId> & {};
export type ProfileRecord = FunctionReturnType<typeof api.voting.getDeputyDashboard>;

/** Normalize imported epoch seconds/milliseconds and date-only strings in UTC. */
export function recordDate(value: string | number | null | undefined): string | null {
  if (value === null || value === undefined || value === '') return null;
  const raw = String(value).trim();
  let date: Date;
  if (/^\d{10,13}$/.test(raw)) {
    const n = Number(raw); date = new Date(raw.length <= 10 ? n * 1000 : n);
  } else if (/^\d{4}-\d{2}-\d{2}(T.*)?$/.test(raw)) {
    date = new Date(raw);
    if (!raw.includes('T') && !Number.isNaN(date.getTime()) && date.toISOString().slice(0,10) !== raw) return null;
  } else return null;
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0,10);
}
export function displayDate(value: string | number | null | undefined): string {
  const day = recordDate(value);
  return day ? new Intl.DateTimeFormat('es-PA',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}).format(new Date(day)) : 'Fecha no disponible';
}
export function archiveRange(data: ProfileRecord | null) {
  const dates = [...(data?.analytics?.attendanceDates ?? []), ...(data?.recentVotes ?? []).map(v=>v.sessionDate)].map(recordDate).filter((d):d is string=>!!d).sort();
  return dates.length ? {start:dates[0],end:dates[dates.length-1],label:`${dates[0].slice(0,4)}–${dates[dates.length-1].slice(0,4)}`} : null;
}
export function documentLinks(data: ProfileRecord | null) {
  const d = data?.transparency?.documents;
  return [
    {label:'Hoja de vida',url:d?.cvLocalUrl || d?.cvUrl},
    {label:'Propuesta política',url:d?.propuestaPoliticaLocalUrl || d?.propuestaPoliticaUrl},
    {label:'Declaración de intereses',url:d?.declaracionInteresesLocalUrl || d?.declaracionInteresesUrl},
    {label:'Declaración de patrimonio',url:d?.declaracionPatrimonioLocalUrl || d?.declaracionPatrimonioUrl},
  ].filter((d):d is {label:string;url:string}=>!!d.url);
}
export const PLATFORM_NAMES:Record<string,string>={instagram:'Instagram',x_twitter:'X',facebook:'Facebook',tiktok:'TikTok',youtube:'YouTube',linkedin:'LinkedIn',twitch:'Twitch',discord:'Discord'};
export const platformIcon=(p:string)=>`/icons/platforms/${p==='x_twitter'?'x-twitter':p}.svg`;
