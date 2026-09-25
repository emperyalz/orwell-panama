// Seed party LEADERS as full politician profiles (roleCategory "Party Leader").
// Reuses the self-hosted party-head photos as headshots and attaches each
// leader's researched personal social accounts + Wikipedia.
//
// Idempotent: skips a leader/account that already exists (matched by externalId
// / platform+handle). Also flags the existing PAN deputy (Jorge Herrera) as a
// dual-role party leader.
//
// Usage:
//   NEXT_PUBLIC_CONVEX_URL=https://fleet-vole-527.convex.cloud node scripts/seed-party-leaders.mjs

import { readFileSync } from "node:fs";

function resolveConvexUrl() {
  if (process.env.NEXT_PUBLIC_CONVEX_URL) return process.env.NEXT_PUBLIC_CONVEX_URL;
  try {
    const env = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
    const m = env.match(/NEXT_PUBLIC_CONVEX_URL=(\S+)/);
    if (m) return m[1];
  } catch {}
  throw new Error("NEXT_PUBLIC_CONVEX_URL not set and not found in .env.local");
}
const CONVEX_URL = resolveConvexUrl();

async function cx(kind, path, args = {}) {
  const r = await fetch(`${CONVEX_URL}/api/${kind}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path, args, format: "json" }),
  });
  const d = await r.json();
  if (d.status !== "success") throw new Error(`${path} failed: ${JSON.stringify(d)}`);
  return d.value;
}
const q = (path, args) => cx("query", path, args);
const m = (path, args) => cx("mutation", path, args);

const score = (verdict) => (verdict === "CONFIRMED" ? 85 : 60);

// 7 party leaders who are NOT already in the directory (Jorge Herrera/PAN handled separately).
const LEADERS = [
  {
    externalId: "LDR-RM", name: "Ricardo Martinelli", slug: "ricardo-martinelli",
    party: "RM", partyFull: "Realizando Metas", role: "Presidente del partido",
    headshot: "/images/party-heads/rm.jpg",
    wikipediaUrl: "https://es.wikipedia.org/wiki/Ricardo_Martinelli",
    personalWebsite: "https://ricardomartinelli.com/",
    accounts: [
      { platform: "x_twitter", handle: "rmartinelli", profileUrl: "https://x.com/rmartinelli", verdict: "CONFIRMED" },
      { platform: "instagram", handle: "ricardomartinelli99", profileUrl: "https://www.instagram.com/ricardomartinelli99/", verdict: "CONFIRMED" },
      { platform: "facebook", handle: "ricardomartinelli99", profileUrl: "https://www.facebook.com/ricardomartinelli99/", verdict: "CONFIRMED" },
      { platform: "tiktok", handle: "ricardomartinellioficial", profileUrl: "https://www.tiktok.com/@ricardomartinellioficial", verdict: "PROBABLE" },
      { platform: "youtube", handle: "RicardoRMartinelli", profileUrl: "https://www.youtube.com/user/RicardoRMartinelli", verdict: "PROBABLE" },
    ],
  },
  {
    externalId: "LDR-PRD", name: "Balbina Herrera", slug: "balbina-herrera",
    party: "PRD", partyFull: "Partido Revolucionario Democrático", role: "Secretaria General",
    headshot: "/images/party-heads/prd.jpg",
    wikipediaUrl: "https://es.wikipedia.org/wiki/Balbina_Herrera",
    accounts: [
      { platform: "x_twitter", handle: "BalbinaHerrera", profileUrl: "https://x.com/BalbinaHerrera", verdict: "CONFIRMED" },
      { platform: "instagram", handle: "balbinaherreraa", profileUrl: "https://www.instagram.com/balbinaherreraa/", verdict: "CONFIRMED" },
      { platform: "facebook", handle: "balbina.herreraarauz", profileUrl: "https://www.facebook.com/balbina.herreraarauz/", verdict: "PROBABLE" },
    ],
  },
  {
    externalId: "LDR-CD", name: "Yanibel Ábrego", slug: "yanibel-abrego",
    party: "CD", partyFull: "Cambio Democrático", role: "Presidenta del partido",
    headshot: "/images/party-heads/cd.jpg",
    wikipediaUrl: "https://en.wikipedia.org/wiki/Yanibel_%C3%81brego",
    accounts: [
      { platform: "instagram", handle: "yanibelabrego", profileUrl: "https://www.instagram.com/yanibelabrego/", verdict: "CONFIRMED" },
      { platform: "x_twitter", handle: "YanibelAbrego", profileUrl: "https://x.com/YanibelAbrego", verdict: "CONFIRMED" },
      { platform: "facebook", handle: "yanibelabregoS", profileUrl: "https://www.facebook.com/yanibelabregoS/", verdict: "CONFIRMED" },
    ],
  },
  {
    externalId: "LDR-MOLIRENA", name: "Francisco Alemán", slug: "francisco-aleman",
    party: "MOLIRENA", partyFull: "Movimiento Liberal Republicano Nacionalista", role: "Presidente del partido",
    headshot: "/images/party-heads/molirena.jpg",
    personalWebsite: "http://www.panchoaleman.com",
    accounts: [
      { platform: "x_twitter", handle: "AlemanPancho", profileUrl: "https://x.com/AlemanPancho", verdict: "CONFIRMED" },
      { platform: "instagram", handle: "alemanpancho", profileUrl: "https://www.instagram.com/alemanpancho/", verdict: "CONFIRMED" },
      { platform: "tiktok", handle: "alemanpancho", profileUrl: "https://www.tiktok.com/@alemanpancho", verdict: "PROBABLE" },
      { platform: "facebook", handle: "pancho.aleman.14", profileUrl: "https://www.facebook.com/pancho.aleman.14/", verdict: "PROBABLE" },
    ],
  },
  {
    externalId: "LDR-MOCA", name: "Ricardo Lombana", slug: "ricardo-lombana",
    party: "MOCA", partyFull: "Movimiento Otro Camino", role: "Presidente del partido",
    headshot: "/images/party-heads/moca.jpg",
    personalWebsite: "https://otrocamino.org/lombana/",
    accounts: [
      { platform: "instagram", handle: "ricardolombanag", profileUrl: "https://www.instagram.com/ricardolombanag/", verdict: "CONFIRMED" },
      { platform: "x_twitter", handle: "RicardoLombanaG", profileUrl: "https://x.com/RicardoLombanaG", verdict: "CONFIRMED" },
      { platform: "tiktok", handle: "ricardolombanag", profileUrl: "https://www.tiktok.com/@ricardolombanag", verdict: "CONFIRMED" },
      { platform: "facebook", handle: "ricardolombanag", profileUrl: "https://www.facebook.com/ricardolombanag/", verdict: "CONFIRMED" },
      { platform: "youtube", handle: "RicardoLombanaG", profileUrl: "https://www.youtube.com/channel/UC7NpiX-prsiegX4oXBl6hyw", verdict: "CONFIRMED" },
    ],
  },
  {
    externalId: "LDR-PP", name: "Cirilo Salas", slug: "cirilo-salas",
    party: "PP", partyFull: "Partido Popular", role: "Presidente del partido",
    headshot: "/images/party-heads/pp.jpg",
    accounts: [
      { platform: "instagram", handle: "cirilosalas", profileUrl: "https://www.instagram.com/cirilosalas/", verdict: "CONFIRMED" },
      { platform: "x_twitter", handle: "cirilosalas", profileUrl: "https://x.com/cirilosalas", verdict: "PROBABLE" },
      { platform: "facebook", handle: "cirilo.salaslemos", profileUrl: "https://www.facebook.com/cirilo.salaslemos", verdict: "PROBABLE" },
    ],
  },
  {
    externalId: "LDR-ALZ", name: "José Muñoz Molina", slug: "jose-munoz-molina",
    party: "ALZ", partyFull: "Partido Alianza", role: "Presidente del partido",
    headshot: "/images/party-heads/alz.jpg",
    accounts: [
      { platform: "x_twitter", handle: "JMunozM27", profileUrl: "https://x.com/JMunozM27", verdict: "CONFIRMED" },
    ],
  },
];

async function ensureLeader(L) {
  const existing = await q("politicians:getByExternalId", { externalId: L.externalId });
  let politicianId;
  if (existing) {
    politicianId = existing._id;
    await m("politicians:update", {
      id: politicianId,
      role: L.role, roleCategory: "Party Leader", party: L.party, partyFull: L.partyFull,
      hasHeadshot: true, headshot: L.headshot, province: "Nacional",
      wikipediaUrl: L.wikipediaUrl, personalWebsite: L.personalWebsite,
    });
    console.log(`  ~ updated ${L.externalId} (${L.name})`);
  } else {
    politicianId = await m("politicians:create", {
      externalId: L.externalId, name: L.name, slug: L.slug,
      party: L.party, partyFull: L.partyFull, role: L.role, roleCategory: "Party Leader",
      province: "Nacional", hasHeadshot: true, headshot: L.headshot,
      wikipediaUrl: L.wikipediaUrl, personalWebsite: L.personalWebsite,
    });
    console.log(`  + created ${L.externalId} (${L.name})`);
  }

  // Attach accounts (skip duplicates by platform+handle)
  let added = 0;
  for (const a of L.accounts) {
    const dup = await q("accounts:getByPlatformHandle", { platform: a.platform, handle: a.handle });
    if (dup) continue;
    await m("accounts:create", {
      politicianId, platform: a.platform, handle: a.handle, profileUrl: a.profileUrl,
      avatar: `/images/avatars/${L.externalId}-${a.platform}.jpg`, verdict: a.verdict, score: score(a.verdict), pollingTier: "warm",
    });
    added++;
  }
  console.log(`      accounts: +${added}/${L.accounts.length}`);
}

async function main() {
  console.log(`Convex: ${CONVEX_URL}`);
  for (const L of LEADERS) await ensureLeader(L);

  // Dual-role: flag the sitting PAN deputy Jorge Herrera as also a party leader.
  const jorge = await q("politicians:getByExternalId", { externalId: "DEP-005" });
  if (jorge) {
    await m("politicians:update", { id: jorge._id, isPartyLeader: true });
    console.log(`  ★ flagged DEP-005 (${jorge.name}) as dual-role Party Leader`);
  } else {
    console.warn("  ! DEP-005 (Jorge Herrera) not found — skipped dual-role flag");
  }

  console.log("Done.");
}

main().catch((e) => { console.error(e); process.exit(1); });
