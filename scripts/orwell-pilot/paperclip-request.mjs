/** Paperclip may request one authorized phase; it cannot widen scope or budget. */
export function paperclipRequest({request,scope,items,now=Date.now()}){
 const deny=reason=>({allowed:false,reason});
 if(!request||typeof request.requestId!=='string'||!/^[a-zA-Z0-9-]{16,100}$/.test(request.requestId)||!Number.isFinite(request.requestedAt)||request.requestedAt>now+5000||now-request.requestedAt>120000)return deny('Waiting for a fresh Paperclip assignment');
 if(!scope.itemKeys.includes(request.itemKey))return deny('Paperclip item is outside authorized product scope');
 const item=items.find(i=>i.key===request.itemKey);
 if(!item||!['ready','triage_ready','qa_ready','accept_ready'].includes(item.state)||item.leaseUntil>now||item.retryAt>now)return deny('Requested phase is not ready or its retry is pending');
 const role=item.state==='qa_ready'?'claude':item.state==='accept_ready'||item.state==='triage_ready'?'orion':'codex';
 if(request.role!==role)return deny('Paperclip role does not match the independent workflow phase');
 return {allowed:true,itemKey:item.key,role};
}
