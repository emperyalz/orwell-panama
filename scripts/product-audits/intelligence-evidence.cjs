/* eslint-disable @typescript-eslint/no-require-imports -- Evaluate the actual Convex query handler in a VM. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const ts=require('typescript');
const base='https://fleet-vole-527.convex.cloud/api/query';
const moduleRef={exports:{}};
const exportsRef=moduleRef.exports;
const source=ts.transpileModule(fs.readFileSync('convex/intelligence.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
vm.runInNewContext(source,{module:moduleRef,exports:exportsRef,Date,Map,Promise,String,Number,Math,RegExp,Error,require:name=>{
 if(name==='./_generated/server')return {query:x=>({handler:x.handler})};
 throw Error(`Unexpected import ${name}`);
}});
const archive=exportsRef.archive;
const post=(id,platform,date,format='unspecified',suffix='')=>({politicianId:id,platform,publishedAt:Date.parse(`${date}T12:00:00Z`),sourceUrl:format==='short'?`https://tiktok.com/@p/video/${suffix||date.replaceAll('-','')}`:`https://example.org/${suffix||date}`,title:`${id} ${date}`,mediaKind:format==='video'?'video':format==='image'?'image':undefined,kind:'social'});
const fixture=[
 post('p1','x_twitter','2024-01-03','image','jan-old'),post('p1','x_twitter','2024-01-28','image','jan-latest'),
 post('p1','x_twitter','2024-02-04','image','feb-old'),post('p1','x_twitter','2024-02-27','image','feb-latest'),
 post('p2','instagram','2024-01-15','video','other-person'),post('p1','instagram','2024-01-20','short','other-platform'),
 post('p1','x_twitter','invalid','image','invalid-date'),
];
function context(posts){return {db:{query(table){const baseQuery={filter(){return {collect:async()=>posts}},collect:async()=>table==='activity'?posts:table==='politicians'?[{_id:'p1',externalId:'one',name:'One'},{_id:'p2',externalId:'two',name:'Two'}]:table==='accounts'?[]:[],withIndex(){return {order(){return {take:async()=>[],first:async()=>null}}}},order(){return {take:async()=>[],first:async()=>null}}};return baseQuery;}}};}
function bucketKey(row){return [row.person,row.platform,row.month,row.format].join('|');}
function assertContract(result){
 assert.deepEqual(Object.keys(result).sort(),['accounts','buckets','examples','lastSocialImport','people','runs'].sort());
 assert.equal(result.buckets.some(row=>row.month==='2024-01'&&row.person==='p1'&&row.platform==='x_twitter'&&row.format==='image'&&row.count===2),true);
 assert.equal(result.examples.filter(row=>row.person==='p1'&&row.platform==='x_twitter'&&row.format==='image').length,2,'same person/platform/format must retain multiple months');
 assert.equal(result.examples.find(row=>row.person==='p1'&&row.platform==='x_twitter'&&row.date===Date.parse('2024-01-28T12:00:00Z'))?.url,'https://example.org/jan-latest');
 assert.equal(result.examples.find(row=>row.person==='p1'&&row.platform==='x_twitter'&&row.date===Date.parse('2024-02-27T12:00:00Z'))?.url,'https://example.org/feb-latest');
 assert.equal(result.examples.some(row=>row.person==='p2'&&row.platform==='instagram'),true);
 assert.equal(result.examples.some(row=>row.person==='p1'&&row.platform==='instagram'&&row.format==='short'),true);
 assert.equal(result.buckets.every(row=>row.month!=='NaN-NaN'),true);
 for(const example of result.examples)assert.equal(Number.isFinite(example.date),true);
 // Mirror the frontend's person/platform/month filters, then require matching dated evidence.
 const filtered=result.examples.filter(e=>e.person==='p1'&&e.platform==='x_twitter'&&new Date(e.date).toISOString().slice(0,7)>='2024-01'&&new Date(e.date).toISOString().slice(0,7)<='2024-01');
 assert.equal(filtered.length,1,'January filter must retain January supporting card');
 assert.equal(new Date(filtered[0].date).toISOString().slice(0,7),'2024-01');
}
async function queryPublic(){const r=await fetch(base,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({path:'intelligence:archive',args:{},format:'json'})});if(!r.ok)throw Error(`intelligence:archive HTTP ${r.status}`);const j=await r.json();if(j.status==='error')throw Error(j.errorMessage);return j.value;}
function validateLive(result){
 const examples=new Map();for(const e of result.examples){
  assert.equal(typeof e.person,'string','example person');assert.equal(typeof e.platform,'string','example platform');
  assert.equal(Number.isFinite(e.date),true,`invalid timestamp: ${JSON.stringify(e)}`);
  assert.equal(typeof e.url,'string',`missing URL: ${JSON.stringify(e)}`);assert.match(e.url,/^https?:\/\//i,`invalid URL: ${e.url}`);
  const month=new Date(e.date).toISOString().slice(0,7);const key=[e.person,e.platform,month,e.format].join('|');
  assert.equal(result.buckets.some(b=>bucketKey(b)===key&&e.date<=b.latest),true,`example does not match a bucket: ${key}`);
  examples.set(key,(examples.get(key)||0)+1);
 }
 for(const b of result.buckets){if(b.count<=0)continue;const key=bucketKey(b);assert.ok(examples.get(key),`nonzero bucket has no dated example: ${key}`);}
}
(async()=>{
 const local=await archive.handler(context(fixture));assertContract(local);
 const empty=await archive.handler(context([]));assert.equal(empty.buckets.length,0);assert.equal(empty.examples.length,0);assert.deepEqual(empty.people.map(p=>p.id),['p1','p2']);
 assert.equal(empty.accounts.length,0);assert.equal(empty.lastSocialImport,null);
 console.log('PASS handler regression: month buckets, latest representatives, cross-person/platform, invalid date exclusion, date filtering, and empty archive');
 if(process.argv.includes('--live')){const live=await queryPublic();validateLive(live);console.log(`PASS public intelligence:archive: ${live.buckets.length} buckets, ${live.examples.length} dated examples; every nonzero bucket represented with valid URL/timestamp`);}
})().catch(error=>{console.error(error);process.exitCode=1;});
