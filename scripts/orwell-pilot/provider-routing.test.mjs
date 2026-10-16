import test from 'node:test';
import assert from 'node:assert/strict';
import {admitSubscription} from './budget.mjs';
import {routeProvider,selectNativeModel,nativeRunSpec,routingObservation,oppositeProvider} from './provider-routing.mjs';
const now=1792120000000,week=10080,resetsAt=now/1000+86400;
const window=(usedPercent,id='week')=>({id,durationMinutes:week,resetsAt,usedPercent});
const snapshot=(provider,usedPercent)=>({provider,observedAt:now,windows:[window(usedPercent)]});
const policy={subscriptionOnly:true,allowPaidFallback:false,allocationPercentagePoints:30,reservePercentagePoints:3,startedAt:now,endsAt:now+86400000,baselines:{codex:snapshot('codex',22),claude:snapshot('claude',0)}};
const nativeChecks=(codex=40,claude=1)=>Object.fromEntries([['codex',codex],['claude',claude]].map(([provider,used])=>[provider,admitSubscription({snapshot:snapshot(provider,used),baseline:policy.baselines[provider],policy,activeRuns:0,now})]));
const checks=(codex=9,claude=26)=>Object.fromEntries([['codex',codex],['claude',claude]].map(([provider,points])=>[provider,points===null?{allowed:false,reason:'Native provider is held'}:{allowed:true,remaining:[{id:'week',availablePercentagePoints:points}]}]));
const route=patch=>routeProvider({phase:'work',item:{key:'task/step'},checks:nativeChecks(),policy,now,...patch});

test('remaining original native allowance routes new heavy work to Claude while reserving Codex QA',()=>{
 const result=route({previousProvider:'codex'});
 assert.equal(result.allowed,true);assert.equal(result.provider,'claude');assert.equal(result.reviewerProvider,'codex');assert.equal(result.headroomPoints,26);assert.equal(result.reservedReviewerHeadroomPoints,1);
 assert.equal(policy.baselines.codex.windows[0].usedPercent,22);assert.equal(policy.baselines.claude.windows[0].usedPercent,0);assert.equal(policy.reservePercentagePoints,3);
});

test('three-point hysteresis avoids switching heavy providers on every small meter update',()=>{
 assert.equal(route({checks:checks(26,25),previousProvider:'claude'}).provider,'claude');
 assert.equal(route({checks:checks(27,24),previousProvider:'claude'}).provider,'codex');
 const multi=checks(27,20);multi.codex.remaining.push({id:'other-model-week',availablePercentagePoints:2});
 assert.equal(route({checks:multi}).provider,'claude');
});

test('planning can use one healthy provider but new work never bypasses missing opposite-provider review',()=>{
 const partial=checks(null,26);
 assert.equal(route({checks:partial}).allowed,false);
 const plan=route({phase:'planner',checks:partial});assert.equal(plan.allowed,true);assert.equal(plan.provider,'claude');assert.equal(plan.reviewBlocked,true);
 assert.equal(route({phase:'planner',checks:checks(null,null)}).allowed,false);
 assert.equal(route({checks:checks(.5,26)}).allowed,false);
 assert.equal(route({checks:checks(.5,26),item:{workerProvider:'codex'}}).allowed,true);
});

test('fresh independent QA always uses the opposite actual stored author even if that author is held',()=>{
 assert.equal(route({phase:'qa',item:{workerProvider:'claude'},checks:checks(9,null)}).provider,'codex');
 assert.equal(route({phase:'qa',item:{workerProvider:'codex'},checks:checks(null,26)}).provider,'claude');
 assert.equal(route({phase:'qa',item:{workerProvider:'claude'},checks:checks(null,26)}).allowed,false);
 assert.equal(route({phase:'qa',item:{},reservation:{workerProvider:'claude'}}).allowed,false);
 assert.throws(()=>oppositeProvider('unknown'),/Actual worker provider/);
});

test('repairs preserve both stored author ownership and failed-first-turn private reservations',()=>{
 assert.equal(route({item:{workerProvider:'codex'}}).provider,'codex');
 assert.equal(route({reservation:{workerProvider:'codex'}}).provider,'codex');
 assert.equal(route({item:{workerProvider:'claude'},reservation:{workerProvider:'codex'}}).allowed,false);
 assert.equal(route({item:{workerProvider:'codex'},checks:checks(null,26)}).allowed,false);
});

