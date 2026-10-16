/** Validate destinations without creating activity, then launch only after validation. */
export function validateNativeActivityScope({job,authorizedItems=[],tasks=[],positions=[],opsPolicy}){
 const positionId=job?.positionKey?.replace(/^position:/,'');if(!job?.positionKey?.startsWith('position:')||!positions.some(p=>p.positionId===positionId))throw Error('Unknown native roster position before inference');
 if(job.activityNamespace==='ops'){
  if(!job.itemKey?.startsWith('ops/')||job.originalItemKeys?.length||!opsPolicy?.itemKeys?.includes(job.itemKey)||!opsPolicy?.positionKeys?.includes(job.positionKey))throw Error('Unapproved ops namespace before inference');
  return {namespace:'ops',binding:null};
 }
 if(job.activityNamespace&&job.activityNamespace!=='product-preparation')throw Error('Unknown native activity namespace before inference');
 const keys=job.originalItemKeys??[job.itemKey];if(!keys.length||new Set(keys).size!==keys.length)throw Error('Invalid product binding before inference');
 for(const key of keys){if(!authorizedItems.includes(key)||!/^[-a-z0-9]+\/[-a-z0-9]+$/.test(key))throw Error('Unauthorized product binding before inference');const [taskKey,stepKey]=key.split('/'),task=tasks.find(t=>t.key===taskKey);if(!task||['done','superseded'].includes(task.status)||!task.checklist?.some(s=>s.key===stepKey&&!s.done))throw Error('Product binding must identify an open task and step before inference');}
 if(job.itemKey!==keys[0]&&!/^preparation-batch\/[a-f0-9-]{36}$/.test(job.itemKey))throw Error('Invalid preparation batch namespace before inference');
 const [taskKey,stepKey]=keys[0].split('/');return {namespace:'product-preparation',binding:{taskKey,stepKey,rosterKey:job.positionKey},originalItemKeys:keys};
}
export async function launchValidatedNative({preflight,launch}){const activity=await preflight();return {activity,child:launch(activity)};}
