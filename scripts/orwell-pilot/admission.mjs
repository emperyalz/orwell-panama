import {readFile, mkdir, writeFile, rename} from 'node:fs/promises';
import {join, resolve} from 'node:path';
import {homedir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {readCodexMeter} from './codex-meter.mjs';
import {admitSubscription,reconcileShortWindows} from './budget.mjs';

export const pilotDirectory = join(homedir(), '.codex', 'orwell-pilot');
const deployment='https://fleet-vole-527.convex.cloud';
export async function readActiveRuns() {
  const response=await fetch(`${deployment}/api/query`,{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({path:'dispatch:snapshot',args:{},format:'json'}),signal:AbortSignal.timeout(12_000)});
  if(!response.ok)throw new Error('Cannot verify existing queue leases');
  const data=await response.json();
  if(data.status!=='success'||!Array.isArray(data.value?.items))throw new Error('Queue lease response is invalid');
  return data.value.items.filter(item=>item.leaseUntil>Date.now()&&['running','qa_running','accept_running'].includes(item.state)).length;
}
export async function admission({directory = pilotDirectory, meter = readCodexMeter, active = readActiveRuns} = {}) {
  let policy;
  try {policy = JSON.parse(await readFile(join(directory,'policy.json'),'utf8'));}
  catch {return {allowed:false,state:'held',reason:'Pilot allocation is missing or unreadable; no model launch allowed'};}
  try {
    const snapshot = await meter();
    const activeRuns=await active();
    const reconciled=reconcileShortWindows({snapshot,baseline:policy.baselines?.codex,policy});
    if(reconciled.records.length){
      policy.baselines.codex=reconciled.baseline;
      policy.shortWindowReconciliations=[...(policy.shortWindowReconciliations??[]),...reconciled.records.map(record=>({...record,provider:'codex'}))];
      await writeAtomicJson(join(directory,'policy.json'),policy);
    }
    return {...admitSubscription({snapshot,baseline:policy.baselines?.codex,policy,activeRuns}),snapshot};
  } catch(error) {return {allowed:false,state:'held',reason:error.message};}
}

/** Only call for a newly authorized allocation. Never renew on a timer or quota reset. */
export async function initializeAllocation({directory = pilotDirectory, meter = readCodexMeter, active = readActiveRuns} = {}) {
  await mkdir(directory,{recursive:true,mode:0o700});
  // Exclusive create prevents a service restart from silently replenishing the allocation.
  const snapshot = await meter(), now = Date.now();
  const policy = {version:1,project:'orwell',subscriptionOnly:true,allowPaidFallback:false,
    allocationPercentagePoints:30,reservePercentagePoints:3,maxSnapshotAgeMs:120_000,
    startedAt:now,endsAt:now+24*60*60_000,baselines:{codex:snapshot},
    scope:'One-day Orwell pilot; all account usage after baseline counts conservatively toward allocation',
    claude:'Held until current usage and included-subscription billing are verified'};
  const check = admitSubscription({snapshot,baseline:snapshot,policy,activeRuns:await active(),now});
  if (!check.allowed) throw new Error(check.reason);
  await writeFile(join(directory,'policy.json'),JSON.stringify(policy,null,2),{mode:0o600,flag:'wx'});
  return {policy,admission:check};
}

export async function writeAtomicJson(path,value) {
  const temporary = `${path}.${process.pid}.tmp`;
  await writeFile(temporary,JSON.stringify(value,null,2),{mode:0o600});
  await rename(temporary,path);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const action=process.argv[2]??'check';
    if(!['check','initialize'].includes(action))throw new Error('Expected check or initialize');
    const result=action==='initialize'?await initializeAllocation():await admission();
    console.log(JSON.stringify(result,null,2));
    if(action==='check'&&!result.allowed)process.exitCode=2;
  } catch(error) {console.error(error.message);process.exitCode=1;}
}
