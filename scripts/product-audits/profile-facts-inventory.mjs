import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
const rawPath='docs/product-audits/profile-facts-raw-observations.json';
const invPath='docs/product-audits/profile-facts-inventory.json';
const base='https://fleet-vole-527.convex.cloud/api/query';
const fields=['birthDate','birthPlace','citizenship','biography'];
const clean=v=>v==null||String(v).trim()===''?null:v;
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
// Only full, calendar-valid dates are normalized; partial precision stays distinct.
const months={enero:1,febrero:2,marzo:3,abril:4,mayo:5,junio:6,julio:7,agosto:8,septiembre:9,setiembre:9,octubre:10,noviembre:11,diciembre:12};
function canonicalDate(value){
 if(typeof value!=='string')return null;
 const s=value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim();
 let y,m,d,match;
 if((match=s.match(/^(\d{4})-(\d{2})-(\d{2})$/))){[,y,m,d]=match;}
 else if((match=s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/))){[,d,m,y]=match;}
 else if((match=s.replace(/\bde\b/g,' ').replace(/\//g,' ').replace(/\s+/g,' ').trim().match(/^(\d{1,2}) ([a-z]+) (\d{4})$/))){d=match[1];m=months[match[2]];y=match[3];}
 else return null;
 [y,m,d]=[y,m,d].map(Number);
 if(!m||!d||m>12||d>31||y<1000)return null;
 const date=new Date(Date.UTC(y,m-1,d));
 return date.getUTCFullYear()===y&&date.getUTCMonth()+1===m&&date.getUTCDate()===d?date.toISOString().slice(0,10):null;
}
function sameDate(a,b){const ca=canonicalDate(a),cb=canonicalDate(b);return ca&&cb?ca===cb:String(a).trim()===String(b).trim();}
function dateRegressionChecks(){
 for(const value of ['21 de abril de 1960','21/04/1960','21 abril 1960','21/abril/1960'])assert.equal(sameDate('1960-04-21',value),true);
 assert.equal(sameDate('1960-04-21','22 de abril de 1960'),false);
 assert.equal(sameDate('1960-04-21','21/04/1961'),false);
 assert.equal(sameDate('1960','1960-04-21'),false,'year precision must not become a full date');
 assert.equal(sameDate('1960-04','1960-04-21'),false,'month precision must remain distinct');
 assert.equal(canonicalDate('31/02/2000'),null);
 assert.equal(canonicalDate('29/02/2000'),'2000-02-29');
 assert.equal(canonicalDate('29/02/1900'),null);
}
dateRegressionChecks();
async function query(path,args={}){const r=await fetch(base,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({path,args,format:'json'})});if(!r.ok)throw Error(`${path}: HTTP ${r.status}`);const j=await r.json();if(j.status==='error')throw Error(`${path}: ${j.errorMessage}`);return j.value;}
function make(raw){const ids=raw.directory.map(p=>p.externalId);if(ids.length!==91||new Set(ids).size!==ids.length)throw Error(`expected 91 unique directory IDs, got ${ids.length}/${new Set(ids).size}`);
 const records=raw.directory.map(p=>{const f=raw.facts[p.externalId]||null,d=raw.dashboards[p.externalId]||null;const vals={birthDate:[clean(f?.birthDate),clean(d?.bio?.structuredData?.fechaNacimiento)],birthPlace:[clean(f?.birthPlace),null],citizenship:[clean(f?.citizenship),null],biography:[clean(d?.transparency?.biography),clean(f?.biography)]};const sources=f?.sources||[];const fieldsOut={};for(const field of fields){const [primary,fallback]=vals[field];const value=field==='biography'?(primary||fallback):field==='birthDate'?(primary||fallback):primary;const winningLayer=value==null?null:(field==='biography'&&primary?'dashboard.transparency':field==='birthDate'&&!primary&&fallback?'dashboard.bio.structuredData': 'politicianFacts');const sourceURLs=[...new Set(sources.filter(s=>s.field===field&&/^https?:\/\//i.test(s.url)).map(s=>s.url))];if(field==='biography'&&winningLayer==='dashboard.transparency'&&d?.transparency?.espacioCivicoUrl)sourceURLs.push(d.transparency.espacioCivicoUrl);const alternatives=[...new Set([primary,fallback].filter(x=>x!=null&&(field==='birthDate'?!sameDate(x,value):x!==value)))];let status=value==null?'missing':alternatives.length?'conflicting':sourceURLs.length?'sourced':'unsourced';let evidenceNote=null;if(p.externalId==='DEP-032'&&field==='birthPlace'){status='unsourced';evidenceNote='ELLAS reports that she grew up in Herrera; that supports childhood residence, not place of birth.';}if(p.externalId==='DEP-032'&&field==='citizenship'){status='unsourced';evidenceNote='Linked constitutional text describes general citizenship law and does not establish this person’s citizenship.';}fieldsOut[field]={value,sourceLayer:winningLayer,sourceURLs:[...new Set(sourceURLs)],status,alternativeConflictingStoredValues:alternatives,...(field==='birthDate'?{storedObservations:{politicianFacts:clean(f?.birthDate),dashboard:clean(d?.bio?.structuredData?.fechaNacimiento)}}:{}),...(evidenceNote?{evidenceNote}:{})};}return {externalId:p.externalId,name:p.name,fields:fieldsOut};});
 const totals={};for(const field of fields){totals[field]={missing:0,unsourced:0,sourced:0,conflicting:0};for(const r of records)totals[field][r.fields[field].status]++;}
 const rawText=fs.readFileSync(rawPath,'utf8');return {observedAt:raw.observedAt,total:records.length,uniqueIDs:ids.length,fieldTotals:totals,rawObservation:{file:rawPath,sha256:hash(rawText)},records};}
function fail(msg){console.error(msg);process.exitCode=1;}
if(process.argv.includes('--self-test')){console.log('Date regression checks passed: equivalent formats, different dates, partial precision, and calendar validity.');}else if(process.argv.includes('--verify')){try{const rawText=fs.readFileSync(rawPath,'utf8'),raw=JSON.parse(rawText),inv=JSON.parse(fs.readFileSync(invPath,'utf8')),expected=make(raw);if(inv.total!==91||inv.uniqueIDs!==91||inv.records.length!==91)throw Error('inventory totals are not 91');const ids=inv.records.map(x=>x.externalId);if(new Set(ids).size!==91)throw Error('duplicate inventory IDs');if(JSON.stringify([...ids].sort())!==JSON.stringify(raw.directory.map(x=>x.externalId).sort()))throw Error('inventory ID set differs from saved raw directory');if(JSON.stringify(inv.fieldTotals)!==JSON.stringify(expected.fieldTotals))throw Error('field totals mismatch raw observations');for(let i=0;i<91;i++)if(JSON.stringify(inv.records[i])!==JSON.stringify(expected.records[i]))throw Error(`record/provenance mismatch at ${inv.records[i]?.externalId}`);if(inv.rawObservation.sha256!==hash(rawText))throw Error('raw snapshot hash mismatch');const current=await query('politicians:list',{});const curIds=current.map(p=>p.externalId);if(curIds.length!==91||new Set(curIds).size!==91||JSON.stringify([...curIds].sort())!==JSON.stringify([...ids].sort()))throw Error('current public directory ID set differs');for(const p of current){const f=await query('politicianFacts:get',{politicianId:p._id});const d=p.roleCategory==='Deputy'?await query('voting:getDeputyDashboard',{politicianId:p._id}):null;if(JSON.stringify(f)!==JSON.stringify(raw.facts[p.externalId]||null))throw Error(`current facts differ from raw: ${p.externalId}`);if(p.roleCategory==='Deputy'&&JSON.stringify(d)!==JSON.stringify(raw.dashboards[p.externalId]||null))throw Error(`current dashboard differs from raw: ${p.externalId}`);}console.log('Verified 91 unique IDs, field counts, field precedence/provenance, raw hash, and current public observations.');}catch(e){fail(e.message);}}else{const raw=JSON.parse(fs.readFileSync(rawPath,'utf8'));const inv=make(raw);fs.writeFileSync(invPath,JSON.stringify(inv,null,2)+'\n');console.log(`Wrote ${invPath}`);}
