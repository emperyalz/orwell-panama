/** Isolated local inference screening only. This module cannot approve any release. */
import {spawn} from 'node:child_process';
import {createHash,randomUUID} from 'node:crypto';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

export const LOCAL_MODEL=Object.freeze({repository:'Qwen/Qwen2.5-Coder-3B-Instruct-GGUF',commit:'f74adce6aa16316c625447af059dbebe4983757c',file:'qwen2.5-coder-3b-instruct-q4_k_m.gguf',bytes:2104932800,sha256:'724fb256bec1ff062b2f65e4569e871ad2e95ab2a3989723d1769c54294730b7',runtime:'llama.cpp b11678',runtimeSha256:'16122345af3b1c7529ca1d22c36a858eb47e7d80f08a5a3ed3a1357878e55847'});
const digest=value=>createHash('sha256').update(value).digest('hex');
export function qualificationCases({archiveSource,scopeSource}){
 if(!archiveSource.includes('[person,platform,month,format].join')||!scopeSource.includes("path.endsWith('/')?file.startsWith(path):file===path"))throw Error('Canonical source changed; regenerate and independently review the fixtures');
 const archive=key=>`function examples(posts){const found=new Map();for(const post of posts){const person=post.person,platform=post.platform,month=post.date.slice(0,7),format=post.format;const key=${key};if(!found.has(key)||found.get(key).date<post.date)found.set(key,post);}return [...found.values()];}`;
 const paths=expression=>`function permits(file,allowed){return allowed.some(path=>${expression});}`;
 const archiveGood=archive("[person,platform,month,format].join(':')"),archiveBad=archive("[person,platform,format].join(':')"),pathGood=paths("path.endsWith('/')?file.startsWith(path):file===path"),pathBad=paths('file.startsWith(path)');
 return [
  {id:'case-01',category:'archive',sourceFile:'convex/intelligence.ts',sourceHash:digest(archiveSource),expected:'clean',code:archiveGood},
  {id:'case-02',category:'path',sourceFile:'scripts/orwell-pilot/product-release.mjs',sourceHash:digest(scopeSource),expected:'defect',code:pathBad},
  {id:'case-03',category:'archive',sourceFile:'convex/intelligence.ts',sourceHash:digest(archiveSource),expected:'defect',code:archiveBad},
  {id:'case-04',category:'path',sourceFile:'scripts/orwell-pilot/product-release.mjs',sourceHash:digest(scopeSource),expected:'clean',code:pathGood},
 ];
}
export function oracle(item){
 if(item.category==='archive'){
  const implementation=Function(`${item.code};return examples;`)();
  const records=[{person:'DEP-019',platform:'x_twitter',format:'image',date:'2013-05-29'},{person:'DEP-019',platform:'x_twitter',format:'image',date:'2026-10-06'}];
  return implementation(records).length===2?'clean':'defect';
 }
 const implementation=Function(`${item.code};return permits;`)();
 return !implementation('src/card.ts.backup',['src/card.ts'])&&implementation('docs/product-audits/facts.json',['docs/product-audits/'])?'clean':'defect';
}
export function reviewPrompt(item){
 const requirement=item.category==='archive'?'Preserve at least one example for every distinct person, platform, month and format containing posts. The UI later filters these examples to the selected month.':'An allowed path ending in slash permits files inside that directory. Every other allowed path permits only that exact file, never similarly named siblings.';
 return `Review the following JavaScript against this requirement only: ${requirement}\n${item.code}\nReturn JSON only: {"verdict":"clean" or "defect","reason":"specific code-backed explanation and one concrete example"}. Do not assume a defect exists. Do not discuss unrelated hypothetical improvements.\n`;
}
export function parseReview(output){
 const match=String(output).match(/\{[\s\S]*\}/);if(!match)throw Error('No complete JSON review');
 const answer=JSON.parse(match[0]);if(!['clean','defect'].includes(answer.verdict)||typeof answer.reason!=='string'||answer.reason.length<15)throw Error('Invalid code review answer');return answer;
}
export function summarizeScreening(records){
 const complete=records.length===4&&records.every(row=>row.code===0&&row.answer&&row.elapsedMs<=60000);
 const falseNegatives=records.filter(row=>row.expected==='defect'&&row.answer?.verdict==='clean').length;
 const falsePositives=records.filter(row=>row.expected==='clean'&&row.answer?.verdict==='defect').length;
 const grounded=records.every(row=>row.answer&&(row.category==='archive'?/month|period|2013|2026/i:/exact|prefix|sibling|backup|\.ts/i).test(row.answer.reason));
 return {state:complete&&!falseNegatives&&!falsePositives&&grounded?'passed_bounded_screening':'not_qualified',cases:records.length,correct:records.filter(row=>row.code===0&&row.answer?.verdict===row.expected).length,truePositives:records.filter(row=>row.code===0&&row.expected==='defect'&&row.answer?.verdict==='defect').length,trueNegatives:records.filter(row=>row.code===0&&row.expected==='clean'&&row.answer?.verdict==='clean').length,falseNegatives,falsePositives,noVerdict:records.filter(row=>!row.answer).length,failedRuns:records.filter(row=>row.code!==0).length,codeGroundingPassed:grounded,totalWallMs:records.reduce((sum,row)=>sum+row.elapsedMs,0),releaseAuthority:false,mayApprove:false,providerQaReplacement:false};
}
async function runCase(item,{root,artifactDir}){
 const promptPath=join(root,'cases',`${item.id}.txt`);await writeFile(promptPath,`<|im_start|>system\nYou review code carefully and return only the requested JSON.<|im_end|>\n<|im_start|>user\n${reviewPrompt(item)}<|im_end|>\n<|im_start|>assistant\n`,{mode:0o644});
 const unit=`orwell-local-review-${randomUUID()}`;
 const args=['--quiet','--wait','--pipe','--collect',`--unit=${unit}`,'--uid=orwell-local-reviewer','--property=CPUQuota=200%','--property=MemoryMax=5G','--property=TasksMax=24','--property=RuntimeMaxSec=60s','--property=NoNewPrivileges=yes','--property=PrivateNetwork=yes','--property=PrivateTmp=yes','--property=ProtectHome=yes','--property=ProtectSystem=strict','--property=InaccessiblePaths=-/etc/orwell-agent-controller -/var/lib/orwell-agent-controller -/etc/orwell-paperclip -/var/lib/orwell-paperclip','--setenv=HOME=/nonexistent','--setenv=PATH=/usr/bin:/bin','/usr/bin/timeout','--signal=TERM','--kill-after=2s','58s','/usr/bin/time','-f','LOCAL_PEAK_RSS_KIB=%M',join(root,'runtime/llama-b11678/llama-completion'),'-m',join(root,'models/qwen2.5-coder-3b-q4_k_m.gguf'),'--threads','2','--threads-batch','2','--ctx-size','2048','--predict','160','--temp','0','--seed','7','--no-conversation','--no-display-prompt','--simple-io','--no-warmup','--file',promptPath];
 const startedAt=Date.now();
 const result=await new Promise(resolveRun=>{
  const child=spawn('/usr/bin/systemd-run',args,{env:{PATH:'/usr/bin:/bin',LANG:'C.UTF-8'},stdio:['ignore','pipe','pipe']});let out='',err='';
  const watchdog=setTimeout(()=>child.kill('SIGTERM'),65000);
  child.stdout.on('data',data=>out+=data);child.stderr.on('data',data=>err+=data);child.on('error',error=>{clearTimeout(watchdog);resolveRun({code:null,out,err:error.message});});child.on('close',(code,signal)=>{clearTimeout(watchdog);resolveRun({code,signal,out,err});});
 });
 const record={id:item.id,category:item.category,expected:item.expected,oracle:oracle(item),code:result.code,signal:result.signal,elapsedMs:Date.now()-startedAt,peakRssKiB:Number(result.err.match(/LOCAL_PEAK_RSS_KIB=(\d+)/)?.[1])||null,sourceFile:item.sourceFile,sourceHash:item.sourceHash};
 try{record.answer=parseReview(result.out);}catch(error){record.parseError=error.message;}
 await writeFile(join(artifactDir,`${item.id}.stdout.txt`),result.out,{mode:0o600});await writeFile(join(artifactDir,`${item.id}.stderr.txt`),result.err,{mode:0o600});await writeFile(join(artifactDir,`${item.id}.json`),JSON.stringify(record,null,2),{mode:0o600});return record;
}
export async function qualifyLocalReviewer({workspace='/home/orwell/build',root='/opt/orwell-local-reviewer',artifactDir='/tmp/orwell-local-reviewer-qualification'}={}){
 if(process.getuid?.()!==0)throw Error('Trusted qualification harness must launch isolation as root');
 await mkdir(artifactDir,{recursive:true,mode:0o700});
 const items=qualificationCases({archiveSource:await readFile(join(workspace,'convex/intelligence.ts'),'utf8'),scopeSource:await readFile(join(workspace,'scripts/orwell-pilot/product-release.mjs'),'utf8')});
 for(const item of items)if(oracle(item)!==item.expected)throw Error('Fixture oracle mismatch');
 const records=[],startedAt=Date.now();
 for(const item of items){if(Date.now()-startedAt>=240000)break;records.push(await runCase(item,{root,artifactDir}));}
 const report={model:LOCAL_MODEL,isolation:{user:'orwell-local-reviewer',cpuLimit:2,memoryMax:'5G',network:false,providerCredentials:false,concurrency:1},...summarizeScreening(records),records};
 await writeFile(join(artifactDir,'result.json'),JSON.stringify(report,null,2),{mode:0o600});return report;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 if(process.argv[2]!=='--run')throw Error('Use --run only for the explicitly authorized bounded local qualification');
 console.log(JSON.stringify(await qualifyLocalReviewer(),null,2));
}
