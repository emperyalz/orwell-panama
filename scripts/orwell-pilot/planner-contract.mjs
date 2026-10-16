/** Untrusted planning produces proposals only. Root retains commands, budget and acceptance. */
export const PRODUCT_FAMILIES=Object.freeze(['safe-collection-controls','social-freshness','career-history','earlier-elections','social-identity-audit','social-identity-qa','profile-facts-audit','statements-actions','communication-trends','country-expansion']);
export const VERIFICATION_KINDS=Object.freeze(['inventory','source-research','source-audit','frontend-contract','backend-contract','fullstack-contract','language-contract']);
const product=key=>typeof key==='string'&&key.split('/').length===2&&PRODUCT_FAMILIES.includes(key.split('/')[0]);
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const text=(value,min=1,max=2500)=>typeof value==='string'&&value.trim().length>=min&&value.length<=max&&!value.includes('\0');
function fields(value,allowed,required=allowed){
 if(!object(value)||Object.keys(value).some(key=>!allowed.includes(key))||required.some(key=>!Object.hasOwn(value,key)))throw Error('Unexpected or missing plan fields');
}
function normalizeBacklog(backlog){
 const records=new Map();
 const roots=Array.isArray(backlog)?backlog:backlog?.scoreboard??backlog?.tasks??[];
 if(!Array.isArray(roots))throw Error('Invalid backlog');
 for(const row of roots){
  if(!object(row))throw Error('Invalid backlog row');
  if(Array.isArray(row.checklist)){
   for(const step of row.checklist){const key=`${row.key}/${step.key}`;records.set(key,{...step,key,done:step.done===true||row.status==='done'});}
  }else if(typeof row.key==='string')records.set(row.key,{...row,done:row.done===true||row.state==='accepted'||row.status==='done'});
 }
 const dispatch=Array.isArray(backlog)?[]:backlog?.dispatch?.items??backlog?.items??[];
 if(!Array.isArray(dispatch))throw Error('Invalid dispatch backlog');
 for(const row of dispatch){
  const old=records.get(row.key);
  // Dispatch-only data can identify existing steps; accepted state never becomes unchecked.
  records.set(row.key,{...old,...row,done:old?.done===true||row.done===true||row.state==='accepted'});
 }
 return records;
}
function validatePath(path,existing,assets){
 if(!text(path,1,240)||path.startsWith('/')||path.endsWith('/')||/[\\\0\r\n*?\[\]{}]/.test(path))throw Error('Writable paths must be exact relative files');
 const parts=path.split('/');
 if(/^convex\/(?:dispatch|scoreboard|schema|runtimeTeam|runtimeTeamIdentity|leadMetrics|leadAccountability|agentActivity|controllerStatus|controllerStatusData|agentProfiles|agentProfileAliases|agentAvatarCatalog|agentAvatarEditing|agentAvatarIdentity|agentAvatars)\.ts$/.test(path))throw Error('Control-plane source path refused');
 if(parts.some(part=>!part||part==='.'||part==='..'||part.startsWith('.')||/^(AGENTS\.md|SKILL\.md|node_modules|artifacts|tmp|output)$/i.test(part)))throw Error('Forbidden source path');
 if(/(?:credential|secret|private[-_]?key|id_rsa|controller|orwell-pilot|orwell-dispatcher|dispatchPriority|leadAccountability|leadMetrics|agentActivity|agentProfiles|agentAvatar|agent-editor|runtime-team|orwell-runtime|use-agent|\/agents\/|\/Agent[^/]*|\/(?:auth|budget|admission|provider|scope|policy|planner|config)(?:[./-]|$))/i.test(path))throw Error('Control-plane or credential path refused');
 if(path.startsWith('scripts/product-audits/')||path.startsWith('docs/product-audits/'))return;
 if(path.startsWith('convex/')&&/^convex\/(?!_generated\/).+\.ts$/.test(path))return;
 if(path.startsWith('src/')&&/\.(?:tsx?|jsx?|mjs|cjs|css|json|svg)$/.test(path))return;
 if(path.startsWith('public/')&&existing.has(path)&&assets.has(path))return;
 throw Error('Path is outside trusted product source inventory');
}

