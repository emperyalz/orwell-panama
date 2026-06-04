import { PartiesGrid } from "@/components/parties/PartiesGrid";

export const metadata = {
  title: "Partidos | ORWELL POLÍTICA",
  description:
    "Los partidos políticos de Panamá: logos, líderes, historia, redes sociales y enlaces oficiales.",
};

export default function PartidosPage() {
  return (
    <>
      {/* Page hero */}
      <div className="bg-[#111]">
        <div className="mx-auto max-w-7xl px-4 pt-8 pb-6 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold tracking-tight text-white">
            Partidos
          </h1>
          <p className="mt-2 text-xs text-neutral-400">
            Los partidos políticos de Panamá: liderazgo, historia y presencia
            digital verificada
          </p>
        </div>
      </div>

      {/* Cards grid */}
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <PartiesGrid />
      </div>
    </>
  );
}
