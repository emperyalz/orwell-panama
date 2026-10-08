import {electionResults,electionForPerson} from '@/lib/elections';
import {getDirectory} from '@/lib/reference-data';
import {ElectionWorkspace} from '@/components/reference/ElectionWorkspace';
export const metadata={title:'2024 Panama election results | ORWELL Politics'};
export default async function Elections(){
 const people=await getDirectory();
 const matched=new Map(people.flatMap(p=>{const result=electionForPerson(p);return result?[[result.id,{id:p.externalId,portrait:p.headshot,name:p.name}] as const]:[];}));
 return <ElectionWorkspace rows={electionResults.map(r=>({...r,profile:matched.get(r.id)}))}/>;
}
