/* eslint-disable @typescript-eslint/no-require-imports -- This CommonJS harness evaluates transpiled Convex handlers in a VM. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const ts=require('typescript');
const moduleRef={exports:{}};
const validator=new Proxy({}, {get:()=>()=>({})});
const source=ts.transpileModule(fs.readFileSync('convex/dispatch.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
vm.runInNewContext(source,{module:moduleRef,exports:moduleRef.exports,Date,require:name=>{
 if(name==='./_generated/server')return {internalMutation:x=>x,internalQuery:x=>x,query:x=>x};
 if(name==='convex/values')return {v:validator};
 if(name==='./dispatchPriority')return {compareDispatchPriority:()=>0};
 throw Error(name);
}});
const claim=moduleRef.exports.claimNext.handler;
(async()=>{
 for(const smokeItemKey of [undefined,'continuous-agent-dispatch-20261009/dispatch-2','continuous-agent-dispatch-20261009/dispatch-3','continuous-agent-dispatch-20261009/dispatch-4','continuous-agent-dispatch-20261009/dispatch-5']){
  const ctx={db:{query:table=>{assert.equal(table,'projectLeadMonitor','Paused claims must not inspect or mutate the work queue');return {withIndex:()=>({unique:async()=>({dispatchPaused:true,pauseReason:{en:'Explicit pilot hold'}})})};},patch:()=>assert.fail('Paused claim must not mutate state')}};
  const result=await claim(ctx,{leaseId:'fixture-lease-123456',smokeItemKey});
  assert.equal(result.state,'paused');
 }
 const ctx={db:{query:table=>table==='projectLeadMonitor'?{withIndex:()=>({unique:async()=>({dispatchPaused:false})})}:{collect:async()=>table==='projectDispatchItems'?[{leaseUntil:Date.now()+10000}]:[]}}};
 assert.equal((await claim(ctx,{leaseId:'fixture-lease-123456'})).state,'busy');
 console.log('PASS manual/cost pauses apply to normal and smoke claims; active lease denies a second claim');
})().catch(error=>{console.error(error);process.exitCode=1;});
