import {ExplorePage} from '@/components/reference/ExplorePage';
export const metadata={title:'Partidos | ORWELL Panamá'};
export default async function Parties({searchParams}:{searchParams?:Promise<{name?:string}>}){return <ExplorePage kind="party" query={searchParams?await searchParams:{}}/>;}
