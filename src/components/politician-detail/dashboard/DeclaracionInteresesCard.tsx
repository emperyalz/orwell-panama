"use client";

import {
  Building2,
  Users,
  Wallet,
  AlertTriangle,
  UserCheck,
} from "lucide-react";
import { PARTY_COLORS } from "@/lib/constants";
import type { ExtractedIntereses } from "@/lib/types";
import { DashboardSection } from "./DashboardSection";

interface DeclaracionInteresesCardProps {
  data: ExtractedIntereses;
  partyCode: string;
  pdfUrl?: string;
}

function CounterBadge({
  count,
  label,
  icon: Icon,
  color,
}: {
  count: number;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  color: string;
}) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className="flex h-10 w-10 items-center justify-center rounded-xl text-white"
        style={{ backgroundColor: color, opacity: 0.85 }}
      >
        <Icon size={18} />
      </div>
      <span className="text-lg font-bold text-[var(--foreground)]">{count}</span>
      <span className="text-[10px] text-[var(--muted-foreground)]">{label}</span>
    </div>
  );
}

function ListSection({
  title,
  icon: Icon,
  items,
}: {
  title: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  items: { primary: string; secondary?: string; badge?: string }[];
}) {
  if (items.length === 0) return null;
  return (
    <div>
      <h4 className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-[var(--foreground)]">
        <Icon size={12} className="text-[var(--muted-foreground)]" />
        {title}
      </h4>
      <div className="space-y-1.5">
        {items.map((item, i) => (
          <div key={i} className="flex items-start justify-between gap-2">
            <div>
              <p className="text-xs text-[var(--foreground)]">{item.primary}</p>
              {item.secondary && (
                <p className="text-[10px] text-[var(--muted-foreground)]">
                  {item.secondary}
                </p>
              )}
            </div>
            {item.badge && (
              <span className="shrink-0 rounded bg-[var(--accent)] px-1.5 py-0.5 text-[10px] text-[var(--muted-foreground)]">
                {item.badge}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export function DeclaracionInteresesCard({
  data,
  partyCode,
  pdfUrl,
}: DeclaracionInteresesCardProps) {
  const partyColor = PARTY_COLORS[partyCode] ?? "var(--foreground)";

  const businessItems = data.actividadesComerciales.map((a) => ({
    primary: a.empresa,
    secondary: a.cargo,
    badge: a.tipo,
  }));

  const membershipItems = data.membresias.map((m) => ({
    primary: m.organizacion,
    secondary: m.cargo,
  }));

  const incomeItems = data.fuentesIngreso.map((f) => ({
    primary: f.fuente,
    badge: f.tipo,
  }));

  const relativesItems = data.parientesEnGobierno.map((r) => ({
    primary: `${r.nombre} — ${r.cargo}`,
    secondary: `Relación: ${r.relacion}`,
  }));

  return (
    <DashboardSection title="Declaración de Intereses">
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-[var(--muted-foreground)]">
            <Building2 size={14} />
            Intereses Declarados
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

        {/* Summary counters */}
        <div className="mb-5 flex justify-around">
          <CounterBadge
            count={data.totalEmpresas || data.actividadesComerciales.length}
            label="Empresas"
            icon={Building2}
            color={partyColor}
          />
          <CounterBadge
            count={data.totalMembresias || data.membresias.length}
            label="Membresías"
            icon={Users}
            color={partyColor}
          />
          <CounterBadge
            count={data.totalFuentesIngreso || data.fuentesIngreso.length}
            label="Fuentes Ingreso"
            icon={Wallet}
            color={partyColor}
          />
        </div>

        {/* Detail sections */}
        <div className="space-y-4">
          <ListSection
            title="Actividades Comerciales"
            icon={Building2}
            items={businessItems}
          />
          <ListSection
            title="Membresías"
            icon={Users}
            items={membershipItems}
          />
          <ListSection
            title="Fuentes de Ingreso"
            icon={Wallet}
            items={incomeItems}
          />

          {data.parientesEnGobierno.length > 0 && (
            <ListSection
              title="Parientes en Gobierno"
              icon={UserCheck}
              items={relativesItems}
            />
          )}

          {data.conflictosDeclarados.length > 0 && (
            <div>
              <h4 className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-yellow-600">
                <AlertTriangle size={12} />
                Conflictos Declarados
              </h4>
              <ul className="space-y-1">
                {data.conflictosDeclarados.map((c, i) => (
                  <li
                    key={i}
                    className="rounded border border-yellow-500/20 bg-yellow-500/5 px-2.5 py-1.5 text-xs text-[var(--foreground)]"
                  >
                    {c}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </DashboardSection>
  );
}
