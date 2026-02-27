import { PLATFORM_CONFIG } from "@/lib/constants";

const PLACEHOLDER_PLATFORMS = ["instagram", "x_twitter", "tiktok"] as const;

export function SocialPostsPlaceholder() {
  return (
    <section>
      <h2 className="mb-4 text-lg font-bold text-[var(--foreground)]">
        Últimas Publicaciones
      </h2>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {PLACEHOLDER_PLATFORMS.map((platform) => {
          const config = PLATFORM_CONFIG[platform];

          return (
            <div
              key={platform}
              className="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-[var(--border)] bg-[var(--muted)]/30 px-6 py-10 opacity-60"
            >
              <img
                src={config.icon}
                alt={config.label}
                className="h-8 w-8 opacity-50"
              />
              <p className="text-xs font-medium text-[var(--muted-foreground)]">
                Próximamente
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
