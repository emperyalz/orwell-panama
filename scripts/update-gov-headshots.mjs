/**
 * Update hasHeadshot + headshot path for the 5 governors in Convex
 */
import { readFileSync } from "fs";
import { resolve, join } from "path";

const ROOT = resolve(process.cwd());
const envContent = readFileSync(join(ROOT, ".env.local"), "utf-8");
const convexUrl = envContent.match(/NEXT_PUBLIC_CONVEX_URL=(.+)/)?.[1]?.trim();

if (!convexUrl) {
  console.error("NEXT_PUBLIC_CONVEX_URL not found in .env.local");
  process.exit(1);
}

const { ConvexHttpClient } = await import("convex/browser");
const { api } = await import(join(ROOT, "convex/_generated/api.js"));

const client = new ConvexHttpClient(convexUrl);

const governors = [
  { externalId: "GOV-001", headshot: "/images/headshots/GOV-001.jpg" },
  { externalId: "GOV-002", headshot: "/images/headshots/GOV-002.jpg" },
  { externalId: "GOV-005", headshot: "/images/headshots/GOV-005.jpg" },
  { externalId: "GOV-006", headshot: "/images/headshots/GOV-006.jpg" },
  { externalId: "GOV-009", headshot: "/images/headshots/GOV-009.jpg" },
];

for (const gov of governors) {
  const record = await client.query(api.politicians.getByExternalId, {
    externalId: gov.externalId,
  });

  if (!record) {
    console.log(`❌ Not found in DB: ${gov.externalId}`);
    continue;
  }

  await client.mutation(api.politicians.update, {
    id: record._id,
    hasHeadshot: true,
    headshot: gov.headshot,
  });

  console.log(`✅ Updated ${gov.externalId} (${record.name})`);
}

console.log("\nDone!");
