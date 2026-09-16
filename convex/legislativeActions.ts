'use node';
import {internalAction} from './_generated/server';
import {internal} from './_generated/api';
import {v} from 'convex/values';
const base='https://prensa507.asamblea.gob.pa/api/v1';
type Deputy={id:number;principalId:number|null;circuit:string;user:{name:string;lastname:string};politicalParty:{code:string}};
type Question={id:number;title:string;result:number;votesToPass:number;answers:{id:number;type:number;total:number}[];votes:{id:number;answerId:number;deputy:Deputy}[]};
type Voting={id:number;title:string;isSecret:boolean;questions:Question[]};
async function read(url:string){let failure:unknown;for(let attempt=0;attempt<3;attempt++)try{const response=await fetch(url,{signal:AbortSignal.timeout(30000)});if(!response.ok)throw Error(`HTTP ${response.status}`);return await response.json();}catch(error){failure=error;}throw failure;}
export const refresh=internalAction({args:{},handler:async(ctx):Promise<{scheduled:number}>=>{
 const list=await read(`${base}/reports?paginated=false`) as {reports:{id:number;isPrivate:boolean;plenarySession:{date:string}}[]};
 const known=new Set(await ctx.runQuery(internal.legislativeRefresh.reports,{}));
 const reports=list.reports.filter(r=>!r.isPrivate&&!known.has(r.id)&&r.plenarySession?.date>='2026-03-03').sort((a,b)=>a.id-b.id);
 if(reports.length)await ctx.scheduler.runAfter(0,internal.legislativeActions.refreshReport,{reportId:reports[0].id,remaining:reports.slice(1).map(r=>r.id)});
 return {scheduled:reports.length};
}});
export const refreshReport=internalAction({args:{reportId:v.number(),remaining:v.optional(v.array(v.number()))},handler:async(ctx,{reportId,remaining=[]}):Promise<{inserted:number;deputies:number;errors:string[]}>=>{
 let inserted=0;const deputies=new Set<number>();const errors:string[]=[];
 try{
  const data=await read(`${base}/report/${reportId}/public`) as {report:{id:number;sessionId:number;plenarySession:{date:string;votings:Voting[]}}};
  const report=data.report;if(!report?.plenarySession)throw Error('No public report');const sessionDate=Date.parse(report.plenarySession.date);if(!Number.isFinite(sessionDate))throw Error('Invalid session date');
  for(const voting of report.plenarySession.votings||[]){if(voting.isSecret)continue;
   const records=(voting.questions||[]).flatMap(q=>(q.votes||[]).flatMap(vote=>{
    const d=vote.deputy;const answer=(q.answers||[]).find(a=>a.id===vote.answerId);if(!d||!answer||![0,1,2].includes(answer.type))return [];deputies.add(d.id);
    return [{voteId:vote.id,votingId:voting.id,questionId:q.id,questionText:q.title||voting.title,questionPassed:q.result===1,votesNeeded:q.votesToPass||0,totalAFavor:q.answers.filter(a=>a.type===0).reduce((n,a)=>n+a.total,0),totalEnContra:q.answers.filter(a=>a.type===1).reduce((n,a)=>n+a.total,0),totalAbstencion:q.answers.filter(a=>a.type===2).reduce((n,a)=>n+a.total,0),deputyId:d.id,deputyName:`${d.user.name} ${d.user.lastname}`,partyCode:d.politicalParty?.code||'',circuit:d.circuit||'',vote:['a_favor','en_contra','abstencion'][answer.type],isSuplente:!!d.principalId,sessionDate,votingTitle:voting.title}];
   }));
   for(let i=0;i<records.length;i+=80)inserted+=await ctx.runMutation(internal.legislativeRefresh.ingest,{reportId:report.id,sessionId:report.sessionId,sessionDate,votingId:voting.id,votingTitle:voting.title,records:records.slice(i,i+80)});
  }
  for(const deputyId of deputies)await ctx.runMutation(internal.legislativeRefresh.aggregate,{deputyId});
  await ctx.runMutation(internal.legislativeRefresh.complete,{reportIds:[reportId]});
 }catch(error){errors.push(`${reportId}: ${String(error)}`);}
 await ctx.runMutation(internal.activity.logRun,{kind:'legislative',inserted,errors});
 if(remaining.length)await ctx.scheduler.runAfter(1000,internal.legislativeActions.refreshReport,{reportId:remaining[0],remaining:remaining.slice(1)});
 return {inserted,deputies:deputies.size,errors};
}});
