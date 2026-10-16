#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const activityPath = path.join(ROOT, 'convex', 'activity.ts');
const intelligencePath = path.join(ROOT, 'convex', 'intelligence.ts');

const activitySrc = fs.readFileSync(activityPath, 'utf8');
const intelligenceSrc = fs.readFileSync(intelligencePath, 'utf8');

const checks = [
  // (a) ingest validation + dedupe
  {
    file: 'convex/activity.ts',
    label: 'ingest validates https scheme',
    src: activitySrc,
    snippet: "!/^https:\\/\\//.test(item.sourceUrl)",
    line: 33,
  },
  {
    file: 'convex/activity.ts',
    label: 'ingest validates publishedAt finite and not >now+1 day',
    src: activitySrc,
    snippet: "!Number.isFinite(item.publishedAt)||item.publishedAt>Date.now()+86400000",
    line: 33,
  },
  {
    file: 'convex/activity.ts',
    label: 'ingest dedupes by politicianId+sourceUrl via by_politician_url index',
    src: activitySrc,
    snippet: "withIndex('by_politician_url',q=>q.eq('politicianId',item.politicianId).eq('sourceUrl',item.sourceUrl))",
    line: 33,
  },
  {
    file: 'convex/activity.ts',
    label: 'ingest inserts new row with collectedAt when no existing match, else backfills only a missing image',
    src: activitySrc,
    snippet: "if(!old){await ctx.db.insert('activity',{...item,collectedAt:Date.now()});inserted++;}else if(item.imageUrl&&!old.imageUrl)",
    line: 33,
  },
  {
    file: 'convex/activity.ts',
    label: 'logRun records kind/inserted/errors/checkedAt per collection run',
    src: activitySrc,
    snippet: "ctx.db.insert('collectionRuns',{...args,checkedAt:Date.now()})",
    line: 35,
  },
  // (d) activity.list limit cap + take
  {
    file: 'convex/activity.ts',
    label: 'list caps limit at 50',
    src: activitySrc,
    snippet: 'const limit=Math.min(args.limit||12,50)',
    line: 17,
  },
  {
    file: 'convex/activity.ts',
    label: 'list computes take=Math.max(limit*8,100): at least 100 and 8x limit only when limit>=13, otherwise more than 8x limit',
    src: activitySrc,
    snippet: 'const take=Math.max(limit*8,100)',
    line: 18,
  },
  {
    file: 'convex/activity.ts',
    label: 'list over-fetches take rows per kind on the by_politician_date branch via .take(take)',
    src: activitySrc,
    snippet: ".filter(q=>q.eq(q.field('kind'),kind)).take(take)",
    line: 20,
  },
  {
    file: 'convex/activity.ts',
    label: 'list over-fetches take rows per kind on the by_published branch via .take(take)',
    src: activitySrc,
    snippet: ".filter(q=>q.eq(q.field('kind'),kind)).take(take);",
    line: 21,
  },
  {
    file: 'convex/activity.ts',
    label: 'list trims the over-fetched/enriched rows back down to limit via diverse(enriched,limit,args.kind)',
    src: activitySrc,
    snippet: 'return diverse(enriched,limit,args.kind);',
    line: 28,
  },
  {
    file: 'convex/activity.ts',
    label: 'paginated() uses Convex cursor pagination via .paginate(args.paginationOpts)',
    src: activitySrc,
    snippet: '.paginate(args.paginationOpts)',
    line: 15,
  },
  // (b) archive bucketing
  {
    file: 'convex/intelligence.ts',
    label: 'archive input is social-only: activity filtered to kind===social before collect()',
    src: intelligenceSrc,
    snippet: "ctx.db.query('activity').filter(q=>q.eq(q.field('kind'),'social')).collect()",
    line: 6,
  },
  {
    file: 'convex/intelligence.ts',
    label: 'archive skips posts with non-finite publishedAt before bucketing (finite timestamp guard)',
    src: intelligenceSrc,
    snippet: "if(!Number.isFinite(post.publishedAt))continue;",
    line: 14,
  },
  {
    file: 'convex/intelligence.ts',
    label: 'archive derives person=String(politicianId) and platform=post.platform||unknown',
    src: intelligenceSrc,
    snippet: "const person=String(post.politicianId),platform=post.platform||'unknown';",
    line: 15,
  },
  {
    file: 'convex/intelligence.ts',
    label: 'archive buckets by UTC month via toISOString().slice(0,7)',
    src: intelligenceSrc,
    snippet: "new Date(post.publishedAt).toISOString().slice(0,7)",
    line: 16,
  },
  {
    file: 'convex/intelligence.ts',
    label: 'format falls back to mediaKind video/image else unspecified when no short-form URL match',
    src: intelligenceSrc,
    snippet: "post.mediaKind==='video'?'video':post.mediaKind==='image'?'image':'unspecified'",
    line: 17,
  },
  {
    file: 'convex/intelligence.ts',
    label: 'bucket accumulates count++ and latest=Math.max(latest,publishedAt) per key',
    src: intelligenceSrc,
    snippet: "old.count++;old.latest=Math.max(old.latest,post.publishedAt);buckets.set(key,old);",
    line: 20,
  },
  {
    file: 'convex/intelligence.ts',
    label: 'archive bucket key is [person,platform,month,format]',
    src: intelligenceSrc,
    snippet: "const key=[person,platform,month,format].join(':')",
    line: 18,
  },
  {
    file: 'convex/intelligence.ts',
    label: 'archive keeps one latest representative example per bucket key',
    src: intelligenceSrc,
    snippet: "if(!examples.has(exampleKey)||examples.get(exampleKey)!.date<post.publishedAt)",
    line: 24,
  },
  {
    file: 'convex/intelligence.ts',
    label: 'format derived from short-form URL regex or mediaKind',
    src: intelligenceSrc,
    snippet: "/tiktok\\.com\\/@[^/]+\\/video\\/|\\/reel\\/|\\/reels\\/|\\/shorts\\//i.test(post.sourceUrl)",
    line: 17,
  },
  // (c) account attribution
  {
    file: 'convex/intelligence.ts',
    label: 'accounts identifies tiktok/x_twitter as handle-matched platforms',
    src: intelligenceSrc,
    snippet: "const identified=a.platform==='tiktok'||a.platform==='x_twitter'",
    line: 29,
  },
  {
    file: 'convex/intelligence.ts',
    label: 'accounts normalizes stored handle: strips leading @ and lowercases',
    src: intelligenceSrc,
    snippet: "const handle=a.handle.replace(/^@/,'').toLowerCase();",
    line: 29,
  },
  {
    file: 'convex/intelligence.ts',
    label: 'accounts requires post to match account politicianId AND platform (person-platform scope)',
    src: intelligenceSrc,
    snippet: "if(p.politicianId!==a.politicianId||p.platform!==a.platform)return false;",
    line: 29,
  },
  {
    file: 'convex/intelligence.ts',
    label: 'accounts non-identified platforms accept every matching person+platform post (return true)',
    src: intelligenceSrc,
    snippet: "if(!identified)return true;",
    line: 29,
  },
  {
    file: 'convex/intelligence.ts',
    label: 'accounts extracts tiktok handle from post URL via /tiktok.com/@(handle)/ regex',
    src: intelligenceSrc,
    snippet: "a.platform==='tiktok'?p.sourceUrl.match(/tiktok\\.com\\/@([^/?#]+)/i)",
    line: 29,
  },
  {
    file: 'convex/intelligence.ts',
    label: 'accounts extracts x/twitter handle from post URL via /(x|twitter).com/(handle)/status/ regex',
    src: intelligenceSrc,
    snippet: "p.sourceUrl.match(/(?:x|twitter)\\.com\\/([^/?#]+)\\/status\\//i)",
    line: 29,
  },
  {
    file: 'convex/intelligence.ts',
    label: 'accounts compares the lowercased captured handle group against the normalized stored handle',
    src: intelligenceSrc,
    snippet: "return match?.[1].toLowerCase()===handle;",
    line: 29,
  },
  {
    file: 'convex/intelligence.ts',
    label: 'accounts scope field distinguishes account vs person-platform',
    src: intelligenceSrc,
    snippet: "scope:identified?'account':'person-platform'",
    line: 29,
  },
];

