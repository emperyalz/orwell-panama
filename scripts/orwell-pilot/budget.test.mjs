import test from 'node:test';
import assert from 'node:assert/strict';
import {admitSubscription, codexSnapshot, claudeSnapshot, normalizeCodexUsage, subscriptionEnvironment} from './budget.mjs';
const now = 1_792_090_000_000;
const snapshot = (usedPercent=21) => ({provider:'codex',observedAt:now,windows:[{id:'codex/primary',durationMinutes:10080,resetsAt:now/1000+86400,usedPercent}]});
const policy = {subscriptionOnly:true,allowPaidFallback:false,allocationPercentagePoints:30,reservePercentagePoints:3,startedAt:now-1000,endsAt:now+86399000};
const run = (overrides={}) => admitSubscription({snapshot:snapshot(),baseline:snapshot(),policy,activeRuns:0,now,...overrides});

test('admits a measured subscription baseline with a finite 30-point allocation', () => {
  assert.equal(run().allowed,true);
  assert.equal(run().remaining[0].availablePercentagePoints,27);
});
test('stops before allocation exhaustion and accounts conservatively for other chats', () => {
  assert.equal(run({snapshot:snapshot(47)}).allowed,true);
  assert.equal(run({snapshot:snapshot(48)}).allowed,false);
  assert.equal(run({snapshot:snapshot(51)}).allowed,false);
});
test('missing, null and stale percentages never become zero', () => {
  for(const value of [null,undefined,NaN,-1,101,'21']) {
    const s=snapshot();s.windows[0].usedPercent=value;
    assert.equal(run({snapshot:s}).allowed,false);
  }
  assert.equal(run({snapshot:{...snapshot(),observedAt:now-121000}}).allowed,false);
  assert.equal(run({snapshot:{...snapshot(),observedAt:now+6000}}).allowed,false);
});
test('a reset does not silently replenish the pilot budget', () => {
  const s=snapshot();s.windows[0].resetsAt++;
  assert.equal(run({snapshot:s}).allowed,false);
  assert.equal(run({snapshot:snapshot(20)}).allowed,false);
});
test('new or missing buckets require reconciliation', () => {
  const s=snapshot();s.windows.push({...s.windows[0],id:'new'});
  assert.equal(run({snapshot:s}).allowed,false);
  assert.equal(run({baseline:{provider:'codex',windows:[]}}).allowed,false);
});
test('all weekly buckets and short-window reserves must pass', () => {
  const s=snapshot(),b=snapshot();
  for (const w of [s,b])w.windows.push({id:'short',durationMinutes:300,resetsAt:now/1000+5000,usedPercent:10});
  s.windows[1].usedPercent=98;
  assert.equal(run({snapshot:s,baseline:b}).allowed,false);
});
test('short-window reset holds until recorded reconciliation exists and cannot renew weekly allocation', () => {
  const s=snapshot(),b=snapshot();
  for (const w of [s,b])w.windows.push({id:'short',durationMinutes:300,resetsAt:now/1000+5000,usedPercent:10});
  s.windows[1].resetsAt++;
  assert.equal(run({snapshot:s,baseline:b}).allowed,false);
  const weekReset=snapshot(0);weekReset.windows[0].resetsAt++;
  assert.equal(run({snapshot:weekReset,baseline:b}).allowed,false);
});
test('a weekly decrease cannot be hidden by a fresh baseline timestamp', () => {
  const b=snapshot(40),s=snapshot(39);
  assert.equal(run({baseline:b,snapshot:s}).allowed,false);
});
test('expiry, paid fallback, invalid policy and parallel runs cannot bypass admission', () => {
  for(const patch of [{endsAt:now},{subscriptionOnly:false},{allowPaidFallback:true},{reservePercentagePoints:30},{allocationPercentagePoints:50},{reservePercentagePoints:0},{endsAt:now+86400001}])
    assert.equal(run({policy:{...policy,...patch}}).allowed,false);
  for(const activeRuns of [undefined,1,2,-1,0.5])assert.equal(run({activeRuns}).allowed,false);
});
test('Codex normalization derives total without double-counting cached input', () => {
  const u=normalizeCodexUsage({input_tokens:100,cached_input_tokens:80,output_tokens:5});
  assert.equal(u.total_tokens,105);
  for(const bad of [null,{}, {input_tokens:100,cached_input_tokens:101,output_tokens:5},
    {input_tokens:100,cached_input_tokens:80,output_tokens:5,total_tokens:0}])assert.equal(normalizeCodexUsage(bad),null);
});
test('meter adapters preserve unknown fields rather than inventing usage', () => {
  assert.equal(run({snapshot:codexSnapshot({},now)}).allowed,false);
  const c=claudeSnapshot({rate_limits:{seven_day:{used_percentage:12,resets_at:now/1000+86400}}},now);
  assert.equal(admitSubscription({snapshot:c,baseline:c,policy,activeRuns:0,now}).allowed,true);
});
test('subscription environment excludes API and cloud-provider fallbacks', () => {
  const cleaned=subscriptionEnvironment({PATH:'/bin',HOME:'/home/test',OPENAI_API_KEY:'secret',CODEX_API_KEY:'secret',FUTURE_API_KEY:'secret',ANTHROPIC_AUTH_TOKEN:'secret',CLAUDE_CODE_USE_VERTEX:'1',AWS_SECRET_ACCESS_KEY:'secret'});
  assert.deepEqual(cleaned,{PATH:'/bin',HOME:'/home/test'});
});
