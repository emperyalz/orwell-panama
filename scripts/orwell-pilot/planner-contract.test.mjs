import test from 'node:test';
import assert from 'node:assert/strict';
import {validatePlan} from './planner-contract.mjs';
const key='communication-trends/document-analysis-methods',other='communication-trends/label-uncertainty-and-archive-gaps',done='profile-facts-audit/directory';
const backlog=[{key,state:'ready',done:false},{key:other,state:'ready',done:false},{key:done,state:'accepted',done:true},{key:'continuous-agent-dispatch-20261009/dispatch-6',state:'ready',done:false}];
const task=()=>({itemKey:key,acceptance:'Document every implemented archive calculation, unit, inclusion rule and limitation with source-addressable code evidence.',allowedPaths:['docs/product-audits/communication-methods.md'],verification:{kind:'source-audit'},delivery:'evidence',modelTier:'economy',reason:'The current archive implementation exists and its complete method can be documented in one bounded run.',wholeStep:true,dependencies:[done]});
const plan=()=>({tasks:[task()],blocked:[],summary:'Finish the implemented communication-method documentation using the existing archive source.'});
const check=(p,extra={})=>validatePlan({plan:p,backlog,existingPaths:['src/components/reference/IntelligenceWorkspace.tsx','convex/intelligence.ts','public/icons/official/tribunal-electoral-ined.png'],...extra});
test('accepts one or two bounded whole steps; cannot alter trusted policy or return aliases',()=>{
 const input=plan(),policy={weeklyAllocation:30,reserve:3};const saved=structuredClone(policy),result=check(input,{policy});assert.equal(result.allowed,true);assert.deepEqual(policy,saved);
 result.plan.tasks[0].allowedPaths.push('untrusted');assert.equal(input.tasks[0].allowedPaths.length,1);
 const second={...task(),itemKey:other,dependencies:[key]};input.tasks.push(second);assert.equal(check(input).allowed,true);
});
test('rejects completed, invented, nonproduct and duplicate keys',()=>{
 for(const itemKey of [done,'career-history/invented-child','continuous-agent-dispatch-20261009/dispatch-6']){const p=plan();p.tasks[0].itemKey=itemKey;assert.equal(check(p).allowed,false,itemKey);}
 const p=plan();p.tasks.push(task());assert.match(check(p).reason,/Duplicate/);
 const duplicate=plan();duplicate.blocked.push({itemKey:key,reason:'This is already selected and cannot also be blocked.'});assert.equal(check(duplicate).allowed,false);
});
test('rejects arbitrary shell commands, provider/budget changes and partial completion',()=>{
 const mutations=[p=>p.command='curl secret',p=>p.tasks[0].verification.command='sh',p=>p.tasks[0].verification.args=['-c','curl secret'],p=>p.tasks[0].provider='codex',p=>p.policy={weeklyAllocation:100},p=>p.tasks[0].deletePaths=['convex/intelligence.ts'],p=>p.tasks[0].wholeStep=false];
 for(const mutate of mutations){const p=plan();mutate(p);assert.equal(check(p).allowed,false);}
});
test('exact source boundaries reject credentials, controller, traversal, broad scope and unverified public assets',()=>{
 for(const path of ['/etc/passwd','src/../secret','src/','convex/*','docs/product-audits/../../AGENTS.md','AGENTS.md','docs/product-audits/.env.local','scripts/orwell-pilot/budget.mjs','src/lib/provider-config.ts','convex/agentActivity.ts','convex/dispatch.ts','convex/scoreboard.ts','convex/schema.ts','convex/runtimeTeam.ts','convex/leadMetrics.ts','src/app/agents/page.tsx','convex/_generated/api.ts','src/run.sh','public/icons/official/tribunal-electoral-ined.png']){
  const p=plan();p.tasks[0].delivery='frontend';p.tasks[0].allowedPaths=[path];assert.equal(check(p,{existingPaths:[path]}).allowed,false,path);
 }
 const p=plan();p.tasks[0].delivery='frontend';p.tasks[0].allowedPaths=['src/components/reference/IntelligenceWorkspace.tsx'];assert.equal(check(p).allowed,true);
 p.tasks[0].allowedPaths=['src/components/reference/StatementEvidence.tsx','convex/statementEvidence.ts'];assert.equal(check(p).allowed,true);
 p.tasks[0].allowedPaths=['public/icons/official/tribunal-electoral-ined.png'];assert.equal(check(p,{verifiedAssetPaths:p.tasks[0].allowedPaths}).allowed,true);
});
test('pending dependencies and active/retry phases cannot be bypassed; completed dependencies can be used',()=>{
 const p=plan();p.tasks[0].dependencies=[other];assert.match(check(p).reason,/Unsatisfied/);
 p.tasks[0].dependencies=[done];assert.equal(check(p).allowed,true);
 for(const state of ['qa_ready','accept_ready','running','blocked','accepted'])assert.equal(check(plan(),{backlog:[{key,state}]}).allowed,false,state);
 assert.equal(check(plan(),{backlog:[{key,state:'ready',retryAt:200}],now:100}).allowed,false);
 assert.equal(check(plan(),{backlog:[{key,state:'ready',leaseUntil:200}],now:100}).allowed,false);
});
test('empty plan requires specific reasons for every open product step, and completed backlog may be empty',()=>{
 const p={tasks:[],blocked:[],summary:'No task can run because primary source access is unavailable.'};assert.equal(check(p).allowed,false);
 p.blocked=[{itemKey:key,reason:'Primary sources cannot currently be reopened for method verification.'},{itemKey:other,reason:'The coverage analysis prerequisite remains unverified in this snapshot.'}];assert.equal(check(p).allowed,true);
 assert.equal(check({...p,blocked:[]},{backlog:[{key:done,done:true}]}).allowed,true);
});
test('scoreboard and dispatch shapes combine without reopening checked rows; explicit authorized scope narrows choices',()=>{
 const board=[{key:'communication-trends',checklist:[{key:'document-analysis-methods',done:true},{key:'label-uncertainty-and-archive-gaps',done:false}]}];
 assert.equal(check(plan(),{backlog:{scoreboard:board,dispatch:{items:[{key,state:'ready'}]}}}).allowed,false);
 assert.equal(check(plan(),{policy:{itemKeys:[other]}}).allowed,false);
});

test('recorded career-history input stays read-only and rejections identify the exact path',()=>{
 const p=plan();p.tasks[0].allowedPaths.push('docs/accepted-career-histories-2026-10-08.json');
 assert.match(check(p).reason,/outside trusted product source inventory: docs\/accepted-career-histories-2026-10-08.json/);
 p.tasks[0].allowedPaths.pop();p.tasks[0].allowedPaths.push('src/components/reference/CareerHistory.tsx');
 assert.match(check(p).reason,/Evidence delivery cannot change application source/);
 p.tasks[0].allowedPaths.pop();assert.equal(check(p).allowed,true);
});
