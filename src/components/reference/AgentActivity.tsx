'use client';

import {useEffect,useState} from 'react';
import {useQuery} from 'convex/react';
import {Activity,Clock3} from 'lucide-react';
import {api} from '../../../convex/_generated/api';
import './agent-activity.css';
import {AgentAvatar,agentName,RelativeTime} from './AgentIdentity';

type Language='en'|'es'|'pt';
type Status='running'|'completed'|'blocked'|'error'|'idle';
type EventKind='assigned'|'progress'|'completed'|'error'|'model_changed';

const copy={
 en:{title:'Agent activity',subtitle:'Current assignments and recorded updates',recent:'Recent updates',empty:'No agents recorded yet.',noEvents:'No updates recorded yet.',loading:'Loading agent activity…',team:{research:'Research',qa:'Quality assurance',implementation:'Implementation'},status:{running:'Running',completed:'Turn ended',blocked:'Blocked',error:'Error',idle:'Idle'},kind:{assigned:'Assigned',progress:'Progress',completed:'Turn ended',error:'Error',model_changed:'Model changed'},assignment:'Assignment',model:'Model',reasoning:'Reasoning',last:'Last activity',unknown:'Not recorded',stale:'Last update is over 5 minutes old',snapshot:'Snapshot received',past:'Completed and idle agents',reasoningValue:{low:'Low',medium:'Medium',high:'High',unknown:'Unknown'}},
 es:{title:'Actividad de agentes',subtitle:'Asignaciones actuales y actualizaciones registradas',recent:'Actualizaciones recientes',empty:'Aún no hay agentes registrados.',noEvents:'Aún no hay actualizaciones registradas.',loading:'Cargando actividad de agentes…',team:{research:'Investigación',qa:'Control de calidad',implementation:'Implementación'},status:{running:'En curso',completed:'Turno terminado',blocked:'Bloqueado',error:'Error',idle:'Inactivo'},kind:{assigned:'Asignado',progress:'Avance',completed:'Turno terminado',error:'Error',model_changed:'Cambio de modelo'},assignment:'Asignación',model:'Modelo',reasoning:'Razonamiento',last:'Última actividad',unknown:'Sin registrar',stale:'La última actualización tiene más de 5 minutos',snapshot:'Datos recibidos',past:'Agentes completados e inactivos',reasoningValue:{low:'Bajo',medium:'Medio',high:'Alto',unknown:'Desconocido'}},
 pt:{title:'Atividade dos agentes',subtitle:'Tarefas atuais e atualizações registradas',recent:'Atualizações recentes',empty:'Nenhum agente registrado ainda.',noEvents:'Nenhuma atualização registrada ainda.',loading:'Carregando atividade dos agentes…',team:{research:'Pesquisa',qa:'Controle de qualidade',implementation:'Implementação'},status:{running:'Em andamento',completed:'Turno encerrado',blocked:'Bloqueado',error:'Erro',idle:'Inativo'},kind:{assigned:'Atribuído',progress:'Progresso',completed:'Turno encerrado',error:'Erro',model_changed:'Modelo alterado'},assignment:'Tarefa',model:'Modelo',reasoning:'Raciocínio',last:'Última atividade',unknown:'Não registrado',stale:'A última atualização tem mais de 5 minutos',snapshot:'Dados recebidos',past:'Agentes concluídos e inativos',reasoningValue:{low:'Baixo',medium:'Médio',high:'Alto',unknown:'Desconhecido'}},
} as const;

const issueCopy={
 en:{cause:'What happened',recovery:'Recovery',recovered:'Recovered',replacement:'Replacement',unknown:'The cause has not been recorded yet.',past:'Ended turns, idle and recovered agents'},
 es:{cause:'Qué ocurrió',recovery:'Recuperación',recovered:'Recuperado',replacement:'Reemplazo',unknown:'La causa aún no se ha registrado.',past:'Turnos terminados, agentes inactivos y recuperados'},
 pt:{cause:'O que aconteceu',recovery:'Recuperação',recovered:'Recuperado',replacement:'Substituto',unknown:'A causa ainda não foi registrada.',past:'Turnos encerrados, agentes inativos e recuperados'},
};
const reportCopy={en:{result:'Recorded result',remaining:'Still open',recorded:'Checkpoint recorded',estimate:'Estimated remaining',unknownEstimate:'Estimate not recorded'},es:{result:'Resultado registrado',remaining:'Pendiente',recorded:'Avance registrado',estimate:'Tiempo restante estimado',unknownEstimate:'Estimación sin registrar'},pt:{result:'Resultado registrado',remaining:'Pendente',recorded:'Avanço registrado',estimate:'Tempo restante estimado',unknownEstimate:'Estimativa não registrada'}};
function formatTime(value:number|undefined,lang:Language){
 if(!value||!Number.isFinite(value))return null;
 return new Intl.DateTimeFormat(lang,{dateStyle:'medium',timeStyle:'short'}).format(value);
}
function dateTime(value:number|undefined){return value&&Number.isFinite(value)?new Date(value).toISOString():undefined;}

