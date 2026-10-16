/** Bounded read-only product preparation. Run under the SAME controller.lock flock.
 * This is evidence preparation, never dispatch completion or release authority.
 */
import {spawn,execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {readFile,writeFile,mkdir,readdir,rename} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash,randomUUID} from 'node:crypto';
import {WorkspacePool} from './workspace-pool.mjs';
import {admitSubscription,normalizeCodexUsage} from './budget.mjs';
import {finiteModelCeiling} from './receipts.mjs';
import {nativeRunSpec,normalizeClaudeModel} from './provider-routing.mjs';
import {sourceManifest} from './product-release.mjs';
const exec=promisify(execFile),state='/var/lib/orwell-agent-controller',repository='/home/orwell/build';
const environment={HOME:'/home/orwell',USER:'orwell',LOGNAME:'orwell',PATH:'/home/orwell/agent-tools/node_modules/.bin:/usr/local/bin:/usr/bin:/bin',LANG:'C.UTF-8',TERM:'dumb'};
const json=async path=>JSON.parse(await readFile(path,'utf8'));
const save=async(path,value)=>{const temporary=path+'.'+randomUUID()+'.tmp';await writeFile(temporary,JSON.stringify(value,null,2),{mode:0o600});await rename(temporary,path);};
export function validatePreparationJobs(jobs,policy){
 if(!Array.isArray(jobs)||jobs.length!==2)throw Error('Exactly two bounded preparation positions required');
 const allowed=new Set(policy.itemKeys.map(x=>typeof x==='string'?x:x.key));
 for(const job of jobs)if(!allowed.has(job.itemKey)||!/^position:[a-zA-Z0-9_-]+$/.test(job.positionKey)||!job.inputPaths?.length||job.inputPaths.some(p=>typeof p!=='string'||p.startsWith('/')||p.split('/').some(x=>!x||x==='.'||x==='..'||x.startsWith('.')||/credentials|secret|cookie|storageState/i.test(x)))||!job.question?.trim())throw Error('Preparation must reference authorized backlog and stable positions');
 if(new Set(jobs.map(x=>x.itemKey)).size!==2||new Set(jobs.map(x=>x.positionKey)).size!==2)throw Error('Preparation item or roster collision');
 return jobs;
}
export async function admission(){
 const policy=await json(join(state,'policy.json'));
 const config=await json('/etc/orwell-agent-controller/credentials.json'),response=await fetch(config.url+'/api/query',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Convex '+config.adminKey},body:JSON.stringify({path:'leadAccountability:snapshot',args:{},format:'json'}),signal:AbortSignal.timeout(15000)}),pause=await response.json();if(!response.ok||pause.status!=='success')throw Error('Cannot verify authoritative user/dispatch pause');if(pause.value?.monitor?.dispatchPaused)throw Error('Authoritative dispatch pause holds preparation');
 const result=await exec('/usr/bin/node',['/opt/orwell-agent-controller/claude-meter.mjs'],{env:environment,uid:Number(process.env.ORWELL_UID),gid:Number(process.env.ORWELL_GID),timeout:30000});
 const snapshot=JSON.parse(result.stdout),check=admitSubscription({snapshot,baseline:policy.baselines.claude,policy,activeRuns:0});
 if(!check.allowed||check.remaining.some(x=>x.availablePercentagePoints<3))throw Error('Preparation held; native subscription/review reserve: '+(check.reason??'fewer than3 usable points'));
 return {policy,snapshot,check};
}
export async function globalReceipts(projectedRuns=3){
 const receipts=[];for(const name of await readdir(join(state,'runs'))){const dir=join(state,'runs',name);let receipt;try{receipt=await json(join(dir,'receipt.json'));}catch{try{await readFile(join(dir,'execution.json'));throw Error('Unreconciled execution '+name);}catch(e){if(e.code!=='ENOENT')throw e;}continue;}
 if(!receipt.finish)throw Error('Unreconciled native receipt '+name);if(!receipt.usagePersisted||!receipt.usage){const r=receipt.quotaReconciliation;if(r?.method!=='fresh-native-account-quota'||r.sessionId!==receipt.sessionId||!r.observedUsage)throw Error('Unreconciled native usage '+name);receipt.usage=r.observedUsage;}receipts.push(receipt);}
 let acceptedAt=0;try{acceptedAt=(await json(join(state,'last-acceptance.json'))).at;}catch{}
 const counts={runs:receipts.length+projectedRuns,tokens:receipts.reduce((n,r)=>n+r.usage.total_tokens,0),freshTokens:receipts.reduce((n,r)=>n+r.usage.total_tokens-r.usage.cached_input_tokens,0),withoutAcceptance:receipts.filter(r=>r.finishedAt>acceptedAt).length+projectedRuns};
 if(finiteModelCeiling(counts))throw Error('Preparation plus independent QA exceeds original global receipt ceilings');return counts;
}
async function observe(record,sessionId,model,completed=false){
 const config=await json('/etc/orwell-agent-controller/credentials.json'),at=Date.now(),qa=record.positionKey==='position:qa-02',name=qa?'Lyra':record.positionKey==='position:research-02'?'Newton':'Kepler',itemKey=record.originalItemKeys?.[0]??record.job.item.key,taskKey=itemKey.split('/')[0],stepKey=itemKey.split('/')[1],assignment=(qa?'Independent preparation QA: ':'Read-only preparation: ')+(record.originalItemKeys?.join(', ')??itemKey),summary=completed?'Native preparation returned; original product checkbox remains open':'Actual native subscription preparation session observed; no product acceptance';
 const args={key:sessionId,name,team:qa?'qa':'research',model,reasoning:'low',assignment:{en:assignment,es:assignment,pt:assignment},status:completed?'completed':'running',lastActivityAt:at,eventId:'prep:'+record.leaseId+':'+(completed?'returned':'assigned'),kind:completed?'completed':'assigned',summary:{en:summary,es:summary,pt:summary},binding:{taskKey,stepKey,rosterKey:record.positionKey,observedAt:at,evidence:'Actual native session '+sessionId+'; original items '+(record.originalItemKeys?.join(', ')??itemKey)+'; preparation only'}};
 const response=await fetch(config.url+'/api/mutation',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Convex '+config.adminKey},body:JSON.stringify({path:'agentActivity:record',args,format:'json'}),signal:AbortSignal.timeout(30000)}),result=await response.json();if(!response.ok||result.status!=='success')throw Error('Preparation activity persistence failed');
}
export async function run({job,cwd,model,phase,prompt,batchId}){
 await admission();const leaseId=randomUUID(),dir=join(state,'runs',leaseId);await mkdir(dir,{mode:0o700});
 const startedAt=Date.now(),record={job:{item:{key:job.itemKey},phase:'preparation'},batchId,leaseId,positionKey:job.positionKey,originalItemKeys:job.originalItemKeys,provider:'claude',model,startedAt,cwd,preparation:true};
 await save(join(dir,'execution.json'),record);
 const {args}=nativeRunSpec({provider:'claude',phase:'planner',model,cwd});args[args.indexOf('--max-turns')+1]='8';args[args.indexOf('--tools')+1]='Read,Grep,Glob';args[args.indexOf('--allowedTools')+1]='Read,Grep,Glob';
 const child=spawn('/home/orwell/agent-tools/node_modules/.bin/claude',args,{cwd,env:environment,uid:Number(process.env.ORWELL_UID),gid:Number(process.env.ORWELL_GID),detached:true,stdio:['pipe','pipe','pipe']});
 let telemetry=Promise.resolve();let raw='',pending='',stderr='',sessionId,actualModel,answer,usage,error;
 const kill=()=>{try{process.kill(-child.pid,'SIGTERM');}catch{}};
 const event=line=>{let e;try{e=JSON.parse(line);}catch{return;}if(e.type==='system'&&e.subtype==='init'){sessionId=e.session_id;actualModel=e.model;telemetry=telemetry.then(async()=>{await save(join(dir,'execution.json'),{...record,sessionId,model:actualModel,observedAt:Date.now()});await observe(record,sessionId,actualModel);}).catch(e=>{error=e.message;kill();});}if(e.type==='result'){answer=e.result;const u=e.usage;if(u)usage=normalizeCodexUsage({input_tokens:(u.input_tokens??0)+(u.cache_creation_input_tokens??0)+(u.cache_read_input_tokens??0),cached_input_tokens:u.cache_read_input_tokens??0,output_tokens:u.output_tokens??0});if(e.is_error)error=e.subtype;}};
 child.stdout.on('data',chunk=>{raw+=chunk;pending+=chunk;let i;while((i=pending.indexOf('\n'))>=0){event(pending.slice(0,i));pending=pending.slice(i+1);}if(raw.length>2000000){error='output bound';kill();}});child.stderr.on('data',chunk=>stderr+=chunk);child.stdin.on('error',()=>{});child.stdin.end(prompt);
 const timeout=setTimeout(()=>{error='Preparation8minute bound';kill();},480000);let busy=false;const watch=setInterval(async()=>{if(busy)return;busy=true;try{await admission();}catch(e){error=e.message;kill();}finally{busy=false;}},45000);
 const exit=await new Promise(resolve=>{child.once('error',e=>{error=e.message;resolve(-1);});child.once('close',resolve);});clearTimeout(timeout);clearInterval(watch);if(pending.trim())event(pending);
 await telemetry;if(sessionId)try{await observe(record,sessionId,actualModel,true);}catch(e){error??=e.message;}
 if(!usage||!sessionId||normalizeClaudeModel(actualModel)!==model)error??='Missing native usage/session or actual model mismatch';
 const receipt={...record,phase,sessionId,model:actualModel??model,answer,usage,usagePersisted:Boolean(usage),exit,error,finishedAt:Date.now(),finish:{state:error?'preparation_failed':phase==='qa'?'preparation_reviewed':'preparation_submitted',productAccepted:false}};
 await save(join(dir,'receipt.json'),receipt);await writeFile(join(dir,'events.jsonl'),raw,{mode:0o600});await writeFile(join(dir,'stderr.txt'),stderr,{mode:0o600});if(error||exit!==0)throw Error(`Preparation ${leaseId}: ${error??exit}`);return receipt;
}
export async function main(){
 if(!process.env.ORWELL_UID||!process.env.ORWELL_GID||process.env.ORWELL_CONTROLLER_LOCK_HELD!=='1')throw Error('Require root systemd runner under shared controller flock and explicit worker uid/gid');
 let previous;try{previous=await json(join(state,'parallel-preparation.json'));}catch(e){if(e.code!=='ENOENT')throw e;}
 const jobs=validatePreparationJobs(await json(join(state,'preparation-jobs.json')),await json(join(state,'planner-policy.json')));
 const jobsHash=createHash('sha256').update(JSON.stringify(jobs)).digest('hex');if(previous&&createHash('sha256').update(JSON.stringify(previous.jobs)).digest('hex')===jobsHash){if(previous.state==='inreview'){const {repairPreparation}=await import('./preparation-repair.mjs');await repairPreparation(previous);}console.log(JSON.stringify({state:previous.state,reason:'Existing preparation batch retained; no duplicate native runs',batchId:previous.batchId}));return;}
 await admission();await globalReceipts();
 const batchId=randomUUID(),pool=new WorkspacePool({repository,stateDir:join(state,'workspace-pool'),root:'/opt/orwell-workspaces'}),lanes=[];
 for(const job of jobs){const lane=await pool.acquire({...job,leaseId:randomUUID(),allowedPaths:['docs/preparation/'+job.itemKey.replaceAll('/','-')+'.json']});lanes.push(lane);}
 const batch={batchId,state:'preparing',jobsHash,startedAt:Date.now(),jobs,lanes};await save(join(state,'parallel-preparation.json'),batch);
 const results=await Promise.allSettled(jobs.map(async(job,i)=>{const snapshot=await pool.snapshot(lanes[i],randomUUID());const receipt=await run({job,cwd:snapshot.path,model:'sonnet',phase:'research',batchId,prompt:`You are the read-only Orwell backlog preparation worker at ${job.positionKey}. Actual existing checklist item: ${job.itemKey}. Task: ${job.question}. Read ONLY these relevant source inputs: ${job.inputPaths.join(', ')}. No source edits, no checklist completion, no deployment, no agents. Inspect actual facts, identify source-backed gaps and exact proposed changes with file/line evidence. Distinguish unresolved evidence. Return concise evidence report for independent QA. You have8turns; batch reads. This is preparation only.`});if((await sourceManifest(snapshot.path)).revision!==snapshot.snapshotRevision)throw Error('Read-only preparation source changed');return {job,snapshot,receipt};}));
 batch.results=results.map(r=>r.status==='fulfilled'?{status:r.status,...r.value}:{status:r.status,error:String(r.reason)});batch.state=results.every(r=>r.status==='fulfilled')?'inreview':'preparation_failed';await save(join(state,'parallel-preparation.json'),batch);
 if(batch.state==='inreview'){
 const valid=results.map(r=>r.value);const qa=await run({job:{itemKey:'preparation-batch/'+batchId,positionKey:'position:qa-02',originalItemKeys:jobs.map(x=>x.itemKey)},cwd:valid[0].snapshot.path,model:'opus',phase:'qa',batchId,prompt:`You are independent Orwell preparation QA in a fresh Opus session. These are read-only preparation reports for existing backlog, not product acceptance. Reopen source files and verify concrete claims/gaps. Sources for both tasks are in this immutable snapshot. Return ONLY a JSON object with decisions:[{itemKey,result:accepted|changes_requested,detail}] and all concrete unsupported claims/corrections. Provide exactly one decision for each of the two actual task keys. Do not edit or mark a checklist complete. Reports: ${JSON.stringify(valid.map(x=>({itemKey:x.job.itemKey,report:x.receipt.answer})))}`});
 if(valid.some(r=>r.receipt.sessionId===qa.sessionId)||normalizeClaudeModel(qa.model)!=='opus')throw Error('Independent preparation reviewer identity mismatch');batch.qa=qa;let decisions;try{decisions=JSON.parse(qa.answer.replace(/^```(?:json)?\s*|\s*```$/g,'')).decisions;}catch{}const accepted=Array.isArray(decisions)&&decisions.length===2&&jobs.every(job=>decisions.filter(d=>d.itemKey===job.itemKey&&d.result==='accepted'&&typeof d.detail==='string').length===1);batch.qaDecisions=decisions??null;batch.state=accepted?'prepared-awaiting-integration':'inreview';const inventory={batchId,jobsHash,state:batch.state,productAccepted:false,candidates:valid.map(x=>({itemKey:x.job.itemKey,sourceRevision:x.snapshot.revision,snapshotRevision:x.snapshot.snapshotRevision,authorSessionId:x.receipt.sessionId,authorModel:x.receipt.model,reviewerSessionId:qa.sessionId,reviewerModel:qa.model,reportSha256:createHash('sha256').update(x.receipt.answer).digest('hex'),receiptPath:join(state,'runs',x.receipt.leaseId,'receipt.json'),snapshotPath:x.snapshot.path,decision:decisions?.find(d=>d.itemKey===x.job.itemKey)??null}))};await save(join(state,'preparation-inventory.json'),inventory);batch.productAccepted=false;batch.finishedAt=Date.now();await save(join(state,'parallel-preparation.json'),batch);
 }
 for(const lane of lanes)await pool.release(lane);
 console.log(JSON.stringify({batchId,state:batch.state,productAccepted:false}));
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(async error=>{try{const path=join(state,'parallel-preparation.json'),batch=await json(path);batch.runtimeHold={at:Date.now(),reason:error.message};await save(path,batch);}catch{}console.error(error.message);process.exitCode=1;});
