# Visual identity in ORWELL

- In visual lists of publishers, parties, companies, organizations, and platforms, show their authentic logos or icons. Pair publisher marks with the actual publisher name. In compact platform columns, the icon can carry the visible identity with its name in `alt`, accessible labels, and tooltips. A typed name alone is not a substitute for an available mark.
- Prefer approved local assets, then marks from the organization's own site. Preserve the official artwork's proportions, colors, and geometry. Record asset provenance in the relevant `SOURCES.md`.
- Use an account's actual social profile image for its avatar. Never substitute the politician's portrait and imply it is the account avatar. If the profile image cannot be verified or the account is unavailable, show the platform icon and keep that limitation explicit.

# Social account integrity and collection cost

- Treat a corrected profile URL as a new identity check. Reconcile its handle with the URL, fetch that account's own current avatar, verify the image visually or against its public profile, and keep source provenance. Do not reuse an old account's avatar or posts under the corrected handle.
- Investigate every missing or placeholder avatar, zero-post account, and stale last-post date. First check the public profile and owner evidence, then the Monitor account mapping, last successful scrape, errors, and archive import. A zero in Panama means no matching posts in its reused archive; it does not prove the account is inactive.
- Attribute posts to a specific account only when source evidence identifies its handle. Otherwise label counts and dates as an archive grouping by person and platform. Show the most recent archived publication date below each account's archived post count; show a clear no-data state when none exists.
- Keep paid scraping in ORWELL Monitor. Check its existing account-health agent and adaptive scheduler before changing cadence. Reduce polling for confirmed dormant accounts within Monitor's schedule, but do not lower cadence to conceal a broken scraper or incorrect handle. Recheck intermittently for reactivation.
