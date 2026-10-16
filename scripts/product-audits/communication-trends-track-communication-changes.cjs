#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..', '..', 'src', 'components', 'reference', 'IntelligenceWorkspace.tsx');
const source = fs.readFileSync(SRC, 'utf8');

let failures = 0;
function assert(cond, msg) {
  if (!cond) {
    failures++;
    console.error('FAIL:', msg);
  } else {
    console.log('ok:', msg);
  }
}

// Static checks: the new trend/change view exists and is wired to person+platform selection.
assert(/\[view,setView\]=useState<'chart'\|'table'\|'trend'>\('chart'\);/.test(source),
  "view state includes a 'trend' option alongside chart/table");
assert(/<button aria-pressed=\{view==='trend'\} onClick=\{\(\)=>setView\('trend'\)\}>\{t\('change'\)\}<\/button>/.test(source),
  "a visible button switches to the 'trend' (change) view");
assert(/const changeReady=Boolean\(selectedPersonId\)&&Boolean\(platform\)&&Boolean\(effectiveFrom\)&&Boolean\(effectiveTo\)&&effectiveFrom<=effectiveTo;/.test(source),
  'changeReady requires a selected person, platform, and a valid resolved month range');
assert(/const changeSpan=changeReady\?monthSpan\(effectiveFrom,effectiveTo\):0;/.test(source),
  'changeSpan computes the length (in months) of the current resolved range');
assert(/const priorTo=changeReady\?shiftMonth\(effectiveFrom,-1\):'';/.test(source),
  'priorTo is the month immediately preceding the current range start');
assert(/const priorFrom=changeReady\?shiftMonth\(priorTo,-\(changeSpan-1\)\):'';/.test(source),
  'priorFrom makes the prior range the same length as the current range');
assert(/const hasPriorPeriod=changeReady&&Boolean\(data\?\.buckets\.some\(b=>b\.person===selectedPersonId&&b\.platform===platform&&b\.month>=priorFrom&&b\.month<=priorTo\)\);/.test(source),
  'hasPriorPeriod checks for any archived bucket for this person+platform in the prior range');
assert(/const currentPeriodSum=changeReady\?sumBuckets\(effectiveFrom,effectiveTo\):0;/.test(source),
  'currentPeriodSum sums post counts over the current resolved range');
assert(/const priorPeriodSum=changeReady&&hasPriorPeriod\?sumBuckets\(priorFrom,priorTo\):0;/.test(source),
  'priorPeriodSum sums post counts over the prior range only when prior data exists');
assert(/const periodDelta=currentPeriodSum-priorPeriodSum;/.test(source),
  'periodDelta is the signed difference current minus prior');

// Static checks: three-language copy for the change view and its disclaimer.
for (const key of ['change', 'changeSelect', 'changeNoPrior', 'changeUp', 'changeDown', 'changeSame', 'changeCurrent', 'changePrior']) {
  const m = source.match(new RegExp(key + ":\\[([^\\]]*)\\]"));
  assert(Boolean(m), key + ' copy tuple exists');
  if (m) {
    const parts = m[1].split(',').filter((s) => s.trim().length > 0);
    assert(parts.length === 3, key + ' has exactly 3 [es,en,pt] entries, found ' + parts.length);
  }
}

// Static check: the methodology note explicitly disclaims tone/sentiment/stance/ideology in all 3 languages.
const noteMatch = source.match(/changeNote:\[([^\]]*)\]/);
assert(Boolean(noteMatch), 'changeNote tuple found');
if (noteMatch) {
  const langs = noteMatch[1].split("','");
  assert(langs.length === 3, 'changeNote has exactly 3 [es,en,pt] language strings, found ' + langs.length);
  assert(/no mide tono, sentimiento, postura ni ideolog[ií]a/i.test(noteMatch[1]),
    'Spanish changeNote explicitly disclaims tone/sentiment/stance/ideology');
  assert(/does not measure tone, sentiment, stance, or ideology/i.test(noteMatch[1]),
    'English changeNote explicitly disclaims tone/sentiment/stance/ideology');
  assert(/n[ãa]o mede tom, sentimento, postura ou ideologia/i.test(noteMatch[1]),
    'Portuguese changeNote explicitly disclaims tone/sentiment/stance/ideology');
}
assert(/<p className="intelligence-change-note">\{t\('changeNote'\)\}<\/p>/.test(source),
  'the methodology/disclaimer note is rendered inside the change view');

