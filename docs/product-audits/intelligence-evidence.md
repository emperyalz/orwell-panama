# Dated intelligence evidence

`convex/intelligence.ts` retains the latest archived post within each person, platform, UTC month, and format bucket. This keeps the existing `{people, buckets, examples, accounts, runs, lastSocialImport}` response contract and lets the existing workspace month filters find historical cards. Example count stays bounded by the set of populated buckets. Invalid publication timestamps remain excluded from both buckets and examples.

Run the local regression harness with:

```sh
node scripts/product-audits/intelligence-evidence.cjs
```

The harness transpiles and invokes the actual Convex query handler in a VM. Its fixture covers repeated months for one person/platform/format, latest representatives, other people and platforms, invalid dates, and an empty archive. It also mirrors the workspace date filter to check historical cards remain visible.

After Convex publication, verify the public production query with:

```sh
node scripts/product-audits/intelligence-evidence.cjs --live
```

`--live` reads public `intelligence:archive`, validates every example URL and timestamp, confirms examples match their actual dated buckets, and requires an example for every nonzero person/platform/month/format bucket. It exits nonzero on a missing or mismatched example.
