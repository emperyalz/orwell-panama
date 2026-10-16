import test from 'node:test';
import assert from 'node:assert/strict';
import {selectAffinity} from './selection.mjs';
const key='continuous-agent-dispatch-20261009/dispatch-2';
const select=(state,extra={})=>selectAffinity({affinity:{itemKey:key},items:[{key,state},{key:'other',state:'ready'}],itemKeys:['other',key],...extra});
test('affinity survives work, rejection, repair and acceptance queue without selecting other dirty edits',()=>{
 for(const state of ['ready','qa_ready','accept_ready'])assert.deepEqual(select(state).onlyItemKeys,[key]);
 for(const state of ['running','qa_running','blocked']){assert.deepEqual(select(state).onlyItemKeys,[]);assert.equal(select(state).affinity.itemKey,key);}
 assert.deepEqual(select('ready',{modelHeld:true}).onlyItemKeys,[]);
 assert.deepEqual(select('accept_ready',{modelHeld:true}).onlyItemKeys,[key]);
});
test('only acceptance or supersession clears affinity; missing item holds visibly',()=>{
 for(const state of ['accepted','superseded'])assert.equal(select(state).affinity,null);
 assert.equal(select('blocked').state,'affinity_held');
 assert.equal(select('ready',{items:[]}).state,'affinity_held');
});
test('authorized backlog items are selected without a pilot acceptance gate',()=>{
 const items=[{key:'continuous-agent-dispatch-20261009/dispatch-2',state:'ready'},{key:'continuous-agent-dispatch-20261009/dispatch-3',state:'qa_ready'},{key:'out-of-scope/step',state:'ready'}];
 assert.deepEqual(selectAffinity({affinity:null,items,itemKeys:[items[0].key,items[1].key]}).onlyItemKeys,[items[0].key,items[1].key]);
 assert.deepEqual(selectAffinity({affinity:null,items,itemKeys:[items[0].key],modelHeld:true}).onlyItemKeys,[]);
});

test('a different authorized dirty owner stays pinned and out-of-scope ownership holds visibly',()=>{
 const result=select('ready',{affinity:{itemKey:'other'}});assert.deepEqual(result.onlyItemKeys,['other']);assert.equal(result.affinity.itemKey,'other');
 const out=selectAffinity({affinity:{itemKey:'outside/step'},items:[{key:'outside/step',state:'ready'}],itemKeys:[key]});assert.deepEqual(out.onlyItemKeys,[]);assert.equal(out.state,'affinity_held');
});