/** No execution, filesystem, budget mutation, task creation, or completion side effects. */
export function validatePlan({plan,backlog,policy={},existingPaths=[],verifiedAssetPaths=[],now=Date.now()}={}){
 try{
  fields(plan,['tasks','blocked','summary']);
  if(!Array.isArray(plan.tasks)||plan.tasks.length>2||!Array.isArray(plan.blocked)||plan.blocked.length>100||!text(plan.summary,12,1800))throw Error('Plan requires at most two tasks and a meaningful summary');
  if(!Array.isArray(existingPaths)||!Array.isArray(verifiedAssetPaths)||!existingPaths.every(p=>typeof p==='string')||!verifiedAssetPaths.every(p=>typeof p==='string'))throw Error('Invalid trusted source inventory');
  if(policy.itemKeys!==undefined&&(!Array.isArray(policy.itemKeys)||!policy.itemKeys.every(product)))throw Error('Invalid authorized product keys');
  const records=normalizeBacklog(backlog),existing=new Set(existingPaths),assets=new Set(verifiedAssetPaths),seen=new Set(),selected=new Set();
  const authorized=key=>product(key)&&(!policy.itemKeys||policy.itemKeys.includes(key));
  const lookup=key=>{const row=records.get(key);if(!authorized(key)||!row||row.done)throw Error(`Unknown, completed or unauthorized product step: ${key}`);if(seen.has(key))throw Error(`Duplicate product step: ${key}`);seen.add(key);return row;};
  const tasks=[];
  for(const task of plan.tasks){
   fields(task,['itemKey','acceptance','allowedPaths','verification','delivery','modelTier','reason','wholeStep','dependencies']);
   const row=lookup(task.itemKey);
   if(task.wholeStep!==true)throw Error('Partial parent work cannot complete an existing step');
   if(!text(task.acceptance,40)||!text(task.reason,20,1600))throw Error('Acceptance and selection rationale must be concrete');
   if(!['backend','frontend','evidence'].includes(task.delivery)||!['economy','standard'].includes(task.modelTier))throw Error('Invalid delivery or model tier');
   if(row.state&&!['ready','triage_ready'].includes(row.state)||row.leaseUntil>now||row.retryAt>now)throw Error(`Step is not available for a new worker: ${task.itemKey}`);
   if(!Array.isArray(task.allowedPaths)||!task.allowedPaths.length||task.allowedPaths.length>25||new Set(task.allowedPaths).size!==task.allowedPaths.length)throw Error('Invalid exact writable path list');
   for(const path of task.allowedPaths)validatePath(path,existing,assets);
   fields(task.verification,['kind']);
   if(!VERIFICATION_KINDS.includes(task.verification.kind))throw Error('Verifier kind is not trusted');
   if(!Array.isArray(task.dependencies)||new Set(task.dependencies).size!==task.dependencies.length||task.dependencies.length>30)throw Error('Invalid dependencies');
   for(const dependency of task.dependencies){const source=records.get(dependency);if(dependency===task.itemKey||!product(dependency)||!source||(!source.done&&!selected.has(dependency)))throw Error(`Unsatisfied dependency: ${dependency}`);}
   if(task.delivery==='evidence'&&task.allowedPaths.some(path=>!path.startsWith('docs/product-audits/')&&!path.startsWith('scripts/product-audits/')))throw Error('Evidence delivery cannot change application source');
   selected.add(task.itemKey);tasks.push(structuredClone(task));
  }
  const blocked=[];
  for(const item of plan.blocked){fields(item,['itemKey','reason']);lookup(item.itemKey);if(!text(item.reason,20,1600))throw Error('Blocked steps need a concrete reason');blocked.push(structuredClone(item));}
  if(!tasks.length){
   const uncovered=[...records.values()].filter(row=>authorized(row.key)&&!row.done&&!seen.has(row.key));
   if(uncovered.length)throw Error('An empty plan must explain every remaining authorized product step');
  }
  return {allowed:true,plan:{tasks,blocked,summary:plan.summary.trim()}};
 }catch(error){return {allowed:false,reason:error.message};}
}
