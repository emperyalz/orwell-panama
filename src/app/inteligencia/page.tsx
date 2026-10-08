import {LocalizedLoading} from '@/components/reference/LocalizedLoading';
import {Suspense} from 'react';
import {IntelligenceWorkspace} from '@/components/reference/IntelligenceWorkspace';
export const metadata={title:'Social intelligence | ORWELL Politics',description:'Explore archived political communication by person, date, platform and format.'};
export default function Intelligence(){return <Suspense fallback={<LocalizedLoading/>}><IntelligenceWorkspace/></Suspense>;}
