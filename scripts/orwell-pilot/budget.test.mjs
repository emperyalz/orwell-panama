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


test('verified native Codex tolerates at most two seconds of same-cycle clock jitter without changing its original allocation',()=>{
 const native=used=>({...snapshot(used),source:'account/rateLimits/read',authType:'chatgpt'});
 const baseline=native(22);baseline.windows[0].resetsAt=1792668152;
 const saved=structuredClone(baseline);
 for(const jitter of [-2,-1,1,2]){
  const current=native(45);current.windows[0].resetsAt=baseline.windows[0].resetsAt+jitter;
  const result=run({snapshot:current,baseline});assert.equal(result.allowed,true);assert.equal(result.remaining[0].usedPercentagePoints,23);assert.equal(result.remaining[0].availablePercentagePoints,4);
 }
 assert.deepEqual(baseline,saved);
 for(const jitter of [-3,3,604800]){const current=native(45);current.windows[0].resetsAt=baseline.windows[0].resetsAt+jitter;assert.equal(run({snapshot:current,baseline}).allowed,false);}
 const decreased=native(21);decreased.windows[0].resetsAt=baseline.windows[0].resetsAt+1;assert.equal(run({snapshot:decreased,baseline}).allowed,false);
 for(const resetsAt of [undefined,null,now/1000-1]){const current=native(45);current.windows[0].resetsAt=resetsAt;assert.equal(run({snapshot:current,baseline}).allowed,false);}
 const expired=native(22),next=native(45);expired.windows[0].resetsAt=now/1000-1;next.windows[0].resetsAt=now/1000+1;assert.equal(run({snapshot:next,baseline:expired}).allowed,false);
});

test('clock jitter tolerance cannot apply to other providers, sources or authentication methods',()=>{
 const baseline={...snapshot(22),source:'account/rateLimits/read',authType:'chatgpt'},current={...snapshot(45),source:'account/rateLimits/read',authType:'chatgpt'};current.windows[0].resetsAt++;
 for(const patch of [{provider:'claude'},{source:'unverified'},{source:undefined},{authType:'apiKey'},{authType:undefined}]){
  assert.equal(run({snapshot:{...current,...patch},baseline}).allowed,false);
  assert.equal(run({snapshot:current,baseline:{...baseline,...patch}}).allowed,false);
 }
 const shortBase=structuredClone(baseline),shortCurrent=structuredClone(current);
 for(const value of [shortBase,shortCurrent])value.windows.push({id:'short',durationMinutes:300,usedPercent:10,resetsAt:now/1000+5000});shortCurrent.windows[1].resetsAt++;
 assert.equal(run({snapshot:shortCurrent,baseline:shortBase}).allowed,false);
});

test('explicit Codex40 override retains Claude30, reserve3 and original baseline',()=>{
 const p={...policy,providerAllocations:{codex:40,claude:30}};
 assert.equal(run({policy:p,snapshot:snapshot(53)}).remaining[0].availablePercentagePoints,5);
 assert.equal(run({policy:p,snapshot:snapshot(58)}).allowed,false);
 const base={...snapshot(),provider:'claude'},current={...snapshot(48),provider:'claude'};
 assert.equal(run({policy:p,baseline:base,snapshot:current}).allowed,false);
 for(const providerAllocations of [{codex:41},{claude:40},{codex:0},{codex:null},{unknown:40},null,[]])assert.equal(run({policy:{...policy,providerAllocations}}).allowed,false);
});
