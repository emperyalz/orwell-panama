# Panama activity collection

Production directory and workshop: `fleet-vole-527`. Existing social collection engine: ORWELL Monitor, `graceful-perch-508`, repository `~/orwell-monitor`.

## Running now

- News: six precise full-name Google News RSS searches hourly, rotating across the 91 directory profiles. Original publisher title, date and outbound URL are preserved. No paid scraping or AI enrichment.
- Social archive bootstrap: `node scripts/import-social-archive.mjs` paginates the whole Monitor archive and matches unique platform handles or exact entity identities. September 16 import: 10,166 source posts, 6,325 matched posts across 75 profiles, 6,064 newly inserted, 4,388 with media. Forty unmatched accounts remain audited rather than guessed. Daily incremental reuse checks the latest 500 posts with unique exact author matches. This is archive reuse, not a new social scrape.
- Bills: the official Assembly Seguimiento Legislativo search supplies ficha, project/anteproject number, title, introduction date, stage and proponents. Daily polling scans up to 150 pages through the current mandate from July 2024. Stage history records observation dates, not enactment dates. Profile links require named proponents, never inferred voting support.
- Media: daily free enrichment targets each profile's latest four news and four social items. Publisher article images, Instagram image endpoints and TikTok oEmbed posters are persisted to Convex. Exact official outlet logos are local assets. Unsupported media falls back to the original source or a supported embed, without invented images.
- Presentation: compact feeds require usable visual media, suppress exact and near-duplicate titles, and select across people, parties, publishers, platforms and publication days. Full activity archives remain chronological and paginated.
- Sources: `/metodologia` computes a live registry of every news publisher and every identified social account, including archive counts and original links.
- Votes: check official Assembly public reports daily. Process reports serially in separate actions, retry HTTP fetches and deduplicate by official vote ID. Complete each report only after updating deputy aggregates. Failed reports remain eligible for the next check. Secret votes are omitted.

## Data boundaries

The historical voting archive crosses mandates and contains principals and substitutes. New records extend the archive; they do not validate historical person-to-mandate links or establish attendance rates. Committee memberships retain the available Espacio Cívico associations and their unknown period. Province boundaries derive from the Instituto Geográfico Nacional Tommy Guardia ArcGIS service.

Espacio Cívico refreshes preserve existing document storage pointers. Set `SCRAPE_OUTPUT` on the scraper and `SCRAPE_INPUT` on the seed script to inspect an import before applying it.

## Rollout boundaries

Paid social collectors have not been restarted. A future restart should reuse Monitor's existing collectors and account cursors, use explicit account selection and spending limits, and avoid historical backfills. News, bill and vote polling are already active. No paid job or future spending authorization is assumed from archive integration.

Launch SEO is implemented through public canonical URLs, Person JSON-LD, dynamic politician/party/bill sitemap, and robots exclusion of editor/admin routes. Set NEXT_PUBLIC_SITE_URL to the confirmed production custom domain before launch and redeploy. Register that domain in Search Console and submit /sitemap.xml after DNS is live; deployment itself does not guarantee search indexing. Bill stages come from the official tracker and do not imply independently verified promulgation.
