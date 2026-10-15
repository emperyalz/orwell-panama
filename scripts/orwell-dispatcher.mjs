#!/usr/bin/env node
/** A real local Codex CLI runner for the durable Orwell checklist queue. */
import {spawn} from 'node:child_process';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {join,resolve,dirname} from 'node:path';
import {homedir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
import {admission,writeAtomicJson} from './orwell-pilot/admission.mjs';
import {normalizeCodexUsage,subscriptionEnvironment} from './orwell-pilot/budget.mjs';
import {receiptBudget,legalOutcome} from './orwell-pilot/receipts.mjs';

const repo=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const base=join(homedir(),'.codex','orwell-dispatcher');
const cli=join(repo,'node_modules/.bin/convex');
const action=process.argv[2]??'once';
if(action!=='status')throw Error('Local model dispatch is retired. The budgeted Hostinger controller owns execution, cross-provider QA and revision-bound acceptance.');
let wakeSleep;
const sleep=ms=>new Promise(resolve=>{const timer=setTimeout(()=>{wakeSleep=null;resolve();},ms);wakeSleep=()=>{clearTimeout(timer);wakeSleep=null;resolve();};});
let stopping=false,activeChild=null;
let budgetNotified=false;
for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>{stopping=true;activeChild?.kill('SIGTERM');wakeSleep?.();});

async function runCommand(command,args,options={}){
 return new Promise((resolve,reject)=>{const child=spawn(command,args,{cwd:repo,stdio:['pipe','pipe','pipe'],...options});let out='',err='';child.stdout.on('data',d=>out+=d);child.stderr.on('data',d=>err+=d);child.on('error',reject);child.on('close',(code,signal)=>resolve({code,signal,out,err}));if(options.input)child.stdin.end(options.input);else child.stdin.end();});
}
async function convex(name,args={}){const r=await runCommand(cli,['run','--prod',name,JSON.stringify(args)]);if(r.code!==0)throw Error(`Convex ${name}: ${r.err.slice(-1200)}`);try{return JSON.parse(r.out);}catch{throw Error(`Invalid Convex response for ${name}: ${r.out.slice(0,300)}`);}}
const schema={type:'object',additionalProperties:false,required:['result','detail','evidence','team'],properties:{result:{type:'string',enum:['submitted','changes_requested','accepted','needs_input','failed']},detail:{type:'string'},evidence:{type:'string'},team:{type:'string',enum:['research','implementation','none']}}};
const oneLine=s=>String(s??'').replace(/\s+/g,' ').trim().slice(0,1000);

function prompt(job){const {phase,item}=job;const common=`You are working on a real Orwell project checklist item. Task key: ${item.taskKey}. Request: ${item.taskTitle??item.taskKey}. Request detail: ${item.taskDetail??'not recorded'}. Scoreboard lane: ${item.taskStatus??'unknown'}. Step key: ${item.stepKey}. Line item: ${item.label}. Acceptance criteria: ${item.acceptance}. Lead: ${item.lead}. Team: ${item.team}. Previous checkpoint: ${item.checkpoint??'none'}. Existing evidence: ${item.evidence??'none'}. QA evidence: ${item.qaEvidence??'none'}. ${phase==='triage'?'Use only this supplied context; do not call tools or inspect files.':'Inspect AGENTS.md and only sources relevant to this step; avoid broad log dumps or repeated full-file reads.'} This is a shared checkout with concurrent UI and portrait work. Preserve all existing uncommitted edits, do not revert or overwrite another worker's changes, and accommodate them. Only do this bounded line item. Do not spawn sub-agents for this run. Report factual evidence and remaining limitations. Do not mark the task complete yourself. Your final reply must match the provided JSON schema exactly.`;
 if(phase==='triage')return `${common}\nYou are Orion, the Orwell executive. Decide whether this item is ready using the supplied context. If ready, choose research (Iris) or implementation (Rowan), put concise measurable acceptance criteria in evidence, and result=submitted. If Eric or external access is needed, result=needs_input with exact next action. Do not change files in triage.`;
 if(phase==='work')return `${common}\nYou work for ${item.lead}. Implement or research the line item with permitted tools, save durable changes and verify them. If complete for QA, result=submitted and evidence must cite exact files, commands, URLs or artifacts. An internal build, deployment, preview, or QA handoff is team work; submit the available work and state what Ada must verify. Use needs_input only for a real Eric decision, inaccessible external credential, or prerequisite the team cannot perform, with the exact required action. If you cannot continue, result=failed. Your turn ending does not make the item complete.`;
 if(phase==='qa')return `${common}\nYou are an independent member of Ada's QA team. Reopen the evidence, inspect implementation and run meaningful checks. You must not approve your own authored work. If a genuine coordinator checklist mapping is absent in production, verify the honest missing state live and the mapped navigation path with focused tests; report that mapped navigation remains live-unverified, and never create a fictitious mapping to pass QA. Use a headless, isolated browser only when the acceptance criterion requires browser verification. Close the browser context when finished. Do not open visible tabs in Eric's Chrome. Return result=accepted with specific checks and evidence only if the criterion is truly satisfied; otherwise result=changes_requested with exact defects. Do not edit implementation files.`;
 return `${common}\nYou are Orion. Reopen the worker evidence and Ada's independent QA finding. Accept only if the line item meets its acceptance criteria and no material gap remains. Return result=accepted with exact reason and evidence, or changes_requested with the next action. Do not edit implementation files.`;
}

