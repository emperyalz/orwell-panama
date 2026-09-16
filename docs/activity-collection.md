# Panama activity collection

Production directory and workshop: `fleet-vole-527`. Existing social collection engine: ORWELL Monitor, `graceful-perch-508`, repository `~/orwell-monitor`.

## Running now

- News: six precise full-name Google News RSS searches hourly, rotating across the 91 directory profiles. Original publisher title, date and outbound URL are preserved. No paid scraping or AI enrichment.
- Social archive: import the latest 500 political posts already collected by Monitor daily. Match author names exactly after accent normalization; posts about someone require one unambiguous full-name mention. Preserve the source author and original date. This is archive reuse, not a new social scrape.
- Votes: check official Assembly public reports daily. Process reports serially in separate actions, retry HTTP fetches and deduplicate by official vote ID. Complete each report only after updating deputy aggregates. Failed reports remain eligible for the next check. Secret votes are omitted.

## Data boundaries

The historical voting archive crosses mandates and contains principals and substitutes. New records extend the archive; they do not validate historical person-to-mandate links or establish attendance rates. Committee memberships retain the available Espacio Cívico associations and their unknown period. Province boundaries derive from the Instituto Geográfico Nacional Tommy Guardia ArcGIS service.

Espacio Cívico refreshes preserve existing document storage pointers. Set `SCRAPE_OUTPUT` on the scraper and `SCRAPE_INPUT` on the seed script to inspect an import before applying it.

## Remaining rollout work

The two broad profile notes about the social scraping restart and launch remain open. Paid social collectors have not been restarted. Their next-week rollout should reuse Monitor's existing collectors and account cursors, use explicit account selection and spending limits, and avoid historical backfills. News and vote polling are already active. No paid job or future spending authorization is assumed from archive integration.

Launch SEO/indexing and a dedicated policy/bill lifecycle collector are further work. The aggregate activity page includes published legislative vote titles with official report links; those titles do not establish a bill's final legal status.
