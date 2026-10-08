# Shared project scoreboard

- Maintain the public `/scoreboard` page as the shared task record for Eric and the team. New requests add to existing work unless Eric explicitly cancels or replaces a task.
- The production `projectTasks` table is the live status source. Update it using trusted internal `scoreboard:setTask` calls; do not expose public task-write mutations. Keep `WORKLIST.md` aligned as the local readable summary.
- Mark tasks done only after the requested result is delivered and relevant verification succeeds. Record completion evidence. A successful dispatch or build alone is not completion of a deployment or live feature.
- MANDATORY CHECKLIST POLICY: Every task, including completed tasks, must contain explicit, independently checkable steps. Never use a paragraph in place of a checklist. Keep short labels and visible checked/total counts. A task cannot move to Completed while any step remains unchecked; every checked step needs verification evidence. Voice questions and new requests do not cancel prior work.
- Keep task titles short and visual, with green completion checks. Use the selected English, Spanish, or Portuguese language.
- Do not reset recorded status during deployments. The seed only adds missing tasks. Add new requests promptly, retain completed work, and accurately distinguish current work from queued scope.

# Visual identity in ORWELL

- In visual lists of publishers, parties, companies, organizations, and platforms, show their authentic logos or icons. Pair publisher marks with the actual publisher name. In compact platform columns, the icon can carry the visible identity with its name in `alt`, accessible labels, and tooltips. A typed name alone is not a substitute for an available mark.
- Prefer approved local assets, then marks from the organization's own site. Preserve the official artwork's proportions, colors, and geometry. Record asset provenance in the relevant `SOURCES.md`.
- Use an account's actual social profile image for its avatar. Never substitute the politician's portrait and imply it is the account avatar. If the profile image cannot be verified or the account is unavailable, show the platform icon and keep that limitation explicit.

# Social account integrity and collection cost

- Treat a corrected profile URL as a new identity check. Reconcile its handle with the URL, fetch that account's own current avatar, verify the image visually or against its public profile, and keep source provenance. Do not reuse an old account's avatar or posts under the corrected handle.
- Investigate every missing or placeholder avatar, zero-post account, and stale last-post date. First check the public profile and owner evidence, then the Monitor account mapping, last successful scrape, errors, and archive import. A zero in Panama means no matching posts in its reused archive; it does not prove the account is inactive.
- Attribute posts to a specific account only when source evidence identifies its handle. Otherwise label counts and dates as an archive grouping by person and platform. Show the most recent archived publication date below each account's archived post count; show a clear no-data state when none exists.
- Keep paid scraping in ORWELL Monitor. Check its existing account-health agent and adaptive scheduler before changing cadence. Reduce polling for confirmed dormant accounts within Monitor's schedule, but do not lower cadence to conceal a broken scraper or incorrect handle. Recheck intermittently for reactivation.

- Verify social account ownership using a politician’s official institutional page, own website or cross-linked professional accounts and corroborated role/location. A matching name, search ranking, platform badge, existing CONFIRMED flag, or familiar portrait alone is insufficient. Recheck probable identities and user-reported mismatches first, then audit all linked accounts and missing profiles. Keep an account-level evidence record and explicitly distinguish verified ownership, a proven wrong account, and unresolved ownership. Changes require source review; never carry an old identity’s avatar or post history onto a replacement account.

- Social identity audits require independent quality assurance outside the research batch. The reviewer must reopen the ownership sources and can reject claims. Do not apply new research corrections until independent review accepts them; verify account-specific avatar and archive attribution separately. Report blocked access or conflicting ownership honestly rather than marking a search result verified. Rotate research and QA workers when concurrency is limited; retain every batch assignment and resume paused batches.

- Use the lowest suitable model and reasoning effort for each assignment. Routine source discovery uses a lower-cost model; escalate ambiguous ownership evidence selectively. Keep model choice visible on the live agent board. Agent telemetry must come from actual session events, never simulated heartbeats or invented progress; distinguish an ended agent turn from a verified completed deliverable.
