export const PARTY_COLORS: Record<string, string> = {
  CD: "var(--color-party-cd)",
  PRD: "var(--color-party-prd)",
  PAN: "var(--color-party-pan)",
  LP: "var(--color-party-lp)",
  RM: "var(--color-party-rm)",
  MOCA: "var(--color-party-moca)",
  PP: "var(--color-party-pp)",
  MOLIRENA: "var(--color-party-molirena)",
  ALZ: "var(--color-party-alz)",
  IND: "var(--color-party-ind)",
};

export const PARTY_BG_CLASSES: Record<string, string> = {
  CD: "bg-party-cd",
  PRD: "bg-party-prd",
  PAN: "bg-party-pan",
  LP: "bg-party-lp",
  RM: "bg-party-rm",
  MOCA: "bg-party-moca",
  PP: "bg-party-pp",
  MOLIRENA: "bg-party-molirena",
  ALZ: "bg-party-alz",
  IND: "bg-party-ind",
};

export const PARTY_LABELS: Record<string, string> = {
  CD: "Cambio Democrático",
  PRD: "Partido Revolucionario Democrático",
  PAN: "Partido Panameñista",
  LP: "Libre Postulación",
  RM: "Realizando Metas",
  MOCA: "Movimiento Otro Camino",
  PP: "Partido Popular",
  MOLIRENA: "MOLIRENA",
  ALZ: "Partido Alianza",
  IND: "Independiente",
};

export const ROLE_CATEGORIES = [
  { value: "Deputy", label: "Diputados" },
  { value: "Governor", label: "Gobernadores" },
  { value: "Mayor", label: "Alcaldes" },
  { value: "President", label: "Presidente" },
] as const;

export const PROVINCES = [
  "Bocas del Toro",
  "Chiriquí",
  "Coclé",
  "Colón",
  "Comarca Guna Yala",
  "Darién",
  "Herrera",
  "Nacional",
  "Panamá",
  "Panamá Oeste",
  "Veraguas",
] as const;

export const PLATFORM_CONFIG: Record<
  string,
  { label: string; icon: string; color: string; urlPrefix: string }
> = {
  instagram: {
    label: "Instagram",
    icon: "/icons/platforms/instagram.svg",
    color: "#e4405f",
    urlPrefix: "https://www.instagram.com/",
  },
  x_twitter: {
    label: "X (Twitter)",
    icon: "/icons/platforms/x-twitter.svg",
    color: "#000000",
    urlPrefix: "https://x.com/",
  },
  tiktok: {
    label: "TikTok",
    icon: "/icons/platforms/tiktok.svg",
    color: "#010101",
    urlPrefix: "https://www.tiktok.com/@",
  },
  facebook: {
    label: "Facebook",
    icon: "/icons/platforms/facebook.svg",
    color: "#1877f2",
    urlPrefix: "https://www.facebook.com/",
  },
  youtube: {
    label: "YouTube",
    icon: "/icons/platforms/youtube.svg",
    color: "#ff0000",
    urlPrefix: "https://www.youtube.com/",
  },
};
