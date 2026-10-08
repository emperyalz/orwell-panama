'use client';
import {useEffect,useState} from 'react';

export const agentProfiles:Record<string,{name:string;tasks:string[]}>= {
 'Orwell lead':{name:'Atlas',tasks:['task-timestamps','agent-assignment-context','agent-visual-identities','step-accountability']},
 'Social research A':{name:'Iris',tasks:['social-identity-audit','social-freshness']},
 'Independent identity QA':{name:'Ada',tasks:['social-identity-qa','social-freshness']},
 'Scoreboard interface':{name:'Lin',tasks:['live-agent-scoreboard','step-accountability']},
 'Activity collector':{name:'Echo',tasks:['live-agent-scoreboard']},
 'Original research A':{name:'Scout',tasks:['social-identity-audit']},
 'Original identity QA':{name:'Bram',tasks:['social-identity-qa']},
 'Social research B':{name:'Newton',tasks:['social-identity-audit']},
 'Social research C':{name:'Kepler',tasks:['social-identity-audit']},
};
export const currentAgentSteps:Record<string,Record<string,string[]>>={
 'Orwell lead':{'step-accountability':['history','contributors','estimates','verify'],'task-timestamps':['verify'],'agent-assignment-context':['history','outcomes','verify'],'agent-visual-identities':['verify']},
 'Social research A':{'social-freshness':['investigate-zero-post-accounts'],'social-identity-audit':['monitor']},
 'Independent identity QA':{'social-freshness':['investigate-zero-post-accounts']},
 'Scoreboard interface':{'step-accountability':['verify']},
};
export const agentName=(name:string)=>agentProfiles[name]?.name||name;
export function AgentAvatar({name,size=42}:{name:string;size?:number}){
 const seed=Array.from(name).reduce((n,c)=>(n*31+c.charCodeAt(0))>>>0,0);
 const palettes=[['#d9efe4','#287154'],['#efe3cc','#966927'],['#e1e6f6','#5365a0'],['#f4ded9','#a55d50'],['#e9ddf0','#795895'],['#d8edf1','#31798a']];
 const names=['Atlas','Iris','Ada','Lin','Echo','Scout','Bram','Newton','Kepler','Sagan','Goodall','Peirce','Ptolemy','Archimedes','Popper','Mill'];
 const known=names.indexOf(name);const avatarIndex=known>=0?known:seed;
 const [bg,ink]=palettes[avatarIndex%palettes.length];const eye=Math.floor(avatarIndex/6)%3;const antenna=(seed>>>6)%2;
 return <svg role="img" aria-label={`${name} avatar`} width={size} height={size} viewBox="0 0 64 64" className="agent-avatar"><rect width="64" height="64" rx="16" fill={bg}/><path d={antenna?'M32 20V12M29 12h6':'M24 20l-5-7M40 20l5-7'} stroke={ink} strokeWidth="3" strokeLinecap="round"/><rect x="14" y="21" width="36" height="29" rx={(seed>>>7)%2?10:7} fill={ink}/><rect x="18" y="25" width="28" height="20" rx="5" fill={bg}/>{eye===0?<><circle cx="25" cy="33" r="3" fill={ink}/><circle cx="39" cy="33" r="3" fill={ink}/></>:eye===1?<path d="M22 33h6M36 33h6" stroke={ink} strokeWidth="3" strokeLinecap="round"/>:<><rect x="22" y="30" width="6" height="6" rx="1" fill={ink}/><rect x="36" y="30" width="6" height="6" rx="1" fill={ink}/></>}<path d={(seed>>>8)%2?'M27 40h10':'M27 39q5 4 10 0'} stroke={ink} strokeWidth="2" fill="none" strokeLinecap="round"/><path d="M10 30v10M54 30v10" stroke={ink} strokeWidth="3" strokeLinecap="round"/></svg>;
}
export function RelativeTime({value,lang}:{value:number;lang:'en'|'es'|'pt'}){
 const [now,setNow]=useState<number>();
 useEffect(()=>{const initial=window.setTimeout(()=>setNow(Date.now()),0);const timer=window.setInterval(()=>setNow(Date.now()),30_000);return()=>{window.clearTimeout(initial);window.clearInterval(timer);};},[]);
 if(now===undefined)return null;
 const seconds=Math.max(0,(now-value)/1000);const unit=seconds<60?'second':seconds<3600?'minute':seconds<86400?'hour':'day';
 const count=Math.floor(seconds/(unit==='second'?1:unit==='minute'?60:unit==='hour'?3600:86400));
 return <span className="scoreboard-relative-time">{new Intl.RelativeTimeFormat(lang,{numeric:'auto'}).format(-count,unit)}</span>;
}