// Source-branch regression: the Change view must render even when the current
// period has zero posts (current=0, prior>0 must still show a negative delta).
// This requires the view==='trend' branch to be checked BEFORE the !total
// empty-state guard, not after it (an earlier regression hid the Change view
// whenever total===0, silently dropping a real decrease).
const trendBranchMatch = source.match(/\{view==='trend'\?<div className="intelligence-change"[\s\S]*?<\/section>/);
assert(Boolean(trendBranchMatch), "the view==='trend' branch is located in the render output");
if (trendBranchMatch) {
  const trendBranch = trendBranchMatch[0];
  const totalGuardIndex = trendBranch.indexOf('!total?');
  assert(totalGuardIndex > 0, "the !total empty-state guard appears after the view==='trend' check");
  const changeNoteIndex = trendBranch.indexOf("t('changeNote')");
  assert(changeNoteIndex > -1 && changeNoteIndex < totalGuardIndex,
    "the rendered Change view (including its methodology note) is reached before the !total guard can hide it");
}
// The ordinary chart/table empty state must still exist for non-trend views.
assert(/:!total\?<p>\{t\('empty'\)\}<\/p>:view==='chart'\?/.test(source),
  "chart/table views still show the empty-state message when total is zero");

// Behavior checks: pure reimplementation of the delta logic, matching the
// shiftMonth/monthSpan/sumBuckets/hasPriorPeriod/periodDelta logic above.
function shiftMonth(m, n) {
  const d = new Date(`${m}-01T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + n);
  return d.toISOString().slice(0, 7);
}
function monthSpan(m1, m2) {
  const d1 = new Date(`${m1}-01T00:00:00Z`);
  const d2 = new Date(`${m2}-01T00:00:00Z`);
  return (d2.getUTCFullYear() - d1.getUTCFullYear()) * 12 + (d2.getUTCMonth() - d1.getUTCMonth()) + 1;
}
function computeChange(buckets, person, platform, from, to) {
  const changeSpan = monthSpan(from, to);
  const priorTo = shiftMonth(from, -1);
  const priorFrom = shiftMonth(priorTo, -(changeSpan - 1));
  const inRange = (month, a, b) => month >= a && month <= b;
  const sum = (a, b) =>
    buckets
      .filter((bk) => bk.person === person && bk.platform === platform && inRange(bk.month, a, b))
      .reduce((s, bk) => s + bk.count, 0);
  const hasPriorPeriod = buckets.some(
    (bk) => bk.person === person && bk.platform === platform && inRange(bk.month, priorFrom, priorTo)
  );
  const currentPeriodSum = sum(from, to);
  const priorPeriodSum = hasPriorPeriod ? sum(priorFrom, priorTo) : 0;
  return { currentPeriodSum, priorPeriodSum, hasPriorPeriod, periodDelta: currentPeriodSum - priorPeriodSum, priorFrom, priorTo };
}

function bucket(person, platform, month, count) {
  return { person, platform, month, count };
}

const behaviorCases = [
  {
    name: 'increase: current period higher than prior period of equal length',
    buckets: [
      bucket('p1', 'x', '2026-07', 2),
      bucket('p1', 'x', '2026-08', 1),
      bucket('p1', 'x', '2026-09', 10),
      bucket('p1', 'x', '2026-10', 5),
    ],
    person: 'p1',
    platform: 'x',
    from: '2026-09',
    to: '2026-10',
    expect: { currentPeriodSum: 15, priorPeriodSum: 3, hasPriorPeriod: true, periodDelta: 12 },
  },
  {
    name: 'decrease: current period lower than prior period of equal length',
    buckets: [
      bucket('p1', 'x', '2026-07', 8),
      bucket('p1', 'x', '2026-08', 7),
      bucket('p1', 'x', '2026-09', 1),
      bucket('p1', 'x', '2026-10', 0),
    ],
    person: 'p1',
    platform: 'x',
    from: '2026-09',
    to: '2026-10',
    expect: { currentPeriodSum: 1, priorPeriodSum: 15, hasPriorPeriod: true, periodDelta: -14 },
  },
  {
    name: 'no-prior-period: no archived buckets exist at all before the current range',
    buckets: [bucket('p1', 'x', '2026-09', 4), bucket('p1', 'x', '2026-10', 6)],
    person: 'p1',
    platform: 'x',
    from: '2026-09',
    to: '2026-10',
    expect: { currentPeriodSum: 10, priorPeriodSum: 0, hasPriorPeriod: false, periodDelta: 10 },
  },
  {
    name: 'zero-to-nonzero: prior period has a bucket with zero count, current has posts',
    buckets: [bucket('p1', 'x', '2026-08', 0), bucket('p1', 'x', '2026-09', 3)],
    person: 'p1',
    platform: 'x',
    from: '2026-09',
    to: '2026-09',
    expect: { currentPeriodSum: 3, priorPeriodSum: 0, hasPriorPeriod: true, periodDelta: 3 },
  },
  {
    name: 'cross-person/platform isolation: other person/platform buckets are ignored',
    buckets: [
      bucket('p2', 'x', '2026-08', 99),
      bucket('p1', 'tiktok', '2026-08', 99),
      bucket('p1', 'x', '2026-08', 2),
      bucket('p1', 'x', '2026-09', 2),
    ],
    person: 'p1',
    platform: 'x',
    from: '2026-09',
    to: '2026-09',
    expect: { currentPeriodSum: 2, priorPeriodSum: 2, hasPriorPeriod: true, periodDelta: 0 },
  },
  {
    name: 'current-zero/prior-positive: current period has zero posts, prior period had posts (must still show a negative delta)',
    buckets: [bucket('p1', 'x', '2026-09', 5), bucket('p1', 'x', '2026-10', 0)],
    person: 'p1',
    platform: 'x',
    from: '2026-10',
    to: '2026-10',
    expect: { currentPeriodSum: 0, priorPeriodSum: 5, hasPriorPeriod: true, periodDelta: -5 },
  },
  {
    name: 'multi-month equal-length window comparison (3 months vs preceding 3 months)',
    buckets: [
      bucket('p1', 'x', '2026-04', 1),
      bucket('p1', 'x', '2026-05', 1),
      bucket('p1', 'x', '2026-06', 1),
      bucket('p1', 'x', '2026-07', 4),
      bucket('p1', 'x', '2026-08', 4),
      bucket('p1', 'x', '2026-09', 4),
    ],
    person: 'p1',
    platform: 'x',
    from: '2026-07',
    to: '2026-09',
    expect: { currentPeriodSum: 12, priorPeriodSum: 3, hasPriorPeriod: true, periodDelta: 9 },
  },
];

for (const c of behaviorCases) {
  const result = computeChange(c.buckets, c.person, c.platform, c.from, c.to);
  const ok =
    result.currentPeriodSum === c.expect.currentPeriodSum &&
    result.priorPeriodSum === c.expect.priorPeriodSum &&
    result.hasPriorPeriod === c.expect.hasPriorPeriod &&
    result.periodDelta === c.expect.periodDelta;
  assert(ok, `behavior case "${c.name}" -> got ${JSON.stringify(result)}, expected ${JSON.stringify(c.expect)}`);
}

// --- Related scoreboard connection (bounded handoff) ---------------------
// A protected browser check found that Scoreboard.tsx did not mount the
// ControllerStatus panel at all, so the live-operations/budget readout never
// appeared. Root added only the import and the <ControllerStatus lang={lang}/>
// mount immediately before <LeadAccountability/>. These checks confirm the
// connection and that its required dependency files (CSS + provider logos)
// exist, since a normal `tsc --noEmit` does not detect an absent CSS import.
const refDir = path.join(__dirname, '..', '..', 'src', 'components', 'reference');
const scoreboard = fs.readFileSync(path.join(refDir, 'Scoreboard.tsx'), 'utf8');
assert(/import\s*\{\s*ControllerStatus\s*\}\s*from\s*'\.\/ControllerStatus';/.test(scoreboard),
  'Scoreboard.tsx imports the ControllerStatus component');
const ctrlMount = scoreboard.indexOf('<ControllerStatus lang={lang}/>');
const leadMount = scoreboard.indexOf('<LeadAccountability lang={lang}/>');
assert(ctrlMount > -1, 'Scoreboard.tsx mounts <ControllerStatus lang={lang}/>');
assert(leadMount > -1 && ctrlMount < leadMount,
  'ControllerStatus is mounted immediately before LeadAccountability');

const controller = fs.readFileSync(path.join(refDir, 'ControllerStatus.tsx'), 'utf8');
assert(/import\s*'\.\/controller-status\.css';/.test(controller),
  'ControllerStatus.tsx imports its controller-status.css stylesheet');
const depFiles = [
  path.join(refDir, 'controller-status.css'),
  path.join(__dirname, '..', '..', 'public', 'images', 'providers', 'codex.png'),
  path.join(__dirname, '..', '..', 'public', 'images', 'providers', 'claude.ico'),
];
for (const f of depFiles) {
  assert(fs.existsSync(f) && fs.statSync(f).size > 0,
    'ControllerStatus dependency present and non-empty: ' + path.basename(f));
}
assert(/\/images\/providers\/codex\.png/.test(controller) && /\/images\/providers\/claude\.ico/.test(controller),
  'ControllerStatus references both provider logo paths it depends on');

// The snapshot query must expose source-backed progress (completed/total/
// remaining) and recorded blockers derived from the live DB, not simulated.
const snapQuery = fs.readFileSync(path.join(__dirname, '..', '..', 'convex', 'controllerStatus.ts'), 'utf8');
assert(/const progress=\{total:keys\.size,completed:/.test(snapQuery),
  'controllerStatus.snapshot computes progress totals from scoped item keys');
assert(/const blockers=scoped\.filter\(item=>item\.state==='blocked'\)/.test(snapQuery),
  'controllerStatus.snapshot records blockers from items in the blocked state');
assert(/limitPoints:v\.number\(\),reservePoints:v\.number\(\)/.test(
  fs.readFileSync(path.join(__dirname, '..', '..', 'convex', 'controllerStatusData.ts'), 'utf8')),
  'controllerStatusData declares measured allocation limit/reserve point fields');
assert(/limitPoints\?\?snapshot\.allocation\.limitPoints/.test(controller),
  'ControllerStatus renders the measured per-provider limitPoints (actual 40/30 caps)');

// No-new-collection guard: the change view must only read already-queried buckets,
// not introduce any sentiment/tone/ideology/reach estimation.
const changeBlock = source.match(/const shiftMonth=[\s\S]{0,1600}?const periodDelta=currentPeriodSum-priorPeriodSum;/);
assert(Boolean(changeBlock), 'change computation block located in source for vocabulary guard');
if (changeBlock) {
  assert(!/sentiment|ideolog|reach|tone|stance/i.test(changeBlock[0]),
    'no sentiment/tone/ideology/stance/reach estimation introduced in the change computation');
}

if (failures > 0) {
  console.error(`\n${failures} check(s) failed.`);
  process.exit(1);
}
console.log('\nAll checks passed.');
