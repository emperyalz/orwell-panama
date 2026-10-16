import test from 'node:test';
import assert from 'node:assert/strict';
import {classifyFailure,retryDecision} from './retry-policy.mjs';
test('capacity holds never cause provider fallback; repeated capacity failure blocks',()=>{
 assert.equal(classifyFailure('codex held: Provider allowance reserve reached'),'capacity');
 assert.deepEqual(retryDecision({failureCounts:{},failureClass:'capacity'}),{failureClass:'capacity',count:1,blocked:false,model:null});
 assert.equal(retryDecision({failureCounts:{capacity:1},failureClass:'capacity'}).blocked,true);
});
test('one model failure escalates once, then visibly blocks same failure class',()=>{
 assert.deepEqual(retryDecision({failureCounts:{},failureClass:'model'}),{failureClass:'model',count:1,blocked:false,model:'gpt-6.1-sol'});
 assert.equal(retryDecision({failureCounts:{model:1},failureClass:'model'}).blocked,true);
});
test('independent execution failures have a separate finite counter',()=>{
 assert.equal(retryDecision({failureCounts:{model:1},failureClass:'execution'}).blocked,false);
});
