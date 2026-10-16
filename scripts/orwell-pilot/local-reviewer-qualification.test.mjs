import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {qualificationCases,oracle,reviewPrompt,parseReview,summarizeScreening} from './local-reviewer-qualification.mjs';
const source=async()=>({archiveSource:await readFile(new URL('../../convex/intelligence.ts',import.meta.url),'utf8'),scopeSource:await readFile(new URL('./product-release.mjs',import.meta.url),'utf8')});
test('real source-backed controls and mutations have independent executable ground truth',async()=>{
 const cases=qualificationCases(await source());assert.equal(cases.length,4);assert.equal(cases.filter(row=>row.expected==='defect').length,2);
 for(const item of cases){assert.equal(oracle(item),item.expected);assert.match(item.sourceHash,/^[a-f0-9]{64}$/);assert.equal(reviewPrompt(item).includes(`"expected":"${item.expected}"`),false);}
});
test('changed canonical code requires explicit fixture review rather than silently using stale fixtures',()=>{
 assert.throws(()=>qualificationCases({archiveSource:'unrelated',scopeSource:'unrelated'}),/Canonical source changed/);
});
test('malformed or empty output cannot pass; false positives/negatives remain visible with zero release authority',async()=>{
 for(const text of ['', '{}','{"verdict":"approved","reason":"nothing"}'])assert.throws(()=>parseReview(text));
 const records=qualificationCases(await source()).map(item=>({...item,elapsedMs:1000,code:0,answer:{verdict:item.expected,reason:item.category==='archive'?'The key retains distinct month values.':'An exact filename comparison protects sibling prefixes.'}}));
 assert.equal(summarizeScreening(records).state,'passed_bounded_screening');assert.equal(summarizeScreening(records).mayApprove,false);
 records[1].answer.verdict='clean';records[3].answer.verdict='defect';const result=summarizeScreening(records);assert.equal(result.state,'not_qualified');assert.equal(result.falseNegatives,1);assert.equal(result.falsePositives,1);assert.equal(result.providerQaReplacement,false);
 records[0].code=124;assert.equal(summarizeScreening(records).state,'not_qualified');
 const missing=records.map(row=>({...row,code:0,answer:undefined}));const absent=summarizeScreening(missing);assert.equal(absent.noVerdict,4);assert.equal(absent.falsePositives,0);assert.equal(absent.falseNegatives,0);assert.equal(absent.state,'not_qualified');
});
