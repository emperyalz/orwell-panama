import test from 'node:test';
import assert from 'node:assert/strict';
import {observedClaudeUsage,quotaReconciliation} from './interrupted-usage.mjs';
const line=(id,output)=>JSON.stringify({session_id:'actual-run',message:{id,role:'assistant',usage:{input_tokens:2,cache_read_input_tokens:10,cache_creation_input_tokens:3,output_tokens:output}}});
test('interrupted native transcript usage counts each request once and stays a lower bound',()=>{
 const usage=observedClaudeUsage([line('request-a',2),line('request-a',5),line('request-b',4)].join('\n'),'actual-run');
 assert.equal(usage.input_tokens,30);assert.equal(usage.output_tokens,9);assert.equal(usage.total_tokens,39);
 assert.equal(usage.exactFinalTotalKnown,false);assert.equal(usage.observedRequests,2);
});
test('unknown tokens require fresh original account allocation and included billing before recovery',()=>{
 const now=1792107400000;
 const snapshot=provider=>({provider,observedAt:now,authType:provider==='codex'?'chatgpt':'claudeAi',creditsEnabled:false,windows:[{id:'week',durationMinutes:10080,resetsAt:now/1000+86400,usedPercent:1}]});
 const snapshots={codex:snapshot('codex'),claude:snapshot('claude')};
 const policy={subscriptionOnly:true,allowPaidFallback:false,allocationPercentagePoints:30,reservePercentagePoints:3,startedAt:now-1000,endsAt:now+86399000,baselines:snapshots};
 const args={sessionId:'actual-run',observedUsage:observedClaudeUsage(line('request-a',5),'actual-run'),snapshots,policy,now};
 assert.equal(quotaReconciliation(args).exactFinalTotalKnown,false);
 assert.throws(()=>quotaReconciliation({...args,snapshots:{...snapshots,claude:{...snapshots.claude,creditsEnabled:true}}}),/billing/);
 assert.throws(()=>quotaReconciliation({...args,now:now+121000}),/stale/);
});
