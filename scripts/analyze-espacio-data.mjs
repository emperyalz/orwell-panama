import { readFileSync, writeFileSync } from "fs";

const data = JSON.parse(readFileSync("data/espacio-civico-deputies.json", "utf8"));
const valid = data.filter(d => d.name !== "Diputados 2024-2029");
const invalid = data.filter(d => d.name === "Diputados 2024-2029");

console.log("Valid profiles:", valid.length);
console.log("Invalid (listing page):", invalid.length);

console.log("\nValid deputies:");
valid.forEach(d => {
  const score = d.performanceScores?.calificacionPonderada ?? "?";
  console.log(`  ${d.name} | ${d.party} | ${d.province} ${d.circuit} | Score: ${score} | Planilla: ${d.planillaTotal || "?"} | Suplente: ${d.suplente || "?"} | Comms: ${d.commissions?.length || 0}`);
});

console.log("\nInvalid slugs:", invalid.map(d => d.slug).join(", "));

// Overwrite with only valid data
writeFileSync("data/espacio-civico-deputies.json", JSON.stringify(valid, null, 2));
console.log(`\nCleaned file: ${valid.length} valid profiles saved`);

// Stats
const withScores = valid.filter(r => r.performanceScores);
const withComm = valid.filter(r => r.commissions?.length > 0);
const withDocs = valid.filter(r => r.documents && Object.keys(r.documents).length > 0);
const withSup = valid.filter(r => r.suplente);
const withPlan = valid.filter(r => r.planillaTotal);

console.log(`\n📊 Data coverage (of ${valid.length}):`);
console.log(`   Performance scores: ${withScores.length}`);
console.log(`   Commissions: ${withComm.length}`);
console.log(`   Documents: ${withDocs.length}`);
console.log(`   Suplente: ${withSup.length}`);
console.log(`   Planilla: ${withPlan.length}`);
