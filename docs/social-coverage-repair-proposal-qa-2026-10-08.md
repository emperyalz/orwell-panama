# Independent QA: social coverage repair proposal, 2026-10-08

## Review scope

I reviewed the proposal’s Ernesto Cedeño and Jorge Bloise identity chains and traced its proposed status, registration, and polling steps into the current Monitor source. Website pages were fetched directly over HTTPS; the Jorge X and Linktree HTML were inspected for live metadata and exact outbound links. Monitor review was source-only and read-only. I made no production changes and ran no scraper or paid API request.

## Accepted findings and safe identity updates

**Ernesto Cedeño: accept the exact Facebook ownership mapping.** The current owner-controlled site identifies Dr. Ernesto Cedeño Alvarado, and its biography says he is a sitting deputy for circuit 8-4. The site homepage and contact page each contain an explicit, labeled link to `https://www.facebook.com/cedenoabogado/`; the homepage structured data also lists that URL as a sameAs profile. Voto Informado independently identifies the candidate/circuit and links the same exact Facebook URL. This is a strong direct owner-link plus office/circuit corroboration. The proposal is right that this corrects the identity verdict for the existing Monitor row; it does not require a handle replacement or second account.

Safe identity-layer change: mark the existing `cedenoabogado` mapping verified and retain its same account ID/URL. The identity conclusion does not itself verify the cached avatar’s current appearance or audit all three stored posts. Keep those media/post records attached to the existing row, as proposed.

**Jorge Bloise: accept the professional Facebook destination as distinct from the old row.** The official [VAMOS roster](https://www.vamosporpanama.com/autoridades/bancada) lists Jorge Bloise as a deputy for circuit 8-4 and directly links his Instagram `jorgeibloise` and X `jorgeibloise`. The live X page identifies Jorge Bloise Iglesias, says deputy for VAMOS, circuit 8-4, and links `linktr.ee/jorgebloisei`. That Linktree page identifies a deputy for circuit 8-4 and links the exact Facebook URL `https://www.facebook.com/JorgeIsaacIglesiasBloise/`. The Facebook target page itself returns the same full name and deputy/circuit description. This chain is materially stronger than name resemblance and is enough to accept the current professional Facebook mapping.

The old Monitor `/jorgebloise` row is a different URL and remains unresolved. Keep its ID, URL, avatar, and two posts separate; do not label it impersonation or transfer its contents. Safe identity-layer change: record the exact professional destination as a separate accepted mapping. Do not overwrite the legacy mapping.

## Operational assumptions rejected or narrowed

**Activation schedules an immediate attempt.** In `convex/admin.ts:setAccountActive`, setting `isActive: true` patches an existing priority row’s `nextScrapeAt` to `Date.now() - 1000` and resets `consecutiveFailures` to zero. This makes it due immediately; it does not “schedule within normal cadence.” Cron execution timing determines when the due row is actually attempted. The proposal correctly spots this behavior, but its suggestion to activate and then schedule normally is not safely implementable with this mutation alone. A separate, atomic activation/cadence operation would be needed to avoid a window in which a due account can be collected.

**Adding the proposed Facebook row has automatic side effects.** The standard `convex/admin.ts:addAccountToEntity` mutation inserts the account as active, then schedules `fetchAndStoreAvatar` immediately. For Facebook, that function calls the ScrapeCreators profile endpoint and can store the returned avatar. The mutation also schedules bio-link discovery after 10 seconds. Therefore “start with no inherited avatar or posts” is accurate about not copying legacy data, but does not mean the new row starts without a fresh avatar probe or other scheduled work.

The same mutation does not create a `platformPriority` row, and its Backfill-on-Add branches cover Instagram, TikTok, Twitter, and YouTube, not Facebook. Consequently, adding a Facebook row through this path does not establish the proposed LOW cadence, and does not give the standard Facebook due-query a priority record to poll. Other seed/migration paths commonly create priority rows with `nextScrapeAt: now`, so the exact insertion path matters. The proposed “add row, LOW tier, no immediate poll” is not a one-step safe action in current code.

**LOW cadence detail:** the source sets shared post-success intervals to HIGH 24h, MEDIUM 48h, and LOW 72h in `twitterScraperQueries.ts:updateNextScrape`. Facebook’s LOW cron itself runs daily and selects accounts whose stored `nextScrapeAt` is due. A 72-hour account interval depends on a successful attempt writing that future timestamp; it is not guaranteed merely by labeling a newly inserted row LOW.

**Paused behavior still differs by collection path.** Per-platform query modules require both `isActive` and `!isPaused`, but `convex/scraping/worker.ts:getAccountsDue` checks only `isActive`. This does not alter the current seven inactive rows but should be fixed or explicitly guarded before activating a paused row.

## Safe next changes and prerequisites

- Apply the identity verdict for Ernesto to the research/identity record only. Keep the existing exact Monitor row and its posts. Any separate operational activation should be held for an explicitly designed schedule path; current activation makes the row due immediately.
- Record Jorge’s professional Facebook mapping as a new, distinct identity mapping while leaving the old Monitor row untouched. The identity decision is accepted; production registration and collection are not ready through the standard add mutation.
- Before adding Jorge’s Facebook row, provide a registration path that can create it inactive (or otherwise non-collectible), omit avatar fetching and bio discovery unless separately requested, avoid backfill, and create/assign an explicit LOW priority with a future due timestamp. Ensure both the cron query and VPS worker honor paused state. Then inspect the resulting row read-only before any separate activation.
- If an operator chooses to activate Ernesto or another existing row, use a single operation that atomically sets active status and the intended future `nextScrapeAt`; do not call `setAccountActive(true)` and assume the tier will delay collection.
- Keep media and posts tied to their exact account IDs. Neither identity acceptance authorizes copying an avatar or historical posts between rows.

## Source limits

- Ernesto’s identity evidence is direct and exact. The web search reader exposed the owner site biography and contact page text, while direct HTTPS inspection confirmed the actual homepage/contact anchor targets and structured-data `sameAs` URL. No avatar was visually compared.
- Jorge’s VAMOS page confirms his official role/circuit and links his exact X and Instagram. X blocked the web page reader, but direct HTTPS returned a live profile page with his name, role/circuit and Linktree URL. The Linktree page was directly readable and linked the professional Facebook target. These sources establish the preferred professional destination; they do not establish who controls the separate old `/jorgebloise` row.
- Monitor findings are from repository source, not a deployment test. I did not execute mutations, inspect account-specific fresh production state, or test whether a new registration would trigger additional code paths outside the reviewed mutation.
