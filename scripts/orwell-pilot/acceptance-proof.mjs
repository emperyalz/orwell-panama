import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
export const digest=bytes=>'sha256:'+createHash('sha256').update(bytes).digest('hex');
/** Read back saved records; never manufacture passing checks from prose. */
export async function acceptanceProof({checksPath,deploymentPath,itemKey,leaseId,revision}) {
 const checksBytes=await readFile(checksPath),deploymentBytes=await readFile(deploymentPath);
 const checks=JSON.parse(checksBytes),deployment=JSON.parse(deploymentBytes);
 for(const record of [checks,deployment])if(record.itemKey!==itemKey||record.leaseId!==leaseId||record.revision!==revision)throw Error('Acceptance record identity/revision mismatch');
 if(!Array.isArray(checks.commands)||checks.commands.length!==6||checks.commands.some(c=>c.code!==0)||deployment.code!==0||!deployment.deployment?.startsWith('https://'))throw Error('Acceptance requires actual successful checks and deployment');
 return {itemKey,leaseId,revision,checksHash:digest(checksBytes),deploymentHash:digest(deploymentBytes),deploymentUrl:deployment.deployment,checks:checks.commands.map(c=>({name:c.name,code:c.code}))};
}
