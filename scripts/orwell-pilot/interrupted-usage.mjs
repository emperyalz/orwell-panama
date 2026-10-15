import {admitSubscription} from './budget.mjs';

/** Per-request native usage is a lower bound when the final CLI result is lost. */
export function observedClaudeUsage(lines,sessionId) {
 const messages=new Map();
 for(const line of lines.split('\n')) {
  if(!line.trim())continue;
  let event;try{event=JSON.parse(line);}catch{continue;}
  if(event.session_id&&event.session_id!==sessionId)continue;
  const message=event.message,usage=message?.usage;
  if(!message?.id||!usage||message.role!=='assistant')continue;
  const prior=messages.get(message.id)??{};
  for(const name of ['input_tokens','output_tokens','cache_read_input_tokens','cache_creation_input_tokens']) {
   const value=usage[name]??0;
   if(!Number.isSafeInteger(value)||value<0)throw Error('Native partial usage is invalid');
   prior[name]=Math.max(prior[name]??0,value);
  }
  messages.set(message.id,prior);
 }
 if(!messages.size)throw Error('No native usage observations available');
 const sum=name=>[...messages.values()].reduce((n,u)=>n+u[name],0);
 const input=sum('input_tokens')+sum('cache_read_input_tokens')+sum('cache_creation_input_tokens'),output=sum('output_tokens');
 return {input_tokens:input,cached_input_tokens:sum('cache_read_input_tokens'),output_tokens:output,total_tokens:input+output,observedRequests:messages.size,exactFinalTotalKnown:false};
}

/** Quota recovery uses the user's measured percentage allocation, not invented tokens. */
export function quotaReconciliation({sessionId,observedUsage,snapshots,policy,now=Date.now()}) {
 if(!sessionId||!observedUsage||observedUsage.exactFinalTotalKnown!==false)throw Error('An actual interrupted run and honest partial usage are required');
 for(const provider of ['codex','claude']) {
  const check=admitSubscription({snapshot:snapshots[provider],baseline:policy.baselines[provider],policy,activeRuns:0,now});
  if(!check.allowed)throw Error(`${provider} quota reconciliation held: ${check.reason}`);
 }
 if(snapshots.claude.creditsEnabled!==false||snapshots.codex.authType!=='chatgpt')throw Error('Included subscription billing must be verified');
 return {method:'fresh-native-account-quota',sessionId,verifiedAt:now,policyStartedAt:policy.startedAt,originalWeeklyBaselines:policy.baselines,snapshots,observedUsage,exactFinalTotalKnown:false,
  limitation:'Final token total is unknown. Observed tokens are a lower bound. All account usage counts against the unchanged weekly allocation; every new model launch still requires fresh native admission.'};
}
