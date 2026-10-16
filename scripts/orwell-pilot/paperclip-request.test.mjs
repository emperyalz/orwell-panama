import test from 'node:test';
import assert from 'node:assert/strict';
import {paperclipRequest} from './paperclip-request.mjs';
const now=1792120000000,key='profile-facts-audit/directory';
const request={requestId:'12345678-1234-4321-9876-123456789012',itemKey:key,role:'codex',requestedAt:now};
const routing=(role='codex',phase='work',patch={})=>({observedAt:now,items:{[key]:{role,phase,allowed:true}},...patch});
const run=(patch={},item={key,state:'ready'},route=routing())=>paperclipRequest({request:{...request,...patch},scope:{itemKeys:[key]},items:[item],routing:route,now});

test('Paperclip follows fresh root routing, scope, lease and retry gates',()=>{
 assert.equal(run().allowed,true);
 assert.equal(run({role:'claude'},{key,state:'ready'},routing('claude')).allowed,true);
 for(const [state,role]of [['qa_ready','claude'],['accept_ready','orion'],['triage_ready','orion']]){assert.equal(run({role},{key,state,workerProvider:'codex'},routing(role,state==='qa_ready'?'qa':'work')).allowed,true);assert.equal(run({role:'codex'},{key,state,workerProvider:'codex'},routing(role,'qa')).allowed,false);}
 for(const patch of [{itemKey:'other/step'},{role:'claude'},{requestedAt:now-120001},{requestedAt:now+5001},{requestId:'x'}])assert.equal(run(patch).allowed,false);
 for(const item of [{key,state:'accepted'},{key,state:'ready',retryAt:now+1},{key,state:'ready',leaseUntil:now+1}])assert.equal(run({},item).allowed,false);
 for(const route of [undefined,null,routing('codex','work',{observedAt:now-120001}),routing('codex','work',{observedAt:now+5001}),{observedAt:now,items:{}},routing('codex','qa')])assert.equal(paperclipRequest({request,scope:{itemKeys:[key]},items:[{key,state:'ready'}],routing:route,now}).allowed,false);
});

test('Claude authors receive Codex QA and repairs stay on the actual provider',()=>{
 assert.equal(run({role:'codex'},{key,state:'qa_ready',workerProvider:'claude'},routing('codex','qa')).allowed,true);
 assert.equal(run({role:'claude'},{key,state:'qa_ready',workerProvider:'claude'},routing('claude','qa')).allowed,false);
 assert.equal(run({role:'codex'},{key,state:'qa_ready'},routing('codex','qa')).allowed,false);
 assert.equal(run({role:'codex'},{key,state:'ready',workerProvider:'claude'},routing('codex')).allowed,false);
 assert.equal(run({role:'claude'},{key,state:'ready',workerProvider:'claude'},routing('claude')).allowed,true);
 const held=routing();held.items[key].allowed=false;held.items[key].reason='Reviewer headroom held';assert.equal(run({},undefined,held).allowed,false);
});

test('planner requests need explicit root scope authorization and never claim a product item',()=>{
 const input={request:{...request,itemKey:undefined,role:'planner'},scope:{itemKeys:[key],serverPlanning:true},items:[],now};
 assert.deepEqual(paperclipRequest(input),{allowed:true,role:'planner'});
 assert.equal(paperclipRequest({...input,scope:{itemKeys:[key]}}).allowed,false);
 assert.equal(paperclipRequest({...input,request:{...input.request,requestedAt:now-120001}}).allowed,false);
});


test('same-provider QA is allowed only by explicit root cross-model policy and distinct model routing',()=>{
 const item={key,state:'qa_ready',workerProvider:'claude',workerModel:'claude-sonnet-4-6'};
 const route=routing('claude','qa');Object.assign(route.items[key],{reviewMode:'claude-cross-model',model:'opus'});
 const input={request:{...request,role:'claude'},scope:{itemKeys:[key],reviewMode:'claude-cross-model'},policy:{reviewMode:'claude-cross-model'},items:[item],routing:route,now};
 assert.equal(paperclipRequest(input).allowed,true);
 for(const patch of [{model:'sonnet'},{model:undefined},{reviewMode:'cross-provider'},{role:'codex'}])assert.equal(paperclipRequest({...input,routing:{...route,items:{[key]:{...route.items[key],...patch}}}}).allowed,false);
 assert.equal(paperclipRequest({...input,items:[{...item,workerModel:'unknown'}]}).allowed,false);
 assert.equal(paperclipRequest({...input,policy:{},scope:{itemKeys:[key]}}).allowed,false);
 assert.equal(paperclipRequest({...input,policy:{}}).allowed,false);
 assert.equal(paperclipRequest({...input,policy:undefined}).allowed,true);
 const old={...item,workerProvider:'codex',workerModel:'gpt-6-luna'},oldRoute={...route,items:{[key]:{...route.items[key],model:'sonnet'}}};assert.equal(paperclipRequest({...input,items:[old],routing:oldRoute}).allowed,true);
});

test('explicit Claude-only policy permits recorded repair handover while strict legacy mode preserves provider pinning',()=>{
 const route=routing('claude','work');route.items[key].reviewMode='claude-cross-model';
 const input={request:{...request,role:'claude'},scope:{itemKeys:[key],reviewMode:'claude-cross-model'},policy:{reviewMode:'claude-cross-model'},items:[{key,state:'ready',workerProvider:'codex'}],routing:route,now};
 assert.equal(paperclipRequest(input).allowed,true);
 assert.equal(paperclipRequest({...input,policy:undefined,scope:{itemKeys:[key]}}).allowed,false);
});
