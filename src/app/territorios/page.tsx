import {ExplorePage} from '@/components/reference/ExplorePage';
export const metadata={title:'Territorios | ORWELL Panamá'};
export default async function Territories({searchParams}:{searchParams:Promise<{province?:string;circuit?:string;district?:string}>}){return <ExplorePage kind="territory" query={await searchParams}/>;}
