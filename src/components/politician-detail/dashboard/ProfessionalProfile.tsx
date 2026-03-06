"use client";

import { Briefcase, GraduationCap, Building, Globe, Mail } from "lucide-react";
import type { DeputyBio } from "@/lib/types";
import { DashboardSection } from "./DashboardSection";

interface ProfessionalProfileProps {
  bio: DeputyBio;
}

function TimelineItem({
  items,
  icon: Icon,
  title,
}: {
  items: { primary: string; secondary?: string; date?: string }[];
  icon: React.ComponentType<{ size?: number; className?: string }>;
  title: string;
}) {
  if (items.length === 0) return null;

  return (
    <div>
      <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold text-[var(--foreground)]">
        <Icon size={14} className="text-[var(--muted-foreground)]" />
        {title}
      </h4>
      <div className="ml-5 space-y-2 border-l border-[var(--border)] pl-4">
        {items.map((item, i) => (
          <div key={i}>
            <p className="text-sm text-[var(--foreground)]">{item.primary}</p>
            {item.secondary && (
              <p className="text-xs text-[var(--muted-foreground)]">
                {item.secondary}
              </p>
            )}
            {item.date && (
              <p className="text-[10px] text-[var(--muted-foreground)]">
                {item.date}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export function ProfessionalProfile({ bio }: ProfessionalProfileProps) {
  const sd = bio.structuredData;

  const education = (sd?.educacion ?? []).map((e) => ({
    primary: e.titulo ?? "Título no especificado",
    secondary: e.institucion,
    date: e.periodo,
  }));

  const career = (sd?.experienciaLaboral ?? []).map((e) => ({
    primary: e.cargo ?? "Cargo no especificado",
    secondary: e.empresa,
    date: e.periodo,
  }));

  const political = (sd?.cargosPoliticos ?? []).map((e) => ({
    primary: e.cargo ?? "Cargo no especificado",
    secondary: e.partido,
    date: e.periodo,
  }));

  return (
    <DashboardSection title="Perfil Profesional">
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
        {/* AI Summary */}
        {bio.aiSummary && (
          <blockquote className="mb-4 border-l-2 border-[var(--muted-foreground)] pl-3 text-sm italic text-[var(--muted-foreground)]">
            {bio.aiSummary}
          </blockquote>
        )}

        {/* Key Qualifications */}
        {bio.aiKeyQualifications && bio.aiKeyQualifications.length > 0 && (
          <div className="mb-4 flex flex-wrap gap-1.5">
            {bio.aiKeyQualifications.map((q, i) => (
              <span
                key={i}
                className="rounded-full bg-[var(--accent)] px-2.5 py-0.5 text-xs text-[var(--foreground)]"
              >
                {q}
              </span>
            ))}
          </div>
        )}

        {/* Timelines */}
        <div className="space-y-5">
          <TimelineItem items={education} icon={GraduationCap} title="Educación" />
          <TimelineItem items={career} icon={Briefcase} title="Experiencia Laboral" />
          <TimelineItem items={political} icon={Building} title="Cargos Políticos" />
        </div>

        {/* Languages */}
        {sd?.idiomas && sd.idiomas.length > 0 && (
          <div className="mt-4 flex items-center gap-2">
            <Globe size={14} className="text-[var(--muted-foreground)]" />
            <div className="flex flex-wrap gap-1.5">
              {sd.idiomas.map((lang, i) => (
                <span
                  key={i}
                  className="rounded bg-[var(--accent)] px-2 py-0.5 text-xs text-[var(--foreground)]"
                >
                  {lang}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Email */}
        {bio.correo && (
          <div className="mt-3 flex items-center gap-2 text-sm">
            <Mail size={14} className="text-[var(--muted-foreground)]" />
            <a
              href={`mailto:${bio.correo}`}
              className="text-blue-400 hover:underline"
            >
              {bio.correo}
            </a>
          </div>
        )}
      </div>
    </DashboardSection>
  );
}
