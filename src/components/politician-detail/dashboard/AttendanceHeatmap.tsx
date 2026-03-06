"use client";

import { useMemo } from "react";
import { PARTY_COLORS } from "@/lib/constants";
import { DashboardSection } from "./DashboardSection";

interface AttendanceHeatmapProps {
  attendanceDates: string[]; // ["2024-01-15", ...]
  partyCode: string;
  totalSessions: number;
}

export function AttendanceHeatmap({
  attendanceDates,
  partyCode,
  totalSessions,
}: AttendanceHeatmapProps) {
  const partyColor = PARTY_COLORS[partyCode] ?? "var(--foreground)";
  const attendedSet = useMemo(() => new Set(attendanceDates), [attendanceDates]);

  // Generate grid for the last 12 months
  const { weeks, months } = useMemo(() => {
    const today = new Date();
    const startDate = new Date(today);
    startDate.setMonth(startDate.getMonth() - 12);
    // Align to Monday
    startDate.setDate(startDate.getDate() - ((startDate.getDay() + 6) % 7));

    const weeks: { date: Date; attended: boolean }[][] = [];
    let currentWeek: { date: Date; attended: boolean }[] = [];
    const months: { label: string; col: number }[] = [];

    const MONTHS_ES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
    let lastMonth = -1;

    const d = new Date(startDate);
    while (d <= today) {
      const dateStr = d.toISOString().slice(0, 10);
      const attended = attendedSet.has(dateStr);
      currentWeek.push({ date: new Date(d), attended });

      // Track month labels
      if (d.getMonth() !== lastMonth) {
        months.push({ label: MONTHS_ES[d.getMonth()], col: weeks.length });
        lastMonth = d.getMonth();
      }

      if (d.getDay() === 0) {
        weeks.push(currentWeek);
        currentWeek = [];
      }
      d.setDate(d.getDate() + 1);
    }
    if (currentWeek.length > 0) weeks.push(currentWeek);

    return { weeks, months };
  }, [attendedSet]);

  const cellSize = 11;
  const gap = 2;
  const totalWidth = weeks.length * (cellSize + gap);

  if (attendanceDates.length === 0) {
    return (
      <DashboardSection title="Calendario de Asistencia">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 text-center text-sm text-[var(--muted-foreground)]">
          Sin datos de asistencia disponibles
        </div>
      </DashboardSection>
    );
  }

  return (
    <DashboardSection title="Calendario de Asistencia">
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
        <div className="overflow-x-auto">
          {/* Month labels */}
          <div className="mb-1 flex text-[10px] text-[var(--muted-foreground)]" style={{ paddingLeft: 0 }}>
            {months.map((m, i) => (
              <span
                key={i}
                className="shrink-0"
                style={{
                  position: "relative",
                  left: m.col * (cellSize + gap),
                  marginRight: i < months.length - 1
                    ? (months[i + 1].col - m.col) * (cellSize + gap) - 30
                    : 0,
                }}
              >
                {m.label}
              </span>
            ))}
          </div>
          {/* Grid */}
          <svg width={totalWidth} height={7 * (cellSize + gap)} className="block">
            {weeks.map((week, wi) =>
              week.map((day, di) => (
                <rect
                  key={`${wi}-${di}`}
                  x={wi * (cellSize + gap)}
                  y={((day.date.getDay() + 6) % 7) * (cellSize + gap)}
                  width={cellSize}
                  height={cellSize}
                  rx={2}
                  fill={day.attended ? partyColor : "var(--border)"}
                  opacity={day.attended ? 1 : 0.3}
                >
                  <title>
                    {day.date.toLocaleDateString("es-PA")}
                    {day.attended ? " — Presente" : ""}
                  </title>
                </rect>
              ))
            )}
          </svg>
        </div>
        {/* Legend */}
        <p className="mt-3 text-xs text-[var(--muted-foreground)]">
          {attendanceDates.length} de {totalSessions} sesiones —{" "}
          <span className="font-medium text-[var(--foreground)]">
            {totalSessions > 0 ? Math.round((attendanceDates.length / totalSessions) * 100) : 0}%
          </span>{" "}
          asistencia
        </p>
      </div>
    </DashboardSection>
  );
}
