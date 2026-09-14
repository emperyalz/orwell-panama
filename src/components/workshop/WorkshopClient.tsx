'use client';
import {useState,useEffect,type ReactNode,type FormEvent} from 'react';
import {MultiplayerProvider,MultiplayerTopBar,StickyNotesProvider,VersionNavigator,saveIdentity,type Identity} from '@quexopa/multiplayer-workshop';
import {api} from '../../../convex/_generated/api';
import {ProfileHeader} from '../reference/ProfileHeader';
import './workshop.css';
const loginKey='orwell-panama-team-login';
const colors={eric:'#59348b',jose:'#1375c1'};
type Account=keyof typeof colors;
function restore():Identity|null{try{const saved=JSON.parse(localStorage.getItem(loginKey)||'null');if(!saved||saved.expiresAt<=Date.now()||!['eric','jose'].includes(saved.account))return null;const account=saved.account as Account;return saveIdentity(account==='eric'?'Eric':'Jose',colors[account],'orwell-panama');}catch{return null}}
type Props={politicianId?:string;name:string;initialTab?:string;pageSessionId?:string;publicPath?:string;versionSession?:string;children:ReactNode};
export default function WorkshopClient({politicianId,name,initialTab='perfil',pageSessionId,publicPath='/',versionSession,children}:Props){
 const [identity,setIdentity]=useState<Identity|null>(restore);const [tab,setTab]=useState(initialTab);const [username,setUsername]=useState('');const [password,setPassword]=useState('');const [error,setError]=useState('');
 const base=pageSessionId||`orwell-panama-${politicianId}-${tab}`;const sessionId=versionSession&&new RegExp(`^${base}-v[0-9]+$`).test(versionSession)?versionSession:base;
 useEffect(()=>{const onTab=(event:Event)=>{if(!politicianId)return;const next=(event as CustomEvent<{id:string}>).detail.id;const url=new URL(window.location.href);url.searchParams.set('politician',politicianId);url.searchParams.set('tab',next);url.searchParams.delete('path');url.searchParams.delete('session');history.replaceState(null,'',url);setTab(next);};window.addEventListener('orwell:profile-tab',onTab);return()=>window.removeEventListener('orwell:profile-tab',onTab);},[politicianId]);
 function login(event:FormEvent){event.preventDefault();const account=username.trim().toLowerCase().replace(/@quexopa\.io$/,'');if(!['eric','jose'].includes(account)||!['eric','jose','quexopa','panama','password'].includes(password.trim().toLowerCase())){setError('Revisa el usuario y la contraseña del equipo.');return;}localStorage.setItem(loginKey,JSON.stringify({account,expiresAt:Date.now()+365*24*60*60*1000}));setIdentity(saveIdentity(account==='eric'?'Eric':'Jose',colors[account as Account],'orwell-panama'));setPassword('');setError('');}
 if(!identity)return <div className="workshop-login"><form onSubmit={login}><img src="/icons/branding/orwell-black.svg" alt="ORWELL" width={161} height={32}/><h1>Multiplayer</h1><p>Entra con tu cuenta de equipo para editar y anotar los perfiles.</p><label>Usuario<input name="username" autoComplete="username" value={username} onChange={e=>setUsername(e.target.value)} placeholder="Eric o Jose" required/></label><label>Contraseña<input type="password" name="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} required/></label>{error&&<p role="alert">{error}</p>}<button type="submit">Entrar</button><a href={publicPath}>Ver página pública</a></form></div>;
 return <MultiplayerProvider api={api} config={{convexDeployment:'fleet-vole-527',storageKeyPrefix:'orwell-panama',brand:{name:'ORWELL Panamá',primaryColor:'#59348b'}}}><WorkshopTools key={sessionId} sessionId={sessionId} identity={identity} name={name} onSwitch={()=>{localStorage.removeItem(loginKey);setIdentity(null);}}/><div className="workshop-content"><div onClickCapture={e=>{const link=(e.target as HTMLElement).closest('a');const href=link?.getAttribute('href');if(!href||!href.startsWith('/')||href.startsWith('/multiplayer')||e.ctrlKey||e.metaKey)return;e.preventDefault();e.stopPropagation();const match=href.match(/^\/politician\/([^/?#]+)$/);window.location.href=match?`/multiplayer?politician=${encodeURIComponent(match[1])}`:`/multiplayer?path=${encodeURIComponent(href)}`;}}><ProfileHeader/>{children}</div></div></MultiplayerProvider>;
}
function WorkshopTools({sessionId,identity,name,onSwitch}:{sessionId:string;identity:Identity;name:string;onSwitch:()=>void}){
 // Pending edits replay in the workshop after reload; original public records are untouched.
 if(localStorage.getItem('mw-replay-'+sessionId)===null)localStorage.setItem('mw-replay-'+sessionId,'1');
 return <><MultiplayerTopBar sessionId={sessionId} identity={identity} onChangeName={onSwitch} title={name} workspace="ORWELL Panamá" subtitle="Perfiles"/><StickyNotesProvider sessionId={sessionId} identity={identity}/><VersionNavigator sessionId={sessionId} identity={identity}/></>;
}
