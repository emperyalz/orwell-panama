// Seed party profile fields (description, foundedDate, head*) into Convex.
// Re-runnable: maps party code -> Convex _id, then calls parties:update.
//
// Usage:
//   NEXT_PUBLIC_CONVEX_URL=https://fleet-vole-527.convex.cloud node scripts/seed-party-profiles.mjs
// Defaults to the URL in .env.local if the env var is not set.

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

async function convexQuery(path, args = {}) {
  const r = await fetch(`${CONVEX_URL}/api/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path, args, format: "json" }),
  });
  const d = await r.json();
  if (d.status !== "success") throw new Error(`${path} failed: ${JSON.stringify(d)}`);
  return d.value;
}

async function convexMutation(path, args = {}) {
  const r = await fetch(`${CONVEX_URL}/api/mutation`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path, args, format: "json" }),
  });
  const d = await r.json();
  if (d.status !== "success") throw new Error(`${path} failed: ${JSON.stringify(d)}`);
  return d.value;
}

// Researched data (verified 2025; sources: Wikipedia/Commons, Tribunal Electoral, news).
const PROFILES = {
  RM: {
    foundedDate: "2021-03-24",
    headName: "Ricardo Martinelli",
    headRole: "Presidente del partido",
    headPhoto: "/images/party-heads/rm.jpg",
    description:
      "Realizando Metas (RM) es un partido político panameño de derecha fundado por el expresidente Ricardo Martinelli tras su separación de Cambio Democrático, y reconocido por el Tribunal Electoral el 24 de marzo de 2021. En las elecciones de 2024 respaldó la candidatura de José Raúl Mulino, quien resultó electo presidente, convirtiendo a RM en el partido de gobierno.",
  },
  PRD: {
    foundedDate: "1979-03-11",
    headName: "Balbina Herrera",
    headRole: "Secretaria General",
    headPhoto: "/images/party-heads/prd.jpg",
    description:
      "El Partido Revolucionario Democrático (PRD) es un partido de orientación centroizquierdista fundado el 11 de marzo de 1979 por el general Omar Torrijos como vehículo del torrijismo. Históricamente el partido con mayor número de afiliados del país, ha gobernado Panamá en cuatro ocasiones; en noviembre de 2025 eligió a Balbina Herrera como Secretaria General, la primera mujer en ocupar el cargo.",
  },
  CD: {
    foundedDate: "1998-05-20",
    headName: "Yanibel Ábrego",
    headRole: "Presidenta del partido",
    headPhoto: "/images/party-heads/cd.jpg",
    description:
      "Cambio Democrático (CD) es un partido de centroderecha fundado el 20 de mayo de 1998 por el empresario Ricardo Martinelli, con quien llegó a la presidencia en 2009. Promueve el libre mercado y el estado de derecho; tras la salida de Martinelli en 2020, fue dirigido por Rómulo Roux y desde octubre de 2024 lo preside Yanibel Ábrego Smith.",
  },
  PAN: {
    foundedDate: "1991-10-31",
    headName: "Jorge Luis Herrera",
    headRole: "Presidente del partido",
    headPhoto: "/images/headshots/DEP-005.jpg", // reuse existing self-hosted headshot
    description:
      "El Partido Panameñista, heredero del movimiento arnulfista fundado por Arnulfo Arias Madrid, es el partido de raíz nacionalista y populista más histórico de Panamá. Su doctrina, el panameñismo, reivindica la soberanía nacional; recuperó el nombre Panameñista en 2005 y en noviembre de 2025 eligió como presidente al diputado Jorge Luis Herrera.",
  },
  MOLIRENA: {
    foundedDate: "1982-10-01",
    headName: "Francisco Alemán",
    headRole: "Presidente del partido",
    headPhoto: "/images/party-heads/molirena.jpg",
    description:
      "El Movimiento Liberal Republicano Nacionalista (MOLIRENA) es un partido de centroderecha fundado el 1 de octubre de 1982 a partir de la fusión de varias agrupaciones liberales y nacionalistas. De ideología liberal-conservadora, ha sido un actor recurrente en las alianzas electorales del país y conserva representación en la Asamblea Nacional y en municipios.",
  },
  MOCA: {
    foundedDate: "2022-06-29",
    headName: "Ricardo Lombana",
    headRole: "Presidente del partido",
    headPhoto: "/images/party-heads/moca.jpg",
    description:
      "Movimiento Otro Camino (MOCA) es un partido fundado por Ricardo Lombana y reconocido por el Tribunal Electoral el 29 de junio de 2022. Su plataforma se centra en la lucha anticorrupción, la austeridad fiscal y una nueva constitución; en las presidenciales de 2024 Lombana obtuvo el segundo lugar con cerca del 25% de los votos.",
  },
  PP: {
    foundedDate: "1960-11-20",
    headName: "Cirilo Salas",
    headRole: "Presidente del partido",
    headPhoto: "/images/party-heads/pp.jpg",
    description:
      "El Partido Popular (PP) es el heredero del histórico Partido Demócrata Cristiano de Panamá, fundado el 20 de noviembre de 1960 y renombrado Partido Popular en 2001. De ideología democristiana y doctrina social cristiana, es miembro de la Organización Demócrata Cristiana de América; en diciembre de 2025 eligió a Cirilo Salas Lemos como presidente.",
  },
  ALZ: {
    foundedDate: "2018-03-02",
    headName: "José Muñoz Molina",
    headRole: "Presidente del partido",
    headPhoto: "/images/party-heads/alz.jpg",
    description:
      "Partido Alianza es un partido de tendencia nacionalista liberal fundado el 2 de marzo de 2018 por José Muñoz Molina tras separarse de Cambio Democrático. En 2024 integró la coalición que respaldó la candidatura presidencial ganadora de José Raúl Mulino y mantiene representación en la Asamblea Nacional, alcaldías y juntas comunales.",
  },
  // Electoral mechanisms — not traditional parties (no head / founded date).
  IND: {
    description:
      "La candidatura independiente (sin partido) permite a una persona postularse y ejercer un cargo de elección sin estar inscrita en un colectivo político. No constituye un partido: agrupa a quienes llegan a la Asamblea Nacional o a cargos locales por la vía de la libre postulación o que renunciaron a su partido.",
  },
  LP: {
    description:
      "La Libre Postulación es el mecanismo electoral panameño que habilita a candidatos a postularse sin el respaldo de un partido político, mediante la recolección de firmas de adherentes. No es un partido, sino una vía de participación ciudadana reconocida por el Código Electoral.",
  },
};

async function main() {
  console.log(`Convex: ${CONVEX_URL}`);
  const parties = await convexQuery("parties:list");
  const idByCode = Object.fromEntries(parties.map((p) => [p.code, p._id]));

  let updated = 0;
  for (const [code, profile] of Object.entries(PROFILES)) {
    const id = idByCode[code];
    if (!id) {
      console.warn(`  ! No party found for code ${code} — skipping`);
      continue;
    }
    await convexMutation("parties:update", { id, ...profile });
    console.log(`  ✓ ${code}${profile.headName ? ` — ${profile.headName}` : ""}`);
    updated++;
  }
  console.log(`Done. Updated ${updated} parties.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
