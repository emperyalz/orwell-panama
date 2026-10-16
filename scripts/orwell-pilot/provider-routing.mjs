import {providerAllocation,validAllocationPolicy} from './budget.mjs';
/** Native subscription routing. Measurements stay account-wide; no token/quota conversion. */
export const PROVIDERS=Object.freeze(['codex','claude']);
export const ROUTING_MAX_AGE_MS=120_000;
export const HYSTERESIS_POINTS=3;
export const REVIEW_HEADROOM_POINTS=1;
const known=provider=>PROVIDERS.includes(provider);
export const CLAUDE_CROSS_MODEL='claude-cross-model';
export const claudeCrossModel=policy=>policy?.reviewMode===CLAUDE_CROSS_MODEL;
/** One observed model only. Mixed modelUsage lists and unknown names stay unknown. */
export function normalizeClaudeModel(value){
 if(typeof value!=='string'||value!==value.trim())return null;
 if(value==='sonnet'||value==='opus')return value;
 const current=value.match(/^claude-(sonnet|opus)-[0-9]+(?:[.-][0-9]+)*$/);
 if(current)return current[1];
 const older=value.match(/^claude-[0-9]+(?:-[0-9]+)*-(sonnet|opus)(?:-[0-9]{8})?$/);
 return older?.[1]??null;
}
export function independentClaudeModel(workerModel){
 const model=normalizeClaudeModel(workerModel);if(!model)throw Error('A single actual Sonnet or Opus worker model is required for independent Claude QA');
 return model==='sonnet'?'opus':'sonnet';
}
export function oppositeProvider(provider){if(!known(provider))throw Error('Actual worker provider is required for independent QA');return provider==='codex'?'claude':'codex';}
export function routingPolicyError(policy,now=Date.now()){
 if(policy?.reviewMode!==undefined&&!['cross-provider',CLAUDE_CROSS_MODEL].includes(policy.reviewMode))return 'Unknown independent review mode';
 if(policy?.subscriptionOnly!==true||policy.allowPaidFallback!==false)return 'Subscription-only routing policy is required';
 if(!validAllocationPolicy(policy))return 'Original allocation and safety reserve are required';
 if(policy.authorProvider!==undefined&&policy.authorProvider!=='claude')return 'Only the explicitly pinned Claude author is supported';
 if(!Number.isFinite(policy.startedAt)||!Number.isFinite(policy.endsAt)||policy.startedAt>now||policy.endsAt<=now||policy.endsAt<=policy.startedAt||policy.endsAt-policy.startedAt>86_400_000)return 'Original allocation window has not started or has ended';
 return null;
}
function available(provider,checks){
 const check=checks?.[provider];
 if(!check?.allowed||!Array.isArray(check.remaining)||!check.remaining.length)return null;
 const points=Math.min(...check.remaining.map(window=>window.availablePercentagePoints));
 return Number.isFinite(points)&&points>0?points:null;
}
function chooseHeavy(checks,policy,previousProvider,hysteresisPoints){
 if(policy.authorProvider){const points=available(policy.authorProvider,checks);return points===null?null:{provider:policy.authorProvider,points,normalized:points/providerAllocation(policy,policy.authorProvider)};}
 const candidates=PROVIDERS.map(provider=>({provider,points:available(provider,checks)})).filter(row=>row.points!==null).map(row=>({...row,normalized:row.points/policy.allocationPercentagePoints})).sort((a,b)=>b.normalized-a.normalized||a.provider.localeCompare(b.provider));
 const best=candidates[0];if(!best)return null;
 const previous=candidates.find(row=>row.provider===previousProvider);
 return previous&&best.points-previous.points<hysteresisPoints?previous:best;
}
const blockedReason=(provider,checks)=>`${provider} held: ${checks?.[provider]?.reason??'Fresh native subscription admission is unavailable'}`;

