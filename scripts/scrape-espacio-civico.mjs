#!/usr/bin/env node
/**
 * Scrape all 71 deputy profiles from espaciocivico.org
 * Uses cheerio for proper HTML parsing
 */

import { writeFileSync } from "fs";
import * as cheerio from "cheerio";

const BASE = "https://espaciocivico.org/diputados";

// All 71 confirmed deputy slugs
const SLUGS = [
  // Original 56 confirmed slugs
  "alain-cedeno", "alexandra-brenes", "ariana-coba", "ariel-vallarino",
  "arquesio-arias", "augusto-palacios", "benicio-robinson", "betserai-richards",
  "carlos-afu", "carlos-saldana", "crispiano-adames", "dana-castaneda",
  "didiano-pinilla", "eduardo-gaitan", "eduardo-vasquez", "edwin-vergara",
  "eliecer-castrellon", "flor-brenes", "gertrudis-rodriguez", "jamis-acosta",
  "jairo-salazar", "janine-prado", "jhonatan-vega", "joan-guevara",
  "jorge-bloise-iglesias", "jorge-gonzalez", "jose-luis-varela",
  "jose-perez-barboni", "julio-de-la-guardia", "lenin-alberto-ulate",
  "lilia-batista", "luis-camacho-castro", "luis-duke", "manuel-cheng",
  "manuel-cohen", "manuel-samaniego", "marcos-castillero", "miguel-angel-campos",
  "nelson-jackson", "nestor-guardia", "nixon-andrade", "osman-camilo-gomez",
  "patsy-lee-renteria", "raphael-buchanan", "ricardo-vigil-lopez",
  "roberto-zuniga", "rogelio-revello", "shirley-castanedas", "tomas-benavides",
  "victor-castillo", "yamireliz-chong", "yesica-romero", "yuzaida-marin",
  "jorge-herrera", "raul-pineda", "walkiria-chandler",
  // 15 newly confirmed slugs (found via agent)
  "ernesto-cedeno", "francisco-brea", "graciela-hernandez", "isaac-mosquera",
  "jaime-vargas", "javier-sucre", "omar-ortega", "medin-jimenez-pitti",
  "neftali-zamora", "orlando-carrasquilla", "paulette-thomas",
  "roberto-archibold", "ronald-de-gracia", "sergio-galvez", "yarelis-rodriguez",
];

