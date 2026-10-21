#!/usr/bin/env node
/** Root-owned control plane. Model processes run as the unprivileged Orwell UID. */
import {spawn} from 'node:child_process';
import {readFile,writeFile,mkdir,readdir,lstat,cp,chmod,symlink,copyFile,rm} from 'node:fs/promises';
import {join,relative} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {admitSubscription,reconcileShortWindows,normalizeCodexUsage} from './budget.mjs';
import {writeAtomicJson} from './admission.mjs';
import {legalOutcome,finiteModelCeiling} from './receipts.mjs';
import {selectAffinity} from './selection.mjs';
import {classifyFailure,retryDecision} from './retry-policy.mjs';
import {acceptanceProof} from './acceptance-proof.mjs';
import {commitReviewedSource} from './source-commit.mjs';
import {statusObservation} from './status.mjs';
import {planningState,runServerPlanner} from './server-planner.mjs';
import {releaseFrontend,verifyFrontendLive} from './frontend-release.mjs';
import {recoverBlockedWorkspace} from './workspace-recovery.mjs';
import {paperclipRequest} from './paperclip-request.mjs';
import {PROVIDERS,oppositeProvider,routeProvider,routingPolicyError,routingObservation,selectNativeModel,nativeRunSpec,normalizeClaudeModel} from './provider-routing.mjs';
import {sourceManifest,assertScopedChanges,verifyProductArtifact} from './product-release.mjs';

