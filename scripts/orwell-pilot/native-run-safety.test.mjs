import test from 'node:test';import assert from 'node:assert/strict';import {EventEmitter} from 'node:events';import {PassThrough} from 'node:stream';import {mkdtemp,mkdir,readdir,readFile,rm} from 'node:fs/promises';import {join} from 'node:path';import {tmpdir} from 'node:os';
import {validateNativeActivityScope} from './native-run-safety.mjs';import {run} from './parallel-preparation.mjs';
const job={itemKey:'career-history/document-tenure-dates',positionKey:'position:research-03'},input={job,authorizedItems:[job.itemKey],tasks:[{key:'career-history',status:'in_progress',checklist:[{key:'document-tenure-dates',done:false}]}],positions:[{positionId:'research-03'}]};
test('preflight rejects bad or completed product bindings and requires explicitly approved ops namespace',()=>{
 assert.equal(validateNativeActivityScope(input).binding.stepKey,'document-tenure-dates');
 assert.throws(()=>validateNativeActivityScope({...input,job:{...job,itemKey:'ops/public-operations-qa'}}),/Unauthorized/);
 assert.throws(()=>validateNativeActivityScope({...input,tasks:[{...input.tasks[0],status:'done'}]}),/open task/);
 const ops={...job,itemKey:'ops/public-operations-qa',activityNamespace:'ops'};
 assert.throws(()=>validateNativeActivityScope({...input,job:ops}),/Unapproved ops/);
 const scope=validateNativeActivityScope({...input,job:ops,opsPolicy:{itemKeys:[ops.itemKey],positionKeys:[ops.positionKey]}});assert.equal(scope.namespace,'ops');assert.equal(scope.binding,null);
});
test('invalid destination prevents admission, execution markers and native inference',async()=>{
 let spawns=0,admissions=0;await assert.rejects(run({job,cwd:'/tmp',model:'sonnet',phase:'qa',prompt:'test',batchId:'test'},{preflight:async()=>validateNativeActivityScope({...input,job:{...job,itemKey:'ops/unapproved'}}),admission:async()=>{admissions++;},spawn:()=>{spawns++;}}),/Unauthorized/);assert.equal(spawns,0);assert.equal(admissions,0);
});
function fakeNative(){const child=new EventEmitter();child.stdout=new PassThrough();child.stderr=new PassThrough();child.stdin=new PassThrough();child.pid=999999;child.stdin.on('finish',()=>{setImmediate(()=>{child.stdout.write(JSON.stringify({type:'system',subtype:'init',session_id:'actual-test-session',model:'claude-sonnet-5'})+'\n');setTimeout(()=>{child.stdout.write(JSON.stringify({type:'result',is_error:false,result:'candidate that must not be submitted',usage:{input_tokens:23,cache_creation_input_tokens:4,cache_read_input_tokens:5,output_tokens:7}})+'\n');child.emit('close',0);},20);});});return child;}
test('post-start telemetry failure drains native final usage, quarantines output and rejects submission',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'orwell-native-safety-'));await mkdir(join(directory,'runs'));let spawns=0,kills=0,events=0;
 try{await assert.rejects(run({job,cwd:directory,model:'sonnet',phase:'research',prompt:'test',batchId:'test'},{stateDir:directory,preflight:async()=>validateNativeActivityScope(input),admission:async()=>{},spawn:()=>{spawns++;return fakeNative();},kill:()=>{kills++;},observe:async()=>{events++;throw Error('backend binding changed after startup');}}),/Telemetry failure/);
 const [id]=await readdir(join(directory,'runs')),receipt=JSON.parse(await readFile(join(directory,'runs',id,'receipt.json'),'utf8')),quarantine=JSON.parse(await readFile(join(directory,'runs',id,'quarantined-output.json'),'utf8'));
 assert.equal(spawns,1);assert.equal(kills,0);assert.equal(events,1);assert.equal(receipt.sessionId,'actual-test-session');assert.equal(receipt.usagePersisted,true);assert.equal(receipt.usage.total_tokens,39);assert.equal(receipt.outputQuarantined,true);assert.equal(receipt.answer,undefined);assert.equal(receipt.finish.state,'preparation_failed');assert.equal(receipt.finish.productAccepted,false);assert.equal(quarantine.answer,'candidate that must not be submitted');
 }finally{await rm(directory,{recursive:true,force:true});}
});
test('budget watchdog still stops a native run and retains unknown usage as unpersisted',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'orwell-native-budget-'));await mkdir(join(directory,'runs'));let admissions=0,kills=0;
 try{await assert.rejects(run({job,cwd:directory,model:'sonnet',phase:'research',prompt:'test',batchId:'test'},{stateDir:directory,preflight:async()=>validateNativeActivityScope(input),admission:async()=>{if(++admissions>1)throw Error('original native reserve reached');},spawn:fakeNative,watchdogMs:2,kill:child=>{kills++;child.emit('close',143);},observe:async()=>{}}),/original native reserve reached/);
 const [id]=await readdir(join(directory,'runs')),receipt=JSON.parse(await readFile(join(directory,'runs',id,'receipt.json'),'utf8'));assert.equal(kills,1);assert.equal(receipt.usagePersisted,false);assert.equal(receipt.usage,undefined);assert.equal(receipt.finish.productAccepted,false);assert.equal(receipt.finish.state,'preparation_failed');
 }finally{await rm(directory,{recursive:true,force:true});}
});
