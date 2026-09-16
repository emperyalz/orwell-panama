import {ExplorePage} from '@/components/reference/ExplorePage';
export const metadata={title:'Comisiones | ORWELL Panamá'};
export default async function Committees({searchParams}:{searchParams:Promise<{name?:string}>}){return <ExplorePage kind="committee" query={await searchParams}/>;}
