import { notFound } from "next/navigation";
import { getAllPoliticianIds, getPoliticianById } from "@/lib/politicians";
import { HeroSection } from "@/components/politician-detail/HeroSection";
import { InfoGrid } from "@/components/politician-detail/InfoGrid";
import { SocialAccounts } from "@/components/politician-detail/SocialAccounts";
import { OfficialLinks } from "@/components/politician-detail/OfficialLinks";
import { NewsPlaceholder } from "@/components/politician-detail/NewsPlaceholder";
import { SocialPostsPlaceholder } from "@/components/politician-detail/SocialPostsPlaceholder";
import { BackButton } from "@/components/ui/BackButton";
import type { Metadata } from "next";

export function generateStaticParams() {
  return getAllPoliticianIds().map((id) => ({ id }));
}

type PageProps = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const politician = getPoliticianById(id);
  if (!politician) return { title: "Político no encontrado" };
  return {
    title: `${politician.name} — ${politician.role} | Orwell Panamá`,
    description: `Perfil de ${politician.name}, ${politician.role} por ${politician.province}. Partido: ${politician.partyFull}.`,
  };
}

export default async function PoliticianPage({ params }: PageProps) {
  const { id } = await params;
  const politician = getPoliticianById(id);
  if (!politician) notFound();

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
