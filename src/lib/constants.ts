/* ------------------------------------------------------------------ */
/*  Party code normalisation                                           */
/*  The Asamblea voting-records CSVs use abbreviated codes (PA, VA,    */
/*  MO, PN) that differ from the official Tribunal Electoral siglas.   */
/*  This mapping lets the entire UI resolve them consistently.         */
/* ------------------------------------------------------------------ */
const PARTY_CODE_ALIASES: Record<string, string> = {
  PA: "ALZ",       // Partido Alianza  — official TE code is ALZ
  VA: "LP",        // Coalición VAMOS  — not a party; deputies are Libre Postulación
  MO: "MOCA",      // Movimiento Otro Camino
  PN: "PAN",       // Partido Panameñista
};

/** Normalise a party code to the official Tribunal Electoral sigla. */
export function normalizePartyCode(code: string): string {
  const upper = code.toUpperCase();
  return PARTY_CODE_ALIASES[upper] ?? upper;
}

/* ------------------------------------------------------------------ */
/*  Party logo paths (mixed file formats from official sources)        */
/* ------------------------------------------------------------------ */
export const PARTY_LOGOS: Record<string, string> = {
  cd: "/icons/parties/cd.png",
  prd: "/icons/parties/prd.png",
  pan: "/icons/parties/pan.png",
  lp: "/icons/parties/lp.svg",
  rm: "/icons/parties/rm.png",
  moca: "/icons/parties/moca.svg",
  pp: "/icons/parties/pp.png",
  molirena: "/icons/parties/molirena.png",
  alz: "/icons/parties/alz.jpg",
  ind: "/icons/parties/ind.svg",
};

/** Get the logo path for a party code (handles aliases + mixed formats). */
export function getPartyLogoPath(code: string): string {
  const normalised = normalizePartyCode(code).toLowerCase();
  return PARTY_LOGOS[normalised] ?? `/icons/parties/${normalised}.svg`;
}

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
  discord: {
    label: "Discord",
    icon: "/icons/platforms/discord.svg",
    color: "#5865F2",
    urlPrefix: "https://discord.gg/",
  },
  twitch: {
    label: "Twitch",
    icon: "/icons/platforms/twitch.svg",
    color: "#9146FF",
    urlPrefix: "https://www.twitch.tv/",
  },
  linkedin: {
    label: "LinkedIn",
    icon: "/icons/platforms/linkedin.svg",
    color: "#0A66C2",
    urlPrefix: "https://www.linkedin.com/in/",
  },
};