const frontendPath = path.join(ROOT, 'src', 'components', 'reference', 'IntelligenceWorkspace.tsx');
const frontendSrc = fs.readFileSync(frontendPath, 'utf8');
checks.push(
  {
    file: 'src/components/reference/IntelligenceWorkspace.tsx',
    label: 'default lookback window computed from latest available month minus 11',
    src: frontendSrc,
    snippet: 'startDate.setUTCMonth(startDate.getUTCMonth()-11)',
    line: 28,
  },
  {
    file: 'src/components/reference/IntelligenceWorkspace.tsx',
    label: 'cohort filters people by person/party/province and name search',
    src: frontendSrc,
    snippet: '(!party||p.party===party)&&(!province||p.province===province)',
    line: 26,
  },
  {
    file: 'src/components/reference/IntelligenceWorkspace.tsx',
    label: 'effectiveFrom = explicit from arg overriding the default 12-month lookback',
    src: frontendSrc,
    snippet: 'const effectiveFrom=from||defaultFrom;',
    line: 28,
  },
  {
    file: 'src/components/reference/IntelligenceWorkspace.tsx',
    label: 'cohort ids set built from filtered people for bucket/account scoping',
    src: frontendSrc,
    snippet: 'const ids=new Set(cohort.map(p=>p.id));',
    line: 29,
  },
  {
    file: 'src/components/reference/IntelligenceWorkspace.tsx',
    label: 'buckets filtered by cohort membership and optional platform equality',
    src: frontendSrc,
    snippet: "ids.has(b.person)&&(!platform||b.platform===platform)",
    line: 29,
  },
  {
    file: 'src/components/reference/IntelligenceWorkspace.tsx',
    label: 'buckets filtered by explicit from bound (b.month>=effectiveFrom)',
    src: frontendSrc,
    snippet: '!effectiveFrom||b.month>=effectiveFrom',
    line: 29,
  },
  {
    file: 'src/components/reference/IntelligenceWorkspace.tsx',
    label: 'buckets filtered by explicit to bound (b.month<=to)',
    src: frontendSrc,
    snippet: '!to||b.month<=to',
    line: 29,
  },
  {
    file: 'src/components/reference/IntelligenceWorkspace.tsx',
    label: 'missing months in the from/to range are zero-filled before bucket counts are accumulated onto them',
    src: frontendSrc,
    snippet: "series.set(month,{month,...Object.fromEntries(platforms.map(p=>[p,0]))})",
    line: 33,
  },
  {
    file: 'src/components/reference/IntelligenceWorkspace.tsx',
    label: 'bucket counts are accumulated onto the zero-filled month series by platform',
    src: frontendSrc,
    snippet: 'point[b.platform]=Number(point[b.platform]||0)+b.count',
    line: 34,
  },
);

let failed = 0;
for (const check of checks) {
  const lines = check.src.split('\n');
  const lineText = lines[check.line - 1] || '';
  const present = check.src.includes(check.snippet);
  const onCitedLine = lineText.includes(check.snippet);
  if (!present) {
    failed++;
    console.error(`FAIL [${check.file}:${check.line}] ${check.label}\n  missing snippet: ${check.snippet}`);
  } else if (!onCitedLine) {
    failed++;
    console.error(`FAIL [${check.file}:${check.line}] ${check.label}\n  snippet found elsewhere in file but not on cited line ${check.line}`);
  } else {
    console.log(`OK   [${check.file}:${check.line}] ${check.label}`);
  }
}

if (failed > 0) {
  console.error(`\n${failed} of ${checks.length} cited behaviors not found in current source.`);
  process.exit(1);
}
console.log(`\nAll ${checks.length} cited behaviors confirmed present in current source.`);
