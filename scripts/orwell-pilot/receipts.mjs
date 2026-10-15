import {readdir,stat,readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {normalizeCodexUsage} from './budget.mjs';
/** Secondary ceilings only; native percentages remain the spending authority. */
export function finiteModelCeiling({runs,tokens,freshTokens,withoutAcceptance}) {
 if(![runs,tokens,freshTokens,withoutAcceptance].every(n=>Number.isSafeInteger(n)&&n>=0)||freshTokens>tokens)return true;
 return runs>=24||tokens>=15_000_000||freshTokens>=1_000_000||withoutAcceptance>=12;
}
export async function receiptBudget(directory,now=Date.now()) {
 const recent=[];
 for(const name of await readdir(directory)){
  const file=join(directory,name,'receipt.json');let meta;
  try{meta=await stat(file);}catch{
   try{const pending=await stat(join(directory,name,'execution.json'));if(now-pending.mtimeMs<=86400000)recent.push({at:pending.mtimeMs,accepted:false,tokens:null,unreconciled:true});}catch{}
   continue;
  }
  if(now-meta.mtimeMs>86400000)continue;
  try{
   const receipt=JSON.parse(await readFile(file,'utf8')),usage=normalizeCodexUsage(receipt.usage);
   recent.push({at:meta.mtimeMs,accepted:receipt.finish?.state==='accepted',tokens:usage?.total_tokens??null,freshTokens:usage?usage.total_tokens-usage.cached_input_tokens:null,
    unreconciled:!receipt.finish||receipt.usagePersisted===false});
  }catch{recent.push({at:meta.mtimeMs,accepted:false,tokens:null,unreconciled:true});}
 }
 recent.sort((a,b)=>b.at-a.at);
 const firstAccepted=recent.findIndex(row=>row.accepted);
 const withoutAcceptance=firstAccepted<0?recent.length:firstAccepted;
 const tokens=recent.reduce((sum,row)=>sum+(row.tokens??0),0);
 const freshTokens=recent.reduce((sum,row)=>sum+(row.freshTokens??0),0);
 const unknownUsageRuns=recent.filter(row=>row.tokens===null).length;
 const unreconciledRuns=recent.filter(row=>row.unreconciled).length;
 return {runs:recent.length,tokens,freshTokens,unknownUsageRuns,unreconciledRuns,withoutAcceptance,
  exceeded:unknownUsageRuns>0||unreconciledRuns>0||finiteModelCeiling({runs:recent.length,tokens,freshTokens,withoutAcceptance})};
}

export function legalOutcome(phase,answer) {
 const results={triage:['submitted','needs_input','failed'],work:['submitted','needs_input','failed'],
  qa:['accepted','changes_requested','needs_input','failed'],accept:['accepted','changes_requested','needs_input','failed']};
 return Boolean(answer&&results[phase]?.includes(answer.result)&&typeof answer.detail==='string'&&answer.detail.trim()&&
  typeof answer.evidence==='string'&&['research','implementation','none'].includes(answer.team)&&
  (phase!=='triage'||answer.result!=='submitted'||answer.team!=='none'));
}
