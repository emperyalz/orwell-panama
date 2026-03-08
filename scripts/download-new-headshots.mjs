/**
 * Download hi-res headshots for the 10 newly added deputies.
 * Uses the same pattern as download-hires-headshots.mjs:
 *   /Uploads/diputado/foto/{id}/publicacion_{id}.jpg
 * Optimizes via sharp to 800px wide JPEG @ quality 85.
 */
import { writeFileSync } from "fs";
import { resolve, join } from "path";
import { createRequire } from "module";
import https from "https";

const require = createRequire(import.meta.url);
const sharp = require("sharp");

const ROOT = resolve(process.cwd());
const HEADSHOTS_DIR = join(ROOT, "public/images/headshots");

const deputies = [
  { id: "DEP-072", url: "https://www.asamblea.gob.pa/Uploads/diputado/foto/113/publicacion_113.jpg", name: "Nixon Andrade" },
  { id: "DEP-073", url: "https://www.asamblea.gob.pa/Uploads/diputado/foto/134/publicacion_134.jpg", name: "Jony Guevara" },
  { id: "DEP-074", url: "https://www.asamblea.gob.pa/Uploads/diputado/foto/99/publicacion_99.jpg", name: "Ronald De Gracia" },
  { id: "DEP-076", url: "https://www.asamblea.gob.pa/Uploads/diputado/foto/89/publicacion_89.jpg", name: "Jorge González López" },
  { id: "DEP-077", url: "https://www.asamblea.gob.pa/Uploads/diputado/foto/104/publicacion_104.jpg", name: "Tomás Benavides" },
  { id: "DEP-078", url: "https://www.asamblea.gob.pa/Uploads/diputado/foto/101/publicacion_101.jpg", name: "Victor Castillo" },
  { id: "DEP-079", url: "https://www.asamblea.gob.pa/Uploads/diputado/foto/66/publicacion_66.jpg", name: "Nelson Jackson Palma" },
  { id: "DEP-080", url: "https://www.asamblea.gob.pa/Uploads/diputado/foto/110/publicacion_110.jpg", name: "Flor Brenes" },
  { id: "DEP-081", url: "https://www.asamblea.gob.pa/Uploads/diputado/foto/129/publicacion_129.jpg", name: "Gertrudis Rodríguez" },
  { id: "DEP-082", url: "https://www.asamblea.gob.pa/Uploads/diputado/foto/121/publicacion_121.jpg", name: "Carlos Afú" },
];

function downloadBuffer(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { "User-Agent": "OrwellPanama/1.0" } }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return downloadBuffer(res.headers.location).then(resolve, reject);
      }
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode} for ${url}`));
        res.resume();
        return;
      }
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => resolve(Buffer.concat(chunks)));
      res.on("error", reject);
    }).on("error", reject);
  });
}

async function main() {
  console.log(`Downloading ${deputies.length} headshots to ${HEADSHOTS_DIR}`);
  let success = 0;
  let failed = 0;

  for (const dep of deputies) {
    const destPath = join(HEADSHOTS_DIR, `${dep.id}.jpg`);
    try {
      const rawBuffer = await downloadBuffer(dep.url);
      const rawKb = (rawBuffer.length / 1024).toFixed(0);

      const optimized = await sharp(rawBuffer)
        .resize(800, null, { withoutEnlargement: true })
        .jpeg({ quality: 85 })
        .toBuffer();

      writeFileSync(destPath, optimized);
      const optKb = (optimized.length / 1024).toFixed(0);
      console.log(`  ✅ ${dep.name} (${dep.id}) → ${rawKb}KB raw → ${optKb}KB optimized`);
      success++;
    } catch (err) {
      console.log(`  ❌ FAILED ${dep.name} (${dep.id}): ${err.message}`);
      failed++;
    }
    await new Promise((r) => setTimeout(r, 300));
  }

  console.log(`\nDone! ${success} downloaded, ${failed} failed.`);
}

main().catch(console.error);
