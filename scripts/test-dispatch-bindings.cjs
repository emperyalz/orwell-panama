/* eslint-disable @typescript-eslint/no-require-imports -- This CommonJS VM harness intentionally loads Node fixtures with require. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {EventEmitter}=require('node:events');
const source=fs.readFileSync('scripts/orwell-dispatcher.mjs','utf8');
const executeSource=source.slice(source.indexOf('async function execute(job)'),source.indexOf('\nasync function cycle('));
let helpers,receiptHelpers;
async function scenario(failRecord=false){
 const calls=[];let concurrent=0,maxConcurrent=0;
 const context={...helpers,...receiptHelpers,writeAtomicJson:async()=>{},join:require('node:path').join,base:'/tmp/fixture',repo:'.',mkdir:async()=>{},writeFile:async()=>{},readFile:async()=>JSON.stringify({result:'submitted',detail:'Checked',evidence:'fixture',team:'implementation'}),schema:{properties:{result:{enum:['submitted','failed']}}},member:()=>({key:'roster-lin',name:'Lin'}),prompt:()=>'',oneLine:String,process:{stderr:{write:()=>{}}},Date,setInterval,clearInterval,setTimeout,clearTimeout,activeChild:null,
 spawn:(_command,args,options)=>{assert.equal(args[args.indexOf('--sandbox')+1],'workspace-write');assert.ok(args.includes('forced_login_method="chatgpt"'));assert.ok(!options.env.CODEX_API_KEY);const child=new EventEmitter();child.stdout=new EventEmitter();child.stderr=new EventEmitter();child.stdin={on:()=>{},end:()=>setTimeout(()=>{for(const event of [{type:'thread.started',thread_id:'actual-session'},{type:'item.completed',item:{type:'command_execution'}},{type:'turn.completed',usage:{input_tokens:100,cached_input_tokens:80,output_tokens:5}}])child.stdout.emit('data',JSON.stringify(event)+'\n');child.emit('close',0,null);},0)};child.kill=()=>{};return child;},
 convex:async(name,args)=>{concurrent++;maxConcurrent=Math.max(maxConcurrent,concurrent);await new Promise(r=>setTimeout(r,2));calls.push({name,args});concurrent--;if(failRecord&&name==='agentActivity:record')throw Error('fixture write denied');return {state:'qa_ready'};}};
 vm.createContext(context);vm.runInContext(executeSource+'\nthis.execute=execute;',context);
 await context.execute({leaseId:'lease-fixture',phase:'work',item:{key:'task/step',taskKey:'task',stepKey:'step',label:'Binding',lead:'Rowan',team:'implementation',attempt:0}});
 assert.equal(maxConcurrent,1,'event persistence must be serialized');
 const records=calls.filter(c=>c.name==='agentActivity:record');assert.deepEqual(records.map(c=>c.args.kind),['assigned','progress','completed']);
 for(const {args} of records){assert.equal(args.key,'actual-session');assert.equal(args.binding.rosterKey,'roster-lin');assert.equal(args.binding.taskKey,'task');assert.equal(args.binding.stepKey,'step');assert.equal(args.model,'gpt-6-luna');assert.equal(args.reasoning,'low');assert.ok(args.binding.observedAt<=args.lastActivityAt);}
 assert.equal(calls.at(-1).name,'dispatch:finish');assert.equal(calls.at(-1).args.result,failRecord?'failed':'submitted');
 assert.ok(!calls.some(c=>c.name==='dispatch:renewLease'),'fixture emits no timer-based activity');
}
(async()=>{helpers=await import('./orwell-pilot/budget.mjs');receiptHelpers=await import('./orwell-pilot/receipts.mjs');await scenario();await scenario(true);console.log('PASS runner start/progress/end ordering, actual session/roster separation, subscription execution, normalized usage, failed telemetry prevents submission');})().catch(e=>{console.error(e);process.exitCode=1;});
