export const COMPARISON_LIMIT = 8;
export function comparisonIds(params: {ids?: string; a?: string; b?: string}) {
  return [...new Set((params.ids?.split(',') ?? [params.a, params.b]).filter((id): id is string => Boolean(id)))].slice(0, COMPARISON_LIMIT);
}
export type ComparisonPerson = {
  id: string; name: string; portrait?: string; party: string; partyName: string;
  role: string; province: string; circuit?: string; birthDate?: string;
  accounts: {platform: string; handle: string; profileUrl: string; verdict: string; avatar?: string; posts: number; latest: number | null; scope: string}[];
  documents: {label: string; url: string}[];
  archive: {start: string; end: string; label: string} | null;
  votes: number | null; inFavor: number | null; against: number | null; abstentions: number | null;
  alternate: boolean | null; unavailable: boolean;
  recentVotes: {questionId: number; questionText: string; vote: string; date: string | null}[];
};
export function hasDifference(values: (string | number | null)[]) {
  const known = values.filter(value => value !== null);
  return new Set(known).size > 1;
}
