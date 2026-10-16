/** Root-maintained minimum evidence gate; independent native QA checks substance. */
import {readFile,lstat} from 'node:fs/promises';
import {resolve,join} from 'node:path';
const key=process.argv[2];
if(!/^[a-z][a-z0-9-]+\/[a-z][a-z0-9-]+$/.test(key??''))throw Error('Exact product item required');
const slug=key.replace(/[^a-zA-Z0-9-]/g,'-');
const paths={json:`docs/product-audits/${slug}.json`,report:`docs/product-audits/${slug}.md`,test:`scripts/product-audits/${slug}.cjs`},workspace=process.cwd();
for(const path of Object.values(paths)){const info=await lstat(resolve(workspace,path));if(!info.isFile()||info.isSymbolicLink())throw Error('Regular product evidence files required');}
const artifact=JSON.parse(await readFile(join(workspace,paths.json),'utf8'));
if(artifact.itemKey!==key||artifact.wholeStep!==true||typeof artifact.summary!=='string'||artifact.summary.length<40||!Array.isArray(artifact.sources)||!artifact.sources.length||!Array.isArray(artifact.limitations)||!Array.isArray(artifact.checks))throw Error('Complete product evidence manifest required');
if(!Number.isFinite(Date.parse(artifact.observedAt))&&!Number.isFinite(artifact.observedAt))throw Error('Evidence observation date required');
for(const source of artifact.sources){if(typeof source.url!=='string'||!source.url.length||typeof source.claim!=='string'||source.claim.length<10)throw Error('Every source must identify its supported claim');if(!/^https:\/\//.test(source.url)&&!/^((src|convex|scripts)\/)[^\0\r\n]+$/.test(source.url))throw Error('Source must be original HTTPS evidence or exact repository code path');}
if((await readFile(join(workspace,paths.report),'utf8')).length<300)throw Error('Inspectable product report required');
if((await readFile(join(workspace,paths.test),'utf8')).length<200)throw Error('Meaningful product checks required');
if(key==='communication-trends/label-uncertainty-and-archive-gaps'){
 const source=await readFile(join(workspace,'src/components/reference/IntelligenceWorkspace.tsx'),'utf8');
 const copy=source.split('gapNote:',2)[1]?.split('],',1)[0];
 if(!copy)throw Error('Gap wording must exist in product source');
 // Variable names do not prove behavior. Independent QA, the executable
 // regression and protected deployed browser gate enforce month/range cases.
 // Root found a real contradiction: a monthly gap can coexist with positive
 // lifetime posts and a fresh import. The translated message must allow that.
 const strings=[...copy.matchAll(/'((?:\\.|[^'\\])*)'/g)].map(m=>m[1]);
 if(strings.length!==3||!/(?:mes|per[ií]odo|selecci[oó]n|filtros|rango)/i.test(strings[0])||!/(?:month|period|selected|selection|filter|range)/i.test(strings[1])||!/(?:m[eê]s|per[ií]odo|sele[cç][aã]o|filtros|intervalo)/i.test(strings[2]))throw Error('Gap wording must describe the selected period in Spanish, English and Portuguese; it cannot imply zero lifetime posts or stale imports are the only causes');
}
console.log(JSON.stringify({itemKey:key,wholeStep:true,sourceCount:artifact.sources.length,limitations:artifact.limitations,minimumEvidenceGate:'passed; separate native QA remains mandatory'}));
