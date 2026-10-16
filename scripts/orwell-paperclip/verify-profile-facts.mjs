import fs from 'node:fs';
import assert from 'node:assert/strict';
const months={enero:1,febrero:2,marzo:3,abril:4,mayo:5,junio:6,julio:7,agosto:8,septiembre:9,setiembre:9,octubre:10,noviembre:11,diciembre:12};
function canonicalDate(value){
 if(typeof value!=='string')return null;
 const s=value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim();
 let y,m,d,match;
 if((match=s.match(/^(\d{4})-(\d{2})-(\d{2})$/))){[,y,m,d]=match;}
 else if((match=s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/))){[,d,m,y]=match;}
 else if((match=s.replace(/\bde\b/g,' ').replace(/\//g,' ').replace(/\s+/g,' ').trim().match(/^(\d{1,2}) ([a-z]+) (\d{4})$/))){d=match[1];m=months[match[2]];y=match[3];}
 else return null;
 [y,m,d]=[y,m,d].map(Number);if(!m||!d||m>12||d>31||y<1000)return null;
 const date=new Date(Date.UTC(y,m-1,d));return date.getUTCFullYear()===y&&date.getUTCMonth()+1===m&&date.getUTCDate()===d?date.toISOString().slice(0,10):null;
}
function dateConflict(a,b){const ca=canonicalDate(a),cb=canonicalDate(b);return Boolean(a&&b&&(ca&&cb?ca!==cb:String(a).trim()!==String(b).trim()));}
if(process.argv.includes('--self-test')){
 for(const s of ['21 de abril de 1960','21/04/1960','21 abril 1960','21/abril/1960'])assert.equal(dateConflict('1960-04-21',s),false);
 assert.equal(dateConflict('1960-04-21','22 de abril de 1960'),true);assert.equal(canonicalDate('31/02/2000'),null);assert.equal(dateConflict('1960','1960-04-21'),true);console.log('Independent date comparison fixtures passed.');
}else{
 const raw=JSON.parse(fs.readFileSync('docs/product-audits/profile-facts-raw-observations.json','utf8'));
 const inv=JSON.parse(fs.readFileSync('docs/product-audits/profile-facts-inventory.json','utf8'));
 let failures=[];
 for(const p of raw.directory){const a=raw.facts[p.externalId]?.birthDate,b=raw.dashboards[p.externalId]?.bio?.structuredData?.fechaNacimiento;const row=inv.records.find(r=>r.externalId===p.externalId)?.fields?.birthDate;
  if(!row)throw Error('Missing birthDate audit record '+p.externalId);
  if((row.status==='conflicting')!==dateConflict(a,b))failures.push(`${p.externalId}: ${JSON.stringify(a)} vs ${JSON.stringify(b)} incorrectly classified ${row.status}`);
 }
 if(failures.length)throw Error('False or missed semantic date conflicts: '+failures.join('; '));
 console.log('Independent gate: all91birthday conflict labels agree with date semantics and preserve date precision.');
}
