import { Suspense } from "react";
import {
  getAllPoliticians,
  getUniqueParties,
  getUniqueProvinces,
  getTotalAccounts,
} from "@/lib/politicians";
import { PoliticianGrid } from "@/components/politicians/PoliticianGrid";

export default function HomePage() {
  const politicians = getAllPoliticians();
  const parties = getUniqueParties();
  const provinces = getUniqueProvinces();
  const totalAccounts = getTotalAccounts();

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Hero */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-[var(--foreground)]">
          Directorio de Políticos de Panamá
        </h1>
        <p className="mt-2 text-[var(--muted-foreground)]">
          {politicians.length} políticos · {totalAccounts} cuentas de
          redes sociales verificadas
        </p>
      </div>

      {/* Grid with filters */}
      <Suspense
        fallback={
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
        }
      >
        <PoliticianGrid
          politicians={politicians}
          parties={parties}
          provinces={provinces}
        />
      </Suspense>
    </div>
  );
}