test('the original financial policy and deadline cannot be renewed or widened by routing',()=>{
 for(const patch of [{allocationPercentagePoints:50},{reservePercentagePoints:0},{subscriptionOnly:false},{allowPaidFallback:true},{endsAt:now},{startedAt:now+1},{endsAt:now+86400001}]){
  for(const phase of ['work','qa','planner','triage','accept'])assert.equal(route({phase,policy:{...policy,...patch},item:{workerProvider:'codex'}}).allowed,false);
 }
 assert.equal(route({checks:nativeChecks(49,1)}).allowed,false);
});

test('root model selection stays provider-native and needs evidence for stronger models',()=>{
 assert.equal(selectNativeModel({provider:'codex',proposal:'gpt-6.1-sol'}).model,'gpt-6-luna');
 assert.equal(selectNativeModel({provider:'codex',repairReason:'Independent QA found missing directory entries'}).model,'gpt-6.1-sol');
 assert.equal(selectNativeModel({provider:'claude'}).model,'sonnet');
 assert.equal(selectNativeModel({provider:'claude',proposal:'opus',repairReason:'Mechanical schema typo',qaFailures:1}).model,'sonnet');
 assert.equal(selectNativeModel({provider:'claude',proposal:'opus',repairReason:'Two independently rejected source analyses',qaFailures:2}).model,'opus');
 assert.equal(selectNativeModel({provider:'claude',proposal:'opus',taskReason:'Trusted scope: resolve conflicting constitutional source evidence'}).model,'opus');
 for(const [provider,proposal]of [['claude','gpt-6.1-sol'],['codex','opus'],['codex','gpt-6-astra']])assert.throws(()=>selectNativeModel({provider,proposal}),/allowlist/);
});

test('native command permissions follow work versus QA and keep subscription-only CLI configuration',()=>{
 const input={model:'sonnet',cwd:'/opt/orwell-reviews/frozen',schema:{type:'object'}};
 const work=nativeRunSpec({...input,provider:'claude',phase:'work'}),qa=nativeRunSpec({...input,provider:'claude',phase:'qa'});
 assert.match(work.args[work.args.indexOf('--tools')+1],/Write,Edit/);assert.doesNotMatch(qa.args[qa.args.indexOf('--tools')+1],/Write|Edit/);
 assert.equal(work.sourceWritable,true);assert.equal(qa.sourceWritable,false);assert.equal(qa.args[qa.args.indexOf('--max-turns')+1],'24');
 const codex=nativeRunSpec({...input,model:'gpt-6-luna',provider:'codex',phase:'qa'});
 assert.equal(codex.sourceWritable,false);assert.equal(codex.args[codex.args.indexOf('-C')+1],'/opt/orwell-reviews/frozen');assert.ok(codex.args.includes('forced_login_method="chatgpt"'));assert.ok(codex.args.includes('features.multi_agent=false'));
 assert.throws(()=>nativeRunSpec({...input,provider:'claude',phase:'qa',model:'gpt-6-luna'}),/Invalid native run model/);
});

test('published routing preserves actual running providers and cannot route completed or unauthorized items',()=>{
 const items=[{key:'new/step',state:'ready',lead:'Rowan'},{key:'repair/step',state:'ready',workerProvider:'codex'},{key:'review/step',state:'qa_ready',workerProvider:'claude'},{key:'running/step',state:'running',lead:'Iris',leaseUntil:now+1000},{key:'review-running/step',state:'qa_running',workerProvider:'claude'},{key:'done/step',state:'accepted'},{key:'outside/step',state:'ready'}];
 const previous={heavyProvider:'claude',reservations:{'running/step':{workerProvider:'codex'},'done/step':{workerProvider:'claude'}}};
 const result=routingObservation({items,itemKeys:items.filter(i=>i.key!=='outside/step').map(i=>i.key),checks:nativeChecks(),policy,previous,now});
 assert.equal(result.items['new/step'].role,'claude');assert.equal(result.items['repair/step'].role,'codex');assert.equal(result.items['review/step'].role,'codex');
 assert.equal(result.items['running/step'].role,'codex');assert.equal(result.items['running/step'].allowed,false);assert.equal(result.items['review-running/step'].role,'codex');
 assert.equal(result.items['done/step'],undefined);assert.equal(result.items['outside/step'],undefined);assert.equal(result.reservations['done/step'],undefined);
 assert.equal(previous.reservations['done/step'].workerProvider,'claude');
});