const state='/var/lib/orwell-agent-controller',workspace='/home/orwell/build',tools='/home/orwell/agent-tools/node_modules/.bin';
const home='/home/orwell',uid=1001,gid=1001;
const env={HOME:home,USER:'orwell',LOGNAME:'orwell',PATH:`${tools}:/usr/local/bin:/usr/bin:/bin`,LANG:'C.UTF-8',TERM:'dumb'};
const researchAuthor={key:'01a11e39-c201-76a2-a248-96613d713149',name:'Mira'};
const author={key:'01a11df1-1210-7cb3-b50c-fcc89984c864',name:'Lin'};
const reviewer={key:'01a11e11-f35a-7011-bb49-515df644f97a',name:'Rawls'};
const config=JSON.parse(await readFile('/etc/orwell-agent-controller/credentials.json','utf8'));
const policy=JSON.parse(await readFile(join(state,'policy.json'),'utf8'));
let scope=JSON.parse(await readFile(join(state,'scope.json'),'utf8'));
const log=value=>console.log(JSON.stringify({at:new Date().toISOString(),...value}));
let plannerPolicy=null,plannerState={},lastMeters={},lastChecks={},meterErrors={},routing={},controllerState='checking',controllerReason='Checking native subscription usage';
async function refreshRouting(items){
 let previous={};try{previous=JSON.parse(await readFile(join(state,'routing.json'),'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;}
 const observed=items??(await api('dispatch:snapshot',{},'query')).items;
 const board=scope.serverPlanning?await api('scoreboard:list',{},'query'):[];
 const historicallyDone=new Set(board.flatMap(task=>task.checklist.filter(step=>step.done||task.status==='done').map(step=>`${task.key}/${step.key}`)));
 routing=routingObservation({items:observed,itemKeys:scope.itemKeys,checks:lastChecks,policy,previous});
 for(const [key,dependencies] of Object.entries(scope.dependencies??{})){
  const missing=dependencies.filter(dependency=>!historicallyDone.has(dependency)&&!observed.some(item=>item.key===dependency&&item.state==='accepted'));
  if(missing.length&&routing.items[key])Object.assign(routing.items[key],{allowed:false,reason:`Waiting for accepted dependencies: ${missing.join(', ')}`});
 }
 const monitor=(await api('leadAccountability:pause',{},'query')).monitor;
 const globallyPaused=monitor?.dispatchPaused===true,modelCeilingPause=globallyPaused&&monitor.pauseReason?.en?.startsWith('Pilot model ceiling:');
 if(scope.serverPlanning===true){
  plannerPolicy=JSON.parse(await readFile(join(state,'planner-policy.json'),'utf8'));
  try{plannerState=JSON.parse(await readFile(join(state,'planner.json'),'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;}
  let affinity=null;try{affinity=JSON.parse(await readFile(join(state,'affinity.json'),'utf8'));}catch{}
  const backlog={scoreboard:board,dispatch:{items:observed}};
  if(plannerState.state!=='planning')plannerState=planningState({backlog,authorized:plannerPolicy.itemKeys,scope,previous:plannerState,checks:lastChecks,policy,routing,affinity});
  if(globallyPaused)plannerState={...plannerState,state:'held',planningAllowed:false,reason:'Dispatch is paused'};
  routing.planner={allowed:plannerState.planningAllowed===true,role:plannerState.route?.provider??null,reason:plannerState.reason??plannerState.route?.reason};
  await writeAtomicJson(join(state,'planner.json'),plannerState);
 }
 if(globallyPaused){for(const row of Object.values(routing.items))if(!(modelCeilingPause&&row.phase==='accept'))Object.assign(row,{allowed:false,reason:'Dispatch is paused'});}
 await writeAtomicJson(join(state,'routing.json'),routing);return routing;
}
async function publishStatus(runtimeState=controllerState,reason=controllerReason){
 controllerState=runtimeState;controllerReason=reason;
 await writeAtomicJson(join(state,'health.json'),{state:runtimeState,at:Date.now(),reason});
 const receipts=[];for(const id of await readdir(join(state,'runs')).catch(()=>[])){
  try{receipts.push(JSON.parse(await readFile(join(state,'runs',id,'receipt.json'),'utf8')));}catch{}
 }
 const publishedPlannerPolicy=scope.serverPlanning?JSON.parse(await readFile(join(state,'planner-policy.json'),'utf8')):null;
 await api('controllerStatus:publish',statusObservation({policy,scope:{...scope,itemKeys:scope.serverPlanning&&publishedPlannerPolicy?.itemKeys?[...new Set([...publishedPlannerPolicy.itemKeys,...scope.itemKeys])]:scope.itemKeys},snapshots:lastMeters,checks:lastChecks,receipts,state:runtimeState,reason}));
}
async function api(path,args={},kind='mutation') {
 const response=await fetch(`${config.url}/api/${kind}`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Convex ${config.adminKey}`},body:JSON.stringify({path,args,format:'json'}),signal:AbortSignal.timeout(30000)});
 const result=await response.json();
 if(!response.ok||result.status!=='success')throw Error(`${path}: ${result.errorMessage??response.status}`);
 return result.value;
}
function command(command,args,options={}) {
 return new Promise((resolve,reject)=>{
  const child=spawn(command,args,{cwd:workspace,env,uid,gid,stdio:['pipe','pipe','pipe'],...options});let out='',err='';
  const timeout=setTimeout(()=>child.kill('SIGTERM'),options.timeoutMs??120000);
  child.stdout.on('data',d=>{out+=d;if(out.length>8_000_000)child.kill('SIGTERM');});child.stderr.on('data',d=>err+=d);
  child.on('error',reject);child.on('close',(code,signal)=>{clearTimeout(timeout);resolve({code,signal,out,err:err.slice(-3000)});});child.stdin.on('error',()=>{});child.stdin.end(options.input??'');
 });
}
async function meters() {
 const result={};meterErrors={};
 // A provider-specific probe failure cannot authorize that provider or erase
 // the other provider's measured eligibility. No probe creates a model turn.
 for(const provider of PROVIDERS) {
  try{
   const probe=await command('/usr/bin/node',[`/opt/orwell-agent-controller/${provider}-meter.mjs`],{cwd:home,timeoutMs:25000});
   if(probe.code!==0)throw Error(`usage unavailable: ${probe.err}`);
   result[provider]=JSON.parse(probe.out);
  }catch(error){meterErrors[provider]=error.message;}
 }
 return result;
}
async function admission(activeRuns=0,requiredProviders=[]) {
 const snapshots=await meters(),checks={};
 lastMeters=snapshots;
 for(const provider of PROVIDERS) {
  if(!snapshots[provider]){checks[provider]={allowed:false,state:'held',reason:meterErrors[provider]??'Native usage is unavailable'};continue;}
  const reconciled=reconcileShortWindows({snapshot:snapshots[provider],baseline:policy.baselines[provider],policy});
  if(reconciled.records.length){
   policy.baselines[provider]=reconciled.baseline;
   policy.shortWindowReconciliations=[...(policy.shortWindowReconciliations??[]),...reconciled.records.map(record=>({...record,provider}))];
   await writeAtomicJson(join(state,'policy.json'),policy);
  }
  checks[provider]=admitSubscription({snapshot:snapshots[provider],baseline:policy.baselines[provider],policy,activeRuns});
 }
 lastChecks=checks;
 await writeAtomicJson(join(state,'usage.json'),{at:Date.now(),snapshots,checks});
 await refreshRouting();await publishStatus();
 const published='/opt/orwell-evidence/pilot.json';await writeAtomicJson(published,{policy,lastControllerAdmission:{at:Date.now(),snapshots,checks}});await chmod(published,0o444);
 const globalHold=routingPolicyError(policy);if(globalHold)throw Error(globalHold);
 for(const provider of requiredProviders)if(!checks[provider]?.allowed)throw Error(`${provider} held: ${checks[provider]?.reason??'Native admission is unavailable'}`);
 return {snapshots,checks};
}
const excluded=new Set(['node_modules','.git','.next','.vercel','.impeccable','artifacts','tmp','output']);
async function sourceFiles(directory=workspace) {
 const files=[];
 for(const name of (await readdir(directory)).sort()) {
  if(excluded.has(name)||name.startsWith('.env')||name.endsWith('.tsbuildinfo'))continue;
  const path=join(directory,name),info=await lstat(path);
  if(info.isSymbolicLink())throw Error(`Source symlink rejected: ${relative(workspace,path)}`);
  if(info.isDirectory())files.push(...await sourceFiles(path));
  else if(info.isFile())files.push(path);
 }
 return files;
}
async function revision(directory=workspace) {
 const hash=createHash('sha256');
 for(const path of await sourceFiles(directory)){hash.update(relative(directory,path));hash.update('\0');hash.update(await readFile(path));hash.update('\0');}
 return `sha256:${hash.digest('hex')}`;
}
async function freeze(id) {
 const target=`/opt/orwell-reviews/${id}`;await mkdir(target,{recursive:true,mode:0o755});
 for(const file of await sourceFiles()){
  const dest=join(target,relative(workspace,file));await mkdir(join(dest,'..'),{recursive:true,mode:0o755});await cp(file,dest);await chmod(dest,0o444);
 }
 await symlink(join(workspace,'node_modules'),join(target,'node_modules'));
 // systemd's private umask also applies to mkdir({mode:0755}). Explicitly
 // open traversal only after every file has its immutable review permissions.
 async function openDirectories(directory) {
  await chmod(directory,0o755);
  for(const entry of await readdir(directory,{withFileTypes:true}))if(entry.isDirectory())await openDirectories(join(directory,entry.name));
 }
 await openDirectories(target);
 const probe=await command('/usr/bin/node',['-e',`const fs=require('fs');fs.accessSync('scripts/orwell-pilot/budget.mjs',fs.constants.R_OK);let writable=true;try{fs.accessSync('scripts/orwell-pilot/budget.mjs',fs.constants.W_OK)}catch{writable=false}if(writable)throw Error('QA source is writable');console.log('Review source readable and immutable')`],{cwd:target,timeoutMs:10000});
 if(probe.code!==0)throw Error('Independent review access preflight failed before model launch');
 return target;
}
async function observe(job,sessionId,person,provider,model,kind,detail) {
 const at=Date.now(),localized=en=>({en,es:en,pt:en});
 await api('agentActivity:record',{key:sessionId,name:person.name,team:job.phase==='qa'?'qa':job.item.team,model,reasoning:'low',assignment:localized(`${job.item.label} (${job.item.key}; ${job.phase})`),status:kind==='completed'?'completed':kind==='error'?'error':'running',lastActivityAt:at,eventId:`vps:${job.leaseId}:${kind}:${at}`,kind,summary:localized(detail),binding:{taskKey:job.item.taskKey,stepKey:job.item.stepKey,rosterKey:person.key,observedAt:at,evidence:`Actual ${provider} CLI session ${sessionId}; lease ${job.leaseId}; immutable source review required`}});
 if(kind==='assigned')await publishStatus('working',`Actual ${provider} ${model} session ${sessionId} is running ${job.item.key} (${job.phase}).`);
 if(kind==='assigned')await api('dispatch:checkpoint',{itemKey:job.item.key,leaseId:job.leaseId,checkpoint:detail,sessionId,actorName:person.name,actorKey:person.key});
}
function parseAnswer(text) {
 try{return JSON.parse(text);}catch{}
 const block=text.match(/```(?:json)?\s*([\s\S]*?)```/);if(block)return JSON.parse(block[1]);
 throw Error('Model did not return a valid JSON outcome');
}
function prompt(job,qa,provider,person) {
 if(!qa&&scope.handoffOnly?.[job.item.key])return `You are ${person.name}, the observed Claude author verification/handoff worker. Source is a frozen read-only snapshot; preserve all work. Do not spawn agents or edit files. Existing implementation and audit artifacts are already present. This is NOT another implementation turn. ${scope.criteria[job.item.key]}\nBatch targeted source reads into one Bash call and all required tests into one Bash call. At most4 tool calls,8turns, then return ONLY one JSON object with required string fields result,detail,evidence,team. result=submitted if verified, otherwise failed with concrete evidence. team=implementation. No changes or deployment; root and fresh opposite-provider QA follow.`;
 return `You are ${person.name}, ${qa?`an independent ${provider} reviewer in Ada's QA team`:job.item.team==='research'?`a ${provider} research worker under Iris`:`a ${provider} implementation worker under Rowan`}. You are not alone in this codebase. Preserve other work. Do not spawn agents.\nActual Orwell task: ${job.item.taskTitle}. Context: ${job.item.taskDetail??''}. Step: ${job.item.key}: ${job.item.label}.\nAcceptance: ${scope.criteria[job.item.key]??job.item.acceptance}.\n${qa?`Independent review scope: ${JSON.stringify(scope.allowedPaths?.[job.item.key]??[])}. Actual author provider/model: ${job.item.workerProvider}/${job.item.workerModel??'unknown'}. Author self-evaluation and conversation are withheld.`:`Prior evidence: ${job.item.evidence??''}. Prior QA defects: ${job.item.qaEvidence??''}. Checkpoint: ${job.item.checkpoint??''}.`}\n${qa?'The source is a frozen read-only snapshot. Focus on the changed files named in prior evidence. Batch related file reads and test commands into a few Bash calls. Do not reread the full WORKLIST or re-audit completed pilot steps. Reserve turns for your final JSON outcome before the24-turn bound. Inspect relevant source and run focused meaningful tests. Do not edit source or accept merely because tests pass. Check missing edge cases and real production behavior if required. Report ALL material findings together. Reject only a reproducible behavior/source/data defect, an actual failing required check, or absent required proof. Each defect must state expected versus observed behavior and an exact reproduction or concrete counterexample. Do not block correct behavior for hypothetical wording-test mutations, stylistic preferences or checks outside acceptance. This snapshot has no .git metadata. For a whole-app TypeScript check use npx tsc --noEmit --incremental false -p tsconfig.json so it writes no tsbuildinfo; a forbidden cache write is not a product defect. You may accept when required behavior, evidence and independent checks are complete; root publication remains separate.':'Implement or research this bounded PRODUCT step. Exact writable paths are listed in /opt/orwell-evidence/product-scope.json under allowedPaths for this key; all other files belong to others and must be preserved. Use public query instructions in /opt/orwell-evidence/backlog.json. Do not repeat infrastructure qualification. Research must reopen primary sources and distinguish missing, unsourced, conflicting and inaccessible evidence; never invent facts or activate paid collection. Source changes are allowed only in your listed paths. Do not touch credentials, unrelated assets, task states or deployments. Controller handles publication and acceptance. Batch reads and commands; no commit or deployment yourself.'}\nUse subscription access only. Budget finite, one worker at a time. Finish within 8 minutes. Return one JSON object with required string fields result,detail,evidence,team. result=${qa?'accepted or changes_requested':'submitted or failed or needs_input'}. team=${qa?'implementation':job.item.team}. Evidence must give exact inspected files and commands. Turn ending does not complete the checklist.`;
}
async function runModel(job) {
 // Publish the exact root-owned scope used by this run, including approved operator handoffs.
 await writeAtomicJson('/opt/orwell-evidence/product-scope.json',scope);await chmod('/opt/orwell-evidence/product-scope.json',0o444);
 const qa=job.phase==='qa',handoff=job.phase==='work'&&scope.handoffOnly?.[job.item.key]===true,person=qa?reviewer:job.item.team==='research'?researchAuthor:author;
 let structuredHandoffRecovery=false;
 if(!qa&&job.item.qaAttempt>0){
  const prior=[];for(const id of await readdir(join(state,'runs'))){try{const receipt=JSON.parse(await readFile(join(state,'runs',id,'receipt.json'),'utf8'));if(receipt.job?.item?.key===job.item.key&&receipt.job.phase==='qa')prior.push(receipt);if(receipt.job?.item?.key===job.item.key&&receipt.job.phase==='work'&&receipt.usagePersisted&&receipt.exit?.code===1&&receipt.finishArgs?.detail?.includes('error_max_structured_output_retries'))structuredHandoffRecovery=true;}catch{}}
  const latest=prior.sort((a,b)=>b.finishedAt-a.finishedAt)[0];
  if(latest?.answer?.result==='changes_requested')job.item.qaEvidence=`Required repairs: ${latest.answer.detail}\nInspection evidence: ${latest.answer.evidence}`;
 }
 const measured=await admission();
 const chosen=routeProvider({phase:job.phase,item:job.item,checks:measured.checks,policy,previousProvider:routing.heavyProvider,reservation:routing.reservations?.[job.item.key]});
 if(!chosen.allowed)throw Error(chosen.reason);
 const provider=chosen.provider;
 if(job.requestRole&&job.requestRole!==provider)throw Error('Paperclip provider role differs from its current trusted reservation');
 if(!qa){
  routing.heavyProvider=provider;routing.reservations[job.item.key]={workerProvider:provider};
  await writeAtomicJson(join(state,'routing.json'),routing);
 }
 const dir=join(state,'runs',job.leaseId);await mkdir(dir,{recursive:true,mode:0o700});
 const before=await revision();
 const beforeManifest=!qa&&scope.allowedPaths?.[job.item.key]?await sourceManifest(workspace):null;
 if(qa&&before!==job.item.submissionRevision)throw Error('Workspace differs from submitted revision; QA cannot review');
 const baselineDirectory=qa?null:await freeze(job.leaseId+'-baseline');
 const cwd=qa||handoff?await freeze(job.leaseId):workspace;
 const schema={type:'object',additionalProperties:false,required:['result','detail','evidence','team'],properties:{result:{type:'string',enum:['submitted','changes_requested','accepted','needs_input','failed']},detail:{type:'string'},evidence:{type:'string'},team:{type:'string',enum:['implementation','research','none']}}};
 let retry=null;
 if(!qa){try{const saved=JSON.parse(await readFile(join(state,'retry-model.json'),'utf8'));if(saved.itemKey===job.item.key)retry=saved;}catch(error){if(error.code!=='ENOENT')throw error;}}
 const repairReason=qa?'':job.item.qaEvidence?.trim()||retry?.reason||'';
 const proposal=!qa&&provider==='claude'&&structuredHandoffRecovery?'sonnet':!qa&&provider==='claude'&&(job.item.qaAttempt??0)>=2&&repairReason?'opus':scope.modelProposals?.[job.item.key]?.[provider]??(provider==='codex'?retry?.model:null);
 const selected=selectNativeModel({provider,phase:job.phase,proposal,repairReason,taskReason:scope.modelReasons?.[job.item.key]??'',qaFailures:job.item.qaAttempt??0,policy,workerModel:job.item.workerModel,workerProvider:job.item.workerProvider});
 let model=selected.model,modelUsage;
 const {args}=nativeRunSpec({provider,phase:handoff?'planner':job.phase,model,cwd,schema});
 if(handoff&&provider==='claude')args[args.indexOf('--max-turns')+1]='8';
 await writeAtomicJson(join(dir,'execution.json'),{job,provider,model,modelReason:selected.reason,routingReason:chosen.reason,before,baselineDirectory,beforeManifest,startedAt:Date.now()});
 await publishStatus('working',`Starting ${provider} ${model} for ${job.item.key} (${job.phase}); native session identity pending.`);
 const child=spawn(`${tools}/${provider}`,args,{cwd,env,uid,gid,detached:true,stdio:['pipe','pipe','pipe']});
 let pending='',raw='',stderr='',sessionId,usage,answerText='',answerObject,completed=false,streamError,serial=Promise.resolve(),lastCheckpointAt=0,checkpointCount=0;
 const kill=()=>{try{process.kill(-child.pid,'SIGTERM');}catch{}};
 const processEvent=line=>{
  let e;try{e=JSON.parse(line);}catch{return;}
  if((provider==='codex'&&e.type==='thread.started')||(provider==='claude'&&e.type==='system'&&e.subtype==='init')){
   sessionId=provider==='codex'?e.thread_id:e.session_id;model=e.model??model;
   if(qa&&sessionId===job.item.workerSessionId){streamError=Error('Reviewer cannot reuse the author session');kill();return;}
   if(qa&&policy.reviewMode==='claude-cross-model'&&provider==='claude'&&job.item.workerProvider==='claude'&&(!normalizeClaudeModel(model)||normalizeClaudeModel(model)===normalizeClaudeModel(job.item.workerModel))){streamError=Error('Reviewer must use a distinct actual Claude model');kill();return;}
   serial=serial.then(()=>observe(job,sessionId,person,provider,model,'assigned',`Actual ${provider} ${job.phase} session started`)).catch(error=>{streamError=error;kill();});
  }
 // Save bounded, substantive progress only when the native CLI reports a
 // completed assistant/tool event. Timer renewals below never claim progress.
 let progress;
 if(provider==='codex'&&e.type==='item.completed'){
  const item=e.item??{};
  if(item.type==='agent_message'&&typeof item.text==='string')progress=`Assistant update: ${item.text}`;
  else if(item.type==='command_execution'&&typeof item.command==='string')progress=`Tool completed: ${item.command.slice(0,350)}${item.exit_code===0?' (exit 0)':` (exit ${item.exit_code??'unknown'})`}`;
  else if(item.type==='file_change')progress=`File changes completed: ${(item.changes??[]).map(c=>c.path).filter(Boolean).slice(0,12).join(', ')||'reported by Codex'}`;
 }
 if(provider==='claude'&&e.type==='user'&&Array.isArray(e.message?.content)){
  const results=e.message.content.filter(b=>b.type==='tool_result');
  if(results.length)progress=`Claude tool completed: ${results.slice(0,5).map(b=>`${b.name??'tool'}${b.is_error?' (reported error)':''}`).join(', ')}`;
 }
 else if(provider==='claude'&&e.type==='assistant'&&Array.isArray(e.message?.content)){
  const blocks=e.message.content;const text=blocks.filter(b=>b.type==='text'&&b.text?.trim()).map(b=>b.text).join(' ').slice(0,800);
  const toolsUsed=blocks.filter(b=>b.type==='tool_use').map(b=>b.name).slice(0,6);
  if(text||toolsUsed.length)progress=`Assistant update${toolsUsed.length?`; requested tools: ${toolsUsed.join(', ')}`:''}${text?`: ${text}`:''}`;
 }
 if(progress&&sessionId&&checkpointCount<60&&Date.now()-lastCheckpointAt>=5_000){checkpointCount++;lastCheckpointAt=Date.now();serial=serial.then(()=>api('dispatch:checkpoint',{itemKey:job.item.key,leaseId:job.leaseId,sessionId,actorName:person.name,actorKey:person.key,checkpoint:progress})).catch(error=>{streamError=error;kill();});}
  if(provider==='codex'&&e.type==='turn.completed'){completed=true;const next=normalizeCodexUsage(e.usage);usage=usage&&next?normalizeCodexUsage({input_tokens:usage.input_tokens+next.input_tokens,cached_input_tokens:usage.cached_input_tokens+next.cached_input_tokens,output_tokens:usage.output_tokens+next.output_tokens}):next;}
  if(provider==='codex'&&e.type==='item.completed'&&e.item?.type==='agent_message')answerText=e.item.text;
  if(provider==='claude'&&e.type==='result'){
   completed=e.is_error===false;answerText=e.result??'';answerObject=e.structured_output;
   if(e.is_error)streamError=Error(`Claude ${e.subtype??'run error'}: ${(e.errors??[]).join('; ')}`);
   const u=e.usage;
   if(u){const input=u.input_tokens+u.cache_creation_input_tokens+u.cache_read_input_tokens;usage=normalizeCodexUsage({input_tokens:input,cached_input_tokens:u.cache_read_input_tokens,output_tokens:u.output_tokens});}
   // Auxiliary Haiku usage is accounting metadata, not the actual session model.
   modelUsage=e.modelUsage??null;
  }
 };
 child.stdout.on('data',d=>{raw+=d;pending+=d;let at;while((at=pending.indexOf('\n'))>=0){processEvent(pending.slice(0,at));pending=pending.slice(at+1);}if(raw.length>8_000_000){streamError=Error('Run output bound exceeded');kill();}});
 child.stderr.on('data',d=>stderr+=d);
 child.stdin.on('error',()=>{});child.stdin.end(prompt(job,qa,provider,person));
 let watchdogBusy=false;
 const watchdog=setInterval(async()=>{
  if(watchdogBusy)return;watchdogBusy=true;
  try{await admission(0,qa||policy.reviewMode==='claude-cross-model'?[provider]:[provider,oppositeProvider(provider)]);const snapshot=await api('leadAccountability:pause',{},'query');if(snapshot.monitor?.dispatchPaused)throw Error('Dispatch was paused');await api('dispatch:renewLease',{itemKey:job.item.key,leaseId:job.leaseId});}
  catch(error){streamError=error;kill();}finally{watchdogBusy=false;}
 },45000);
 const timeout=setTimeout(()=>{streamError=Error('Eight-minute model time limit');kill();},8*60_000);
 const exit=await new Promise((resolve,reject)=>{child.on('error',reject);child.on('close',(code,signal)=>resolve({code,signal}));});clearInterval(watchdog);clearTimeout(timeout);
 if(pending.trim())processEvent(pending);await serial;
 await writeFile(join(dir,'events.jsonl'),raw,{mode:0o600});
 let answer;try{answer=answerObject??parseAnswer(answerText);}catch(error){streamError??=error;}
 if(!sessionId||!usage||!completed||exit.code!==0||!legalOutcome(job.phase,answer))streamError??=Error(`Invalid or incomplete ${provider} run; exit ${exit.code}; ${stderr.slice(-200)}`);
 const after=await revision();if(qa&&after!==before)streamError??=Error('Source changed during independent QA');
 if(beforeManifest){try{assertScopedChanges({before:beforeManifest,after:await sourceManifest(workspace),itemKey:job.item.key,scope});}catch(error){streamError??=error;}}
 let usagePersisted=false;
 if(sessionId&&usage){await api('dispatch:recordUsage',{itemKey:job.item.key,leaseId:job.leaseId,sessionId,model,inputTokens:usage.input_tokens,cachedInputTokens:usage.cached_input_tokens,outputTokens:usage.output_tokens,totalTokens:usage.total_tokens});usagePersisted=true;}
 if(sessionId)await observe(job,sessionId,person,provider,model,streamError?'error':'completed',streamError?streamError.message:'Model turn ended; acceptance remains separate');
 const finishArgs={itemKey:job.item.key,leaseId:job.leaseId,phase:job.phase,result:streamError?'failed':answer.result,detail:(streamError?.message??answer.detail).slice(0,2800),evidence:streamError?undefined:(qa&&answer.result==='changes_requested'?`Required repairs: ${answer.detail}\nInspection evidence: ${answer.evidence}`:answer.evidence).slice(0,2800),sessionId,provider,artifactRevision:after,...(policy.reviewMode==='claude-cross-model'?{reviewMode:'claude-cross-model'}:{}),...(qa?{reviewerKey:person.key}:{contributorKey:person.key})};
 const receipt={job,provider,model,modelUsage,sessionId,usage,usagePersisted,exit,before,after,afterManifest:await sourceManifest(workspace),answer,finishArgs,finishedAt:Date.now(),finish:null};
 await writeAtomicJson(join(dir,'receipt.json'),receipt);
 const finish=await api('dispatch:finish',finishArgs);
 if(!streamError&&job.phase==='work'){await rm(join(state,'retry-model.json'),{force:true}).catch(()=>{});if(handoff){delete scope.handoffOnly[job.item.key];await writeAtomicJson(join(state,'scope.json'),scope);}}
 await writeAtomicJson(join(dir,'receipt.json'),{...receipt,finish});
 log({item:job.item.key,phase:job.phase,provider,sessionId,model,usage,finish});return finish;
}
async function activateReviewedSource(job,current) {
 // No model receives deployment credentials. Only a separately approved exact
 // revision reaches these privileged operations.
 if(await revision()!==current)throw Error('Source changed before activation');
 const commandEnv={PATH:'/usr/local/bin:/usr/bin:/bin',HOME:'/root',LANG:'C.UTF-8',CONVEX_SELF_HOSTED_URL:config.url,CONVEX_SELF_HOSTED_ADMIN_KEY:config.adminKey};
 const deployment=await command(join(workspace,'node_modules/.bin/convex'),['deploy','--yes','--typecheck','enable','--codegen','disable'],{uid:0,gid:0,env:commandEnv,timeoutMs:180000});
 await writeFile(join(state,`deployment-${job.leaseId}.txt`),deployment.out+'\n'+deployment.err,{mode:0o600});
 if(deployment.code!==0)throw Error('Reviewed backend deployment failed; acceptance withheld');
 if(await revision()!==current)throw Error('Deployment modified reviewed source; repeat QA');
 // Product authors have no control-plane ownership. Operator-installed root
 // runtime fixes must not be overwritten by their older workspace snapshot.
 for(const name of scope.serverPlanning?[]:await readdir(join(workspace,'scripts/orwell-pilot'))){
  if(!name.endsWith('.mjs'))continue;
  const from=join(workspace,'scripts/orwell-pilot',name),to=join('/opt/orwell-agent-controller',name);
  if(!(await lstat(from)).isFile())throw Error('Only regular reviewed controller files may activate');
  await copyFile(from,to);await chmod(to,0o644);
 }
 await writeAtomicJson(join(state,'deployment.json'),{at:Date.now(),itemKey:job.item.key,leaseId:job.leaseId,code:deployment.code,revision:current,deployment:config.url,worker:job.item.workerSessionId,reviewer:job.item.qaSessionId});
}
async function receiptGuard() {
 const root=join(state,'runs');await mkdir(root,{recursive:true,mode:0o700});
 const receipts=[];
 for(const id of await readdir(root)){
  const dir=join(root,id);let receipt;
  try{receipt=JSON.parse(await readFile(join(dir,'receipt.json'),'utf8'));}catch(error){
   if(error.code==='ENOENT'){
    try{await lstat(join(dir,'execution.json'));}catch(markerError){if(markerError.code==='ENOENT')continue;}
   }
   throw Error(`Unreconciled model execution ${id}; no additional spend`);
  }
  if(!receipt.usage||!receipt.usagePersisted){
   const r=receipt.quotaReconciliation;
   if(!r||r.method!=='fresh-native-account-quota'||r.sessionId!==receipt.sessionId||r.policyStartedAt!==policy.startedAt||r.exactFinalTotalKnown!==false||!r.observedUsage)throw Error(`Unknown or unpersisted usage in ${id}`);
  }
  if(!receipt.finish){const active=await api('dispatch:activeLease',{itemKey:receipt.job.item.key},'query');if(!active)throw Error(`Missing dispatch item ${id}`);const finish=await api('dispatch:finish',receipt.finishArgs);await writeAtomicJson(join(dir,'receipt.json'),{...receipt,finish});}
  receipts.push(receipt);
 }
 const known=r=>r.usage??r.quotaReconciliation.observedUsage;
 const reconciled=receipts.filter(r=>r.quotaReconciliation).length;
 if(reconciled>1)throw Error('Repeated interrupted accounting requires investigation before more spending');
 const totalTokens=receipts.reduce((n,r)=>n+known(r).total_tokens,0),freshTokens=receipts.reduce((n,r)=>n+known(r).total_tokens-known(r).cached_input_tokens,0);
 let acceptedAt=0;try{acceptedAt=JSON.parse(await readFile(join(state,'last-acceptance.json'),'utf8')).at;}catch{}
 return {modelHeld:finiteModelCeiling({runs:receipts.length,tokens:totalTokens,freshTokens,withoutAcceptance:receipts.filter(r=>r.finishedAt>acceptedAt).length}),knownTokens:totalTokens,knownFreshTokens:freshTokens,reconciledUnknownRuns:reconciled,usageLabel:reconciled?'Reported/observed lower bound; interrupted final total unknown':'Reported native usage'};
}
async function main() {
 let spending;try{spending=await receiptGuard();}catch(error){await api('dispatch:stopPilot',{reason:error.message,modelOnly:false});throw error;}
 try{await admission();}catch(error){await api('dispatch:stopPilot',{reason:error.message,modelOnly:false});throw error;}
 if(spending.modelHeld)await api('dispatch:stopPilot',{reason:'Finite 192 runs / 12 since acceptance / 100,000,000 reported or observed tokens / 8,000,000 fresh tokens ceiling reached; reviewed non-model acceptance remains eligible',modelOnly:true});
 await api('dispatch:sync');await api('dispatch:recoverExpired');
 const snapshot=await api('dispatch:snapshot',{},'query');
 let savedAffinity=null;try{savedAffinity=JSON.parse(await readFile(join(state,'affinity.json'),'utf8'));}catch{}
 const blocked=snapshot.items.find(i=>i.key===savedAffinity?.itemKey&&i.state==='blocked'&&!(i.leaseUntil>Date.now()));
 if(blocked&&scope.serverPlanning){
  const recovered=await recoverBlockedWorkspace({workspace,stateDir:state,item:blocked,allowedPaths:scope.allowedPaths?.[blocked.key],revision,sourceManifest});
  if(recovered.state==='recovered'||recovered.state==='unchanged'){await writeAtomicJson(join(state,'affinity.json'),null);log({blocked:blocked.key,recovery:recovered});}else throw Error(`Blocked workspace recovery held: ${JSON.stringify(recovered)}`);
 }
 await refreshRouting(snapshot.items);
 let requested=null;if(scope.paperclipManaged){let request;try{request=JSON.parse(await readFile(join(state,'paperclip-request.json'),'utf8'));}catch{}requested=paperclipRequest({request,scope,policy,items:snapshot.items,routing});if(!requested.allowed){await publishStatus('idle',requested.reason);return log(requested);}}
 if(snapshot.items.some(i=>i.leaseUntil>Date.now()))return log({state:'busy'});
 if(requested?.role==='planner'){
  if(spending.modelHeld)throw Error('Finite model ceiling prohibits another planning turn');
  const backlog={scoreboard:await api('scoreboard:list',{},'query'),dispatch:snapshot};
  const result=await runServerPlanner({state,workspace,tools,env,uid,gid,backlog,plannerPolicy,scope,previous:plannerState,checks:lastChecks,policy,routing,freeze,revision,sourceManifest,admission,api,publishStatus,log});
  scope=result.scope;plannerState=result.state;await refreshRouting();await publishStatus('ready',`VPS planner released ${scope.itemKeys.length} product steps for independent implementation and QA`);return;
 }
 let affinity=null;try{affinity=JSON.parse(await readFile(join(state,'affinity.json'),'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;}
 const selection=selectAffinity({affinity,items:snapshot.items,itemKeys:scope.itemKeys,modelHeld:spending.modelHeld});
 await writeAtomicJson(join(state,'affinity.json'),selection.affinity);
 const eligible=selection.onlyItemKeys.filter(key=>(!requested||key===requested.itemKey)&&routing.items[key]?.allowed);
 if(!eligible.length){const held=selection.onlyItemKeys.map(key=>routing.items[key]).find(row=>row&&!row.allowed);await publishStatus(held?'held':selection.state,held?.reason??selection.reason??'No eligible step in the authorized backlog');return log({...selection,...spending,routingHold:held?.reason});}
 const job=await api('dispatch:claimNext',{leaseId:randomUUID(),onlyItemKeys:eligible,reviewedAcceptanceOnly:spending.modelHeld});
 if(job.state!=='claimed'){const pinned=snapshot.items.find(i=>i.key===selection.affinity?.itemKey);const waiting=pinned?.retryAt>Date.now();await publishStatus(waiting?'ready':job.state,waiting?`Retry scheduled for ${pinned.label} at ${new Date(pinned.retryAt).toISOString()}; repair ownership remains pinned`:job.reason??'No eligible step in the authorized backlog');return log({...job,affinity:selection.affinity});}
 await publishStatus('working',`${job.phase}: ${job.item.label}`);
 await writeAtomicJson(join(state,'affinity.json'),{itemKey:job.item.key});
 try{
  if(['work','qa'].includes(job.phase)){
   const route=routeProvider({phase:job.phase,item:job.item,checks:lastChecks,policy,previousProvider:routing.heavyProvider,reservation:routing.reservations[job.item.key]});
   if(!route.allowed)throw Error(route.reason);
   if(requested&&requested.role!==route.provider)throw Error('Paperclip role does not match the current admitted provider');
   job.requestRole=requested?.role;
   if(job.phase==='work'){routing.reservations[job.item.key]={workerProvider:route.provider};await writeAtomicJson(join(state,'routing.json'),routing);}
  }
  if(job.phase==='triage'){
   const finish=await api('dispatch:finish',{itemKey:job.item.key,leaseId:job.leaseId,phase:'triage',result:'submitted',team:'implementation',detail:'Trusted controller routed the explicitly authorized product step without a model call',evidence:scope.criteria[job.item.key]??job.item.acceptance});return log({item:job.item.key,phase:'triage',finish});
  }
  if(job.phase==='accept'){
   await api('dispatch:checkpoint',{itemKey:job.item.key,leaseId:job.leaseId,sessionId:`controller:${job.leaseId}`,actorName:'Orion',checkpoint:'Controller deterministic acceptance started; not a model session'});
   const current=await revision();if(current!==job.item.submissionRevision||current!==job.item.qaRevision)throw Error('Acceptance source differs from reviewed source');
   const tests=(await readdir(join(workspace,'scripts/orwell-pilot'))).filter(name=>name.endsWith('.test.mjs')).sort().map(name=>`scripts/orwell-pilot/${name}`);
   const commands=[['/usr/bin/node',['--test',...tests.map(path=>path.endsWith('/production-evidence.test.mjs')?'/opt/orwell-agent-controller/production-evidence.test.mjs':path)]],...['live-contract','acceptance','pause'].map(name=>['/usr/bin/node',[`scripts/test-dispatch-${name}.cjs`]]),[join(workspace,'node_modules/.bin/tsc'),['--noEmit','-p','convex/tsconfig.json']]];
   let evidence='';const checkRecords=[],checksPath=join(state,`checks-${job.leaseId}.json`);
   if(scope.productChecks?.[job.item.key]){try{const product=await verifyProductArtifact({workspace,itemKey:job.item.key,scope,runCommand:command});await writeAtomicJson(join(state,`product-checks-${job.leaseId}.json`),product);evidence+='Product acceptance checks: '+JSON.stringify(product)+'\n';}catch(error){await writeAtomicJson(join(state,`product-rejection-${job.leaseId}.json`),{itemKey:job.item.key,at:Date.now(),checks:error.checks??[],reason:error.message});const finish=await api('dispatch:finish',{itemKey:job.item.key,leaseId:job.leaseId,phase:'accept',result:'changes_requested',detail:(`Root product verification rejected this submission: ${error.message}. ${JSON.stringify(error.checks??[]).slice(-1800)}. Repair and fresh opposite-provider QA required`).slice(0,2800),evidence:JSON.stringify(error.checks??error.message).slice(-2500)});await publishStatus('ready','Product defect returned to its original owner for repair');return log({item:job.item.key,phase:'accept',finish});}}
   for(const [binary,args] of commands){const check=await command(binary,args,{timeoutMs:120000});checkRecords.push({name:args.includes('--test')?'pilot':args.some(a=>a.endsWith('live-contract.cjs'))?'live-contract':args.some(a=>a.endsWith('acceptance.cjs'))?'acceptance':args.some(a=>a.endsWith('pause.cjs'))?'pause':'typecheck',code:check.code});await api('dispatch:renewLease',{itemKey:job.item.key,leaseId:job.leaseId});evidence+=`${binary} ${args.join(' ')}\n${check.out}\n${check.err}\n`;await writeAtomicJson(checksPath,{itemKey:job.item.key,leaseId:job.leaseId,revision:current,commands:checkRecords,output:evidence,stage:'checking'});if(check.code!==0)throw Error(`Final verification failed: ${binary} ${args.join(' ')}`);}
   await writeFile(join(state,`checks-${job.leaseId}.txt`),evidence,{mode:0o600});
   // Exercise candidate admission against the real original allocation, not
   // only synthetic fixtures. Run generated source without root privileges.
   const measured=await admission();
   const realPolicy=await command('/usr/bin/node',['--input-type=module','-e',`import fs from 'node:fs';import {admitSubscription} from './scripts/orwell-pilot/budget.mjs';const {policy,lastControllerAdmission}=JSON.parse(fs.readFileSync('/opt/orwell-evidence/pilot.json','utf8'));for(const provider of ['codex','claude']){const result=admitSubscription({snapshot:lastControllerAdmission.snapshots[provider],baseline:policy.baselines[provider],policy,activeRuns:0,now:lastControllerAdmission.at});if(result.allowed!==lastControllerAdmission.checks[provider].allowed)throw Error(provider+': candidate admission differs from trusted original allocation')}console.log('Candidate agrees with original allocation admission/holds for both native providers')`],{timeoutMs:15000});
   await writeFile(join(state,`original-policy-${job.leaseId}.txt`),realPolicy.out+'\n'+realPolicy.err,{mode:0o600});
   if(realPolicy.code!==0){const finish=await api('dispatch:finish',{itemKey:job.item.key,leaseId:job.leaseId,phase:'accept',result:'changes_requested',detail:'Candidate failed the actual original-policy admission check; repair and fresh QA required',evidence:realPolicy.err.slice(-2500)});return log({item:job.item.key,phase:'accept',finish});}
   checkRecords.push({name:'original-policy',code:realPolicy.code});
   await writeAtomicJson(checksPath,{itemKey:job.item.key,leaseId:job.leaseId,revision:current,commands:checkRecords,output:evidence,originalPolicy:realPolicy.out});
   await api('dispatch:renewLease',{itemKey:job.item.key,leaseId:job.leaseId});
   await activateReviewedSource(job,current);
   if(scope.productPostChecks?.[job.item.key]){try{const live=await verifyProductArtifact({workspace,itemKey:job.item.key,scope:{...scope,productChecks:scope.productPostChecks},runCommand:command});await writeAtomicJson(join(state,`product-live-${job.leaseId}.json`),live);evidence+='Production product checks: '+JSON.stringify(live)+'\n';await writeAtomicJson(checksPath,{itemKey:job.item.key,leaseId:job.leaseId,revision:current,commands:checkRecords,output:evidence,originalPolicy:realPolicy.out});}catch(error){const finish=await api('dispatch:finish',{itemKey:job.item.key,leaseId:job.leaseId,phase:'accept',result:'changes_requested',detail:(`Production product verification failed: ${error.message}. ${JSON.stringify(error.checks??[]).slice(-1800)}. Repair and fresh independent QA required`).slice(0,2800),evidence:JSON.stringify(error.checks??error.message).slice(-2500)});await publishStatus('ready','Production product defect returned for repair');return log({item:job.item.key,phase:'accept',finish});}}
   let frontendConfig=null;try{frontendConfig=JSON.parse(await readFile('/etc/orwell-agent-controller/frontend.json','utf8'));}catch(error){if(scope.delivery?.[job.item.key]==='frontend')throw error;}
   const sourceCommit=await commitReviewedSource({workspace,state,uid,gid,home,authorIdentity:frontendConfig?.authorIdentity,log:line=>console.log(line)});
   if(sourceCommit.state!=='committed')throw Error('Reviewed source must be committed before checklist completion');
   if(scope.delivery?.[job.item.key]==='frontend'){
    await api('dispatch:renewLease',{itemKey:job.item.key,leaseId:job.leaseId});
    const {authorIdentity,...deployConfig}=frontendConfig;
    const frontend=await releaseFrontend({workspace,stateDir:state,itemKey:job.item.key,leaseId:job.leaseId,revision:current,config:deployConfig,runCommand:command,verifyLive:args=>verifyFrontendLive({...args,stateDir:state})});
    if(await revision()!==current)throw Error('Frontend deployment changed reviewed source');
    evidence+='Verified frontend release: '+JSON.stringify(frontend)+'\n';
    await writeAtomicJson(checksPath,{itemKey:job.item.key,leaseId:job.leaseId,revision:current,commands:checkRecords,output:evidence,originalPolicy:realPolicy.out});
   }
   const proof=await acceptanceProof({checksPath,deploymentPath:join(state,'deployment.json'),itemKey:job.item.key,leaseId:job.leaseId,revision:current});
   const finish=await api('dispatch:finish',{itemKey:job.item.key,leaseId:job.leaseId,phase:'accept',result:'accepted',...(policy.reviewMode==='claude-cross-model'?{reviewMode:'claude-cross-model'}:{}),acceptanceProof:proof,sessionId:`controller:${job.leaseId}`,artifactRevision:current,detail:'Deterministic acceptance: independent reviewer models and sessions, exact revision, persisted usage and final checks verified',evidence:`Hostinger ${current}; ${job.item.workerProvider}/${job.item.workerModel??'recorded native model'} worker ${job.item.workerSessionId}; ${job.item.qaProvider}/${job.item.qaModel??'recorded native model'} reviewer ${job.item.qaSessionId}; Git ${sourceCommit.commit}; product-specific checks where configured, controller regressions, dispatch acceptance guards and Convex typecheck passed; receipt journal /var/lib/orwell-agent-controller/runs`});await writeAtomicJson(join(state,'last-acceptance.json'),{at:Date.now(),itemKey:job.item.key,revision:current,finish});if(finish.state==='accepted'){
    await writeAtomicJson(join(state,'affinity.json'),null);
    const remaining=await receiptGuard(),monitor=(await api('leadAccountability:pause',{},'query')).monitor;
    if(!remaining.modelHeld&&monitor?.dispatchPaused&&monitor.pauseReason?.en?.startsWith('Pilot model ceiling:')){
     const reason='A real reviewed product release reset the12-runs-without-acceptance ceiling; original subscription/reserve/deadline and absolute run/token guards remain active';
     await api('leadAccountability:configure',{dispatchPaused:false,reason:{en:reason,es:reason,pt:reason}});
    }
   }await publishStatus('ready',`${job.item.label}: accepted with independent QA and product verification. Awaiting the next authorized product step.`);return log({item:job.item.key,phase:'accept',finish});
  }
  const finish=await runModel(job);await publishStatus('ready',`${job.item.label}: ${finish.state}. Awaiting the next verified handoff.`);
 }catch(error){
  if(job.phase!=='triage'&&job.phase!=='accept'){
   const failureClass=classifyFailure(error.message),failurePath=join(state,'failures',`${job.item.key.replace(/[^a-zA-Z0-9-]/g,'_')}.json`);let record={itemKey:job.item.key,counts:{},lastFailure:null};
   try{record=JSON.parse(await readFile(failurePath,'utf8'));}catch(readError){if(readError.code!=='ENOENT')throw readError;}
   const decision=retryDecision({failureCounts:record.counts,failureClass});record.counts[failureClass]=decision.count;record.lastFailure={at:Date.now(),failureClass,detail:error.message,blocked:decision.blocked};await mkdir(join(state,'failures'),{recursive:true,mode:0o700});await writeAtomicJson(failurePath,record);
   if(job.phase==='work'&&job.item.attempt===0&&decision.model)await writeAtomicJson(join(state,'retry-model.json'),{itemKey:job.item.key,model:decision.model,failureClass,reason:error.message,at:Date.now()});
   if(decision.blocked){await api('dispatch:stopPilot',{reason:`Repeated ${failureClass} failure for pinned ${job.item.key}: ${error.message}`,modelOnly:false});}
   await api('dispatch:finish',{itemKey:job.item.key,leaseId:job.leaseId,phase:job.phase,result:'failed',detail:decision.blocked?`Repeated ${failureClass} failure blocked after ${decision.count} occurrences: ${error.message}`:error.message.slice(0,2800)}).catch(()=>{});
   if(decision.blocked)error=Error(`Repeated ${failureClass} failure blocked after ${decision.count} occurrences; repair ownership remains pinned`);
  }
  throw error;
 }
}
try{await main();await publishStatus();await writeAtomicJson(join(state,'health.json'),{state:controllerState,at:Date.now(),reason:controllerReason});}
catch(error){log({state:'held',reason:error.message});await publishStatus('held',error.message).catch(e=>log({telemetryError:e.message}));await writeAtomicJson(join(state,'health.json'),{state:'held',at:Date.now(),reason:error.message});process.exitCode=2;}
