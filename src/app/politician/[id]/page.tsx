import { notFound } from "next/navigation";
import { fetchQuery } from "convex/nextjs";
import { api } from "../../../../convex/_generated/api";
import { HeroSection } from "@/components/politician-detail/HeroSection";
import { InfoGrid } from "@/components/politician-detail/InfoGrid";
import { SocialAccounts } from "@/components/politician-detail/SocialAccounts";
import { OfficialLinks } from "@/components/politician-detail/OfficialLinks";
import { NewsPlaceholder } from "@/components/politician-detail/NewsPlaceholder";
import { SocialPostsPlaceholder } from "@/components/politician-detail/SocialPostsPlaceholder";
import { BackButton } from "@/components/ui/BackButton";
import type { Politician } from "@/lib/types";
import type { Metadata } from "next";

type PageProps = { params: Promise<{ id: string }> };

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

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { id } = await params;
  const doc = await fetchQuery(api.politicians.getByExternalId, {
    externalId: id,
  });
  if (!doc) return { title: "Político no encontrado" };
  return {
    title: `${doc.name} — ${doc.role} | ORWELL | POLÍTICA`,
    description: `Perfil de ${doc.name}, ${doc.role} por ${doc.province}. Partido: ${doc.partyFull}.`,
  };
}

export default async function PoliticianPage({ params }: PageProps) {
  const { id } = await params;
  const doc = await fetchQuery(api.politicians.getByExternalId, {
    externalId: id,
  });
  if (!doc) notFound();

  const politician = toViewPolitician(doc);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <BackButton />
      <HeroSection politician={politician} />
      <InfoGrid politician={politician} />
      <SocialAccounts accounts={politician.accounts} />
      <OfficialLinks politician={politician} />
      <NewsPlaceholder />
      <SocialPostsPlaceholder />
    </div>
  );
}
