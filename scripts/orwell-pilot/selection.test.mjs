import test from 'node:test';
import assert from 'node:assert/strict';
import {selectAffinity} from './selection.mjs';
const key='subscription-agent-pilot-20261015/acceptance';
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
test('acceptance repair is selected before any other candidate even without saved affinity',()=>{
 assert.deepEqual(select('ready',{affinity:null}).onlyItemKeys,[key]);
 assert.deepEqual(select('blocked',{affinity:null}).onlyItemKeys,[]);
});

test('a different existing dirty owner cannot bypass acceptance repair or be silently replaced',()=>{const result=select('ready',{affinity:{itemKey:'other'}});assert.deepEqual(result.onlyItemKeys,[]);assert.equal(result.affinity.itemKey,'other');});
