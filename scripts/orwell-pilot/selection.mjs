/** Serialize edits to the shared checkout across the explicitly authorized backlog. */
export function selectAffinity({affinity,items,itemKeys,modelHeld=false}) {
 const allowed=new Set(itemKeys);
 const item=affinity&&items.find(i=>i.key===affinity.itemKey);
 if(affinity&&(!item||!['accepted','superseded'].includes(item.state))) {
  if(!allowed.has(affinity.itemKey))return {affinity,onlyItemKeys:[],state:'affinity_held',reason:'Saved workspace owner is outside the currently authorized backlog'};
  const eligible=item&&['ready','triage_ready','qa_ready','accept_ready'].includes(item.state)&&(!modelHeld||item.state==='accept_ready');
  return {affinity,onlyItemKeys:eligible?[affinity.itemKey]:[],state:eligible?'ready':'affinity_held',reason:item?.blockedReason??item?.state??'Pinned item missing from snapshot'};
 }
 const eligible=itemKeys.filter(key=>items.some(i=>i.key===key&&['ready','triage_ready','qa_ready','accept_ready'].includes(i.state)&&(!modelHeld||i.state==='accept_ready')));
 return {affinity:null,onlyItemKeys:eligible,state:eligible.length?'ready':'idle'};
}
