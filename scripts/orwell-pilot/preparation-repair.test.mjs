import test from 'node:test';import assert from 'node:assert/strict';
import {exactPreparationDecision} from './preparation-repair.mjs';
test('fresh preparation QA needs an exact task verdict, never prose inference',()=>{
 const key='career-history/document-tenure-dates';
 assert.equal(exactPreparationDecision('accepted',key),null);
 assert.equal(exactPreparationDecision(JSON.stringify({itemKey:'wrong',result:'accepted',detail:'checked'}),key),null);
 assert.equal(exactPreparationDecision(JSON.stringify({itemKey:key,result:'accepted',detail:''}),key),null);
 assert.equal(exactPreparationDecision(JSON.stringify({itemKey:key,result:'accepted',detail:'actual7explicitkeys+6fallbacks verified'}),key).result,'accepted');
 assert.equal(exactPreparationDecision(JSON.stringify({itemKey:key,result:'changes_requested',detail:'actual contradiction remains'}),key).result,'changes_requested');
});
