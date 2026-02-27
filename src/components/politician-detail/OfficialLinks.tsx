import type { Politician } from "@/lib/types";

interface OfficialLinksProps {
  politician: Politician;
}

export function OfficialLinks({ politician }: OfficialLinksProps) {
  const wikipediaUrl = `https://es.wikipedia.org/wiki/Special:Search?search=${encodeURIComponent(politician.name)}`;

  return (
    <section>
      <h2 className="mb-4 text-lg font-bold text-[var(--foreground)]">
        Enlaces Oficiales
      </h2>

      <div className="flex flex-wrap gap-3">
        {politician.officialGovUrl && (
          <a
            href={politician.officialGovUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--card)] px-4 py-2 text-sm font-medium text-[var(--card-foreground)] transition-colors hover:bg-[var(--accent)]"
          >
            <img
              src="/icons/official/asamblea-nacional.png"
              alt="Asamblea Nacional"
              className="h-5 w-5 shrink-0"
            />
            Perfil Oficial
          </a>
        )}

        <a
          href={wikipediaUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--card)] px-4 py-2 text-sm font-medium text-[var(--card-foreground)] transition-colors hover:bg-[var(--accent)]"
        >
          <img
            src="/icons/official/wikipedia.svg"
            alt="Wikipedia"
            className="h-5 w-5 shrink-0 dark:invert"
          />
          Wikipedia
        </a>
      </div>
    </section>
  );
}
