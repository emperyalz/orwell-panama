import snapshot from '../../data/elections/results-2024.json';
export const electionResults=snapshot.results;
export const electionSnapshot=snapshot;
export type ElectionResult=(typeof electionResults)[number];
const clean=(s:string)=>s.replace(/"[^"]*"/g,'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
export function electionForPerson(person:{name:string;roleCategory:string;circuit?:string;district?:string}){
 const kind=person.roleCategory==='Deputy'?'deputy':person.roleCategory==='Mayor'?'mayor':null;
 if(!kind)return null;
 const name=clean(person.name);
 const matches=electionResults.filter(r=>r.kind===kind&&clean(r.name)===name&&(kind!=='deputy'||r.territory===person.circuit)&&(kind!=='mayor'||!person.district||clean(r.territory)===clean(person.district)));
 return matches.length===1?matches[0]:null;
}
export {electionParty} from './election-party';
