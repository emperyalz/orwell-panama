'use client';
import {useState,useSyncExternalStore} from 'react';
import {useQuery} from 'convex/react';
import {api} from '../../../convex/_generated/api';
import {ArrowUpRight,Check,CheckCheck,ClipboardList,Clock3,Copy,FileCheck2,Flag,Globe2,History,Image,Languages,LayoutGrid,ListChecks,MessageSquare,Radio,Search,ShieldCheck,Users,Vote,Wrench} from 'lucide-react';
import './scoreboard.css';
import {AgentActivity} from './AgentActivity';
import {AgentAvatar,agentName,agentProfiles,currentAgentSteps,RelativeTime} from './AgentIdentity';

const subscribe=(notify:()=>void)=>{window.addEventListener('storage',notify);return()=>window.removeEventListener('storage',notify);};
const language=()=>localStorage.getItem('orwell-panama-language')||'es';
const copy={
 en:{title:'The Orwell scoreboard',intro:'What’s done. What’s moving. What comes next.',doing:'In progress',todo:'Up next',done:'Completed',blocked:'Needs attention',updated:'Last updated',share:'Copy link',copied:'Link copied',failed:'Copy unavailable',loading:'Loading the scoreboard…',open:'View result',empty:'No tasks here',total:'requests',live:'Shared project status',detail:'Checklist',gallery:'Homepage concepts',evidence:'Verified',new:'New requests stay on this board.'},
 es:{title:'El tablero de Orwell',intro:'Lo terminado. Lo que avanza. Lo que sigue.',doing:'En curso',todo:'Siguiente',done:'Completado',blocked:'Requiere atención',updated:'Última actualización',share:'Copiar enlace',copied:'Enlace copiado',failed:'No se pudo copiar',loading:'Cargando el tablero…',open:'Ver resultado',empty:'Sin tareas aquí',total:'solicitudes',live:'Estado compartido del proyecto',detail:'Lista',gallery:'Conceptos de inicio',evidence:'Verificado',new:'Las nuevas solicitudes quedan en este tablero.'},
 pt:{title:'O painel do Orwell',intro:'O que está pronto. O que avança. O que vem depois.',doing:'Em andamento',todo:'A seguir',done:'Concluído',blocked:'Precisa de atenção',updated:'Última atualização',share:'Copiar link',copied:'Link copiado',failed:'Não foi possível copiar',loading:'Carregando o painel…',open:'Ver resultado',empty:'Nenhuma tarefa aqui',total:'solicitações',live:'Status compartilhado do projeto',detail:'Lista',gallery:'Conceitos da página inicial',evidence:'Verificado',new:'Novas solicitações permanecem neste painel.'},
};
const icons={users:Users,radio:Radio,votes:Vote,history:History,shield:ShieldCheck,flag:Flag,image:Image,globe:Globe2,message:MessageSquare,search:Search,languages:Languages,layout:LayoutGrid,files:FileCheck2};

