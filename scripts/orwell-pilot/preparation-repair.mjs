/** Repair only a persisted independently rejected preparation report. No product edits. */
import {readFile,writeFile,mkdir,chmod,rename} from 'node:fs/promises';
import {join} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {admission,globalReceipts,run} from './parallel-preparation.mjs';
import {WorkspacePool} from './workspace-pool.mjs';
const state='/var/lib/orwell-agent-controller',json=async p=>JSON.parse(await readFile(p,'utf8')),save=async(p,x)=>{const temp=p+'.'+randomUUID()+'.tmp';await writeFile(temp,JSON.stringify(x,null,2),{mode:0o600});await rename(temp,p);};
export function exactPreparationDecision(answer,itemKey){let value;try{value=JSON.parse(answer.replace(/^```(?:json)?\s*|\s*```$/g,''));}catch{return null;}return value?.itemKey===itemKey&&['accepted','changes_requested'].includes(value.result)&&typeof value.detail==='string'&&value.detail.trim()?value:null;}
export async function repairPreparation(batch){
 const path=join(state,'parallel-preparation.json'),inventoryPath=join(state,'preparation-inventory.json'),inventory=await json(inventoryPath),candidate=inventory.candidates.find(c=>c.decision?.result==='changes_requested');
 if(!candidate)return;
 batch.repairRounds??=[];const prior=batch.repairRounds.filter(r=>r.itemKey===candidate.itemKey);if(prior.length>=2){batch.blocker='Two bounded preparation repairs exhausted; preserve independent rejection for root integration decision';await save(path,batch);return;}
 await admission();await globalReceipts(2);delete batch.runtimeHold;
 const job=batch.jobs.find(j=>j.itemKey===candidate.itemKey);if(!job)throw Error('Rejected preparation missing original roster assignment');
 const round={id:randomUUID(),itemKey:job.itemKey,round:prior.length+1,startedAt:Date.now(),state:'preparing',rejection:candidate.decision,previousReportSha256:candidate.reportSha256};batch.repairRounds.push(round);batch.state='preparing';await save(path,batch);
 const pool=new WorkspacePool({repository:'/home/orwell/build',stateDir:join(state,'workspace-pool'),root:'/opt/orwell-workspaces'}),lane=await pool.acquire({...job,leaseId:randomUUID(),allowedPaths:['docs/preparation/'+job.itemKey.replaceAll('/','-')+'.json']});
 try{
 const snapshot=await pool.snapshot(lane,randomUUID()),original=await readFile(candidate.reportPath,'utf8');
 const author=await run({job,cwd:snapshot.path,model:'sonnet',phase:'repair',batchId:batch.batchId,prompt:`You are the original roster preparation author at ${job.positionKey} in a fresh Sonnet session. This is READ-ONLY preparation for existing item ${job.itemKey}, never product acceptance. Repair ONLY the actual independent Opus finding: ${candidate.decision.detail}. Reopen these source files: ${job.inputPaths.join(', ')}. Preserve supported gap findings. Return the corrected complete preparation report as plain text. No edits, agents, deployment or checklist writes. Do not expand scope. Actual previous report:\n${original}`});
 round.author=author;round.state='inreview';batch.state='inreview';await save(path,batch);
 const qa=await run({job:{itemKey:job.itemKey,positionKey:'position:qa-02',originalItemKeys:[job.itemKey]},cwd:snapshot.path,model:'opus',phase:'qa',batchId:batch.batchId,prompt:`You are fresh independent Opus preparation QA, different model/session from the Sonnet report author. Reopen source inputs ${job.inputPaths.join(', ')} and verify corrected report against actual source. Actual prior defect: ${candidate.decision.detail}. Product checkbox remains open. Return ONLY JSON {"itemKey":"${job.itemKey}","result":"accepted" or "changes_requested","detail":"all concrete evidence/rejections"}. Corrected report:\n${author.answer}`});
 if(author.sessionId===qa.sessionId)throw Error('Preparation QA reused author session');
 const decision=exactPreparationDecision(qa.answer,job.itemKey);round.qa=qa;round.decision=decision;round.finishedAt=Date.now();round.state=decision?.result==='accepted'?'prepared-awaiting-integration':'inreview';
 if(decision){const report=author.answer+'\n\nINDEPENDENT PREPARATION QA: '+decision.result+'\n'+decision.detail+'\nProduct checkbox remains open.\n',reportPath='/opt/orwell-evidence/preparation-reports/'+batch.batchId+'/'+job.itemKey.split('/')[1]+'-repair-'+round.round+'.md';await writeFile(reportPath,report,{mode:0o444});await chmod(reportPath,0o444);Object.assign(candidate,{state:round.state,decision,reportPath,reportSha256:createHash('sha256').update(report).digest('hex'),authorSessionId:author.sessionId,authorModel:author.model,reviewerSessionId:qa.sessionId,reviewerModel:qa.model,sourceRevision:snapshot.revision,snapshotRevision:snapshot.snapshotRevision,snapshotPath:snapshot.path,receiptPath:join(state,'runs',author.leaseId,'receipt.json'),qaReceiptPath:join(state,'runs',qa.leaseId,'receipt.json')});}
 else{round.blocker='Native reviewer returned no exact machine-readable task verdict; not treated as accepted';}
 batch.state=inventory.candidates.every(c=>c.decision?.result==='accepted')?'prepared-awaiting-integration':'inreview';batch.productAccepted=false;inventory.state=batch.state;inventory.productAccepted=false;await save(inventoryPath,inventory);await save(path,batch);
 }catch(error){round.state='inreview';round.error=error.message;round.finishedAt=Date.now();batch.state='inreview';await save(path,batch);throw error;}finally{await pool.release(lane);}
}
