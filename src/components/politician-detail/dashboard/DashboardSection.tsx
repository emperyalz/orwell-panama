"use client";

interface DashboardSectionProps {
  title: string;
  children: React.ReactNode;
  className?: string;
}

export function DashboardSection({
  title,
  children,
  className = "",
}: DashboardSectionProps) {
  return (
    <section className={className}>
      <h2 className="mb-4 text-lg font-bold text-[var(--foreground)]">
        {title}
      </h2>
      {children}
    </section>
  );
}
