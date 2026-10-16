import {readFile,writeFile,rename,stat,chmod,chown} from 'node:fs/promises';
import {join, resolve} from 'node:path';
import {homedir} from 'node:os';
import {fileURLToPath} from 'node:url';

/** Native Claude Code OAuth meter. Schema changes hold work; no API-key fallback. */
export function normalizeClaudeMeter(payload, now=Date.now()) {
  if(payload?.extra_usage?.is_enabled!==false || payload?.spend?.enabled!==false)
    throw Error('Claude usage credits must be explicitly disabled');
  const windows=Object.entries(payload).flatMap(([id,row])=>{
    if(!row || id==='seven_day_breakdown' || !(id==='five_hour'||id.startsWith('seven_day')))return [];
    // seven_day_breakdown is explanatory usage metadata, not a quota window.
    const inactive=id==='five_hour'&&row.utilization===0&&row.resets_at===null&&!row.locked_reason;
    return [{id,usedPercent:row.utilization,durationMinutes:id==='five_hour'?300:10080,
      resetsAt:inactive?null:Math.round(Date.parse(row.resets_at)/60000)*60,reached:Boolean(row.locked_reason),...(inactive?{inactive:true}:{})}];
  });
  if(!windows.some(w=>w.id==='seven_day'))throw Error('Claude weekly allowance is unavailable');
  return {provider:'claude',source:'claude-code/native-oauth-usage',observedAt:now,windows,authType:'claudeAi',creditsEnabled:false};
}
export async function refreshClaudeCredentials({credentials,path,fetchImpl=fetch,now=Date.now()}) {
  const oauth=credentials.claudeAiOauth;
  if(!oauth?.refreshToken)throw Error('Claude native login refresh unavailable; new work held');
  const response=await fetchImpl('https://api.anthropic.com/v1/oauth/token',{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({grant_type:'refresh_token',refresh_token:oauth.refreshToken,client_id:'9d1c250a-e61b-44d9-88ed-5944d1962f5e'}),signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw Error(`Claude native login refresh unavailable (${response.status}); new work held`);
  const data=await response.json();
  if(!data.access_token||!Number.isFinite(data.expires_in)||data.expires_in<=0)throw Error('Invalid Claude native login refresh response; new work held');
  const updated={...credentials,claudeAiOauth:{...oauth,accessToken:data.access_token,refreshToken:data.refresh_token||oauth.refreshToken,expiresAt:now+data.expires_in*1000,...(data.scope?{scopes:data.scope.split(' ')}:{})}};
  const original=await stat(path),temporary=path+'.refresh-'+process.pid;
  await writeFile(temporary,JSON.stringify(updated),{mode:0o600});
  await chmod(temporary,0o600);await chown(temporary,original.uid,original.gid);await rename(temporary,path);
  return updated;
}
export async function readClaudeMeter({directory=join(homedir(),'.claude')}={}) {
  const path=join(directory,'.credentials.json');
  let credentials=JSON.parse(await readFile(path,'utf8'));
  if(Number.isFinite(credentials.claudeAiOauth?.expiresAt)&&credentials.claudeAiOauth.expiresAt<=Date.now()+60000)credentials=await refreshClaudeCredentials({credentials,path});
  const oauth=credentials.claudeAiOauth;
  if(!oauth?.accessToken || !['max','pro','team','enterprise'].includes(oauth.subscriptionType))
    throw Error('Claude requires an included subscription login');
  const response=await fetch('https://api.anthropic.com/api/oauth/usage',{
    headers:{Authorization:`Bearer ${oauth.accessToken}`,'anthropic-beta':'oauth-2025-04-20','User-Agent':'claude-code/2.1.197'},
    signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw Error(`Claude usage meter unavailable (${response.status}); new work held`);
  return normalizeClaudeMeter(await response.json());
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  try{console.log(JSON.stringify(await readClaudeMeter()));}
  catch(error){console.error(error.message);process.exitCode=1;}
}
