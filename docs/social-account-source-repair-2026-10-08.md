# Monitor source repair and account audit

## Verified source connection

The published Monitor app at https://orwell-database-admin.vercel.app initializes its Convex client against `combative-kiwi-307`. The Panama importer was hardcoded to `graceful-perch-508`, where the latest feed ended on April 28. The published JavaScript client initialization and recent public queries establish the active source; the historical dev/prod labels alone did not.

The corrected Panama action reads bounded per-platform Politics feeds from the active source. It accepts only unique CONFIRMED directory platform/handle matches, rejects author URL mismatches on TikTok and X, and preserves publication timestamps and source URLs. It imports existing collected posts without paid scraping or model calls. `MONITOR_ARCHIVE_URL` can override the verified default when the Monitor deployment changes.

The first production run inserted 145 posts for seven people. A second run inserted zero duplicates. The archive now has 6,476 social posts and its latest publication is October 6, 2026. Browser verification confirmed the new date and evidence links on the live intelligence page. TikTok reached the bounded 200-result limit; this is a recent sample, not full account-history coverage. The run logs that limit explicitly.

## Account audit remains open

The attached mapping JSON audits every zero-archive account against the active Monitor Politics registry. After the Manuel correction, 61 accounts still have zero matching Panama posts: 42 have no exact account mapping in that registry; the remaining 19 map uniquely. A missing registry mapping is a technical coverage finding, not proof of public inactivity. Disabled Monitor accounts likewise require review of the reason before any paid reactivation.

Manuel Cohen's campaign Linktree https://linktr.ee/ManuelCohen points to TikTok `@manuel_cohens`, not the directory's former `@manuelcohen58`. The public TikTok profile returned matching identity and the circuit 6-1 campaign description. The directory handle and URL were corrected, and the account's own avatar was refreshed into Convex storage and visually inspected. The corrected handle is not yet registered in the active Monitor Politics dataset; no paid collection was enabled.

Yesica Romero's `@yessicaromero856` remains the one missing saved avatar. It has no exact mapping in the active Monitor Politics registry. Public search did not establish an independently verified replacement. Do not invent an avatar or relabel an unrelated namesake as this deputy. This keeps the avatar verification step open.

Monitor already has its account-health agent and adaptive scrape scheduler. This repair changes no paid tiers, workers or account activation. The directory continues one bounded archive reuse daily. Further polling changes require account-level evidence separating bad handles, missing registration, disabled collection and actual dormancy.

## Verification

- `node scripts/verify-monitor-identity.cjs`: confirmed unique handle acceptance, duplicate and probable rejection, platform/host isolation, HTTPS enforcement, corrected author URL protection.
- Convex production deployment and TypeScript passed.
- Two production action runs: 145 inserted, then zero duplicates.
- `npm run build` passed.
- Live intelligence displays October coverage and retained source links.