async function scrapePage(slug) {
  const url = `${BASE}/${slug}`;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36" },
    });
    if (!res.ok) return null;

    const html = await res.text();
    const $ = cheerio.load(html);

    // Check if we landed on the listing page instead of a profile
    const pageTitle = $("title").text();
    if (pageTitle.includes("Diputados de Panamá 2024-2029") || pageTitle.includes("Asamblea Nacional | Espacio")) {
      return null;
    }

    // Name from first <h2> inside the profile card or <h1>
    const name = $("h1").first().text().trim() || $("h2").first().text().trim();
    if (!name || name.includes("Diputados")) return null;

    // Info fields — look for label/value pairs
    const getField = (label) => {
      // Try finding in "detail" sections with specific patterns
      let value = null;
      $("p, span, div").each((_, el) => {
        const text = $(el).text().trim();
        if (text.startsWith(label + ":")) {
          // Value is in a sibling or next element
          value = text.replace(label + ":", "").trim();
        }
      });
      // Also try finding in dt/dd or label patterns
      if (!value) {
        $("*").each((_, el) => {
          if ($(el).text().trim() === label + ":" || $(el).text().trim() === label) {
            const next = $(el).next();
            if (next.length) value = next.text().trim();
          }
        });
      }
      return value || null;
    };

    // Extract key-value pairs from <span> labels
    // Pattern: <span class="text-sm font-semibold text-gray-600">Label:</span>
    // followed by sibling <p class="text-gray-900">Value</p>
    const pairs = {};
    $("span").each((_, el) => {
      const text = $(el).text().trim();
      if (text.endsWith(":")) {
        const label = text.replace(":", "").trim();
        // Value is in the next sibling <p> with class text-gray-900
        const nextP = $(el).siblings("p").first();
        if (nextP.length) {
          pairs[label] = nextP.text().trim();
        }
      }
    });

    const party = pairs["Partido"] || null;
    const province = pairs["Provincia"] || null;
    const circuit = pairs["Circuito"] || null;
    const suplente = pairs["Suplente"] || null;
    const planillaTotal = pairs["Planilla"] || null;
    const calificacionRaw = pairs["Calificación"] || null;

    // Commissions — <h3>Comisión Principal:</h3> <p>commission list</p>
    let commissions = [];
    $("h3").each((_, el) => {
      if ($(el).text().includes("Comisión Principal")) {
        const commText = $(el).next("p").text().trim();
        if (commText) {
          commissions = commText
            .split(/,\s*(?=(?:[^"\u201C]*["\u201C][^"\u201D]*["\u201D])*[^"\u201C]*$)/)
            .map(c => c.replace(/^["\u201C\u201D"']|["\u201C\u201D"']$/g, "").trim())
            .filter(Boolean);
        }
      }
    });

    // Performance scores from the table
    const scores = {};
    $("table tr, div.flex").each((_, el) => {
      const text = $(el).text();
      const scoreMap = {
        "Asistencia Pleno": "asistenciaPleno",
        "Asistencia Comisiones": "asistenciaComisiones",
        "Viajes y Viáticos": "viajesViaticos",
        "Declaración de Intereses": "declaracionIntereses",
        "Declaración de Patrimonio": "declaracionPatrimonio",
        "Calificación Ponderada": "calificacionPonderada",
      };
      for (const [label, key] of Object.entries(scoreMap)) {
        if (text.includes(label)) {
          // Find the score number - look for a standalone number like 1.0, 2.5, 5.0
          const nums = text.match(/(\d+\.?\d*)/g);
          if (nums) {
            // Take the last number in the row (the score)
            const score = parseFloat(nums[nums.length - 1]);
            if (score >= 0 && score <= 5.5) {
              scores[key] = score;
            }
          }
        }
      }
    });

    // Also try extracting from score badge elements
    if (Object.keys(scores).length === 0) {
      // Try a different approach - look for the score display elements
      const scoreEls = $('[class*="rounded-full"]');
      scoreEls.each((_, el) => {
        const num = parseFloat($(el).text().trim());
        if (num >= 0 && num <= 5 && !scores.calificacionPonderada) {
          // This might be a score badge - check context
        }
      });
      // Fall back to the card calificación if we have it
      if (calificacionRaw) {
        const num = parseFloat(calificacionRaw);
        if (num >= 0 && num <= 5) scores.calificacionPonderada = num;
      }
    }

    // Documents — look for links with specific text
    const documents = {};
    $("a").each((_, el) => {
      const text = $(el).text().trim();
      const href = $(el).attr("href");
      if (!href) return;

      const fullUrl = href.startsWith("http") ? href : `https://espaciocivico.org${href}`;

      if (text.includes("CV") && !documents.cvUrl) {
        documents.cvUrl = fullUrl;
      }
      if ((text.includes("Propuesta") || text.includes("📋")) && !documents.propuestaPoliticaUrl) {
        documents.propuestaPoliticaUrl = fullUrl;
      }
      if (text.includes("Intereses") && href !== "/diputados/1" && href !== "/1" && !documents.declaracionInteresesUrl) {
        documents.declaracionInteresesUrl = fullUrl;
      }
      if (text.includes("Patrimonio") && href !== "/diputados/1" && href !== "/1" && !documents.declaracionPatrimonioUrl) {
        documents.declaracionPatrimonioUrl = fullUrl;
      }
    });

    // Voluntary declarations
    const voluntaryDeclarations = html.includes("declaraciones de forma voluntaria");

    // Biography — <h2>Biografía</h2> followed by <div> (not <p>)
    let biography = null;
    $("h2").each((_, el) => {
      if ($(el).text().includes("Biografía")) {
        const next = $(el).next();
        if (next.length) {
          // Might be <div><p>text</p></div> or <div>text</div>
          const pInside = next.find("p").first();
          biography = pInside.length ? pInside.text().trim() : next.text().trim();
        }
      }
    });

    console.log(`  ✓ ${slug}: ${name} | ${party} | Score: ${scores.calificacionPonderada ?? "?"} | Planilla: ${planillaTotal || "?"}`);
    return {
      slug,
      url,
      name,
      party,
      province,
      circuit,
      suplente,
      planillaTotal,
      biography,
      commissions,
      performanceScores: Object.keys(scores).length > 0 ? scores : null,
      documents: Object.keys(documents).length > 0 ? documents : null,
      voluntaryDeclarations,
    };
  } catch (err) {
    console.error(`  ✗ ${slug}: ${err.message}`);
    return null;
  }
}

async function main() {
  console.log("🏛️ Scraping Espacio Cívico — all deputy profiles (cheerio)\n");

  const uniqueSlugs = [...new Set(SLUGS)];
  console.log(`📋 ${uniqueSlugs.length} unique slugs to try\n`);

  const results = [];
  const failed = [];

  for (let i = 0; i < uniqueSlugs.length; i += 5) {
    const batch = uniqueSlugs.slice(i, i + 5);
    const batchResults = await Promise.all(batch.map(scrapePage));

    for (let j = 0; j < batch.length; j++) {
      if (batchResults[j]) {
        results.push(batchResults[j]);
      } else {
        failed.push(batch[j]);
      }
    }

    if (i + 5 < uniqueSlugs.length) await new Promise(r => setTimeout(r, 300));
  }

  console.log(`\n✅ Successfully scraped: ${results.length}`);
  console.log(`❌ Failed/not found: ${failed.length}`);
  if (failed.length > 0) console.log(`   ${failed.join(", ")}`);

  writeFileSync("data/espacio-civico-deputies.json", JSON.stringify(results, null, 2));
  console.log(`\n💾 Saved to data/espacio-civico-deputies.json`);

  // Stats
  const s = (fn) => results.filter(fn).length;
  console.log(`\n📊 Data coverage (of ${results.length}):`);
  console.log(`   Performance scores: ${s(r => r.performanceScores?.calificacionPonderada != null)}`);
  console.log(`   Commissions: ${s(r => r.commissions?.length > 0)}`);
  console.log(`   Documents: ${s(r => r.documents && Object.keys(r.documents).length > 0)}`);
  console.log(`   Suplente: ${s(r => r.suplente)}`);
  console.log(`   Planilla: ${s(r => r.planillaTotal)}`);
  console.log(`   Biography: ${s(r => r.biography)}`);
  console.log(`   Voluntary Decl: ${s(r => r.voluntaryDeclarations)}`);

  // Show score distribution
  const scored = results.filter(r => r.performanceScores?.calificacionPonderada != null);
  if (scored.length > 0) {
    const scores = scored.map(r => r.performanceScores.calificacionPonderada).sort((a, b) => a - b);
    console.log(`\n📈 Score distribution (${scored.length} deputies):`);
    console.log(`   Min: ${scores[0]} | Max: ${scores[scores.length - 1]} | Median: ${scores[Math.floor(scores.length / 2)]}`);
    console.log(`   Excelente (4.5-5.0): ${scores.filter(s => s >= 4.5).length}`);
    console.log(`   Bueno (3.5-4.4): ${scores.filter(s => s >= 3.5 && s < 4.5).length}`);
    console.log(`   Regular (2.5-3.4): ${scores.filter(s => s >= 2.5 && s < 3.5).length}`);
    console.log(`   Deficiente (<2.5): ${scores.filter(s => s < 2.5).length}`);
  }
}

main().catch(console.error);
