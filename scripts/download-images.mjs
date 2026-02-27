#!/usr/bin/env node
/**
 * Download all politician headshots and social media avatars to local public/ folder.
 * Run: node scripts/download-images.mjs
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import https from "https";
import http from "http";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const SOURCE = join(ROOT, "..", "orwell-discovery", "data", "verified", "FINAL-DATABASE.json");
const HEADSHOTS_DIR = join(ROOT, "public", "images", "headshots");
const AVATARS_DIR = join(ROOT, "public", "images", "avatars");

mkdirSync(HEADSHOTS_DIR, { recursive: true });
mkdirSync(AVATARS_DIR, { recursive: true });

// ── Download helper with redirect following ──
function downloadFile(url, destPath, maxRedirects = 5) {
  return new Promise((resolve, reject) => {
    if (!url || url.length < 10) {
      resolve({ success: false, reason: "empty_url" });
      return;
    }
    if (existsSync(destPath)) {
      resolve({ success: true, reason: "cached" });
      return;
    }

    const protocol = url.startsWith("https") ? https : http;

    const doRequest = (currentUrl, redirectCount) => {
      if (redirectCount > maxRedirects) {
        resolve({ success: false, reason: "too_many_redirects" });
        return;
      }

      protocol.get(currentUrl, { timeout: 15000, headers: { "User-Agent": "Mozilla/5.0" } }, (res) => {
        // Follow redirects
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          let redirectUrl = res.headers.location;
          if (redirectUrl.startsWith("/")) {
            const parsed = new URL(currentUrl);
            redirectUrl = `${parsed.protocol}//${parsed.host}${redirectUrl}`;
          }
          doRequest(redirectUrl, redirectCount + 1);
          return;
        }

        if (res.statusCode !== 200) {
          resolve({ success: false, reason: `http_${res.statusCode}` });
          return;
        }

        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => {
          const buffer = Buffer.concat(chunks);
          if (buffer.length < 100) {
            resolve({ success: false, reason: "too_small" });
            return;
          }
          writeFileSync(destPath, buffer);
          resolve({ success: true, reason: "downloaded", size: buffer.length });
        });
        res.on("error", (err) => resolve({ success: false, reason: err.message }));
      }).on("error", (err) => {
        resolve({ success: false, reason: err.message });
      }).on("timeout", () => {
        resolve({ success: false, reason: "timeout" });
      });
    };

    doRequest(url, 0);
  });
}

// ── Batch downloader with concurrency limit ──
async function downloadBatch(items, concurrency = 5) {
  const results = [];
  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    const batchResults = await Promise.all(
      batch.map(({ url, dest, label }) =>
        downloadFile(url, dest).then((r) => ({ label, ...r }))
      )
    );
    results.push(...batchResults);
    if (i + concurrency < items.length) {
      process.stdout.write(`  Progress: ${Math.min(i + concurrency, items.length)}/${items.length}\r`);
    }
  }
  return results;
}

// ── Main ──
async function main() {
  console.log("Reading source database...");
  const raw = JSON.parse(readFileSync(SOURCE, "utf-8"));

  // ── 1. Download headshots ──
  console.log("\n=== Downloading Headshots ===");
  const headshotItems = raw.politicians
    .filter((p) => p.official_image_url && p.official_image_url.length > 5)
    .map((p) => ({
      url: p.official_image_url,
      dest: join(HEADSHOTS_DIR, `${p.id}.jpg`),
      label: `${p.id} ${p.name}`,
    }));

  console.log(`  ${headshotItems.length} headshots to download`);
  const headshotResults = await downloadBatch(headshotItems);
  const headshotSuccess = headshotResults.filter((r) => r.success).length;
  const headshotFailed = headshotResults.filter((r) => !r.success);
  console.log(`\n  Downloaded: ${headshotSuccess}/${headshotItems.length}`);
  if (headshotFailed.length > 0) {
    console.log("  Failed:");
    headshotFailed.forEach((r) => console.log(`    ${r.label}: ${r.reason}`));
  }

  // ── 2. Download avatars ──
  console.log("\n=== Downloading Avatars ===");
  const avatarItems = [];
  for (const p of raw.politicians) {
    for (const a of p.accounts || []) {
      if (a.avatar_url && a.avatar_url.length > 10) {
        avatarItems.push({
          url: a.avatar_url,
          dest: join(AVATARS_DIR, `${p.id}-${a.platform}.jpg`),
          label: `${p.id} @${a.handle} (${a.platform})`,
        });
      }
    }
  }

  console.log(`  ${avatarItems.length} avatars to download`);
  const avatarResults = await downloadBatch(avatarItems);
  const avatarSuccess = avatarResults.filter((r) => r.success).length;
  const avatarFailed = avatarResults.filter((r) => !r.success);
  console.log(`\n  Downloaded: ${avatarSuccess}/${avatarItems.length}`);
  if (avatarFailed.length > 0) {
    console.log(`  Failed (${avatarFailed.length}):`);
    avatarFailed.slice(0, 20).forEach((r) => console.log(`    ${r.label}: ${r.reason}`));
    if (avatarFailed.length > 20) console.log(`    ... and ${avatarFailed.length - 20} more`);
  }

  // ── Summary ──
  console.log("\n=== SUMMARY ===");
  console.log(`Headshots: ${headshotSuccess}/${headshotItems.length}`);
  console.log(`Avatars: ${avatarSuccess}/${avatarItems.length}`);
  console.log(`Total images: ${headshotSuccess + avatarSuccess}`);
}

main().catch(console.error);