export function AgentActivity({lang}:{lang:Language}){
 const snapshot=useQuery(api.agentActivity.snapshot,{});
 const [now,setNow]=useState<number>();
 useEffect(()=>{const initial=window.setTimeout(()=>setNow(Date.now()),0);const timer=window.setInterval(()=>setNow(Date.now()),60_000);return()=>{window.clearTimeout(initial);window.clearInterval(timer);};},[]);
 const t=copy[lang];
 const agents=snapshot?.agents??[];
 const activeAgents=agents.filter(agent=>agent.status==='running'||agent.status==='blocked'||(agent.status==='error'&&!agent.issue?.resolvedAt));
 const pastAgents=agents.filter(agent=>agent.status==='completed'||agent.status==='idle'||(agent.status==='error'&&Boolean(agent.issue?.resolvedAt)));
 const events=[...(snapshot?.events??[])].sort((a,b)=>b.occurredAt-a.occurredAt).slice(0,10);
 const names=new Map(agents.map(agent=>[agent.key,agentName(agent.name)]));
 function agentCard(agent:(typeof agents)[number]){
  const status=agent.status as Status;
  const lastTime=agent.lastActivityAt||agent.updatedAt;
  const recovered=Boolean(agent.issue?.resolvedAt);
  const stale=Boolean(now&&lastTime&&now-lastTime>300_000&&(status==='running'||status==='blocked'||(status==='error'&&!recovered)));
  const issueLabels=issueCopy[lang];
  const replacement=agents.find(row=>row.key===agent.issue?.replacementKey);
  const reasoningKey=agent.reasoning?.toLowerCase() as keyof typeof t.reasoningValue;
  const reasoning=t.reasoningValue[reasoningKey]||agent.reasoning||t.reasoningValue.unknown;
  return <article className="agent-activity-card" key={agent.key}>
   <div className="agent-activity-card-top"><AgentAvatar name={agentName(agent.name)}/><div><span className="agent-activity-team">{t.team[agent.team]}</span><h3>{agentName(agent.name)}</h3></div><span className={`agent-activity-status agent-activity-status-${recovered?'completed':status}`}><span aria-hidden="true"/>{recovered?issueLabels.recovered:t.status[status]}</span></div>
   <p className="agent-activity-assignment"><span>{t.assignment}</span>{agent.assignment?.[lang]||t.unknown}</p>
   {status==='error'&&<div className={`agent-activity-issue ${recovered?'is-recovered':''}`}><strong>{issueLabels.cause}</strong><p>{agent.issue?.message[lang]||issueLabels.unknown}</p>{agent.issue&&<><strong>{issueLabels.recovery}</strong><p>{agent.issue.recovery[lang]}</p>{replacement&&<p className="agent-activity-replacement">{issueLabels.replacement}: <b>{agentName(replacement.name)}</b> · {t.status[replacement.status as Status]}</p>}</>}</div>}
   {status==='running'&&<p className="agent-activity-estimate"><strong>{reportCopy[lang].estimate}</strong><span>{agent.estimate?.assignmentEn===agent.assignment.en?agent.estimate.label[lang]:reportCopy[lang].unknownEstimate}</span></p>}
   {agent.report&&<div className="agent-activity-report"><strong>{agent.report.assignmentEn===agent.assignment.en?reportCopy[lang].result:(lang==='en'?'Prior assignment result':lang==='es'?'Resultado de asignación anterior':'Resultado da tarefa anterior')}</strong><p>{agent.report.result[lang]}</p><strong>{reportCopy[lang].remaining}</strong><p>{agent.report.remaining[lang]}</p><small>{reportCopy[lang].recorded}: <time dateTime={dateTime(agent.report.recordedAt)}>{formatTime(agent.report.recordedAt,lang)}</time></small></div>}
   <dl className="agent-activity-meta"><div><dt>{t.model}</dt><dd>{agent.model||t.unknown}</dd></div><div><dt>{t.reasoning}</dt><dd>{reasoning}</dd></div><div><dt>{t.last}</dt><dd><time dateTime={dateTime(lastTime)}>{formatTime(lastTime,lang)||t.unknown}</time><RelativeTime value={lastTime} lang={lang}/></dd></div></dl>
   {stale&&<p className="agent-activity-stale"><Clock3 size={13} aria-hidden="true"/>{t.stale}</p>}
  </article>;
 }
 return <section className="agent-activity" aria-labelledby="agent-activity-title">
  <header className="agent-activity-head"><div className="agent-activity-heading"><Activity size={19} aria-hidden="true"/><div><h2 id="agent-activity-title">{t.title}</h2><p>{t.subtitle}</p></div></div>{snapshot?.receivedAt&&<span className="agent-activity-received"><Clock3 size={13} aria-hidden="true"/>{t.snapshot}: <time dateTime={dateTime(snapshot.receivedAt)}>{formatTime(snapshot.receivedAt,lang)}</time></span>}</header>
  {!snapshot?<p className="agent-activity-empty" role="status">{t.loading}</p>:<>
   {agents.length?<>{activeAgents.length>0&&<div className="agent-activity-grid">{activeAgents.map(agentCard)}</div>}{pastAgents.length>0&&<details className="agent-activity-past"><summary>{issueCopy[lang].past} <span>{pastAgents.length}</span></summary><div className="agent-activity-grid">{pastAgents.map(agentCard)}</div></details>}</>:<p className="agent-activity-empty">{t.empty}</p>}
   <div className="agent-activity-events"><h3>{t.recent}</h3>{events.length?<ol>{events.map((event,index)=><li key={`${event.agentKey}-${event.occurredAt}-${event.kind}-${index}`}><span className={`agent-activity-event-mark agent-activity-event-${event.kind as EventKind}`} aria-hidden="true"/><div><div className="agent-activity-event-line"><strong>{names.get(event.agentKey)||event.agentKey}</strong><span>{t.kind[event.kind as EventKind]}</span><time dateTime={dateTime(event.occurredAt)}>{formatTime(event.occurredAt,lang)||t.unknown}</time></div><p>{event.summary?.[lang]||t.unknown}</p></div></li>)}</ol>:<p className="agent-activity-empty">{t.noEvents}</p>}</div>
  </>}
 </section>;
}
