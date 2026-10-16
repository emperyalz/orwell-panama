import test from 'node:test';
import assert from 'node:assert/strict';
import {planningState,compilePlan,remainingBacklog} from './server-planner.mjs';
const now=1792110000000,policy={subscriptionOnly:true,allowPaidFallback:false,allocationPercentagePoints:30,reservePercentagePoints:3,startedAt:now-1000,endsAt:now+100000};
const key='communication-trends/document-analysis-methods';
const backlog={scoreboard:[{key:'communication-trends',status:'in_progress',checklist:[{key:'document-analysis-methods',done:false,label:'Document analysis methods'}]}],dispatch:{items:[{key,state:'ready',label:'Document analysis methods'}]}};
const checks={codex:{allowed:true,remaining:[{availablePercentagePoints:9}]},claude:{allowed:true,remaining:[{availablePercentagePoints:26}]}};
const input={backlog,authorized:[key],scope:{itemKeys:[]},checks,policy,now};
test('plans on spare Claude quota without widening original policy',()=>{const result=planningState(input);assert.equal(result.planningAllowed,true);assert.equal(result.route.provider,'claude');assert.equal(policy.allocationPercentagePoints,30);});
test('active batch and blocked workspace affinity prohibit speculative planning',()=>{assert.equal(planningState({...input,scope:{itemKeys:[key]}}).planningAllowed,false);assert.equal(planningState({...input,affinity:{itemKey:key}}).planningAllowed,false);});
test('unchanged failure waits thirty minutes and absent independent reviewer holds',()=>{const first=planningState(input);assert.equal(planningState({...input,previous:{lastBacklogHash:first.backlogHash,nextPlanAt:now+1800000}}).planningAllowed,false);assert.equal(planningState({...input,checks:{...checks,codex:{allowed:false,reason:'reserve reached'}}}).planningAllowed,false);});
test('checked product steps are never reopened by stale dispatch',()=>{const b=structuredClone(backlog);b.scoreboard[0].checklist[0].done=true;assert.equal(remainingBacklog(b,[key]).length,0);});
test('compiler grants fixed verification paths and commands, never model shell',()=>{const scope={itemKeys:[],criteria:{},allowedPaths:{},productChecks:{},productPostChecks:{}};const next=compilePlan({scope,backlog,plan:{tasks:[{itemKey:key,allowedPaths:['docs/product-audits/methods.md'],acceptance:'Explain all implemented archive counting and evidence semantics.',delivery:'evidence'}]}});assert.deepEqual(next.itemKeys,[key]);assert.equal(next.productChecks[key][0][1][0],'/opt/orwell-evidence/verify-product-delivery.mjs');assert.equal(next.modelProposals[key].claude,'sonnet');assert.equal(scope.itemKeys.length,0);assert.match(next.criteria[key],/ENTIRE/);});

test('Claude planner standard tier selects stronger independent QA only with a concrete reason',()=>{
 const base={itemKey:key,allowedPaths:[],acceptance:'Check complete rendered behavior against source evidence.',delivery:'frontend',modelTier:'standard',reason:'Rendered empty-state behavior needs stronger independent review after a concrete missed defect.'};
 const scope={itemKeys:[],criteria:{},allowedPaths:{},productChecks:{},productPostChecks:{}};
 const standard=compilePlan({scope,backlog,plan:{tasks:[base]}});assert.equal(standard.modelProposals[key].codex,'gpt-6.1-sol');assert.equal(standard.modelProposals[key].claude,'sonnet');assert.equal(standard.modelReasons[key],base.reason);
 const economy=compilePlan({scope,backlog,plan:{tasks:[{...base,modelTier:'economy'}]}});assert.equal(economy.modelProposals[key].codex,'gpt-6-luna');assert.equal(economy.modelReasons[key],undefined);
});

test('two failed proposals hold unchanged backlog even after cooldown, while changed source contract permits repair',()=>{
 const first=planningState(input);
 const previous={lastBacklogHash:first.backlogHash,nextPlanAt:now-1,consecutiveFailures:2,lastError:'Rejected writable source'};
 const held=planningState({...input,previous});assert.equal(held.planningAllowed,false);assert.match(held.reason,/two failed proposals.*Rejected writable source/);
 assert.equal(planningState({...input,previous:{...previous,lastBacklogHash:'older-contract'}}).planningAllowed,true);
 const onlyOnce=planningState({...input,previous:{...previous,consecutiveFailures:1}});assert.equal(onlyOnce.planningAllowed,true);
});
