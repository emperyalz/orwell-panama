# Track communication changes

Step: `communication-trends/track-communication-changes`

## What changed

`src/components/reference/IntelligenceWorkspace.tsx` gained a third, always-visible
view option in the existing "Activity over time" section's tab control: **Chart**,
**Table**, and now **Change** (`t('change')` — es: Cambio, en: Change, pt: Mudança).

The Change view shows, for the currently selected person + platform:

- the current resolved period (`effectiveFrom`..`effectiveTo`) and its summed
  archived post count (`currentPeriodSum`),
- the immediately preceding period of equal length (`priorFrom`..`priorTo`) and
  its summed archived post count (`priorPeriodSum`), and
- the signed delta (`periodDelta = currentPeriodSum - priorPeriodSum`), with a
  translated phrase describing whether it increased, decreased, or stayed the
  same.

If no person+platform is selected, or the resolved range is invalid, the view
shows `changeSelect` ("Select a person and a platform to see the post-count
change."). If the archive has no buckets at all for that person+platform in the
immediately preceding equal-length window, the view shows `changeNoPrior` ("No
equivalent prior period available to compare.") instead of fabricating a zero
baseline.

An always-rendered methodology note (`changeNote`) states, in all three
languages, that this is a raw post-count delta and does **not** measure tone,
sentiment, stance, or ideology.

### Correction: Change view must render even when the current filtered total is zero

A prior release nested the Change view inside the chart/table section's
`!total?<empty-state>:...` conditional, so whenever `total` (the sum over the
*currently filtered* buckets, unrelated to `currentPeriodSum`) was zero, the
UI rendered only the generic "no posts" empty state and never showed the
Change view at all — even for a selected month with zero current posts but a
positive immediately preceding month, which should display a visible negative
delta (e.g. current 0, prior 5 → `-5`). The JSX branch order has been moved so
`view==='trend'` is checked **before** the `!total` guard:

```
{view==='trend'
  ? <div className="intelligence-change">...changeSelect / changeNoPrior / current+prior+delta...</div>
  : !total
    ? <p>{t('empty')}</p>
    : view==='chart' ? ... : view==='table' ? ... : null}
```

The chart and table views keep their original `!total` empty-state fallback
unchanged.

## Computation (all derived from the already-queried `data.buckets`)

```
shiftMonth(m, n)      — add n months to an 'YYYY-MM' string (UTC)
monthSpan(m1, m2)     — inclusive month count from m1 to m2
sumBuckets(from, to)  — sum bucket.count for the selected person+platform in [from, to]

changeReady     = person selected && platform selected && effectiveFrom && effectiveTo && effectiveFrom <= effectiveTo
changeSpan      = monthSpan(effectiveFrom, effectiveTo)
priorTo         = shiftMonth(effectiveFrom, -1)
priorFrom       = shiftMonth(priorTo, -(changeSpan - 1))
hasPriorPeriod  = any bucket exists for person+platform with month in [priorFrom, priorTo]
currentPeriodSum = sumBuckets(effectiveFrom, effectiveTo)
priorPeriodSum   = hasPriorPeriod ? sumBuckets(priorFrom, priorTo) : 0
periodDelta      = currentPeriodSum - priorPeriodSum
```

No Convex schema, query, or budget code was modified. The computation reads
only the `data.buckets` array already fetched by `api.intelligence.archive`
for the existing chart/table views.

## Scope limits

- Requires a single person and single platform to be selected; it does not
  aggregate deltas across "all platforms" or multiple people, since summing
  unrelated series into one signed number would be misleading.
- `hasPriorPeriod` reflects archive coverage, not real-world posting history —
  a collection gap in the prior window correctly yields "no prior period to
  compare" rather than a false zero baseline.
- The metric is exclusively a raw count delta. It carries no sentiment, tone,
  stance, ideology, reach, or audience-size signal, and the rendered copy says
  so explicitly in Spanish, English, and Portuguese.

## Related scoreboard connection (bounded handoff)

A protected real-browser check found that `Scoreboard.tsx` did not mount the
`ControllerStatus` live-operations/budget panel at all, so the readout never
appeared on the page. Root added only the import and
`<ControllerStatus lang={lang}/>` immediately before `<LeadAccountability/>`.
This revision verifies that connection at the source/dependency level:

- `Scoreboard.tsx` imports `{ControllerStatus}` (line 2) and mounts it (line 62)
  immediately before `LeadAccountability` (line 63).
- `ControllerStatus.tsx` imports `./controller-status.css` (line 8) and
  references `/images/providers/codex.png` and `/images/providers/claude.ico`
  (line 46). All three dependency files exist and are non-empty — a plain
  `tsc --noEmit` does **not** detect an absent CSS import or missing public
  image, so the regression checks them on disk. These three files were
  root-restored (missing on the VPS) and are preserved byte-for-byte.
- `convex/controllerStatus.ts` `snapshot` computes source-backed `progress`
  (`{total, completed, remaining}` from the scoped item keys) and `blockers`
  (scoped items in the `blocked` state) and passes through the root-published,
  never-simulated allocation/providers budget data; `controllerStatusData.ts`
  declares the measured `limitPoints`/`reservePoints` fields, and the component
  renders `p.limitPoints ?? snapshot.allocation.limitPoints` (the actual Codex
  40 / Claude 30 caps enforced by `scripts/orwell-pilot/budget.mjs`).

The currently deployed page may lack this connection until root publishes the
reviewed revision; the controller's actual Next build and protected browser
gate remain the authoritative pre-publication check.

## Verification

```
node scripts/product-audits/communication-trends-track-communication-changes.cjs
npx tsc --noEmit --incremental false -p tsconfig.json
node scripts/orwell-pilot/budget.test.mjs
node scripts/orwell-pilot/provider-routing.test.mjs
node scripts/orwell-pilot/status.test.mjs
```

The `.cjs` script statically parses the live `IntelligenceWorkspace.tsx` source
to confirm:

- the `'trend'` view option and its button exist,
- the delta computation lines (`shiftMonth`, `monthSpan`, `changeReady`,
  `changeSpan`, `priorTo`, `priorFrom`, `hasPriorPeriod`, `currentPeriodSum`,
  `priorPeriodSum`, `periodDelta`) are present verbatim,
- all nine new copy keys have exactly 3 `[es,en,pt]` entries,
- the `changeNote` disclaimer explicitly names tone/sentiment/stance/ideology
  in all three languages,
- the `view==='trend'` branch occurs before the `!total` guard (by string
  index in the extracted render block) and before the rendered `changeNote`,
  so the Change view is reached even when the filtered `total` is zero, and
- the chart/table views still retain their `!total` empty-state fallback.

It then runs a pure JS reimplementation of the delta math against 7
constructed bucket fixtures — increase, decrease, no-prior-period,
zero-to-nonzero, cross-person/platform isolation, current-zero/prior-positive
(current=0, prior=5 → periodDelta=-5), and a multi-month window — and asserts
the signed deltas, prior-period detection, and window boundaries match
hand-computed expected values.
