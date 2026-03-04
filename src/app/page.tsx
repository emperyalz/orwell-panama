import { Suspense } from "react";
import { fetchQuery } from "convex/nextjs";
import { api } from "../../convex/_generated/api";
import { HomeClient } from "@/components/politicians/HomeClient";
import type { Politician } from "@/lib/types";

function toViewPolitician(doc: any): Politician {
  return {
    id: doc.externalId,
    name: doc.name,
    slug: doc.slug,
    party: doc.party,
    partyFull: doc.partyFull,
    role: doc.role,
    roleCategory: doc.roleCategory,
    province: doc.province,
    district: doc.district,
    circuit: doc.circuit,
    hasHeadshot: doc.hasHeadshot,
    headshot: doc.headshot,
    officialGovUrl: doc.officialGovUrl,
    wikipediaUrl: doc.wikipediaUrl,
    personalWebsite: doc.personalWebsite,
    accounts: (doc.accounts ?? []).map((a: any) => ({
      platform: a.platform,
      handle: a.handle,
      profileUrl: a.profileUrl,
      avatar: a.avatar,
      verdict: a.verdict,
      score: a.score,
      pollingTier: a.pollingTier,
    })),
  };
}

function computeBreakdown(
  politicians: any[],
  roleCategory: string,
  partyColors: Record<string, string>
) {
  const counts: Record<string, number> = {};
  for (const p of politicians) {
    if (p.roleCategory === roleCategory) {
      counts[p.party] = (counts[p.party] ?? 0) + 1;
    }
  }
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([code, count]) => ({ code, count, color: partyColors[code] ?? "#555" }));
}

export default async function HomePage() {
  const [rawPoliticians, rawPartyList, rawUniqueParties, rawProvinces] = await Promise.all([
    fetchQuery(api.politicians.list, {}),
    fetchQuery(api.parties.list, {}),
    fetchQuery(api.politicians.getUniqueParties, {}),
    fetchQuery(api.politicians.getUniqueProvinces, {}),
  ]);

  const politicians: Politician[] = rawPoliticians.map(toViewPolitician);
  const parties = rawUniqueParties.map((p: any) => p.code);
  const provinces = rawProvinces;

  const partyColors: Record<string, string> = {};
  for (const p of rawPartyList as any[]) {
    partyColors[p.code] = p.color;
  }

  const govTiers = [
    {
      label: "Presidente",
      sublabel: "Presidente de la República",
      total: rawPoliticians.filter((p: any) => p.roleCategory === "President").length,
      slices: computeBreakdown(rawPoliticians, "President", partyColors),
    },
    {
      label: "Gobernadores",
      sublabel: "Gobernadores Provinciales",
      total: rawPoliticians.filter((p: any) => p.roleCategory === "Governor").length,
      slices: computeBreakdown(rawPoliticians, "Governor", partyColors),
    },
    {
      label: "Alcaldes",
      sublabel: "Alcaldes Municipales",
      total: rawPoliticians.filter((p: any) => p.roleCategory === "Mayor").length,
      slices: computeBreakdown(rawPoliticians, "Mayor", partyColors),
    },
    {
      label: "Asamblea Nacional",
      sublabel: "Diputados",
      total: rawPoliticians.filter((p: any) => p.roleCategory === "Deputy").length,
      slices: computeBreakdown(rawPoliticians, "Deputy", partyColors),
    },
  ];

  return (
    <Suspense
      fallback={
        <div className="bg-[#111] border-b border-[#222]">
          <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
            <div className="h-8 w-80 animate-pulse rounded bg-[#222]" />
            <div className="mt-3 h-3 w-64 animate-pulse rounded bg-[#1a1a1a]" />
          </div>
        </div>
      }
    >
      <HomeClient
        politicians={politicians}
        parties={parties}
        provinces={provinces}
        govTiers={govTiers}
      />
    </Suspense>
  );
}