export function Scoreboard(){
 const selectedLanguage=useSyncExternalStore(subscribe,language,()=> 'es');
 const lang=selectedLanguage==='en'||selectedLanguage==='pt'?selectedLanguage:'es';
 const t=copy[lang];
 const tasks=useQuery(api.scoreboard.list,{});
 const activity=useQuery(api.agentActivity.snapshot,{});
 const [copyState,setCopyState]=useState<'idle'|'copied'|'failed'>('idle');
 const latest=tasks?.reduce((date,task)=>Math.max(date,task.updatedAt),0);
 const counts={done:tasks?.filter(t=>t.status==='done').length??0,doing:tasks?.filter(t=>t.status==='doing').length??0,todo:tasks?.filter(t=>t.status==='todo').length??0,blocked:tasks?.filter(t=>t.status==='blocked').length??0};
 async function share(){try{await navigator.clipboard.writeText(window.location.href);setCopyState('copied');}catch{setCopyState('failed');}}
 function lane(status:'doing'|'todo'|'done'|'blocked'){
  const StatusIcon=status==='done'?CheckCheck:status==='doing'?Wrench:status==='blocked'?Flag:Clock3;
  return <section className={`scoreboard-lane scoreboard-${status}`} aria-label={t[status]}><h2><StatusIcon size={21} aria-hidden="true"/>{t[status]}<span>{counts[status]}</span></h2>
   <div className="scoreboard-tasks">{tasks?.filter(task=>task.status===status).map(task=>{
    const assigned=(activity?.agents??[]).filter(agent=>agentProfiles[agent.name]?.tasks.includes(task.key));
    const running=assigned.filter(agent=>agent.status==='running');
    const TaskIcon=icons[task.icon as keyof typeof icons]||ClipboardList;
    return <article key={task.key} className="scoreboard-task"><div className="scoreboard-task-heading"><span className="scoreboard-task-icon">{status==='done'?<Check size={28} strokeWidth={3} aria-hidden="true"/>:<TaskIcon size={23} aria-hidden="true"/>}</span><div><h3>{task.title[lang]}</h3>{status==='doing'&&<span className="scoreboard-current-label">{t.doing}</span>}</div></div>
     <div className="scoreboard-step-count" aria-label={t.detail}><strong>{task.checklist?.filter(step=>step.done).length??0}</strong><span>/ {task.checklist?.length??0}</span><div className="scoreboard-progress-track" aria-hidden="true"><i style={{width:`${task.checklist?.length?task.checklist.filter(step=>step.done).length/task.checklist.length*100:0}%`}}/></div></div>
     <ul className="scoreboard-checklist" aria-label={t.detail}>{task.checklist?.map(step=><li key={step.key} className={step.done?'is-checked':running.some(agent=>currentAgentSteps[agent.name]?.[task.key]?.includes(step.key))?'is-working':''}><span className="scoreboard-checkbox"><input type="checkbox" checked={step.done} disabled aria-label={step.label[lang]}/>{step.done&&<Check size={13} strokeWidth={3} aria-hidden="true"/>}</span><span>{step.label[lang]}{!step.done&&running.filter(agent=>currentAgentSteps[agent.name]?.[task.key]?.includes(step.key)).map(agent=><small className="scoreboard-working-step" key={agent.key}><AgentAvatar name={agentName(agent.name)} size={18}/>{agentName(agent.name)} · {lang==='en'?'Working on this':lang==='es'?'Trabajando aquí':'Trabalhando aqui'}</small>)}</span></li>)}</ul>
     {task.href&&<a className="scoreboard-result" href={task.href}>{t.open}<ArrowUpRight size={14} aria-hidden="true"/></a>}{task.key==='homepage-concepts'&&<div className="scoreboard-concept-links">{[1,2,3,4,5,6].map(n=><a key={n} href={`/design/homepage-concepts/0${n}.png`} aria-label={`${t.gallery} ${n}`}>PNG {n}<ArrowUpRight size={12} aria-hidden="true"/></a>)}</div>}

     {status==='doing'&&running.length===0&&<p className="scoreboard-no-agent">{lang==='en'?'No agent running on this task':lang==='es'?'Ningún agente activo en esta tarea':'Nenhum agente ativo nesta tarefa'}</p>}
     {assigned.length>0&&<div className="scoreboard-assigned-agents">{assigned.map(agent=><span key={agent.key} className={`scoreboard-assigned-agent ${status==='doing'&&agent.status==='running'?'is-running':''}`}><AgentAvatar name={agentName(agent.name)} size={26}/><span>{agentName(agent.name)}<small>{status==='doing'&&agent.status==='running'?(lang==='en'?'Running':lang==='es'?'En curso':'Em andamento'):(status==='done'?(lang==='en'?'Contributed':lang==='es'?'Contribuyó':'Contribuiu'):(lang==='en'?'Previous assignment':lang==='es'?'Asignación anterior':'Tarefa anterior'))}</small></span></span>)}</div>}
     <div className="scoreboard-task-time"><Clock3 size={12} aria-hidden="true"/><span>{status==='done'&&task.completedAt?t.done:t.updated}: <time dateTime={new Date(status==='done'&&task.completedAt?task.completedAt:task.updatedAt).toISOString()}>{new Date(status==='done'&&task.completedAt?task.completedAt:task.updatedAt).toLocaleString(lang==='en'?'en-US':lang==='pt'?'pt-BR':'es-PA',{dateStyle:'medium',timeStyle:'short'})}</time><RelativeTime value={status==='done'&&task.completedAt?task.completedAt:task.updatedAt} lang={lang}/></span></div>
    </article>;
   })}{tasks&&!counts[status]&&<p className="scoreboard-empty">{t.empty}</p>}</div>
  </section>;
 }
 return <div className="scoreboard-page" data-no-translate><div className="scoreboard-wrap">
  <header className="scoreboard-heading"><div><span className="scoreboard-kicker"><ListChecks size={17} aria-hidden="true"/>{t.live}</span><h1>{t.title}</h1><p>{t.intro}</p></div><button className="scoreboard-share" onClick={share}><Copy size={16} aria-hidden="true"/>{copyState==='idle'?t.share:t[copyState]}</button></header>
  {!tasks?<p role="status">{t.loading}</p>:<>
   <div className="scoreboard-overview" aria-live="polite"><div><CheckCheck aria-hidden="true"/><strong>{counts.done}</strong><span>{t.done}</span></div><div><Wrench aria-hidden="true"/><strong>{counts.doing}</strong><span>{t.doing}</span></div><div><Clock3 aria-hidden="true"/><strong>{counts.todo}</strong><span>{t.todo}</span></div>{counts.blocked>0&&<div><Flag aria-hidden="true"/><strong>{counts.blocked}</strong><span>{t.blocked}</span></div>}</div>
   <AgentActivity lang={lang}/>
   <div className="scoreboard-board">{lane('doing')}{counts.blocked>0&&lane('blocked')}{lane('todo')}{lane('done')}</div>
   <footer className="scoreboard-foot"><span>{t.updated}: {latest?new Intl.DateTimeFormat(lang,{dateStyle:'medium',timeStyle:'short'}).format(latest):'—'}</span><span>{t.new}</span></footer>
  </>}
 </div></div>;
}
