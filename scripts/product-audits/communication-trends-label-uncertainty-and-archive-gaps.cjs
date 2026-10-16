#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..', '..', 'src', 'components', 'reference', 'IntelligenceWorkspace.tsx');

function fail(msg) {
  console.error(`FAIL: ${msg}`);
  process.exit(1);
}

const source = fs.readFileSync(SRC, 'utf8');

// 1. gapNote key exists in the copy object with a 3-element tuple of non-empty strings.
const keyMatch = source.match(/gapNote:\[('(?:[^'\\]|\\.)*'),('(?:[^'\\]|\\.)*'),('(?:[^'\\]|\\.)*')\]/);
if (!keyMatch) fail('gapNote i18n entry not found with three string literals (en/es/pt) in copy object');

const strings = keyMatch.slice(1, 4).map((s) => s.slice(1, -1));
for (const [i, s] of strings.entries()) {
  if (!s || s.trim().length < 10) fail(`gapNote language slot ${i} is empty or too short: ${JSON.stringify(s)}`);
}

// 2. Must be distinct from healthNote and missing strings.
const healthNoteMatch = source.match(/healthNote:\[('(?:[^'\\]|\\.)*'),('(?:[^'\\]|\\.)*'),('(?:[^'\\]|\\.)*')\]/);
if (!healthNoteMatch) fail('healthNote entry not found for comparison');
const healthNoteStrings = healthNoteMatch.slice(1, 4).map((s) => s.slice(1, -1));

const missingMatch = source.match(/missing:\[('(?:[^'\\]|\\.)*'),('(?:[^'\\]|\\.)*'),('(?:[^'\\]|\\.)*')\]/);
if (!missingMatch) fail('missing entry not found for comparison');
const missingStrings = missingMatch.slice(1, 4).map((s) => s.slice(1, -1));

for (const [i, s] of strings.entries()) {
  if (s === healthNoteStrings[i]) fail(`gapNote language slot ${i} is identical to healthNote text`);
  if (s === missingStrings[i]) fail(`gapNote language slot ${i} is identical to missing text`);
}

// 3. Must be rendered conditionally in JSX, guarded by a gap condition, not unconditionally.
const renderMatch = source.match(/\{showGapNote&&<p[^>]*>\{t\('gapNote'\)\}<\/p>\}/);
if (!renderMatch) fail("gapNote is not rendered conditionally via '{showGapNote&&<p ...>{t(\\'gapNote\\')}</p>}' in JSX");

// 4. The guard variable must be derived from account posts:0 existence and/or stale lastSocialImport.
if (!/hasZeroPostAccount=accounts\.some\(a=>!a\.posts\)/.test(source)) {
  fail('showGapNote is not derived from accounts having zero posts (hasZeroPostAccount)');
}
if (!/importStale=!data\?\.lastSocialImport\|\|\(Date\.now\(\)-new Date\(data\.lastSocialImport\.date\)\.getTime\(\)>/.test(source)) {
  fail('showGapNote is not derived from a stale/missing lastSocialImport check (importStale)');
}

// 4a. Reject the known dead path: `effectiveFrom===to` can never be true for the default
// single-month selection because `to` defaults to '' while `effectiveFrom` defaults to a month.
// The selected month must instead be derived from a resolved effective range.
if (/Boolean\(effectiveFrom\)&&effectiveFrom===to&&/.test(source)) {
  fail('selectedMonthGap still gates on the dead `effectiveFrom===to` path (unreachable for the default single-month range because `to` defaults to an empty string)');
}

// 4b. The effective end of the range must resolve the empty `to` default to the last archived
// month, so a single-month selection with an implicit end is reachable without the user
// duplicating input.
if (!/effectiveTo=to\|\|months\.at\(-1\)\|\|''/.test(source)) {
  fail('effectiveTo does not resolve the empty `to` default to months.at(-1); implicit-end selection stays unreachable');
}

// 4c. Reject the superseded single-month-only gate. The prior author limited the selected-period
// trigger to a resolved single month (selectedMonth=effectiveFrom===effectiveTo), so a legitimate
// multi-month empty range such as 1900-01..1900-02 (positive lifetime posts, fresh import) never
// fired. The gap must be computed over the inclusive [effectiveFrom,effectiveTo] range instead.
if (/selectedMonth=effectiveFrom&&effectiveFrom===effectiveTo/.test(source)) {
  fail('selected-period gap still derives a single `selectedMonth` from effectiveFrom===effectiveTo; a two-month range (e.g. 1900-01..1900-02) with no matching bucket/example would not trigger the warning');
}
if (/b\.month===selectedMonth/.test(source) || /\.slice\(0,7\)===selectedMonth/.test(source)) {
  fail('the gap check still compares buckets/examples with month equality (===selectedMonth) instead of inclusive range bounds; multi-month ranges stay broken');
}

// 4d. selectedRangeGap must be computed from the inclusive resolved bounds effectiveFrom/effectiveTo
// against buckets AND examples, confirming the account exists. This covers an explicit same-month
// from/to, an implicit-end single month, and a multi-month range alike.
if (!/selectedRangeGap=Boolean\(selectedPersonId\)&&Boolean\(platform\)&&Boolean\(effectiveFrom\)&&Boolean\(effectiveTo\)&&effectiveFrom<=effectiveTo&&Boolean\(data\?\.accounts\.some\(a=>a\.person===selectedPersonId&&a\.platform===platform\)\)&&!data\?\.buckets\.some\(b=>b\.person===selectedPersonId&&b\.platform===platform&&b\.month>=effectiveFrom&&b\.month<=effectiveTo&&b\.count>0\)&&!data\?\.examples\.some\(e=>\{const m=new Date\(e\.date\)\.toISOString\(\)\.slice\(0,7\);return e\.person===selectedPersonId&&e\.platform===platform&&m>=effectiveFrom&&m<=effectiveTo;\}\)/.test(source)) {
  fail('selectedRangeGap is not derived from the inclusive [effectiveFrom,effectiveTo] range having an existing account but zero matching buckets (count>0) and zero matching examples across that range');
}
if (!/showGapNote=importStale\|\|hasZeroPostAccount\|\|selectedRangeGap/.test(source)) {
  fail('showGapNote does not combine importStale, hasZeroPostAccount, and selectedRangeGap');
}

// 5. Copy consistency: the gapNote text must name the selected month/period/filter range as a
// SEPARATE reason (root finding: selectedMonthGap can be true with positive lifetime posts and a
// fresh import), keep the Archive gap:/Brecha de archivo:/Falha no arquivo: prefixes for the
// browser test, and use conditional language that does NOT assert the account is inactive.
const [es, en, pt] = strings;
const prefixes = [
  [es, 'Brecha de archivo:'],
  [en, 'Archive gap:'],
  [pt, 'Falha no arquivo:'],
];
for (const [s, prefix] of prefixes) {
  if (!s.startsWith(prefix)) fail(`gapNote string does not start with required prefix ${JSON.stringify(prefix)}: ${JSON.stringify(s)}`);
}
// Each language must reference the selected period scope (month/period/filter), not only
// lifetime posts or import staleness.
if (!/\bmes\b|per[ií]odo|filtro/i.test(es) || !/seleccionad/i.test(es)) {
  fail('ES gapNote does not name the selected month/period/filter as a separate reason');
}
if (!/\bmonth\b|period|filter/i.test(en) || !/selected/i.test(en)) {
  fail('EN gapNote does not name the selected month/period/filter as a separate reason');
}
if (!/\bm[eê]s\b|per[ií]odo|filtro/i.test(pt) || !/selecionad/i.test(pt)) {
  fail('PT gapNote does not name the selected month/period/filter as a separate reason');
}
// Conditional, non-accusatory language: must not assert the account IS inactive, and must use a
// hedge ("may/puede/pode ... not prove/no demuestra/não prova").
if (/no demuestra que la cuenta est[ée] inactiv/i.test(es) === false || !/puede reflejar/i.test(es)) {
  fail('ES gapNote must use conditional language ("puede reflejar ... no demuestra que la cuenta esté inactiva")');
}
if (!/does not prove the account is inactive/i.test(en) || !/may reflect/i.test(en)) {
  fail('EN gapNote must use conditional language ("may reflect ... does not prove the account is inactive")');
}
if (!/n[ãa]o prova que a conta esteja inativ/i.test(pt) || !/pode refletir/i.test(pt)) {
  fail('PT gapNote must use conditional language ("pode refletir ... não prova que a conta esteja inativa")');
}

// 5a. Copy/trigger consistency (root QA finding): naming the selected period in one sentence and
// hedging in another is NOT enough. Each language must bind the two: an EMPTY selection *may
// reflect* an ARCHIVE or COLLECTION gap. The clause must contain the empty-selection subject, the
// conditional verb ("may reflect"/"puede reflejar"/"pode refletir"), AND both gap kinds (archive
// and collection) so the string cannot pass while omitting the gap relationship entirely.
if (!/selecci[oó]n vac[ií]a puede reflejar una brecha de (recolecci[oó]n o de archivo|archivo o de recolecci[oó]n)/i.test(es)) {
  fail('ES gapNote must state that an empty selection may reflect an archive OR collection gap (e.g. "una selección vacía puede reflejar una brecha de recolección o de archivo"), not only name the period in an unrelated sentence');
}
if (!/empty selection may reflect a (collection or archive|archive or collection) gap/i.test(en)) {
  fail('EN gapNote must state that an empty selection may reflect an archive OR collection gap (e.g. "an empty selection may reflect a collection or archive gap"), not only name the period in an unrelated sentence');
}
if (!/sele[çc][ãa]o vazia pode refletir uma falha de (coleta ou de arquivo|arquivo ou de coleta)/i.test(pt)) {
  fail('PT gapNote must state that an empty selection may reflect an archive OR collection gap (e.g. "uma seleção vazia pode refletir uma falha de coleta ou de arquivo"), not only name the period in an unrelated sentence');
}

// 5b. Guard against the copy asserting a single cause is the ONLY possibility: each language must
// offer the three triggers as alternatives ("o"/"or"/"ou"), so the string never implies that a
// zero-lifetime account or a stale import is the sole explanation for an empty selection.
if (!/\bo\b/i.test(es) || !/\bor\b/i.test(en) || !/\bou\b/i.test(pt)) {
  fail('gapNote must present its causes as alternatives (o/or/ou) so no single cause is implied to be the only explanation');
}

// 6. Executable behavior cases. The following pure reimplementations MIRROR the source expressions
// asserted verbatim above (4 and 4d), so these fixtures exercise the real decision logic. If the
// source and these helpers drift, the regexes in 4d fail first.
const THIRTY_DAYS = 1000 * 60 * 60 * 24 * 30;
const importStale = (data) =>
  !data.lastSocialImport || Date.now() - new Date(data.lastSocialImport.date).getTime() > THIRTY_DAYS;
const hasZeroPostAccount = (accounts) => accounts.some((a) => !a.posts);
const monthOf = (iso) => new Date(iso).toISOString().slice(0, 7);
const selectedRangeGap = (data, selectedPersonId, platform, effectiveFrom, effectiveTo) =>
  Boolean(selectedPersonId) &&
  Boolean(platform) &&
  Boolean(effectiveFrom) &&
  Boolean(effectiveTo) &&
  effectiveFrom <= effectiveTo &&
  Boolean(data.accounts.some((a) => a.person === selectedPersonId && a.platform === platform)) &&
  !data.buckets.some(
    (b) =>
      b.person === selectedPersonId &&
      b.platform === platform &&
      b.month >= effectiveFrom &&
      b.month <= effectiveTo &&
      b.count > 0,
  ) &&
  !data.examples.some((e) => {
    const m = monthOf(e.date);
    return e.person === selectedPersonId && e.platform === platform && m >= effectiveFrom && m <= effectiveTo;
  });
const showGapNote = (data, accounts, selectedPersonId, platform, effectiveFrom, effectiveTo) =>
  importStale(data) ||
  hasZeroPostAccount(accounts) ||
  selectedRangeGap(data, selectedPersonId, platform, effectiveFrom, effectiveTo);

const nowIso = new Date().toISOString();
const freshImport = { date: nowIso, inserted: 3 };
const staleImport = { date: new Date(Date.now() - THIRTY_DAYS * 3).toISOString(), inserted: 0 };
// p1/x_twitter is an ACTIVE account with positive lifetime posts in 2026-05; its 1900 range is empty.
const activeData = {
  lastSocialImport: freshImport,
  accounts: [{ person: 'p1', platform: 'x_twitter', posts: 42 }],
  buckets: [{ person: 'p1', platform: 'x_twitter', month: '2026-05', count: 7 }],
  examples: [{ person: 'p1', platform: 'x_twitter', date: '2026-05-10T00:00:00Z' }],
};
const activeAccounts = activeData.accounts;

const cases = [
  {
    name: 'empty single month (explicit from===to) with fresh import + positive lifetime => gap',
    got: selectedRangeGap(activeData, 'p1', 'x_twitter', '1900-01', '1900-01'),
    want: true,
  },
  {
    name: 'empty two-month range 1900-01..1900-02, positive lifetime, fresh import => gap (concrete required case)',
    got: selectedRangeGap(activeData, 'p1', 'x_twitter', '1900-01', '1900-02'),
    want: true,
  },
  {
    name: 'implicit-end empty month (effectiveTo resolved to latest archived 2026-05, from a prior empty month) => gap',
    got: selectedRangeGap(activeData, 'p1', 'x_twitter', '1900-03', '2026-04'),
    want: true,
  },
  {
    name: 'covered range with a positive matching bucket => no gap',
    got: selectedRangeGap(activeData, 'p1', 'x_twitter', '2026-01', '2026-12'),
    want: false,
  },
  {
    name: 'covered range matched only by a dated example (no bucket) => no gap',
    got: selectedRangeGap(
      { ...activeData, buckets: [] },
      'p1',
      'x_twitter',
      '2026-01',
      '2026-12',
    ),
    want: false,
  },
  {
    name: 'wrong platform (no account for that person+platform) => no gap',
    got: selectedRangeGap(activeData, 'p1', 'instagram', '1900-01', '1900-02'),
    want: false,
  },
  {
    name: 'wrong person (no account) => no gap',
    got: selectedRangeGap(activeData, 'p2', 'x_twitter', '1900-01', '1900-02'),
    want: false,
  },
  {
    name: 'no platform selected => no range gap',
    got: selectedRangeGap(activeData, 'p1', '', '1900-01', '1900-02'),
    want: false,
  },
  {
    name: 'inverted bounds (from>to) => no range gap',
    got: selectedRangeGap(activeData, 'p1', 'x_twitter', '1900-02', '1900-01'),
    want: false,
  },
  {
    name: 'zero-post account surfaces gap via hasZeroPostAccount even on a covered range',
    got: showGapNote(
      activeData,
      [{ person: 'p1', platform: 'x_twitter', posts: 0 }],
      'p1',
      'x_twitter',
      '2026-01',
      '2026-12',
    ),
    want: true,
  },
  {
    name: 'stale import surfaces gap via importStale even on a covered range with posts',
    got: showGapNote(
      { ...activeData, lastSocialImport: staleImport },
      activeAccounts,
      'p1',
      'x_twitter',
      '2026-01',
      '2026-12',
    ),
    want: true,
  },
  {
    name: 'missing import surfaces gap via importStale',
    got: showGapNote(
      { ...activeData, lastSocialImport: null },
      activeAccounts,
      'p1',
      'x_twitter',
      '2026-01',
      '2026-12',
    ),
    want: true,
  },
  {
    name: 'covered month, positive matching account, fresh import => NO gap (no false flag)',
    got: showGapNote(activeData, activeAccounts, 'p1', 'x_twitter', '2026-05', '2026-05'),
    want: false,
  },
];

for (const c of cases) {
  if (c.got !== c.want) fail(`behavior case failed: ${c.name} (expected ${c.want}, got ${c.got})`);
}

console.log(`PASS: gapNote i18n label exists (en/es/pt), is distinct from healthNote/missing, keeps the Archive gap prefixes, names the selected month/period/filter as a separate reason, binds the empty selection to a possible archive OR collection gap in each language, presents its three causes as alternatives (o/or/ou) with conditional non-accusatory language, and is wired to a conditional JSX render guarded by zero-post accounts, stale/missing lastSocialImport, or an inclusive [effectiveFrom,effectiveTo] range (single or multi-month) having no matching bucket/example despite the account existing. ${cases.length} executable behavior cases passed (empty single month, empty two-month range 1900-01..1900-02, implicit-end empty range, covered range via bucket and via example, wrong person/platform, no platform, inverted bounds, zero-post account, stale/missing import, covered month no-false-flag).`);
process.exit(0);
