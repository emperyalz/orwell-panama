import test from 'node:test';
import assert from 'node:assert/strict';
import {paperclipRequest} from './paperclip-request.mjs';
const now=1792120000000,key='profile-facts-audit/directory';
const run=(patch={},item={key,state:'ready'})=>paperclipRequest({request:{requestId:'12345678-1234-4321-9876-123456789012',itemKey:key,role:'codex',requestedAt:now,...patch},scope:{itemKeys:[key]},items:[item],now});
test('Paperclip cannot cross the QA boundary, scope, lease or retry gates',()=>{
 assert.equal(run().allowed,true);
 for(const [state,role]of [['qa_ready','claude'],['accept_ready','orion'],['triage_ready','orion']]){assert.equal(run({role},{key,state}).allowed,true);assert.equal(run({role:'codex'},{key,state}).allowed,false);}
 for(const patch of [{itemKey:'other/step'},{role:'claude'},{requestedAt:now-120001},{requestedAt:now+5001},{requestId:'x'}])assert.equal(run(patch).allowed,false);
 for(const item of [{key,state:'accepted'},{key,state:'ready',retryAt:now+1},{key,state:'ready',leaseUntil:now+1}])assert.equal(run({},item).allowed,false);
});
