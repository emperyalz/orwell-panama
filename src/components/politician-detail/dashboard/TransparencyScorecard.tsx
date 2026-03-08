"use client";

import { PARTY_COLORS } from "@/lib/constants";

interface PerformanceScores {
  calificacionPonderada?: number;
  asistenciaPleno?: number;
  asistenciaComisiones?: number;
  viajesViaticos?: number;
  declaracionIntereses?: number;
  declaracionPatrimonio?: number;
}

interface TransparencyScorecardProps {
  scores: PerformanceScores;
  partyCode: string;
  espacioCivicoUrl?: string;
}

function getScoreLabel(score: number): { text: string; color: string } {
  if (score >= 4.5) return { text: "Excelente", color: "#22c55e" };
  if (score >= 3.5) return { text: "Bueno", color: "#84cc16" };
  if (score >= 2.5) return { text: "Regular", color: "#f59e0b" };
  return { text: "Deficiente", color: "#ef4444" };
}

function ScoreBar({
  label,
  score,
  maxScore = 5,
  color,
}: {
  label: string;
  score: number;
  maxScore?: number;
  color: string;
}) {
  const pct = (score / maxScore) * 100;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-[var(--muted-foreground)]">{label}</span>
        <span className="font-semibold text-[var(--foreground)]">
          {score.toFixed(1)}
        </span>
      </div>
      <div className="h-2 w-full rounded-full bg-[var(--border)]">
        <div
          className="h-2 rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

export function TransparencyScorecard({
  scores,
  partyCode,
  espacioCivicoUrl,
}: TransparencyScorecardProps) {
  const overall = scores.calificacionPonderada ?? 0;
  const label = getScoreLabel(overall);
  const partyColor = PARTY_COLORS[partyCode] ?? "var(--foreground)";

  const criteria = [
    { key: "asistenciaPleno", label: "Asistencia Pleno" },
    { key: "asistenciaComisiones", label: "Asistencia Comisiones" },
    { key: "viajesViaticos", label: "Viajes y Viáticos" },
    { key: "declaracionIntereses", label: "Declaración de Intereses" },
    { key: "declaracionPatrimonio", label: "Declaración de Patrimonio" },
  ] as const;

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-bold uppercase tracking-wider text-[var(--muted-foreground)]">
          Transparencia
        </h3>
        {espacioCivicoUrl && (
          <a
            href={espacioCivicoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
          >
            Espacio Cívico ↗
          </a>
        )}
      </div>

      {/* Overall score */}
      <div className="mb-5 flex items-center gap-4">
        <div
          className="flex h-16 w-16 items-center justify-center rounded-2xl text-white"
          style={{ backgroundColor: label.color }}
        >
          <span className="text-2xl font-bold">{overall.toFixed(1)}</span>
        </div>
        <div>
          <p className="text-lg font-bold text-[var(--foreground)]">
            {label.text}
          </p>
          <p className="text-xs text-[var(--muted-foreground)]">
            Calificación Ponderada (de 5.0)
          </p>
        </div>
      </div>

      {/* Breakdown bars */}
      <div className="space-y-3">
        {criteria.map(({ key, label: barLabel }) => {
          const score = scores[key];
          if (score == null) return null;
          return (
            <ScoreBar
              key={key}
              label={barLabel}
              score={score}
              color={partyColor}
            />
          );
        })}
      </div>
    </div>
  );
}
