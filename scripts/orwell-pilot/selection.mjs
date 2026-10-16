/** Keep a shared dirty workspace on one item until acceptance or supersession. */
export function selectAffinity({affinity,items,itemKeys,modelHeld=false}) {
 const gate=items.find(i=>i.key==='subscription-agent-pilot-20261015/acceptance');
 if(gate&&!['accepted','superseded'].includes(gate.state)&&affinity&&affinity.itemKey!==gate.key&&!items.some(i=>i.key===affinity.itemKey&&['accepted','superseded'].includes(i.state)))return {affinity,onlyItemKeys:[],state:'affinity_held',reason:'Existing workspace owner held; acceptance repair must pass before other candidates'};
 const item=affinity&&items.find(i=>i.key===affinity.itemKey);
 if(affinity&&(!item||!['accepted','superseded'].includes(item.state))) {
  const eligible=item&&['ready','triage_ready','qa_ready','accept_ready'].includes(item.state)&&(!modelHeld||item.state==='accept_ready');
  return {affinity,onlyItemKeys:eligible?[affinity.itemKey]:[],state:eligible?'ready':'affinity_held',reason:item?.blockedReason??item?.state??'Pinned item missing from snapshot'};
 }
 // The acceptance repair must be released before any other candidate.
 if(gate&&!['accepted','superseded'].includes(gate.state))return selectAffinity({affinity:{itemKey:gate.key},items,itemKeys,modelHeld});
 return {affinity:null,onlyItemKeys:itemKeys.filter(key=>!modelHeld||items.some(i=>i.key===key&&i.state==='accept_ready')),state:'ready'};
}
