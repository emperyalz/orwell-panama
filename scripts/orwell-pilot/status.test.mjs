import test from 'node:test';
import assert from 'node:assert/strict';
import {statusObservation} from './status.mjs';
test('public meters retain account-wide delta and distinct40/30 limits',()=>{
 const window=usedPercent=>({id:'week',usedPercent,durationMinutes:10080,resetsAt:1800000000});
 const policy={startedAt:1,endsAt:2,allocationPercentagePoints:30,providerAllocations:{codex:40,claude:30},reservePercentagePoints:3,baselines:{codex:{windows:[window(22)]},claude:{windows:[window(0)]}}};
 const snapshots={codex:{observedAt:1,windows:[window(54)]},claude:{observedAt:1,windows:[window(2)]}};
 const result=statusObservation({policy,scope:{itemKeys:['real/step']},snapshots,state:'ready',now:1});
 assert.deepEqual(result.providers.map(p=>[p.provider,p.limitPoints,p.weekly[0].deltaPoints,p.weekly[0].remainingPoints]),[['codex',40,32,5],['claude',30,2,25]]);
 assert.equal(result.scopeItemKeys[0],'real/step');
});
