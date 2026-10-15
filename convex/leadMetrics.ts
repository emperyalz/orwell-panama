type Agent={status:string;lastActivityAt:number};
type Step={readiness:string;owners:unknown[];handoffAt?:number};
export function leadMetrics(agents:Agent[],steps:Step[],now:number,capacity:number,paused:boolean){
 const running=agents.filter(agent=>agent.status==='running'&&now-agent.lastActivityAt<=300_000).length;
 const staleRuns=agents.filter(agent=>agent.status==='running'&&now-agent.lastActivityAt>300_000).length;
 const unusedSlots=staleRuns?null:Math.max(0,capacity-running);
 const missedHandoffs=steps.filter(step=>step.readiness==='ready'&&!step.owners.length&&step.handoffAt!==undefined&&now-step.handoffAt>=60_000&&!paused&&unusedSlots!==null&&unusedSlots>0).length;
 return {running,staleRuns,unusedSlots,missedHandoffs};
}