/** Only work/planning choose a heavy provider. QA always follows the actual author. */
export function routeProvider({phase,item={},checks,policy,previousProvider,reservation,now=Date.now(),hysteresisPoints=HYSTERESIS_POINTS}){
 const deny=reason=>({allowed:false,phase,reason});
 const invalid=routingPolicyError(policy,now);if(invalid)return deny(invalid);
 if(phase==='triage'||phase==='accept')return {allowed:true,phase,provider:'orion',role:'orion',reason:'Deterministic controller phase; no model invocation'};
 if(!['planner','work','qa'].includes(phase))return deny('Unknown routing phase');
 if(!Number.isFinite(hysteresisPoints)||hysteresisPoints<0||hysteresisPoints>10)return deny('Invalid provider hysteresis');
 if(claudeCrossModel(policy)){
  const points=available('claude',checks);if(points===null)return deny(blockedReason('claude',checks));
  if(phase==='qa'){
   if(!known(item.workerProvider))return deny('Independent QA requires the actual stored worker provider');
   let model='sonnet';if(item.workerProvider==='claude'){try{model=independentClaudeModel(item.workerModel);}catch(error){return deny(error.message);}}
   return {allowed:true,phase,provider:'claude',role:'claude',workerProvider:item.workerProvider,reviewMode:CLAUDE_CROSS_MODEL,model,reviewModel:model,reason:item.workerProvider==='claude'?`Fresh independent Claude QA must use ${model}, distinct from the actual ${normalizeClaudeModel(item.workerModel)} author`:'Claude independently reviews the actual Codex author'};
  }
  if(phase==='planner')return {allowed:true,phase,provider:'claude',role:'claude',headroomPoints:points,normalizedHeadroom:points/policy.allocationPercentagePoints,reviewMode:CLAUDE_CROSS_MODEL,reviewBlocked:points<REVIEW_HEADROOM_POINTS,reason:'Explicit Claude-only planning policy; product work still requires reserved independent cross-model review'};
  if(item.workerProvider!==undefined&&!known(item.workerProvider))return deny('Stored worker provider is invalid');
  if(reservation?.workerProvider!==undefined&&!known(reservation.workerProvider))return deny('Worker provider reservation is invalid');
  if(points<REVIEW_HEADROOM_POINTS)return deny('Claude needs at least one usable percentage point for independent review, in addition to the original safety reserve');
  const handover=item.workerProvider==='codex'||reservation?.workerProvider==='codex';
  return {allowed:true,phase,provider:'claude',role:'claude',reviewerProvider:'claude',reviewMode:CLAUDE_CROSS_MODEL,headroomPoints:points,normalizedHeadroom:points/policy.allocationPercentagePoints,reservedReviewerHeadroomPoints:REVIEW_HEADROOM_POINTS,...(handover?{handoverFrom:'codex'}:{}),reason:handover?'Explicit Claude-only policy transfers this repair to a fresh observed Claude author; prior execution history stays recorded':'Claude author uses a fresh independent reviewer on the other Claude model; original review headroom remains reserved'};
 }
 if(phase==='qa'){
  if(!known(item.workerProvider))return deny('Independent QA requires the actual stored worker provider');
  const provider=oppositeProvider(item.workerProvider);
  if(available(provider,checks)===null)return deny(blockedReason(provider,checks));
  return {allowed:true,phase,provider,role:provider,workerProvider:item.workerProvider,reason:`Independent QA uses ${provider}, opposite the recorded ${item.workerProvider} author`};
 }
 const heavy=chooseHeavy(checks,policy,previousProvider,hysteresisPoints);
 if(!heavy)return deny(policy.authorProvider?blockedReason(policy.authorProvider,checks):PROVIDERS.map(provider=>blockedReason(provider,checks)).join('; '));
 if(phase==='planner')return {allowed:true,phase,provider:heavy.provider,role:heavy.provider,headroomPoints:heavy.points,normalizedHeadroom:heavy.normalized,reviewBlocked:PROVIDERS.some(provider=>available(provider,checks)===null||available(provider,checks)<REVIEW_HEADROOM_POINTS),reason:'Plan on the admitted provider with more remaining original weekly allocation; execution retains independent-review gates'};
 const stored=item.workerProvider,reserved=reservation?.workerProvider;
 if(stored!==undefined&&!known(stored))return deny('Stored worker provider is invalid');
 if(reserved!==undefined&&!known(reserved))return deny('Worker provider reservation is invalid');
 if(stored&&reserved&&stored!==reserved)return deny('Worker provider reservation conflicts with the actual author');
 const provider=stored??reserved??heavy.provider,reviewerProvider=oppositeProvider(provider);
 for(const required of [provider,reviewerProvider])if(available(required,checks)===null)return deny(blockedReason(required,checks));
 if(available(reviewerProvider,checks)<REVIEW_HEADROOM_POINTS)return deny(`${reviewerProvider} needs at least ${REVIEW_HEADROOM_POINTS} usable percentage point for independent review, in addition to the original safety reserve`);
 return {allowed:true,phase,provider,role:provider,reviewerProvider,headroomPoints:available(provider,checks),normalizedHeadroom:available(provider,checks)/policy.allocationPercentagePoints,reservedReviewerHeadroomPoints:REVIEW_HEADROOM_POINTS,reason:stored||reserved?'Repair remains with its recorded author provider; opposite-provider review remains reserved':'Author selected from remaining original weekly allocation; opposite-provider review remains reserved'};
}