const roster={research:[{key:'01a11e39-c201-76a2-a248-96613d713149',name:'Mira'}],implementation:[{key:'01a11df1-1210-7cb3-b50c-fcc89984c864',name:'Lin'}],qa:[{key:'01a11e11-f35a-7011-bb49-515df644f97a',name:'Rawls'},{key:'01a11e3a-3ec7-78e2-a41c-52e3662b9b17',name:'Vera'},{key:'01a11cd4-e701-7060-bb26-3e5057fabf18',name:'Goodall'}]};
function member(job){const choices=roster[job.phase==='qa'?'qa':job.item.team];return choices[Array.from(job.item.key).reduce((n,c)=>n+c.charCodeAt(0),0)%choices.length];}

async function execute(job){const dir=join(base,job.leaseId);await mkdir(dir,{recursive:true,mode:0o700});const output=join(dir,'outcome.json'),schemaPath=join(dir,'schema.json');await writeFile(schemaPath,JSON.stringify(schema));
 const phaseAttempts=job.phase==='qa'?job.item.qaAttempt:job.phase==='accept'?job.item.acceptAttempt:job.item.attempt;
 const model=job.phase==='accept'?'gpt-6.1-sol':job.phase==='qa'?'gpt-6.1-sol':phaseAttempts>0&&job.phase==='work'?'gpt-6.1-sol':'gpt-6-luna';
 const reasoning=job.phase==='accept'?'medium':'low';
 const readonlyRole=job.phase!=='work';
 const args=['-a','never','exec','--json','--strict-config','--ignore-user-config','-m',model,'-c','forced_login_method="chatgpt"','-c',`model_reasoning_effort="${reasoning}"`,'-c','agents.enabled=false','-c','sandbox_workspace_write.network_access=true','--sandbox',readonlyRole?'read-only':'workspace-write','--output-schema',schemaPath,'--output-last-message',output,'-C',repo,'-'];
 const person=job.phase==='work'||job.phase==='qa'?member(job):null;
 await writeFile(join(dir,'execution.json'),JSON.stringify({startedAt:Date.now(),itemKey:job.item.key,leaseId:job.leaseId}),{mode:0o600});
 const child=spawn('codex',args,{cwd:repo,env:subscriptionEnvironment(),stdio:['pipe','pipe','pipe']});activeChild=child;let stderr='',stdout='',sessionId,turnCompleted=false,lastProgress='',unexpectedEdit=false,usage,invalidUsage=false;
 child.stdin.on('error',()=>{});
 let telemetry=Promise.resolve(),telemetryError,sequence=0,bindingObservedAt;
 const localized=en=>({en,es:en,pt:en});
 function observe(kind,detail,observedAt){
  if(!sessionId)return;
  const runId=sessionId,eventId=`dispatch:${job.leaseId}:${runId}:${sequence++}`;
  bindingObservedAt??=observedAt;
  const payload={key:runId,name:person?.name??'Orion',team:job.phase==='qa'?'qa':job.item.team,model,reasoning,assignment:localized(`${job.item.label} (${job.item.taskKey}/${job.item.stepKey}; ${job.phase})`),status:kind==='completed'?'completed':kind==='error'?'error':'running',lastActivityAt:observedAt,eventId,kind,summary:localized(detail),binding:{taskKey:job.item.taskKey,stepKey:job.item.stepKey,rosterKey:person?.key,observedAt:bindingObservedAt,evidence:`Codex CLI ${runId}; lease ${job.leaseId}; explicit ${job.phase} prompt ${job.item.key}; model/reasoning from executed CLI arguments`}};
  telemetry=telemetry.then(async()=>{
   await convex('agentActivity:record',payload);
   if(kind!=='completed'&&kind!=='error')await convex('dispatch:checkpoint',{itemKey:job.item.key,leaseId:job.leaseId,checkpoint:detail,sessionId:runId,actorName:person?.name??'Orion',actorKey:person?.key});
  }).catch(error=>{telemetryError=error;process.stderr.write(`Runtime binding failed: ${error.message}\n`);});
 }
 child.stdin.end(`${person?`You are the configured ${person.name} identity working under ${job.phase==='qa'?'Ada':job.item.lead}. Your actual Codex run ID will be retained separately from this roster identity.\n`:''}${prompt(job)}`);
 child.stderr.on('data',d=>stderr+=d.toString());
 function processEvent(line){let event;try{event=JSON.parse(line);}catch{return;}
  if(event.type==='thread.started'){sessionId=event.thread_id;observe('assigned',`Actual ${model} Codex run started for ${job.phase}`,Date.now());}
  if(event.type==='turn.completed'){turnCompleted=true;const next=normalizeCodexUsage(event.usage);if(!next)invalidUsage=true;else if(!usage)usage=next;else usage=normalizeCodexUsage({input_tokens:usage.input_tokens+next.input_tokens,cached_input_tokens:usage.cached_input_tokens+next.cached_input_tokens,output_tokens:usage.output_tokens+next.output_tokens});}
  if(event.type==='item.completed'){const kind=event.item?.type??'work';if(readonlyRole&&kind==='file_change'){unexpectedEdit=true;child.kill('SIGTERM');}const detail=`Completed ${kind}`;if(detail!==lastProgress){lastProgress=detail;observe('progress',detail,Date.now());}}
 }
 child.stdout.on('data',d=>{stdout+=d.toString();let at;while((at=stdout.indexOf('\n'))>=0){const line=stdout.slice(0,at);stdout=stdout.slice(at+1);processEvent(line);}});
 const renew=setInterval(()=>convex('dispatch:renewLease',{itemKey:job.item.key,leaseId:job.leaseId}).catch(e=>{process.stderr.write(e.message+'\n');child.kill('SIGTERM');}),60_000);renew.unref();
 const timeout=setTimeout(()=>child.kill('SIGTERM'),10*60_000);timeout.unref();
 const exit=await new Promise((res,rej)=>{child.on('error',rej);child.on('close',(code,signal)=>res({code,signal}));});activeChild=null;clearInterval(renew);clearTimeout(timeout);
 if(stdout.trim())processEvent(stdout);
 if(invalidUsage)usage=null;
 let answer;try{answer=JSON.parse(await readFile(output,'utf8'));}catch{answer=null;}
 await telemetry;
 let usageError;
 if(usage&&sessionId)await convex('dispatch:recordUsage',{itemKey:job.item.key,leaseId:job.leaseId,sessionId,model,inputTokens:usage.input_tokens,cachedInputTokens:usage.cached_input_tokens,outputTokens:usage.output_tokens,totalTokens:usage.total_tokens}).catch(e=>{usageError=e;process.stderr.write(`Usage record failed: ${e.message}\n`);});
 const successful=!usageError&&usage&&!unexpectedEdit&&exit.code===0&&turnCompleted&&sessionId&&legalOutcome(job.phase,answer);
 const argsForFinish={itemKey:job.item.key,leaseId:job.leaseId,phase:job.phase,result:successful?answer.result:'failed',detail:successful?oneLine(answer.detail):usageError?'Usage persistence failed; result cannot be accepted':!usage?'Run usage is missing or inconsistent; reconcile before more spending':unexpectedEdit?'Read-only team role attempted to change a file; independent run rejected':oneLine(stderr||`Codex CLI exited ${exit.code}; ${turnCompleted?'output invalid':'turn incomplete'}`),evidence:successful?oneLine(answer.evidence):undefined,sessionId,contributorKey:job.phase==='work'?person?.key:undefined,reviewerKey:job.phase==='qa'?person?.key:undefined,team:successful&&answer.team!=='none'?answer.team:undefined};
 observe(successful?'completed':'error',successful?'Actual CLI turn ended; checklist acceptance remains separate':argsForFinish.detail,Date.now());
 await telemetry;
 if(telemetryError){argsForFinish.result='failed';argsForFinish.detail=`Runtime binding persistence failed: ${oneLine(telemetryError.message)}`;}
 const receipt={job,model,exit,finish:null,usage,usagePersisted:Boolean(usage&&!usageError),output:answer,stderr:stderr.slice(-3000)};
 await writeAtomicJson(join(dir,'receipt.json'),receipt);
 const finish=await convex('dispatch:finish',argsForFinish);
 await writeAtomicJson(join(dir,'receipt.json'),{...receipt,finish});return finish;
}

