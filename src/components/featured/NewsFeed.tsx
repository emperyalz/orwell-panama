"use client";

import Link from "next/link";
import { useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Article {
  id: number;
  category: string;
  timeAgo: string;
  title: string;
  excerpt?: string;
  image: string;
  href: string;
}

// ─── Placeholder data (wire to Convex articles table when ready) ──────────────

const MAIN_ARTICLES: Article[] = [
  {
    id: 1,
    category: "Publicación Destacada",
    timeAgo: "1 año atrás",
    title: "Edmundo González visita Panamá: un paso más en la crisis venezolana",
    excerpt:
      "Panamá recibió al líder de la oposición venezolana, Edmundo González Urrutia, en una visita que busca reforzar su victoria en las elecciones presidenciales.",
    image: "/images/headshots/GOV-005.jpg",
    href: "#",
  },
  {
    id: 2,
    category: "Publicación Destacada",
    timeAgo: "2 años atrás",
    title: "Falsos aplausos: la operación de cuentas X coordinadas para impulsar a Torrijos",
    excerpt:
      "Una red de cuentas en Twitter con pocas interacciones orgánicas publica contenido a favor del candidato Martín Torrijos, a la vez que ataca a sus rivales.",
    image: "/images/headshots/DEP-015.jpg",
    href: "#",
  },
  {
    id: 3,
    category: "Noticias",
    timeAgo: "1 año atrás",
    title: "Panamá conmemora el 35° aniversario de la invasión con una romería en el Jardín de Paz",
    excerpt:
      "A 35 años de la invasión de Estados Unidos a Panamá, se llevó a cabo una solemne romería en el Cementerio Jardín de Paz para recordar a las víctimas.",
    image: "/images/headshots/DEP-033.jpg",
    href: "#",
  },
  {
    id: 4,
    category: "Opinión",
    timeAgo: "1 año atrás",
    title: "Reflexión sobre la generación energética solar en Panamá y la sostenibilidad",
    excerpt:
      "Como especialista en Gestión y Planificación Ambiental, analizo el potencial del país para transitar hacia una matriz energética más limpia y sostenible.",
    image: "/images/headshots/DEP-044.jpg",
    href: "#",
  },
  {
    id: 5,
    category: "Opinión",
    timeAgo: "1 año atrás",
    title: "Un compromiso con las comunidades afectadas por el cierre de Cobre Panamá",
    excerpt:
      "A un año del cese de operaciones de Cobre Panamá, es evidente la profunda huella que ha dejado en las comunidades aledañas.",
    image: "/images/headshots/GOV-006.jpg",
    href: "#",
  },
  {
    id: 6,
    category: "Noticias",
    timeAgo: "1 año atrás",
    title: "¡Mulino no se guarda nada y le suelta sus verdades a Nicaragua!",
    excerpt:
      "El presidente José Raúl Mulino le dio una cachetada diplomática a Nicaragua al afirmar que es un país que 'no respeta los derechos humanos'.",
    image: "/images/headshots/PRES-001.jpg",
    href: "#",
  },
];

const LATEST_ARTICLES: Article[] = [
  {
    id: 10,
    category: "Opinión",
    timeAgo: "2 semanas atrás",
    title: "Homo administrator (Primates: Hominidae): la especie que necesita el mundo de hoy",
    image: "/images/headshots/DEP-062.jpg",
    href: "#",
  },
  {
    id: 11,
    category: "Opinión",
    timeAgo: "1 año atrás",
    title: "Tres versiones de una misma reunión: ¿A quién le creemos?",
    image: "/images/headshots/GOV-001.jpg",
    href: "#",
  },
  {
    id: 12,
    category: "Noticias",
    timeAgo: "1 año atrás",
    title: "Panamá conmemora la gesta patriótica del 9 de enero de 1964 en ceremonia solemne",
    image: "/images/headshots/GOV-002.jpg",
    href: "#",
  },
];

const POPULAR_ARTICLES: Article[] = [
  {
    id: 20,
    category: "Judiciales",
    timeAgo: "3 años atrás",
    title: "Notifican e imputan a Zulay Rodríguez",
    image: "/images/headshots/DEP-026.jpg",
    href: "#",
  },
  {
    id: 21,
    category: "Sociedad",
    timeAgo: "3 años atrás",
    title: "IFARHU publica calendario para segundo cobro de becas del primer trimestre",
    image: "/images/headshots/DEP-041.jpg",
    href: "#",
  },
  {
    id: 22,
    category: "Sociedad",
    timeAgo: "3 años atrás",
    title: "Jubilados y pensionados recibirán su pago mañana",
    image: "/images/headshots/DEP-055.jpg",
    href: "#",
  },
];

const TAGS = [
  "asamblea nacional", "blanqueo de capitales", "caja de seguro social",
  "cambio democrático", "chiriquí", "cobre panamá", "colón",
  "contrato minero", "coronavirus", "corrupción", "Corte Suprema de Justicia",
  "Covid-19", "CSS", "educación", "elecciones 2024", "EN LA MIRA",
  "Estados Unidos", "Featured", "glosas", "Laurentino Cortizo",
  "lavado de dinero", "martinelli", "meduca", "MINERA PANAMÁ",
  "ministerio público", "Minsa", "narcotráfico", "nito cortizo",
  "Odebrecht", "Panamá", "peculado", "policía nacional", "PRD",
  "protestas", "Realizando Metas", "Ricardo Martinelli",
  "Tribunal Electoral", "Yanibel Ábrego", "Zulay Rodríguez",
];

// ─── Category badge colors ────────────────────────────────────────────────────

function categoryColor(cat: string) {
  if (cat.toLowerCase().includes("destacada") || cat.toLowerCase().includes("featured"))
    return "text-red-600";
  if (cat.toLowerCase().includes("opinión") || cat.toLowerCase().includes("opinion"))
    return "text-amber-600";
  if (cat.toLowerCase().includes("judicial"))
    return "text-purple-600";
  return "text-blue-600";
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionDivider({ label }: { label: string }) {
  return (
    <div className="my-8 flex items-center gap-4">
      <div className="h-px flex-1 bg-[var(--border)]" />
      <span className="rounded-sm border border-red-600 px-3 py-0.5 text-[10px] font-bold uppercase tracking-[0.25em] text-red-600">
        {label}
      </span>
      <div className="h-px flex-1 bg-[var(--border)]" />
    </div>
  );
}

function MainArticleCard({ article }: { article: Article }) {
  return (
    <Link
      href={article.href}
      className="group flex gap-4 py-5 border-b border-[var(--border)] last:border-b-0 hover:opacity-80 transition-opacity"
    >
      {/* Thumbnail */}
      <div className="w-28 h-20 shrink-0 overflow-hidden rounded-lg sm:w-36 sm:h-24">
        <img
          src={article.image}
          alt={article.title}
          className="h-full w-full object-cover object-top transition-transform duration-300 group-hover:scale-105"
        />
      </div>

      {/* Content */}
      <div className="flex flex-col justify-center gap-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-[10px] font-bold uppercase tracking-wide ${categoryColor(article.category)}`}>
            {article.category}
          </span>
          <span className="text-[10px] text-[var(--muted-foreground)]">{article.timeAgo}</span>
        </div>
        <h3 className="text-sm font-bold leading-snug text-[var(--foreground)] line-clamp-2 sm:text-base">
          {article.title}
        </h3>
        {article.excerpt && (
          <p className="hidden text-xs text-[var(--muted-foreground)] line-clamp-2 sm:block">
            {article.excerpt}
          </p>
        )}
      </div>
    </Link>
  );
}

function SidebarArticleCard({ article }: { article: Article }) {
  return (
    <Link
      href={article.href}
      className="group flex gap-3 py-3 border-b border-[var(--border)] last:border-b-0 hover:opacity-80 transition-opacity"
    >
      {/* Thumbnail */}
      <div className="w-14 h-14 shrink-0 overflow-hidden rounded-md">
        <img
          src={article.image}
          alt={article.title}
          className="h-full w-full object-cover object-top"
        />
      </div>

      {/* Content */}
      <div className="flex flex-col justify-center gap-0.5 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className={`text-[9px] font-bold uppercase tracking-wide ${categoryColor(article.category)}`}>
            {article.category}
          </span>
          <span className="text-[9px] text-[var(--muted-foreground)]">{article.timeAgo}</span>
        </div>
        <p className="text-xs font-semibold leading-snug text-[var(--foreground)] line-clamp-2">
          {article.title}
        </p>
      </div>
    </Link>
  );
}

type TabKey = "latest" | "popular" | "videos";

function Sidebar() {
  const [activeTab, setActiveTab] = useState<TabKey>("latest");

  const tabs: { key: TabKey; label: string }[] = [
    { key: "latest", label: "Lo Último" },
    { key: "popular", label: "Popular" },
    { key: "videos", label: "Vídeos" },
  ];

  const articles: Record<TabKey, Article[]> = {
    latest: LATEST_ARTICLES,
    popular: POPULAR_ARTICLES,
    videos: [],
  };

  return (
    <aside className="flex flex-col gap-6">
      {/* Tabs */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] overflow-hidden">
        {/* Tab bar */}
        <div className="flex border-b border-[var(--border)]">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 py-2.5 text-[10px] font-bold uppercase tracking-wider transition-colors
                ${activeTab === tab.key
                  ? "bg-[var(--foreground)] text-[var(--background)]"
                  : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="px-4">
          {articles[activeTab].length > 0 ? (
            articles[activeTab].map((a) => (
              <SidebarArticleCard key={a.id} article={a} />
            ))
          ) : (
            <p className="py-6 text-center text-xs text-[var(--muted-foreground)]">
              Próximamente
            </p>
          )}
        </div>
      </div>

      {/* Tag cloud */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
        <h4 className="mb-3 text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--foreground)]">
          Temas
        </h4>
        <div className="flex flex-wrap gap-1.5">
          {TAGS.map((tag) => (
            <Link
              key={tag}
              href="#"
              className="rounded-sm border border-[var(--border)] px-2 py-0.5 text-[10px] text-[var(--muted-foreground)] hover:border-[var(--foreground)] hover:text-[var(--foreground)] transition-colors"
            >
              {tag}
            </Link>
          ))}
        </div>
      </div>
    </aside>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function NewsFeed() {
  return (
    <section className="mx-auto max-w-7xl px-4 pb-12 sm:px-6 lg:px-8">
      <SectionDivider label="Más Noticias" />

      {/* Two-column layout */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* Main article list */}
        <div className="lg:col-span-2">
          <div className="divide-y divide-[var(--border)]">
            {MAIN_ARTICLES.map((article) => (
              <MainArticleCard key={article.id} article={article} />
            ))}
          </div>

          {/* More news button */}
          <div className="mt-8 flex justify-center">
            <Link
              href="#"
              className="rounded-lg border border-[var(--border)] px-10 py-2.5 text-xs font-semibold uppercase tracking-widest text-[var(--foreground)] hover:bg-[var(--accent)] transition-colors"
            >
              Más Noticias
            </Link>
          </div>
        </div>

        {/* Sidebar */}
        <div className="lg:col-span-1">
          <Sidebar />
        </div>
      </div>
    </section>
  );
}