/** Model proposals are hints. Only trusted task/repair evidence permits escalation. */
export function selectNativeModel({provider,phase='work',proposal,repairReason='',taskReason='',qaFailures=0,policy,workerModel,workerProvider='claude'}){
 if(!known(provider))throw Error('Unknown native model provider');
 if(claudeCrossModel(policy)){
  if(provider!=='claude')throw Error('Explicit Claude-only policy does not permit a Codex model launch');
  if(phase==='qa'&&workerProvider==='claude'){
   const model=independentClaudeModel(workerModel);
   return {model,reasoning:'low',escalated:model==='opus',reason:`Explicit cross-model independence requires ${model} QA after the actual ${normalizeClaudeModel(workerModel)} author`};
  }
  if(phase==='qa'&&!known(workerProvider))throw Error('Actual worker provider is required for independent QA');
 }
 const models=provider==='codex'?['gpt-6-luna','gpt-6.1-sol']:['sonnet','opus'];
 const documented=provider==='codex'?Boolean(String(repairReason).trim()||String(taskReason).trim()):Boolean(String(taskReason).trim()||(Number.isSafeInteger(qaFailures)&&qaFailures>=2&&String(repairReason).trim()));
 if(proposal!==undefined&&proposal!==null&&!models.includes(proposal))throw Error(`Model proposal is outside the ${provider} native allowlist`);
 const model=proposal===models[1]&&documented?models[1]:proposal===models[0]?models[0]:provider==='codex'&&String(repairReason).trim()&&phase==='work'?models[1]:models[0];
 return {model,reasoning:'low',escalated:model===models[1],reason:model===models[1]?String(repairReason||taskReason):'Routine bounded task uses the economical native model'};
}

