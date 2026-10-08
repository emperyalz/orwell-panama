import snapshot from '../data/elections/results-2024.json';
import identities from '../data/elections/profile-links-2024.json';
export const electionResults=snapshot.results;
export const electionSnapshot=snapshot;
export type ElectionResult=(typeof electionResults)[number];
const clean=(s:string)=>s.replace(/"[^"]*"/g,'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
type ElectionPerson={externalId?:string;name:string;roleCategory:string;circuit?:string;district?:string};
/** Reviewed identity links take precedence over spelling and current-directory district metadata. */
export function electionForPerson(person:ElectionPerson){
 const kind=person.roleCategory==='Deputy'?'deputy':person.roleCategory==='Mayor'?'mayor':null;
 if(!kind)return null;
 const reviewed=identities.links.find(link=>link.politicianId===person.externalId);
 if(reviewed){
  // Fail closed if either identity or the source snapshot changes. Never silently reassign a portrait.
  if(reviewed.kind!==kind||clean(reviewed.profileName)!==clean(person.name))return null;
  const matches=electionResults.filter(r=>r.id===reviewed.electionId&&r.kind===reviewed.kind&&r.name===reviewed.electionName&&r.territory===reviewed.territory);
  return matches.length===1?matches[0]:null;
 }
 const matches=electionResults.filter(r=>r.kind===kind&&clean(r.name)===clean(person.name)&&(kind!=='deputy'||r.territory===person.circuit)&&(kind!=='mayor'||!person.district||clean(r.territory)===clean(person.district)));
 return matches.length===1?matches[0]:null;
}
export function officialElectionSource(result:ElectionResult){
 return result.kind==='deputy'?{
  page:'https://www.datosabiertos.gob.pa/dataset/te-proclamados-diputados-2024',
  report:'https://www.datosabiertos.gob.pa/dataset/8c4c4aef-f154-4f83-86a8-ed261afab29a/resource/a1b5d88e-ee06-4549-86f4-b62cd272ff45/download/cuadro-06-diputado-proclamados.pdf'
 }:{
  page:'https://www.datosabiertos.gob.pa/dataset/te-proclamados-alcaldes-2024',
  report:'https://www.datosabiertos.gob.pa/dataset/329a411a-07ae-47c7-b4fd-8845e4a01040/resource/65d0ca52-1806-4263-82b7-6fc63b925adf/download/cuadro-10-alcaldes-proclamados.pdf'
 };
}
export {electionParty} from './election-party';
