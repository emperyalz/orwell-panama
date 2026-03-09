"use client";

import {
  Home,
  Car,
  Landmark,
  TrendingUp,
  CreditCard,
  BadgeDollarSign,
} from "lucide-react";
import { PARTY_COLORS } from "@/lib/constants";
import type { ExtractedPatrimonio } from "@/lib/types";
import { DashboardSection } from "./DashboardSection";

interface DeclaracionPatrimonioCardProps {
  data: ExtractedPatrimonio;
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

function AssetRow({
  label,
  value,
  sublabel,
}: {
  label: string;
  value?: string;
  sublabel?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-2 py-1">
      <div className="min-w-0">
        <p className="truncate text-xs text-[var(--foreground)]">{label}</p>
        {sublabel && (
          <p className="text-[10px] text-[var(--muted-foreground)]">
            {sublabel}
          </p>
        )}
      </div>
      {value && (
        <span className="shrink-0 text-xs font-medium text-[var(--foreground)]">
          {value}
        </span>
      )}
    </div>
  );
}

function AssetSection({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h4 className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-[var(--foreground)]">
        <Icon size={12} className="text-[var(--muted-foreground)]" />
        {title}
      </h4>
      <div className="divide-y divide-[var(--border)]">{children}</div>
    </div>
  );
}

export function DeclaracionPatrimonioCard({
  data,
  partyCode,
  pdfUrl,
}: DeclaracionPatrimonioCardProps) {
  const partyColor = PARTY_COLORS[partyCode] ?? "var(--foreground)";

  return (
    <DashboardSection title="Declaración Patrimonial">
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-[var(--muted-foreground)]">
            <BadgeDollarSign size={14} />
            Patrimonio Declarado
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

        {/* Net worth headline */}
        {data.patrimonioNeto && (
          <div className="mb-5 rounded-lg border border-[var(--border)] bg-[var(--accent)] p-4 text-center">
            <p className="text-xs font-medium uppercase tracking-wider text-[var(--muted-foreground)]">
              Patrimonio Neto
            </p>
            <p
              className="mt-1 text-2xl font-bold"
              style={{ color: partyColor }}
            >
              {data.patrimonioNeto}
            </p>
          </div>
        )}

        {/* Summary counters */}
        <div className="mb-5 flex justify-around">
          <CounterBadge
            count={data.totalInmuebles || data.bienesInmuebles.length}
            label="Inmuebles"
            icon={Home}
            color={partyColor}
          />
          <CounterBadge
            count={data.totalVehiculos || data.vehiculos.length}
            label="Vehículos"
            icon={Car}
            color={partyColor}
          />
          <CounterBadge
            count={data.totalCuentas || data.cuentasBancarias.length}
            label="Cuentas"
            icon={Landmark}
            color={partyColor}
          />
          <CounterBadge
            count={data.totalDeudas || data.deudas.length}
            label="Deudas"
            icon={CreditCard}
            color={partyColor}
          />
        </div>

        {/* Detail sections */}
        <div className="space-y-4">
          {data.bienesInmuebles.length > 0 && (
            <AssetSection title="Bienes Inmuebles" icon={Home}>
              {data.bienesInmuebles.map((b, i) => (
                <AssetRow
                  key={i}
                  label={b.descripcion}
                  sublabel={b.ubicacion}
                  value={b.valorEstimado}
                />
              ))}
            </AssetSection>
          )}

          {data.vehiculos.length > 0 && (
            <AssetSection title="Vehículos" icon={Car}>
              {data.vehiculos.map((v, i) => (
                <AssetRow
                  key={i}
                  label={v.descripcion}
                  value={v.valorEstimado}
                />
              ))}
            </AssetSection>
          )}

          {data.cuentasBancarias.length > 0 && (
            <AssetSection title="Cuentas Bancarias" icon={Landmark}>
              {data.cuentasBancarias.map((c, i) => (
                <AssetRow
                  key={i}
                  label={`${c.banco} — ${c.tipo}`}
                  value={c.montoAproximado}
                />
              ))}
            </AssetSection>
          )}

          {data.inversiones.length > 0 && (
            <AssetSection title="Inversiones" icon={TrendingUp}>
              {data.inversiones.map((inv, i) => (
                <AssetRow
                  key={i}
                  label={inv.descripcion}
                  sublabel={inv.tipo}
                  value={inv.valorEstimado}
                />
              ))}
            </AssetSection>
          )}

          {data.deudas.length > 0 && (
            <AssetSection title="Deudas" icon={CreditCard}>
              {data.deudas.map((d, i) => (
                <AssetRow
                  key={i}
                  label={d.acreedor}
                  sublabel={d.tipo}
                  value={d.montoAproximado}
                />
              ))}
            </AssetSection>
          )}
        </div>
      </div>
    </DashboardSection>
  );
}
