/** Paperclip requests one authorized phase; it cannot widen scope or budget. */
export function paperclipRequest({request,scope,items,routing,now=Date.now()}){
 const deny=reason=>({allowed:false,reason});
 if(!request||typeof request.requestId!=='string'||!/^[a-zA-Z0-9-]{16,100}$/.test(request.requestId)||!Number.isFinite(request.requestedAt)||request.requestedAt>now+5000||now-request.requestedAt>120000)return deny('Waiting for a fresh Paperclip assignment');
 // Planning is a separate root-controlled action. It grants no product lease,
 // no new writable scope and no relaxation of the independent-review gates.
 if(request.role==='planner')return scope.serverPlanning===true?{allowed:true,role:'planner'}:deny('Server planning is not authorized');
 if(!scope.itemKeys.includes(request.itemKey))return deny('Paperclip item is outside authorized product scope');
 const item=items.find(i=>i.key===request.itemKey);
 if(!item||!['ready','triage_ready','qa_ready','accept_ready'].includes(item.state)||item.leaseUntil>now||item.retryAt>now)return deny('Requested phase is not ready or its retry is pending');
 const phase=item.state==='qa_ready'?'qa':item.state==='accept_ready'?'accept':item.state==='triage_ready'||item.lead==='Orion'?'triage':'work';
 let role;
 if(phase==='work'||phase==='qa'){
  if(!routing||!Number.isFinite(routing.observedAt)||routing.observedAt>now+5000||now-routing.observedAt>120000)return deny('Waiting for fresh controller provider routing');
  const row=routing.items?.[item.key];
  if(!row?.allowed||row.phase!==phase||!['codex','claude'].includes(row.role))return deny(row?.reason??'Controller has not admitted this provider phase');
  role=row.role;
  if(phase==='qa'&&(!['codex','claude'].includes(item.workerProvider)||role===item.workerProvider))return deny('QA must use the opposite actual worker provider');
  if(phase==='work'&&item.workerProvider&&role!==item.workerProvider)return deny('Repair must stay with its actual worker provider');
 }else role='orion';
 if(request.role!==role)return deny('Paperclip role does not match the independent workflow phase');
 return {allowed:true,itemKey:item.key,role};
}
