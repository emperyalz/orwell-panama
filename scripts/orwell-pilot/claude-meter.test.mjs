import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeClaudeMeter} from './claude-meter.mjs';
import {validateSnapshot} from './budget.mjs';
const now=Date.parse('2026-10-15T23:00:00Z');
const payload=()=>({five_hour:{utilization:1,resets_at:'2026-10-16T00:40:00.041Z'},seven_day:{utilization:0,resets_at:'2026-10-22T10:00:00.041Z'},extra_usage:{is_enabled:false},spend:{enabled:false}});
test('native Claude metering rejects missing or enabled paid credits',()=>{
 for(const mutate of [p=>delete p.extra_usage,p=>p.extra_usage.is_enabled=true,p=>delete p.spend,p=>p.spend.enabled=true]){
  const p=payload();mutate(p);assert.throws(()=>normalizeClaudeMeter(p,now),/credits/);
 }
});
test('Claude native reset clock jitter does not invent a new weekly window',()=>{
 const a=payload(),b=payload();b.seven_day.resets_at='2026-10-22T09:59:59.923Z';
 assert.equal(normalizeClaudeMeter(a,now).windows[1].resetsAt,normalizeClaudeMeter(b,now).windows[1].resetsAt);
 b.seven_day.resets_at='2026-10-29T10:00:00Z';
 assert.notEqual(normalizeClaudeMeter(a,now).windows[1].resetsAt,normalizeClaudeMeter(b,now).windows[1].resetsAt);
});
test('unknown Claude percentages and expired windows remain unusable',()=>{
 for(const mutate of [p=>p.seven_day.utilization=null,p=>p.five_hour.resets_at='garbage',p=>p.seven_day.resets_at='2026-10-14T00:00:00Z']){
  const p=payload();mutate(p);assert.ok(validateSnapshot(normalizeClaudeMeter(p,now),now));
 }
});

test('populated weekly breakdown metadata is not treated as another allowance',()=>{const p=payload();p.seven_day_breakdown={models:[{model:'sonnet',share:1}]};assert.equal(normalizeClaudeMeter(p,now).windows.length,2);assert.equal(validateSnapshot(normalizeClaudeMeter(p,now),now),null);});
