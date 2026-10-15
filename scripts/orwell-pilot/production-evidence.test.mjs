import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {admitSubscription,reconcileShortWindows,validateSnapshot} from './budget.mjs';
import {quotaReconciliation} from './interrupted-usage.mjs';
import {normalizeClaudeMeter} from './claude-meter.mjs';
const root='/opt/orwell-evidence/';
const read=name=>JSON.parse(readFileSync(root+name,'utf8'));
test('saved original allocation admits baseline captured 1ms before policy start', {skip:!existsSync(root+'pilot.json')},()=>{
 const {policy,lastControllerAdmission:observed}=read('pilot.json');
 assert.equal(policy.startedAt-policy.baselines.codex.observedAt,1);
 for(const provider of ['codex','claude'])assert.equal(admitSubscription({policy,baseline:policy.baselines[provider],snapshot:observed.snapshots[provider],activeRuns:0,now:observed.at}).allowed,true);
 const baseline={...policy.baselines.codex,observedAt:policy.startedAt-5001};
 assert.equal(admitSubscription({policy,baseline,snapshot:observed.snapshots.codex,activeRuns:0,now:observed.at}).allowed,false);
});
test('actual native populated breakdown remains metadata', {skip:!existsSync(root+'native-meter-case.json')},()=>{
 const payload=read('native-meter-case.json'),now=Date.parse(payload.seven_day_breakdown.as_of);
 const snapshot=normalizeClaudeMeter(payload,now);
 assert.equal(snapshot.windows.some(w=>w.id==='seven_day_breakdown'),false);
 assert.equal(validateSnapshot(snapshot,now),null);
});
test('expired short windows reconcile once without rewriting original weekly allocation',()=>{
 const now=1792107751225;
 const policy={subscriptionOnly:true,allowPaidFallback:false,allocationPercentagePoints:30,reservePercentagePoints:3,startedAt:now-10000,endsAt:now+10000};
 const weekly={id:'week',durationMinutes:10080,usedPercent:20,resetsAt:now/1000+86400};
 const short={id:'short',durationMinutes:300,usedPercent:90,resetsAt:now/1000-1};
 const baseline={provider:'claude',observedAt:policy.startedAt-1,windows:[weekly,short]};
 const snapshot={provider:'claude',observedAt:now,windows:[{...weekly,usedPercent:24},{...short,usedPercent:2,resetsAt:now/1000+18000}]};
 const original=JSON.stringify(baseline),r=reconcileShortWindows({snapshot,baseline,policy,now});
 assert.equal(r.records.length,1);assert.equal(r.baseline.windows[0],weekly);assert.equal(JSON.stringify(baseline),original);
 assert.equal(admitSubscription({snapshot,baseline:r.baseline,policy,activeRuns:0,now}).remaining[0].availablePercentagePoints,23);
 assert.equal(reconcileShortWindows({snapshot,baseline:r.baseline,policy,now}).records.length,0);
 for(const changed of [{...weekly,usedPercent:0},{...weekly,resetsAt:weekly.resetsAt+604800}])assert.equal(reconcileShortWindows({snapshot:{...snapshot,windows:[changed,snapshot.windows[1]]},baseline,policy,now}).records.length,0);
 const unexpired={...baseline,windows:[weekly,{...short,resetsAt:now/1000+1}]};
 assert.equal(reconcileShortWindows({snapshot,baseline:unexpired,policy,now}).records.length,0);
});

test('real interrupted recovery retains partial usage and has no recovered verdict', {skip:!existsSync(root+'recovery.json')},()=>{
 const {policy,nativeQuotaReconciliation:r}=read('recovery.json');
 const now=Math.max(...Object.values(r.snapshots).map(s=>s.observedAt));
 const result=quotaReconciliation({sessionId:r.sessionId,observedUsage:r.observedUsage,snapshots:r.snapshots,policy,now});
 assert.equal(result.exactFinalTotalKnown,false);assert.equal(result.observedUsage.total_tokens,213596);
 assert.equal(result.originalWeeklyBaselines,policy.baselines);assert.equal(result.verdict,undefined);
});
test('real telemetry keeps completed CLI sessions separate from untouched historical roster records', {skip:!existsSync(root+'session-contract.json')},()=>{
 const {agents}=read('session-contract.json');
 for(const session of agents.filter(a=>a.binding)){
  assert.equal(session.status,'completed');
  const roster=agents.find(a=>a.key===session.binding.rosterKey);
  assert.ok(roster);assert.notEqual(session.key,roster.key);assert.equal(roster.binding,null);
  assert.equal(session.name,roster.name);assert.ok(session.lastActivityAt>roster.lastActivityAt);
 }
});
