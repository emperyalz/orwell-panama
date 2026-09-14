'use client';
import {useRouter} from 'next/navigation';
export function ComparePicker({people,a,b}:{people:{id:string;name:string}[];a:string;b:string}){const router=useRouter();return <div className="compare-pickers">{['a','b'].map((side,i)=><label key={side}>{i===0?'Primer perfil':'Segundo perfil'}<select value={i===0?a:b} onChange={e=>router.push(`/comparar?a=${i===0?e.target.value:a}&b=${i===1?e.target.value:b}`)}><option value="">Selecciona una persona</option>{people.filter(p=>p.id!==(i===0?b:a)).map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>)}</div>}
