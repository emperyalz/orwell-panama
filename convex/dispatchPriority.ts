type QueueItem={state:string;attempt:number;createdAt:number;taskStatus?:string;taskOrder?:number;stepOrder?:number};

/** Complete review handoffs, then work in-progress board items before routing new scope. */
export function compareDispatchPriority(a:QueueItem,b:QueueItem){
 const rank=(item:QueueItem)=>item.state==='accept_ready'?0:item.state==='qa_ready'?1:item.state==='ready'&&item.taskStatus==='doing'?2:item.state==='ready'?3:item.state==='triage_ready'&&item.taskStatus==='doing'?4:item.state==='triage_ready'?5:6;
 return rank(a)-rank(b)||a.attempt-b.attempt||(a.taskOrder??Number.MAX_SAFE_INTEGER)-(b.taskOrder??Number.MAX_SAFE_INTEGER)||(a.stepOrder??Number.MAX_SAFE_INTEGER)-(b.stepOrder??Number.MAX_SAFE_INTEGER)||a.createdAt-b.createdAt;
}
