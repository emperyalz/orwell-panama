"use client";

import {
  FileText,
  Target,
  Users,
  Tag,
  BarChart3,
  DollarSign,
} from "lucide-react";
import { PARTY_COLORS } from "@/lib/constants";
import type { ExtractedPropuesta } from "@/lib/types";
import { DashboardSection } from "./DashboardSection";

interface PolicyProposalCardProps {
  data: ExtractedPropuesta;
  partyCode: string;
  pdfUrl?: string;
}

export function PolicyProposalCard({
  data,
  partyCode,
  pdfUrl,
}: PolicyProposalCardProps) {
  const partyColor = PARTY_COLORS[partyCode] ?? "var(--foreground)";

  return (
    <DashboardSection title="Propuesta Política">
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5">
        {/* Header with link */}
        <div className="mb-4 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-[var(--muted-foreground)]">
            <FileText size={14} />
            Plan de Gobierno
          </h3>
          {pdfUrl && (
            <a
              href={pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)]"
            >
              Ver PDF ↗
            </a>
          )}
        </div>

        {/* Executive summary */}
        {data.resumenEjecutivo && (
          <blockquote className="mb-4 border-l-2 pl-3 text-sm italic text-[var(--muted-foreground)]" style={{ borderColor: partyColor }}>
            {data.resumenEjecutivo}
          </blockquote>
        )}

        {/* Priority themes */}
        {data.temasPrioritarios.length > 0 && (
          <div className="mb-4">
            <h4 className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-[var(--foreground)]">
              <Tag size={12} className="text-[var(--muted-foreground)]" />
              Temas Prioritarios
            </h4>
            <div className="flex flex-wrap gap-1.5">
              {data.temasPrioritarios.map((tema, i) => (
                <span
                  key={i}
                  className="rounded-full px-2.5 py-0.5 text-xs font-medium text-white"
                  style={{ backgroundColor: partyColor, opacity: 0.85 }}
                >
                  {tema}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Strategic areas */}
        {data.areasEstrategicas.length > 0 && (
          <div className="mb-4">
            <h4 className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-[var(--foreground)]">
              <Target size={12} className="text-[var(--muted-foreground)]" />
              Áreas Estratégicas
            </h4>
            <div className="space-y-2">
              {data.areasEstrategicas.map((area, i) => (
                <div key={i}>
                  <p className="text-sm font-medium text-[var(--foreground)]">
                    {area.area}
                  </p>
                  {area.propuestas.length > 0 && (
                    <ul className="ml-4 mt-1 space-y-0.5">
                      {area.propuestas.slice(0, 3).map((p, j) => (
                        <li
                          key={j}
                          className="text-xs text-[var(--muted-foreground)]"
                        >
                          • {p}
                        </li>
                      ))}
                      {area.propuestas.length > 3 && (
                        <li className="text-xs text-[var(--muted-foreground)] opacity-60">
                          +{area.propuestas.length - 3} más
                        </li>
                      )}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Key promises */}
        {data.promesasClave.length > 0 && (
          <div className="mb-4">
            <h4 className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-[var(--foreground)]">
              <BarChart3 size={12} className="text-[var(--muted-foreground)]" />
              Promesas Clave
            </h4>
            <ol className="ml-4 space-y-1">
              {data.promesasClave.map((p, i) => (
                <li key={i} className="text-xs text-[var(--muted-foreground)]">
                  <span className="mr-1.5 inline-flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold text-white" style={{ backgroundColor: partyColor }}>
                    {i + 1}
                  </span>
                  {p}
                </li>
              ))}
            </ol>
          </div>
        )}

        {/* Beneficiary groups + Budget + KPI badges */}
        <div className="flex flex-wrap items-center gap-2">
          {data.gruposBeneficiarios.length > 0 && (
            <div className="flex items-center gap-1.5">
              <Users size={12} className="text-[var(--muted-foreground)]" />
              {data.gruposBeneficiarios.map((g, i) => (
                <span
                  key={i}
                  className="rounded bg-[var(--accent)] px-2 py-0.5 text-[10px] text-[var(--foreground)]"
                >
                  {g}
                </span>
              ))}
            </div>
          )}
          {data.presupuestoMencionado && (
            <span className="inline-flex items-center gap-1 rounded-full bg-yellow-500/10 px-2 py-0.5 text-[10px] font-medium text-yellow-600">
              <DollarSign size={10} />
              {data.presupuestoMencionado}
            </span>
          )}
          {data.tieneIndicadores && (
            <span className="inline-flex items-center gap-1 rounded-full bg-green-500/10 px-2 py-0.5 text-[10px] font-medium text-green-600">
              <BarChart3 size={10} />
              Tiene indicadores
            </span>
          )}
        </div>
      </div>
    </DashboardSection>
  );
}
