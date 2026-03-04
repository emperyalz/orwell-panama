// Static server-safe component — no "use client" needed

interface PartySlice {
  code: string;
  count: number;
  color: string;
}

interface TierData {
  label: string;
  sublabel: string;
  total: number;
  slices: PartySlice[];
  comingSoon?: boolean;
}

interface GovernmentChartProps {
  tiers: TierData[];
}

export function GovernmentChart({ tiers }: GovernmentChartProps) {
  return (
    <div className="flex h-full flex-col justify-center gap-3.5">
      {/* Header */}
      <div className="flex items-center gap-2">
        <span className="h-4 w-0.5 shrink-0 rounded-full bg-red-600" />
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#888]">
          Composición del Gobierno
        </p>
      </div>

      {/* Tiers */}
      <div className="space-y-3">
        {tiers.map((tier) => (
          <div key={tier.label}>
            {/* Tier label row */}
            <div className="mb-1.5 flex items-baseline justify-between">
              <span className="text-[11px] font-semibold text-white/90">{tier.label}</span>
              {!tier.comingSoon && (
                <span className="text-[10px] tabular-nums text-[#555]">
                  {tier.total} total
                </span>
              )}
            </div>

            {tier.comingSoon ? (
              /* Coming soon placeholder bar */
              <div className="flex h-4 items-center overflow-hidden rounded">
                <div className="h-full w-full rounded bg-[#222] flex items-center px-2">
                  <span className="text-[8px] font-semibold uppercase tracking-[0.25em] text-[#444]">
                    Próximamente
                  </span>
                </div>
              </div>
            ) : (
              <>
                {/* Stacked bar */}
                <div className="flex h-4 w-full overflow-hidden rounded">
                  {tier.slices.map((slice) => {
                    const pct = (slice.count / tier.total) * 100;
                    return (
                      <div
                        key={slice.code}
                        title={`${slice.code}: ${slice.count}`}
                        style={{ width: `${pct}%`, backgroundColor: slice.color }}
                        className="relative flex items-center justify-center"
                      >
                        {/* Show count inside bar only if wide enough */}
                        {pct >= 10 && (
                          <span className="text-[8px] font-bold text-white/90 drop-shadow-sm select-none">
                            {slice.count}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Legend */}
                <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5">
                  {tier.slices.map((slice) => (
                    <div key={slice.code} className="flex items-center gap-1">
                      <span
                        className="h-1.5 w-1.5 shrink-0 rounded-sm"
                        style={{ backgroundColor: slice.color }}
                      />
                      <span className="text-[9px] text-[#999]">
                        {slice.code}
                        <span className="ml-0.5 text-[#555]">({slice.count})</span>
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
