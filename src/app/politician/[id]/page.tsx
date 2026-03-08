import { notFound } from "next/navigation";
import { fetchQuery } from "convex/nextjs";
import { api } from "../../../../convex/_generated/api";
import { HeroSection } from "@/components/politician-detail/HeroSection";
import { InfoGrid } from "@/components/politician-detail/InfoGrid";
import { OfficialLinks } from "@/components/politician-detail/OfficialLinks";
import { BackButton } from "@/components/ui/BackButton";
import { ScoreCards } from "@/components/politician-detail/dashboard/ScoreCards";
import { VotingBreakdown } from "@/components/politician-detail/dashboard/VotingBreakdown";
import { VotingTimeline } from "@/components/politician-detail/dashboard/VotingTimeline";
import { AttendanceHeatmap } from "@/components/politician-detail/dashboard/AttendanceHeatmap";
import { PartyLoyalty } from "@/components/politician-detail/dashboard/PartyLoyalty";
import { ControversialVotes } from "@/components/politician-detail/dashboard/ControversialVotes";
import { SwingVotes } from "@/components/politician-detail/dashboard/SwingVotes";
import { VotingAlignment } from "@/components/politician-detail/dashboard/VotingAlignment";
import { Rankings } from "@/components/politician-detail/dashboard/Rankings";
import { ProfessionalProfile } from "@/components/politician-detail/dashboard/ProfessionalProfile";
import { SocialPresence } from "@/components/politician-detail/dashboard/SocialPresence";
import { RecentVotes } from "@/components/politician-detail/dashboard/RecentVotes";
import { TransparencyScorecard } from "@/components/politician-detail/dashboard/TransparencyScorecard";
import { CommissionsCard } from "@/components/politician-detail/dashboard/CommissionsCard";
import { TransparencyDetails } from "@/components/politician-detail/dashboard/TransparencyDetails";
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

  const title = `${doc.name} — ${doc.role} | ORWELL | POLÍTICA`;
  const description = `Perfil de ${doc.name}, ${doc.role} por ${doc.province}. Partido: ${doc.partyFull}.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "profile",
      siteName: "ORWELL | POLÍTICA",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

export default async function PoliticianPage({ params }: PageProps) {
  const { id } = await params;
  const doc = await fetchQuery(api.politicians.getByExternalId, {
    externalId: id,
  });
  if (!doc) notFound();

  const politician = toViewPolitician(doc);
  const isDeputy = politician.roleCategory === "Deputy";

  // Fetch dashboard data for deputies
  let dashboard = null;
  if (isDeputy) {
    try {
      dashboard = await fetchQuery(api.voting.getDeputyDashboard, {
        politicianId: doc._id,
      });
    } catch {
      // Dashboard data not yet available — graceful fallback
    }
  }

  const hasDashboard = dashboard?.profile != null;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <BackButton />
      <HeroSection politician={politician} />

      {/* Digital Presence & Official Links — always at top near hero */}
      <div className="mt-4 space-y-4">
        <SocialPresence accounts={politician.accounts} />
        <OfficialLinks politician={politician} />
      </div>

      {/* Deputy dashboard */}
      {isDeputy && hasDashboard && dashboard!.profile && (
        <div className="mt-6 space-y-6">
          {/* Score Cards */}
          <ScoreCards
            profile={dashboard!.profile}
            analytics={dashboard!.analytics}
            chamberStats={dashboard!.chamberStats}
          />

          {/* Transparency Section — Espacio Cívico data */}
          {dashboard!.transparency && (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                {dashboard!.transparency.performanceScores && (
                  <TransparencyScorecard
                    scores={dashboard!.transparency.performanceScores}
                    partyCode={dashboard!.profile.partyCode}
                    espacioCivicoUrl={dashboard!.transparency.espacioCivicoUrl}
                  />
                )}
                {dashboard!.transparency.commissions &&
                  dashboard!.transparency.commissions.length > 0 && (
                    <CommissionsCard
                      commissions={dashboard!.transparency.commissions}
                      partyCode={dashboard!.profile.partyCode}
                    />
                  )}
              </div>
              <TransparencyDetails
                suplente={dashboard!.transparency.suplente}
                planillaTotal={dashboard!.transparency.planillaTotal}
                biography={dashboard!.transparency.biography}
                documents={dashboard!.transparency.documents}
                voluntaryDeclarations={dashboard!.transparency.voluntaryDeclarations}
              />
            </>
          )}

          {/* Info Grid */}
          <InfoGrid politician={politician} />

          {/* Charts row: Donut + Timeline */}
          <div className="grid gap-4 sm:grid-cols-2">
            <VotingBreakdown profile={dashboard!.profile} />
            {dashboard!.analytics?.monthlyStats && (
              <VotingTimeline
                monthlyStats={dashboard!.analytics.monthlyStats}
                partyCode={dashboard!.profile.partyCode}
              />
            )}
          </div>

          {/* Attendance Heatmap */}
          {dashboard!.analytics?.attendanceDates && (
            <AttendanceHeatmap
              attendanceDates={dashboard!.analytics.attendanceDates}
              partyCode={dashboard!.profile.partyCode}
              totalSessions={dashboard!.chamberStats.totalSessions}
            />
          )}

          {/* Party Loyalty */}
          {dashboard!.analytics && (
            <PartyLoyalty
              analytics={dashboard!.analytics}
              partyCode={dashboard!.profile.partyCode}
            />
          )}

          {/* Controversial + Swing Votes */}
          {dashboard!.analytics && (
            <div className="grid gap-4 sm:grid-cols-2">
              <ControversialVotes
                votes={dashboard!.analytics.controversialVotes}
              />
              <SwingVotes votes={dashboard!.analytics.swingVotes} />
            </div>
          )}

          {/* Voting Alignment */}
          {dashboard!.analytics && (
            <VotingAlignment
              allies={dashboard!.analytics.topAllies}
              rivals={dashboard!.analytics.topRivals}
              ownPartyCode={dashboard!.profile.partyCode}
            />
          )}

          {/* Rankings */}
          {dashboard!.analytics && (
            <Rankings
              analytics={dashboard!.analytics}
              chamberStats={dashboard!.chamberStats}
              partyCode={dashboard!.profile.partyCode}
            />
          )}

          {/* Professional Profile */}
          {dashboard!.bio && <ProfessionalProfile bio={dashboard!.bio} />}

          {/* Recent Votes Table */}
          {dashboard!.recentVotes.length > 0 && (
            <RecentVotes votes={dashboard!.recentVotes} />
          )}
        </div>
      )}

      {/* Non-deputy layout OR deputy without dashboard data */}
      {(!isDeputy || !hasDashboard) && (
        <div className="mt-6 space-y-6">
          <InfoGrid politician={politician} />
        </div>
      )}
    </div>
  );
}
