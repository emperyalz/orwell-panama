import { Newspaper } from "lucide-react";

export function NewsPlaceholder() {
  return (
    <section>
      <h2 className="mb-4 text-lg font-bold text-[var(--foreground)]">
        Noticias
      </h2>

      <div className="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-[var(--border)] bg-[var(--muted)]/30 px-6 py-12 opacity-60">
        <Newspaper className="h-10 w-10 text-[var(--muted-foreground)]" />
        <p className="text-sm font-medium text-[var(--muted-foreground)]">
          Próximamente
        </p>
      </div>
    </section>
  );
}
