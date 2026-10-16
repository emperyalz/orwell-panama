import test from 'node:test';
import assert from 'node:assert/strict';
import {validatePreparationJobs} from './parallel-preparation.mjs';
const jobs=[{itemKey:'career/a',positionKey:'position:research-02',inputPaths:['src/a'],question:'Inspect sources'},{itemKey:'career/b',positionKey:'position:research-03',inputPaths:['src/b'],question:'Inspect tenure evidence'}],policy={itemKeys:['career/a','career/b']};
test('preparation limits actual authorized backlog to two distinct stable positions',()=>{
 assert.deepEqual(validatePreparationJobs(jobs,policy),jobs);
 assert.throws(()=>validatePreparationJobs([{...jobs[0],inputPaths:['../credentials.json']},jobs[1]],policy),/authorized/);
 assert.throws(()=>validatePreparationJobs([jobs[0]],policy),/Exactly two/);
 assert.throws(()=>validatePreparationJobs([jobs[0],{...jobs[1],itemKey:'unapproved'}],policy),/authorized/);
 assert.throws(()=>validatePreparationJobs([jobs[0],{...jobs[1],positionKey:jobs[0].positionKey}],policy),/collision/);
});
