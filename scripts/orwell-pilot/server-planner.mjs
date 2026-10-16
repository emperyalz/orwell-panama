/** VPS planning proposes bounded product scopes. Root validates and releases them. */
import {spawn} from 'node:child_process';
import {readFile,writeFile,mkdir,chmod} from 'node:fs/promises';
import {join} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {writeAtomicJson} from './admission.mjs';
import {normalizeCodexUsage} from './budget.mjs';
import {routeProvider,nativeRunSpec} from './provider-routing.mjs';
import {validatePlan} from './planner-contract.mjs';

export const PLANNER_CONTRACT_VERSION='2026-10-16-path-review-v2';
export const artifactPaths=key=>{
 const slug=key.replace(/[^a-zA-Z0-9-]/g,'-');
 return {json:`docs/product-audits/${slug}.json`,report:`docs/product-audits/${slug}.md`,test:`scripts/product-audits/${slug}.cjs`};
};
export function remainingBacklog(backlog,authorized){
 const allowed=new Set(authorized),dispatch=new Map(backlog.dispatch.items.map(i=>[i.key,i]));
 return backlog.scoreboard.flatMap(task=>task.checklist.filter(step=>!step.done&&task.status!=='done'&&allowed.has(`${task.key}/${step.key}`)).map(step=>({...dispatch.get(`${task.key}/${step.key}`),key:`${task.key}/${step.key}`,label:step.label,taskTitle:task.title,taskDetail:task.detail})));
}
export function planningState({backlog,authorized,scope,previous={},checks,policy,routing={},now=Date.now(),modelHeld=false,affinity=null}){
 const remaining=remainingBacklog(backlog,authorized),hash=createHash('sha256').update(JSON.stringify([PLANNER_CONTRACT_VERSION,remaining.map(i=>[i.key,i.state,i.label,i.qaEvidence??'',i.blockedReason??''])])).digest('hex');
 const live=remaining.filter(i=>scope.itemKeys.includes(i.key)&&!['blocked','superseded','accepted'].includes(i.state));
 const route=routeProvider({phase:'planner',checks,policy,previousProvider:routing.heavyProvider,now});
 const materialChange=previous.lastBacklogHash!==hash;
 const exhausted=!materialChange&&(previous.consecutiveFailures??0)>=2;
 const due=materialChange||!previous.nextPlanAt||previous.nextPlanAt<=now;
 let reason=!remaining.length?'All authorized product steps are complete':live.length?'The current product batch is still being implemented or reviewed':affinity?'A blocked workspace requires safe recovery before another plan':modelHeld?'The finite model-run ceiling is held':!route.allowed?route.reason:route.reviewBlocked?'Independent review capacity is unavailable; preserve the remaining allocation':exhausted?`Planning held after two failed proposals for this backlog: ${previous.lastError??'unknown rejection'}; root repair or changed backlog required`:!due?'Planning cooldown; unchanged backlog does not start another model turn':null;
 return {...previous,state:reason?(remaining.length?'held':'idle'):'ready',backlogHash:hash,remaining:remaining.length,planningAllowed:!reason,nextPlanAt:materialChange?now:previous.nextPlanAt??now,reason,route,observedAt:now};
}
export function compilePlan({plan,scope,backlog}){
 const rows=new Map(backlog.dispatch.items.map(i=>[i.key,i]));
 const next={...scope,label:'VPS-planned Orwell product backlog',serverPlanning:true,itemKeys:plan.tasks.map(t=>t.itemKey),criteria:{...scope.criteria},allowedPaths:{...scope.allowedPaths},productChecks:{...scope.productChecks},productPostChecks:{...scope.productPostChecks},delivery:{...scope.delivery},dependencies:{...scope.dependencies},modelProposals:{...scope.modelProposals},modelReasons:{...scope.modelReasons}};
 for(const task of plan.tasks){
  const a=artifactPaths(task.itemKey),paths=[...new Set([...task.allowedPaths,a.json,a.report,a.test])];
  const original=rows.get(task.itemKey);
  next.allowedPaths[task.itemKey]=paths;
  next.criteria[task.itemKey]=`Complete the ENTIRE existing step: ${JSON.stringify(original?.label)}. Original context: ${JSON.stringify(original?.taskDetail??'')}. ${task.acceptance}\nWhole-step delivery required. A sample, inventory or recommendation cannot close a step requiring applied corrections or working functionality. If required data or access is unavailable, return needs_input with the exact prerequisite; do not claim completion. Deliver ${a.json} with {itemKey,wholeStep:true,observedAt,summary,sources:[{url,claim}],limitations:[],checks:[]}, ${a.report}, and ${a.test} meaningful regression checks. Every source claim must be supported, and coverage limits explicit. The independent reviewer must reopen evidence and challenge scope completeness. Root runs the script without write privileges and publishes only after independent QA.`;
  next.productChecks[task.itemKey]=[['/usr/bin/node',['/opt/orwell-evidence/verify-product-delivery.mjs',task.itemKey]],['/usr/bin/node',[a.test]]];
  delete next.productPostChecks[task.itemKey];
  next.delivery[task.itemKey]=task.delivery;
  next.dependencies[task.itemKey]=task.dependencies??[];
  const standard=task.modelTier==='standard'&&typeof task.reason==='string'&&task.reason.trim().length>=20;
  next.modelProposals[task.itemKey]={claude:'sonnet',codex:standard?'gpt-6.1-sol':'gpt-6-luna'};
  if(standard)next.modelReasons[task.itemKey]=task.reason;else delete next.modelReasons[task.itemKey];
 }
 return next;
}
const planSchema={type:'object',additionalProperties:false,required:['tasks','blocked','summary'],properties:{summary:{type:'string'},blocked:{type:'array',items:{type:'object',additionalProperties:false,required:['itemKey','reason'],properties:{itemKey:{type:'string'},reason:{type:'string'}}}},tasks:{type:'array',maxItems:2,items:{type:'object',additionalProperties:false,required:['itemKey','acceptance','allowedPaths','verification','delivery','modelTier','reason','wholeStep','dependencies'],properties:{itemKey:{type:'string'},acceptance:{type:'string'},allowedPaths:{type:'array',items:{type:'string'}},verification:{type:'object',additionalProperties:false,required:['kind'],properties:{kind:{type:'string'}}},delivery:{type:'string',enum:['backend','frontend','evidence']},modelTier:{type:'string',enum:['economy','standard']},reason:{type:'string'},wholeStep:{type:'boolean'},dependencies:{type:'array',items:{type:'string'}}}}}}};

