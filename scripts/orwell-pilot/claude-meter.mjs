import {readFile} from 'node:fs/promises';
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
    return [{id,usedPercent:row.utilization,durationMinutes:id==='five_hour'?300:10080,
      resetsAt:Math.round(Date.parse(row.resets_at)/60000)*60,reached:Boolean(row.locked_reason)}];
  });
  if(!windows.some(w=>w.id==='seven_day'))throw Error('Claude weekly allowance is unavailable');
  return {provider:'claude',source:'claude-code/native-oauth-usage',observedAt:now,windows,authType:'claudeAi',creditsEnabled:false};
}
export async function readClaudeMeter({directory=join(homedir(),'.claude')}={}) {
  const credentials=JSON.parse(await readFile(join(directory,'.credentials.json'),'utf8'));
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
