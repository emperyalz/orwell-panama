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
