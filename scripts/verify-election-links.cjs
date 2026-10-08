const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const ts=require('typescript');
require.extensions['.ts']=(loaded,filename)=>loaded._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText,filename);
const {electionForPerson,electionResults,officialElectionSource}=require(path.resolve('src/lib/elections.ts'));
const identities=require('../src/data/elections/profile-links-2024.json').links;
assert.equal(identities.length,78);
assert.equal(new Set(identities.map(l=>l.electionId)).size,78,'No two profiles may claim the same election result');
assert.equal(identities.filter(l=>l.kind==='deputy').length,71);
for(const link of identities){
 const person={externalId:link.politicianId,name:link.profileName,roleCategory:link.kind==='deputy'?'Deputy':'Mayor'};
 const result=electionForPerson(person);
 assert.equal(result?.id,link.electionId);
 assert.equal(result.name,link.electionName,'Preserve official election names');
 assert.equal(electionForPerson({...person,name:'Different person'}),null,'A reused directory ID must not silently attach a result');
 assert.equal(electionForPerson({...person,roleCategory:'Governor'}),null,'An office change must not misattribute a winner');
 assert.ok(officialElectionSource(result).report.endsWith('.pdf'));
}
for(const [name,id] of [['Carlos Afú','DEP-082'],['José Luis Varela','DEP-025'],['Yarelis Rodríguez','DEP-032'],['Victor Castillo','DEP-078'],['Lenin Ulate','DEP-066'],['Manuel Cheng','DEP-068']]){
 assert.ok(electionForPerson({externalId:id,name,roleCategory:'Deputy',circuit:'13-3'}),'Reviewed identity survives known bad directory district metadata');
}
assert.equal(electionForPerson({name:'Carlos Afú',roleCategory:'Deputy',circuit:'7-1'}),null,'Do not guess an unreviewed nickname identity');
assert.equal(electionResults.length,152,'Do not discard election rows outside our directory');
console.log('Passed: 78 unique profile links, all 71 deputies, source names preserved, identity/office safeguards, official report links.');
