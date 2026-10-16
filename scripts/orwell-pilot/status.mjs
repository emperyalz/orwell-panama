/** Public operational facts only. Never serialize policy credentials or raw runs. */
export function statusObservation({policy,scope,snapshots={},checks={},receipts=[],state,reason='',now=Date.now()}){
 const known=r=>r.usage??r.quotaReconciliation?.observedUsage;
 return {observedAt:now,state,reason:reason.slice(0,2000),scopeLabel:scope.label??'Orwell authorized backlog',scopeItemKeys:scope.itemKeys,
  allocation:{startedAt:policy.startedAt,endsAt:policy.endsAt,limitPoints:policy.allocationPercentagePoints,reservePoints:policy.reservePercentagePoints},
  providers:['codex','claude'].map(provider=>{
   const s=snapshots[provider],baseline=policy.baselines[provider],check=checks[provider];
   return {provider,observedAt:s?.observedAt??0,meterState:check?.state??'unknown',reason:check?.reason??'',weekly:(s?.windows??[]).filter(w=>w.durationMinutes===10080&&Number.isFinite(w.usedPercent)&&Number.isFinite(w.resetsAt)).flatMap(w=>{
    const prior=baseline.windows.find(p=>p.id===w.id);if(!prior)return [];
    const delta=w.usedPercent-prior.usedPercent;return [{id:w.id,baselinePercent:prior.usedPercent,usedPercent:w.usedPercent,deltaPoints:delta,remainingPoints:Math.max(0,policy.allocationPercentagePoints-policy.reservePercentagePoints-delta),resetsAt:w.resetsAt}];
   })};
  }),
  runs:{total:receipts.length,codex:receipts.filter(r=>r.provider==='codex').length,claude:receipts.filter(r=>r.provider==='claude').length,reportedTokens:receipts.reduce((n,r)=>n+(known(r)?.total_tokens??0),0),knownFreshTokens:receipts.reduce((n,r)=>n+(known(r)?known(r).total_tokens-known(r).cached_input_tokens:0),0),unknownFinalRuns:receipts.filter(r=>!r.usage).length},
 };
}
