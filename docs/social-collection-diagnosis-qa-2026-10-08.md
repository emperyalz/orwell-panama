# Independent QA: social collection diagnosis, 2026-10-08

## Scope and method

I independently queried the production Monitor deployment `combative-kiwi-307` with read-only `queries:auditAccount` calls for all ten exact platform/handle pairs in Iris's dossier. I also inspected the Monitor query implementation and the Mayín migration comment. No writes, scraper jobs, paid scraper requests, or avatar verification were performed. The ten exact registry results reproduce the dossier's account existence, flags, scrape timestamps, backfill summaries, and stored post counts.

This verifies the reported technical state at query time. It does not prove account ownership, explain all historical status changes, or establish that a platform account remains available today.

## Accepted findings

- **All ten registry lookups:** seven exact Monitor rows exist and three do not. Yesica Romero/TikTok, Carlos Saldaña/X, and Jony Guevara/Instagram return not found. These absences support “no Monitor account-level attempt/error is available,” not “no platform content exists.”
- **Mayín Correa/X:** exact row is inactive and paused, has no last scrape timestamp, and its backfill reports zero ingested and zero errors. The migration source comment explicitly says it was paused on 2026-03-16 because it was considered private. The candidate's public readability on the identity-audit date makes that reason worth reviewing; it does not establish ownership or authorize a status change.
- **Osmán Gómez/Instagram:** row is inactive, has zero Monitor posts, and its backfill says `api_exhausted` with the queue-displacement message. The reported backfill completion time predates its start time; I reproduced that inconsistency. Public profile post counts and Monitor stored posts are different measures.
- **Osmán Gómez/TikTok:** row is inactive and its historical backfill error says “Account suspended/deleted on TikTok.” This is a stored past collector message, not independent evidence of present deletion. The current generic shell does not resolve availability.
- **Alaín Cedeño/Facebook:** row is inactive, has 78 stored Monitor posts (newest 2026-06-08), no backfill row, and zero consecutive failures. This does not resolve the identity dossier's circuit conflict.
- **Jorge Bloise/Facebook:** the old exact row remains in Monitor, inactive, with two stored posts (newest 2025-10-05), no backfill row, and zero consecutive failures. Keep this separate from the alternate professional Facebook destination; Monitor evidence does not establish that the old row should be transferred or re-enabled.
- **Ricardo Vigil/X:** row is inactive and has two old posts (newest 2015-08-12); completed backfill reports zero ingested and zero errors. No owner evidence for an alternate handle follows from this state.
- **Ernesto Cedeño/Facebook:** row is inactive with three stored posts (newest 2024-05-18), no backfill row, and zero consecutive failures. The separate identity QA's owner-site cross-link supports the exact profile, but this registry query itself establishes only collection state.
- **Activity history limitation:** the available `agentActions` query covers only the most recent 60 days. A read-only query for these seven exact IDs returned no actions in that window. That cannot recover older manual or migration-driven changes. The Mayín migration comment is the only specific cause surfaced in the sources inspected.

## Disputed or qualified diagnosis

The dossier says, “The scraper account queries explicitly filter for active, unpaused rows.” This is true of the per-platform due/backfill query modules and backfill query, but is too broad as a statement about every collection path. `convex/scraping/worker.ts:getAccountsDue` checks `isActive` without checking `isPaused`; its worker loop likewise checks active status. Every extant candidate row here is inactive, so this distinction does not change the observed disposition of these seven rows. It does mean a future change that activates a paused row must account for the worker path explicitly.

The exact registry state does not independently validate archive matching or identity conclusions. “Zero Panama archive matches” is an archive-specific result, not zero platform posts; the dossier correctly distinguishes these where it reports Monitor counts. For unavailable/missing rows, lack of Monitor errors is a consequence of no exact registration, not a diagnosis of platform failure.

## Safe repair prerequisites

- Keep the three absent accounts unregistered and existing unresolved identities disabled until separate identity QA accepts an exact official or owner-controlled link.
- Do not reactivate or change pause flags based on profile readability, names, roles, circuit, or stored avatar/post data alone. For Mayín, first independently confirm current ownership and visibility; then review the original pause rationale.
- Before considering Osmán Instagram collection, resolve the backfill timestamp inconsistency and queue behavior, and require identity acceptance. Treat the TikTok error as historical until a current public response and owner evidence are independently established.
- Keep Jorge's legacy row distinct from the alternate professional page. Any migration would need explicit identity mapping and a reviewed plan for existing posts/avatar attribution.
- Use a read-only coverage view that includes inactive and paused rows. Do not infer historical actor/reason from the 60-day action query; retain that gap until an older audit source is found.

Raw independent query output and machine-readable judgments are in [/tmp/orwell-social-collection-diagnosis-qa.json](/tmp/orwell-social-collection-diagnosis-qa.json).
