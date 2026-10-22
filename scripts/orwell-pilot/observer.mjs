/** Always-on read-only queue observation. No model invocation or task mutation. */
import {mkdir, readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {join} from 'node:path';
import {writeAtomicJson} from './admission.mjs';

const endpoint=process.env.ORWELL_CONVEX_URL;
if(!endpoint||new URL(endpoint).protocol!=='https:')throw new Error('An explicit HTTPS Orwell deployment is required');
const stateDirectory=process.env.ORWELL_PILOT_STATE_DIRECTORY;
if(!stateDirectory)throw new Error('An explicit state directory is required');
await mkdir(stateDirectory,{recursive:true,mode:0o700});
const statePath=join(stateDirectory,'queue-observation.json');
let stopping=false,wake;
const sleep=ms=>new Promise(resolve=>{const timer=setTimeout(()=>{wake=null;resolve();},ms);wake=()=>{clearTimeout(timer);wake=null;resolve();};});
for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>{stopping=true;wake?.();});
async function query(path){
 const r=await fetch(`${endpoint}/api/query`,{method:'POST',headers:{'Content-Type':'application/json'},
  body:JSON.stringify({path,args:{},format:'json'}),signal:AbortSignal.timeout(15_000)});
 if(!r.ok)throw new Error(`Read-only query ${path} returned HTTP ${r.status}`);
 const response=await r.json();
 if(response.status!=='success')throw new Error(`Read-only query ${path} failed`);
 return response.value;
}
async function observe(){
 // The one-row pause first: a paused queue claims nothing, so the 0.5 MB queue read can wait.
 const lead=await query('leadAccountability:pause');
 paused=lead.monitor?.dispatchPaused===true;
 if(paused&&Date.now()-lastFullAt<PAUSED_EVERY_MS){await writeAtomicJson(join(stateDirectory,'health.json'),{lastSuccessfulObservationAt:Date.now(),paused:true});return;}
 const queue=await query('dispatch:snapshot');lastFullAt=Date.now();
 const counts={};for(const item of queue.items)counts[item.state]=(counts[item.state]??0)+1;
 const ready=queue.items.filter(i=>['ready','qa_ready','accept_ready'].includes(i.state)&&['doing','todo'].includes(i.taskStatus));
 const phases={accept_ready:0,qa_ready:1,ready:2};
 ready.sort((a,b)=>phases[a.state]-phases[b.state]||(a.taskStatus==='doing'?0:1)-(b.taskStatus==='doing'?0:1)||(a.taskOrder??999)-(b.taskOrder??999)||a.key.localeCompare(b.key));
 const state={mode:'read_only',deployment:endpoint,dispatchPaused:lead.monitor?.dispatchPaused??null,
  pauseReason:lead.monitor?.pauseReason?.en??null,counts,
  nextCandidates:ready.slice(0,8).map(i=>({key:i.key,state:i.state,label:i.label,lead:i.lead,team:i.team})),
  modelInvocations:0,canMarkComplete:false,
  pending:'Mixed-provider delivery is not enabled by this observer'};
 const fingerprint=createHash('sha256').update(JSON.stringify(state)).digest('hex');
 let previous;try{previous=JSON.parse(await readFile(statePath,'utf8'));}catch{}
 if(previous?.fingerprint!==fingerprint){
  await writeAtomicJson(statePath,{...state,fingerprint,observedAt:Date.now()});
  console.log(JSON.stringify({event:'queue_changed',counts,dispatchPaused:state.dispatchPaused,mode:state.mode}));
 }
 await writeAtomicJson(join(stateDirectory,'health.json'),{lastSuccessfulObservationAt:Date.now(),fingerprint});
}
const PAUSED_EVERY_MS=1_800_000;let paused=false,lastFullAt=0;
do{
 try{await observe();}catch(error){console.error(JSON.stringify({event:'observation_failed',at:Date.now(),reason:error.message}));if(process.argv.includes('--once'))process.exitCode=1;}
 if(process.argv.includes('--once'))break;
 if(!stopping)await sleep(300_000);
}while(!stopping);
