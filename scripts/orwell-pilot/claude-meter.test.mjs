import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeClaudeMeter} from './claude-meter.mjs';
import {validateSnapshot,admitSubscription,reconcileShortWindows} from './budget.mjs';
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
test('native inactive five-hour window retains original weekly allocation and admits only after old short window expires',()=>{
 const p=payload(), baseline=normalizeClaudeMeter(p,now), later=now+2*60*60*1000;
 p.five_hour={utilization:0,resets_at:null};p.seven_day.utilization=9;
 const snapshot=normalizeClaudeMeter(p,later);
 const policy={subscriptionOnly:true,allowPaidFallback:false,allocationPercentagePoints:30,reservePercentagePoints:3,startedAt:now,endsAt:now+86400000};
 const check=(s=snapshot,b=baseline,t=later)=>admitSubscription({snapshot:s,baseline:b,policy,activeRuns:0,now:t});
 assert.equal(validateSnapshot(snapshot,later),null);assert.equal(snapshot.windows[0].resetsAt,null);
 assert.equal(check().allowed,true);assert.equal(check().remaining[0].usedPercentagePoints,9);
 assert.equal(reconcileShortWindows({snapshot,baseline,policy,now:later}).baseline,baseline);
 assert.equal(check({...snapshot,observedAt:now},baseline,now).allowed,false);
 for(const patch of [{provider:'codex'},{source:'unknown'},{creditsEnabled:true},{observedAt:later-120001}])assert.equal(check({...snapshot,...patch}).allowed,false);
 for(const usedPercent of [null,1,100]){const changed=structuredClone(snapshot);changed.windows[0].usedPercent=usedPercent;assert.equal(check(changed).allowed,false);}
 const exhausted=structuredClone(snapshot);exhausted.windows[1].usedPercent=27;assert.equal(check(exhausted).allowed,false);
 const reset=structuredClone(snapshot);reset.windows[1].resetsAt+=604800;assert.equal(check(reset).allowed,false);
 p.five_hour={utilization:1,resets_at:new Date(later+18000000).toISOString()};
 const active=normalizeClaudeMeter(p,later), reconciled=reconcileShortWindows({snapshot:active,baseline,policy,now:later});
 assert.equal(reconciled.records.length,1);assert.equal(reconciled.baseline.windows[1],baseline.windows[1]);assert.equal(check(active,reconciled.baseline).allowed,true);
});

test('expired native credential refresh rotates securely without changing subscription metadata',async()=>{
 const {mkdtemp,writeFile,readFile,stat,rm}=await import('node:fs/promises');
 const {tmpdir}=await import('node:os');const {join}=await import('node:path');
 const {refreshClaudeCredentials}=await import('./claude-meter.mjs');
 const dir=await mkdtemp(join(tmpdir(),'claude-meter-')),path=join(dir,'credentials.json');
 const credentials={claudeAiOauth:{accessToken:'old',refreshToken:'old-refresh',subscriptionType:'max'},other:'preserved'};
 try{
  await writeFile(path,JSON.stringify(credentials),{mode:0o600});
  const updated=await refreshClaudeCredentials({credentials,path,now:1000,fetchImpl:async(url,options)=>{
   assert.equal(url,'https://api.anthropic.com/v1/oauth/token');assert.equal(JSON.parse(options.body).grant_type,'refresh_token');
   return {ok:true,json:async()=>({access_token:'new',refresh_token:'rotated',expires_in:3600})};
  }});
  assert.equal(updated.claudeAiOauth.subscriptionType,'max');assert.equal(updated.other,'preserved');
  assert.equal(updated.claudeAiOauth.expiresAt,3601000);assert.equal(JSON.parse(await readFile(path,'utf8')).claudeAiOauth.refreshToken,'rotated');assert.equal((await stat(path)).mode&0o777,0o600);
  await assert.rejects(refreshClaudeCredentials({credentials,path,fetchImpl:async()=>({ok:false,status:400})}),/refresh unavailable \(400\)/);
  assert.equal(JSON.parse(await readFile(path,'utf8')).claudeAiOauth.accessToken,'new');
 }finally{await rm(dir,{recursive:true,force:true});}
});
