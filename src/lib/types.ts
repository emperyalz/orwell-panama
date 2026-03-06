export interface PoliticianAccount {
  platform: "instagram" | "x_twitter" | "tiktok" | "facebook" | "youtube" | "discord" | "twitch" | "linkedin";
  handle: string;
  profileUrl: string;
  avatar: string;
  verdict: "CONFIRMED" | "PROBABLE";
  score: number;
  pollingTier: "hot" | "warm" | "cool" | "dormant";
}

export interface Politician {
  id: string;
  name: string;
  slug: string;
  party: string;
  partyFull: string;
  role: string;
  roleCategory: "Deputy" | "Mayor" | "Governor" | "President";
  province: string;
  district?: string;
  circuit?: string;
  hasHeadshot: boolean;
  headshot: string;
  accounts: PoliticianAccount[];
  officialGovUrl?: string;
  wikipediaUrl?: string;
  personalWebsite?: string;
}

export type Platform = PoliticianAccount["platform"];
export type RoleCategory = Politician["roleCategory"];

// ─── Voting Dashboard Types ──────────────────────────────────────────────────

export interface MonthlyVotingStat {
  month: string; // "2024-01"
  totalVotes: number;
  aFavor: number;
  enContra: number;
  abstencion: number;
  pctAFavor: number; // 0-100
}

export interface DissentVote {
  votingId: number;
  votingTitle: string;
  sessionDate: string;
  deputyVote: string;
  partyMajorityVote: string;
}

export interface SwingVoteRecord {
  votingId: number;
  votingTitle: string;
  sessionDate: string;
  totalAFavor: number;
}

export interface ControversialVoteRecord {
  votingId: number;
  votingTitle: string;
  sessionDate: string;
  deputyVote: string;
  totalEnContra: number;
  totalAFavor: number;
  passed: boolean;
}

export interface AllyRival {
  deputyId: number;
  deputyName: string;
  partyCode: string;
  agreementPct: number;
  sharedVotes: number;
}

export interface DeputyVotingProfile {
  deputyId: number;
  deputyName: string;
  partyCode: string;
  circuit: string;
  isSuplente: boolean;
  totalVotes: number;
  totalAFavor: number;
  totalEnContra: number;
  totalAbstencion: number;
  sessionsAttended: number;
  participationRate: number;
}

export interface DeputyAnalyticsData {
  loyaltyScore: number;
  dissentCount: number;
  dissentVotes: DissentVote[];
  swingVoteCount: number;
  swingVotes: SwingVoteRecord[];
  attendancePercentile: number;
  loyaltyPercentile: number;
  votesPercentile: number;
  controversialVotes: ControversialVoteRecord[];
  topAllies: AllyRival[];
  topRivals: AllyRival[];
  monthlyStats: MonthlyVotingStat[];
  attendanceDates: string[];
  provinceAttendanceRank?: number;
  provinceTotalDeputies?: number;
}

export interface DeputyBio {
  aiSummary?: string;
  aiKeyQualifications?: string[];
  aiEducationLevel?: string;
  aiProfessionalSector?: string;
  correo?: string;
  structuredData?: {
    fechaNacimiento?: string;
    cedula?: string;
    estadoCivil?: string;
    direccion?: string;
    educacion: { institucion?: string; titulo?: string; periodo?: string; descripcion?: string }[];
    experienciaLaboral: { empresa?: string; cargo?: string; periodo?: string; descripcion?: string }[];
    cargosPoliticos: { cargo?: string; periodo?: string; partido?: string }[];
    habilidades: string[];
    idiomas: string[];
    seminariosCursos: string[];
  };
}

export interface VoteRecord {
  votingId: number;
  questionId: number;
  questionText: string;
  questionPassed: boolean;
  vote: string;
  sessionDate: string; // "YYYY-MM-DD" (converted from epoch in query)
  votingTitle: string;
}

export interface ChamberStats {
  totalSessions: number;
  avgAttendance: number;
  avgLoyalty: number;
  totalDeputies: number;
}

export interface DeputyDashboard {
  profile: DeputyVotingProfile | null;
  analytics: DeputyAnalyticsData | null;
  bio: DeputyBio | null;
  recentVotes: VoteRecord[];
  chamberStats: ChamberStats;
}

export type SortOption =
  | "rank"
  | "firstName_asc"
  | "firstName_desc"
  | "lastName_asc"
  | "lastName_desc"
  | "role_asc"
  | "role_desc"
  | "province_asc"
  | "province_desc"
  | "party_asc"
  | "party_desc";

export interface FilterState {
  search: string;
  role: RoleCategory | "";
  province: string;
  party: string;
  sort: SortOption | "";
}