const budgetState=()=>receiptBudget(base);
async function cycle(smokeKey){
 const subscription=await admission();if(!subscription.allowed)return {state:'subscription_held',reason:subscription.reason};
 {const budget=await budgetState();if(budget.exceeded){if(!budgetNotified){await convex('leadAccountability:configure',{dispatchPaused:true,reason:{en:`Automatic cost guard: ${budget.runs} runs, ${budget.tokens} known tokens, ${budget.unknownUsageRuns} unknown-usage runs and ${budget.unreconciledRuns} unreconciled results in 24 hours; ${budget.withoutAcceptance} runs since the last accepted step. Orion must reconcile outcomes before new claims.`,es:`Límite automático de gasto: ${budget.runs} ejecuciones, ${budget.tokens} tokens conocidos, ${budget.unknownUsageRuns} usos desconocidos y ${budget.unreconciledRuns} resultados sin conciliar en 24 horas. Orion debe revisar resultados antes de asignar más trabajo.`,pt:`Limite automático de custo: ${budget.runs} execuções, ${budget.tokens} tokens conhecidos, ${budget.unknownUsageRuns} usos desconhecidos e ${budget.unreconciledRuns} resultados não reconciliados em 24 horas. Orion deve revisar resultados antes de novas atribuições.`}});budgetNotified=true;}return {state:'budget_paused',...budget};}
  // A recovered rolling counter never clears a saved pause or renews a pilot allocation.
 }
 await convex('leadAccountability:observe');await convex('dispatch:sync');await convex('dispatch:recoverExpired');const job=await convex('dispatch:claimNext',{leaseId:randomUUID(),...(smokeKey?{smokeItemKey:smokeKey}:{})});if(job.state!=='claimed')return job;try{return {...job,finish:await execute(job)};}catch(error){await convex('dispatch:finish',{itemKey:job.item.key,leaseId:job.leaseId,phase:job.phase,result:'failed',detail:oneLine(error.message)}).catch(e=>process.stderr.write(e.message+'\n'));throw error;}}

if(!['once','watch','status','smoke'].includes(action))throw Error('Use once, watch, smoke, or status');
await mkdir(base,{recursive:true,mode:0o700});
if(action==='status'){console.log(JSON.stringify(await convex('dispatch:snapshot'),null,2));process.exit(0);}
if(action==='once'){console.log(JSON.stringify(await cycle(),null,2));process.exit(0);}
if(action==='smoke'){console.log(JSON.stringify(await cycle(process.argv[3]??'continuous-agent-dispatch-20261009/dispatch-1'),null,2));process.exit(0);}
while(!stopping){try{const value=await cycle();console.log(new Date().toISOString(),JSON.stringify(value));if(!stopping)await sleep(value.state==='claimed'?10_000:60_000);}catch(error){console.error(new Date().toISOString(),error);if(!stopping)await sleep(60_000);}}
