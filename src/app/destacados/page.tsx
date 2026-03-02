import { FeaturedHero } from "@/components/featured/FeaturedHero";
import { VideoSection } from "@/components/featured/VideoSection";
import { NewsFeed } from "@/components/featured/NewsFeed";

export const metadata = {
  title: "Destacados | ORWELL POLÍTICA",
  description: "Las historias y análisis más relevantes de la política panameña.",
};

export default function DestacadosPage() {
  return (
    <>
      {/* Page hero */}
      <div className="bg-[#111]">
        <div className="mx-auto max-w-7xl px-4 pt-8 pb-6 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold tracking-tight text-white">
            Destacados
          </h1>
          <p className="mt-2 text-xs text-neutral-400">
            Las historias y análisis más relevantes de la política panameña
          </p>
        </div>
      </div>

      {/* Featured hero (3-card grid) */}
      <FeaturedHero />

      {/* Video section (up to 12 videos) */}
      <VideoSection />

      {/* More news feed + sidebar */}
      <NewsFeed />
    </>
  );
}
