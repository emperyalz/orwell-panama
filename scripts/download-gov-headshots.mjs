/**
 * Download hi-res governor headshots from mingob.gob.pa
 * Optimizes via sharp to 800px wide, JPEG 85 quality
 */
import { writeFileSync } from "fs";
import { resolve, join } from "path";
import { createRequire } from "module";
import https from "https";

const require = createRequire(import.meta.url);
const sharp = require("sharp");

const ROOT = resolve(process.cwd());
const HEADSHOTS_MAIN = join(ROOT, "public/images/headshots");
const HEADSHOTS_WORKTREE = join(ROOT, ".claude/worktrees/vibrant-swartz/public/images/headshots");

const governors = [
  { id: "GOV-001", name: "Omaira Mayín Correa Delgado",      url: "https://www.mingob.gob.pa/wp-content/uploads/2024/07/H9A6972.jpg" },
  { id: "GOV-002", name: "Marilyn Vallarino B. de Sellhorn", url: "https://www.mingob.gob.pa/wp-content/uploads/2024/07/H9A6849.jpg" },
  { id: "GOV-005", name: "Elías Corro Cano",                 url: "https://www.mingob.gob.pa/wp-content/uploads/2024/07/H9A6933.jpg" },
  { id: "GOV-006", name: "Aixa Santamaría Muñoz",            url: "https://www.mingob.gob.pa/wp-content/uploads/2024/07/H9A7080.jpg" },
  { id: "GOV-009", name: "Arnulfo Díaz de León",             url: "https://www.mingob.gob.pa/wp-content/uploads/2024/07/H9A6922.jpg" },
];

function downloadBuffer(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { "User-Agent": "OrwellPanama/1.0" } }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return downloadBuffer(res.headers.location).then(resolve, reject);
      }
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}`));
        res.resume();
        return;
      }
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => resolve(Buffer.concat(chunks)));
      res.on("error", reject);
    }).on("error", reject);
  });
}

async function main() {
  for (const gov of governors) {
    try {
      process.stdout.write(`Downloading ${gov.name}... `);
      const raw = await downloadBuffer(gov.url);
      const rawKb = (raw.length / 1024).toFixed(0);

      const optimized = await sharp(raw)
        .resize(800, null, { withoutEnlargement: true })
        .jpeg({ quality: 85 })
        .toBuffer();
      const optKb = (optimized.length / 1024).toFixed(0);

      writeFileSync(join(HEADSHOTS_MAIN, `${gov.id}.jpg`), optimized);
      writeFileSync(join(HEADSHOTS_WORKTREE, `${gov.id}.jpg`), optimized);

      console.log(`✅ ${rawKb}KB → ${optKb}KB → ${gov.id}.jpg`);
      await new Promise((r) => setTimeout(r, 400));
    } catch (e) {
      console.log(`❌ FAILED: ${e.message}`);
    }
  }
  console.log("\nDone!");
}

main().catch(console.error);
