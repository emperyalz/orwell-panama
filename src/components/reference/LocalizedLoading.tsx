'use client';
import {useSyncExternalStore} from 'react';
const subscribe=(notify:()=>void)=>{window.addEventListener('storage',notify);return()=>window.removeEventListener('storage',notify);};
const language=()=>localStorage.getItem('orwell-panama-language')||'es';
export function LocalizedLoading(){const lang=useSyncExternalStore(subscribe,language,()=> 'es');return <div className="reference-wrap" data-no-translate role="status" style={{paddingTop:32,paddingBottom:32}}>{lang==='en'?'Loading…':lang==='pt'?'Carregando…':'Cargando…'}</div>;}
