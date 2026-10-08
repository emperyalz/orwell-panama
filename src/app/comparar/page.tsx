import {fetchQuery} from 'convex/nextjs';
import {api} from '../../../convex/_generated/api';
import {getDirectory, getProfile} from '@/lib/reference-data';
import {archiveRange, documentLinks, recordDate} from '@/lib/reference';
import {comparisonIds, type ComparisonPerson} from '@/lib/comparison';
import {ComparisonWorkspace} from '@/components/reference/ComparisonWorkspace';
import './comparison.css';

export const metadata = {title: 'Compare politicians | ORWELL Politics', robots: {index: false}};

export default async function Compare({searchParams}: {searchParams: Promise<{ids?: string; a?: string; b?: string}>}) {
  const params = await searchParams;
  const [directory, registry] = await Promise.all([getDirectory(), fetchQuery(api.sourceRegistry.summary, {})]);
  const ids = comparisonIds(params).filter(id => directory.some(person => person.externalId === id));
  const records = await Promise.all(ids.map(id => getProfile(id)));
  const profiles: ComparisonPerson[] = records.flatMap(record => {
    if (!record) return [];
    const {person, dashboard, facts, unavailable} = record;
    const voting = dashboard?.profile;
    return [{
      id: person.externalId, name: person.name, portrait: person.headshot,
      party: person.party, partyName: person.partyFull || person.party,
      role: person.role, province: person.province, circuit: person.circuit,
      birthDate: facts?.birthDate, accounts: person.accounts.map(account => ({
        platform: account.platform, handle: account.handle, profileUrl: account.profileUrl, verdict: account.verdict, avatar: account.avatar,
        posts: registry.socialAccounts.find(row => row.profileUrl === account.profileUrl)?.posts ?? 0,
        latest: registry.socialAccounts.find(row => row.profileUrl === account.profileUrl)?.lastArchivedAt ?? null,
        scope: registry.socialAccounts.find(row => row.profileUrl === account.profileUrl)?.archiveScope ?? 'person-platform',
      })), documents: documentLinks(dashboard), archive: archiveRange(dashboard),
      votes: voting?.totalVotes ?? null, inFavor: voting?.totalAFavor ?? null,
      against: voting?.totalEnContra ?? null, abstentions: voting?.totalAbstencion ?? null,
      alternate: voting?.isSuplente ?? null, unavailable,
      recentVotes: (dashboard?.recentVotes ?? []).map(vote => ({
        questionId: vote.questionId, questionText: vote.questionText, vote: vote.vote, date: recordDate(vote.sessionDate),
      })),
    }];
  });
  return <ComparisonWorkspace people={directory.map(person => ({id: person.externalId, name: person.name,
    portrait: person.headshot, party: person.party, role: person.role, province: person.province}))} profiles={profiles}/>;
}
