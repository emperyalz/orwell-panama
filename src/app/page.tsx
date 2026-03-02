import { Suspense } from "react";
import { fetchQuery } from "convex/nextjs";
import { api } from "../../convex/_generated/api";
import { PoliticianGrid } from "@/components/politicians/PoliticianGrid";
import type { Politician } from "@/lib/types";

/** Map Convex document to Politician view type */
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

export default async function HomePage() {
  const [rawPoliticians, rawParties, rawProvinces] = await Promise.all([
    fetchQuery(api.politicians.list, {}),
    fetchQuery(api.politicians.getUniqueParties, {}),
    fetchQuery(api.politicians.getUniqueProvinces, {}),
  ]);

  const politicians: Politician[] = rawPoliticians.map(toViewPolitician);
  const parties = rawParties.map((p: any) => p.code);
  const provinces = rawProvinces;
  const totalAccounts = politicians.reduce(
    (sum, p) => sum + p.accounts.length,
    0
  );

  return (
    <>
      {/* Hero — full-width black */}
      <div className="bg-[#111]">
        <div className="mx-auto max-w-7xl px-4 pt-8 pb-6 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold tracking-tight text-white">
            Directorio de Políticos de Panamá
          </h1>
          <p className="mt-2 text-xs text-neutral-400">
            Inteligencia basada en datos, impulsada por el repositorio más completo de política panameña
          </p>
        </div>
      </div>

      {/* Grid with filters — handles its own full-width strip + constrained content */}
      <Suspense
        fallback={
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {Array.from({ length: 10 }).map((_, i) => (
                <div
                  key={i}
                  className="animate-pulse rounded-xl border border-[var(--border)] bg-[var(--muted)]"
                >
                  <div className="aspect-square bg-[var(--border)]" />
                  <div className="space-y-2 p-3">
                    <div className="h-4 rounded bg-[var(--border)]" />
                    <div className="h-3 w-2/3 rounded bg-[var(--border)]" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        }
      >
        <PoliticianGrid
          politicians={politicians}
          parties={parties}
          provinces={provinces}
        />
      </Suspense>
    </>
  );
}