export async function runServerPlanner({state,workspace,tools,env,uid,gid,backlog,plannerPolicy,scope,previous,checks,policy,routing,freeze,revision,sourceManifest,admission,api,publishStatus,log}){
 const decision=planningState({backlog,authorized:plannerPolicy.itemKeys,scope,previous,checks,policy,routing});
 if(!decision.planningAllowed)throw Error(decision.reason);
 const recent=(previous.plans??[]).filter(at=>at>Date.now()-86_400_000);
 if(recent.length>=24)throw Error('24 server plans per day ceiling reached');
 const provider=decision.route.provider,model=provider==='claude'?'sonnet':'gpt-6-luna',leaseId=randomUUID();
 if((await api('leadAccountability:snapshot',{},'query')).monitor?.dispatchPaused)throw Error('Dispatch was paused before planner preparation');
 const dir=join(state,'runs',leaseId);await mkdir(dir,{recursive:true,mode:0o700});
 const before=await revision(),manifest=await sourceManifest(workspace),cwd=await freeze(`${leaseId}-planner`);
 const job={phase:'planner',leaseId,item:{key:'vps-product-planning-20261015/plan-and-dispatch'}};
 const active={...decision,state:'planning',planningAllowed:false,activeProvider:provider,activeModel:model,activeSessionId:null};
 await writeAtomicJson(join(state,'planner.json'),active);await publishStatus('planning',`VPS planner selecting the next product batch using ${provider} ${model}`);
 const paths=Object.keys(manifest.files).filter(p=>/^(src\/|convex\/|scripts\/product-audits\/|docs\/)/.test(p)&&!/(agent|runtime|dispatch|_generated)/i.test(p));
 const remaining=remainingBacklog(backlog,plannerPolicy.itemKeys);
 const prompt=`You are Orion's VPS product planner. You are not alone. Source is frozen read-only. Do not edit, spawn agents, deploy, change budgets, task states or credentials. Choose modelTier=economy for clear repeatable checks, standard for substantive UI behavior, security or ambiguous data integrity review; provide the concrete reason. Current reviewMode=${policy.reviewMode}. In claude-cross-model mode author uses Claude Sonnet and a fresh independent Opus session reviews; Opus repairs require a fresh Sonnet reviewer. Codex is held and must not be requested. modelTier controls proposal complexity only; do not infer absent QA from Codex hold. For frontend acceptance require rendered empty-state/filter behavior as well as arithmetic and source checks. Select at most TWO existing ready product steps from the authorized remaining backlog. Complete each entire existing checkbox, never disguise a sample or recommendation as delivery. Prefer useful work that can be completed in a bounded 8-minute worker turn followed by independent QA under the current reviewMode. Return strict JSON matching the schema. No shell commands in proposals. Allowed paths must be exact product files only, maximum25. For each step include these exact evidence paths derived by replacing / with -: docs/product-audits/<itemKey-slug>.json, docs/product-audits/<itemKey-slug>.md, scripts/product-audits/<itemKey-slug>.cjs. The .cjs script must test actual implementation, not self-assert success. Evidence JSON: {itemKey,wholeStep:true,observedAt,summary,sources:[{url,claim}],limitations:[],checks:[]}. Root adds these fixed paths and verifies artifacts. modelTier economy initially. allowedPaths grants WRITE access only. Existing source/data files may be read from Source inventory without appearing in allowedPaths. Evidence delivery MUST list only docs/product-audits/ and scripts/product-audits/ outputs; never include read-only input JSON or application sources there. Other docs paths are read-only. Do not replace a required applied correction with an audit. Deferred for this two-task batch is not an actual blocker; report specific missing prerequisites only. Public-source research is permitted without paid collection. No paid collection, no speculative identity changes, no avatar changes. Research primary sources. Source-backed uncertainty is acceptable only for genuine audit steps, not steps requiring applied changes. Empty tasks must explain EVERY remaining step in blocked. For dependency ordering choose only accepted or earlier selected steps. verification.kind one of inventory,source-research,source-audit,frontend-contract,backend-contract,fullstack-contract,language-contract. delivery backend/frontend/evidence. Fullstack delivery use frontend.\nChoose only unchecked ready steps from the current Remaining list. Read existing accepted evidence before choosing whole-step verification or corrections. frontend publication on VPS is available. Broader researched/data-mutation work requires primary evidence and an existing safe executor; otherwise explain prerequisites honestly and choose another useful step.\nRecent released batch: ${JSON.stringify(scope.itemKeys)}. Remaining ${JSON.stringify(remaining.map(i=>({key:i.key,label:i.label,state:i.state,context:i.taskDetail,qa:i.qaEvidence})))}.\nSource inventory: ${JSON.stringify(paths)}. Inspect only relevant source. Prior failed planning: ${previous.lastError??'none'}. Budget headroom: ${JSON.stringify(checks)}. End with JSON, within24turns/8minutes.`;
 if((await api('leadAccountability:snapshot',{},'query')).monitor?.dispatchPaused)throw Error('Dispatch was paused before planner launch');
 await writeAtomicJson(join(dir,'execution.json'),{job,provider,model,before,startedAt:Date.now()});

 const {args}=nativeRunSpec({provider,phase:'planner',model,cwd,schema:planSchema});
 const child=spawn(`${tools}/${provider}`,args,{cwd,env,uid,gid,detached:true,stdio:['pipe','pipe','pipe']});
 let raw='',pending='',stderr='',sessionId,usage,answer,answerText='',completed=false,error,serial=Promise.resolve(),lastEventAt=0;
 const kill=()=>{try{process.kill(-child.pid,'SIGTERM');}catch{}};
 async function observe(kind,detail){
  const at=Date.now(),localized={en:detail,es:detail,pt:detail};
  await api('agentActivity:record',{key:sessionId,name:'Orion',team:'research',model,reasoning:'low',assignment:{en:'VPS product backlog planning',es:'Planificación de productos en VPS',pt:'Planejamento de produtos no VPS'},status:kind==='completed'?'completed':kind==='error'?'error':'running',lastActivityAt:at,eventId:`planner:${leaseId}:${kind}:${at}`,kind,summary:localized});
 }
 function event(line){
  let e;try{e=JSON.parse(line);}catch{return;}
  if(provider==='claude'&&e.type==='system'&&e.subtype==='init'||provider==='codex'&&e.type==='thread.started'){
   sessionId=e.session_id??e.thread_id;active.activeSessionId=sessionId;serial=serial.then(async()=>{await writeAtomicJson(join(state,'planner.json'),active);await observe('assigned',`Actual ${provider} planner session ${sessionId} started`);}).catch(e=>{error=e;kill();});
  }
  if(provider==='codex'&&e.type==='turn.completed'){completed=true;const u=normalizeCodexUsage(e.usage);usage=usage?normalizeCodexUsage({input_tokens:usage.input_tokens+u.input_tokens,cached_input_tokens:usage.cached_input_tokens+u.cached_input_tokens,output_tokens:usage.output_tokens+u.output_tokens}):u;}
  if(provider==='codex'&&e.type==='item.completed'&&e.item?.type==='agent_message')answerText=e.item.text;
  if(provider==='claude'&&e.type==='result'){
   completed=e.is_error===false;answer=e.structured_output;answerText=e.result??'';
   if(e.usage){const u=e.usage;usage=normalizeCodexUsage({input_tokens:(u.input_tokens??0)+(u.cache_creation_input_tokens??0)+(u.cache_read_input_tokens??0),cached_input_tokens:u.cache_read_input_tokens??0,output_tokens:u.output_tokens??0});}
  }
  if(sessionId&&Date.now()-lastEventAt>15000&&(e.type==='assistant'||e.type==='item.completed')){lastEventAt=Date.now();serial=serial.then(()=>observe('progress',`Native ${provider} planner reported a completed source-inspection event`)).catch(e=>{error=e;kill();});}
 }
 child.stdout.on('data',d=>{raw+=d;pending+=d;let p;while((p=pending.indexOf('\n'))>=0){event(pending.slice(0,p));pending=pending.slice(p+1);}if(raw.length>8_000_000){error=Error('Planner output bound exceeded');kill();}});
 child.stderr.on('data',d=>stderr=(stderr+d).slice(-3000));child.stdin.on('error',()=>{});child.stdin.end(`${prompt}\nExact required JSON schema: ${JSON.stringify(planSchema)}\nReturn only the JSON object, without XML or commentary.`);
 let busy=false;const watch=setInterval(async()=>{if(busy)return;busy=true;try{await admission(0,policy.reviewMode==='claude-cross-model'?['claude']:['claude','codex']);const s=await api('leadAccountability:snapshot',{},'query');if(s.monitor?.dispatchPaused)throw Error('Dispatch was paused');}catch(e){error=e;kill();}finally{busy=false;}},45000);
 const timer=setTimeout(()=>{error=Error('Eight-minute planner bound reached');kill();},480000);
 const exit=await new Promise((resolve,reject)=>{child.on('error',reject);child.on('close',(code,signal)=>resolve({code,signal}));});clearInterval(watch);clearTimeout(timer);
 if(pending.trim())event(pending);await serial;await writeFile(join(dir,'events.jsonl'),raw,{mode:0o600});
 if(!answer)try{answer=JSON.parse(answerText.replace(/^```(?:json)?\s*|\s*```$/g,''));}catch{error??=Error('Planner did not return structured JSON');}
 const after=await revision();if(after!==before)error??=Error('Read-only planner changed source');
 if(!usage||!sessionId||!completed||exit.code!==0)error??=Error(`Incomplete planner execution, exit ${exit.code}; ${stderr.slice(-300)}`);
 const freshBacklog={scoreboard:await api('scoreboard:list',{},'query'),dispatch:await api('dispatch:snapshot',{},'query')};
 const validated=validatePlan({plan:answer,backlog:freshBacklog,policy:plannerPolicy,existingPaths:Object.keys(manifest.files)});
 if(!validated.allowed)error??=Error(validated.reason);
 const receipt={job,provider,model,sessionId,usage,usagePersisted:Boolean(usage&&sessionId),exit,before,after,answer,finishedAt:Date.now(),finish:{state:error?'failed':'planned',reason:error?.message??null}};
 await writeAtomicJson(join(dir,'receipt.json'),receipt);
 if(sessionId)await observe(error?'error':'completed',error?.message??'Planner proposed a validated product batch; root release follows');
 const saved={...decision,state:error?'held':validated.plan.tasks.length?'idle':'held',planningAllowed:false,lastPlanAt:Date.now(),lastBacklogHash:decision.backlogHash,nextPlanAt:Date.now()+30*60_000,lastError:error?.message??null,contractVersion:PLANNER_CONTRACT_VERSION,consecutiveFailures:error?(previous.lastBacklogHash===decision.backlogHash?(previous.consecutiveFailures??0)+1:1):0,planCount:(previous.planCount??0)+1,plans:[...recent,Date.now()],activeSessionId:null,activeProvider:null,activeModel:null,lastSessionId:sessionId,lastProvider:provider,lastModel:model,lastPlan:validated.allowed?validated.plan:null};
 await writeAtomicJson(join(state,'planner.json'),saved);
 if(error)throw error;
 const next=compilePlan({plan:validated.plan,scope,backlog:freshBacklog});
 await writeAtomicJson(join(state,`plan-${leaseId}.json`),{sessionId,provider,plan:validated.plan,at:Date.now()});
 if(next.itemKeys.length){await writeAtomicJson(join(state,'scope.json'),next);await writeAtomicJson('/opt/orwell-evidence/product-scope.json',next);await chmod('/opt/orwell-evidence/product-scope.json',0o444);}
 log({phase:'planner',provider,sessionId,usage,selected:next.itemKeys,blocked:validated.plan.blocked.length});
 return {scope:next,state:saved};
}
