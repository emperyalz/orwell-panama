'use client';
import {useState} from 'react';
export function Portrait({src,name,className=''}:{src?:string;name:string;className?:string}){const [failed,setFailed]=useState(false);return src&&!failed?<img className={className} src={src} alt={name} onError={()=>setFailed(true)}/>:<span className={`${className} portrait-fallback`} aria-label={`Sin fotografía de ${name}`}>{name.split(' ').map(n=>n[0]).slice(0,2).join('')}</span>;}