/** CLI permissions follow phase; provider never changes identity or QA ownership. */
export function nativeRunSpec({provider,phase,model,cwd}){
 if(!known(provider)||!['work','qa','planner'].includes(phase))throw Error('Invalid native run phase');
 const permitted=provider==='codex'?['gpt-6-luna','gpt-6.1-sol']:['sonnet','opus'];
 if(!permitted.includes(model))throw Error('Invalid native run model');
 if(provider==='claude'){
  const tools=phase==='work'?'Read,Grep,Glob,Bash,Write,Edit':'Read,Grep,Glob,Bash';
  // Root parses and validates the final JSON. The optional native StructuredOutput
  // tool has produced malformed XML-in-JSON inputs and five charged retries.
  return {provider,model,sourceWritable:phase==='work',args:['-p','--model',model,'--effort','low','--output-format','stream-json','--verbose','--max-turns','24','--permission-mode','dontAsk','--setting-sources','','--strict-mcp-config','--mcp-config','{"mcpServers":{}}','--tools',tools,'--allowedTools',tools]};
 }
 // Hostinger cannot run Codex's nested network namespace. The OS still owns
 // frozen QA files (0444) and directories (0755); native sandbox is unchanged.
 return {provider,model,sourceWritable:phase==='work',args:['-a','never','exec','--json','--strict-config','--skip-git-repo-check','-m',model,'-c','forced_login_method="chatgpt"','-c','model_reasoning_effort="low"','-c','features.multi_agent=false','--sandbox','danger-full-access','-C',cwd,'-']};
}

export function routingObservation({items,itemKeys,checks,policy,previous={},now=Date.now()}){
 const allowed=new Set(itemKeys),reservations={};
 for(const item of items){
  if(!allowed.has(item.key)||['accepted','superseded'].includes(item.state))continue;
  const prior=previous.reservations?.[item.key];
  if(claudeCrossModel(policy)&&item.state==='ready'&&item.lead!=='Orion')reservations[item.key]={workerProvider:'claude'};
  else if(claudeCrossModel(policy)&&item.state==='running'&&previous.reviewMode===CLAUDE_CROSS_MODEL&&prior?.workerProvider==='claude')reservations[item.key]={workerProvider:'claude'};
  else if(known(item.workerProvider))reservations[item.key]={workerProvider:item.workerProvider};
  else if(known(prior?.workerProvider))reservations[item.key]={workerProvider:prior.workerProvider};
 }
 const rows={};
 for(const item of items){
  if(!allowed.has(item.key)||!['ready','triage_ready','qa_ready','accept_ready','running','qa_running','accept_running'].includes(item.state))continue;
  const phase=['qa_ready','qa_running'].includes(item.state)?'qa':['accept_ready','accept_running'].includes(item.state)?'accept':item.state==='triage_ready'||item.lead==='Orion'?'triage':'work';
  if(['running','qa_running','accept_running'].includes(item.state)){
   const role=phase==='accept'||phase==='triage'?'orion':phase==='qa'?(known(item.workerProvider)?claudeCrossModel(policy)?'claude':oppositeProvider(item.workerProvider):null):reservations[item.key]?.workerProvider??item.workerProvider??null;
   let model;if(phase==='qa'&&claudeCrossModel(policy)){try{model=item.workerProvider==='claude'?independentClaudeModel(item.workerModel):'sonnet';}catch{}}
   rows[item.key]={phase,role,allowed:false,reason:'Observed executing phase; provider ownership remains pinned',...(claudeCrossModel(policy)?{reviewMode:CLAUDE_CROSS_MODEL}:{}),...(model?{model,reviewModel:model}:{})};continue;
  }
  const route=routeProvider({phase,item,checks,policy,previousProvider:previous.heavyProvider,reservation:reservations[item.key],now});
  const waiting=item.leaseUntil>now||item.retryAt>now;
  rows[item.key]={phase,role:route.role??(phase==='triage'||phase==='accept'?'orion':null),allowed:route.allowed&&!waiting,reason:waiting?'The current lease or bounded retry is pending':route.reason,...(route.reviewMode?{reviewMode:route.reviewMode}:{}),...(route.model?{model:route.model,reviewModel:route.model}:{})};
 }
 return {observedAt:now,...(claudeCrossModel(policy)?{reviewMode:CLAUDE_CROSS_MODEL}:{}),heavyProvider:known(previous.heavyProvider)?previous.heavyProvider:null,reservations,items:rows};
}
