# Politician profile facts inventory

Observed production data: 2026-10-16. The audit includes **91 profiles** and **91 unique external IDs**, with one record per ID in the JSON inventory. The raw production responses used to build it are retained in `profile-facts-raw-observations.json`; the JSON inventory records the snapshot SHA-256. This is an observational audit. No production data was changed.

## Field totals

| Field | Missing | Unsourced | Sourced | Conflicting |
|---|---:|---:|---:|---:|
| Birth date | 59 | 2 | 30 | 0 |
| Birthplace | 72 | 1 | 18 | 0 |
| Citizenship | 89 | 1 | 1 | 0 |
| Biography | 14 | 0 | 76 | 1 |

“Unsourced” means a stored value is visible but its associated link does not establish that field. `officialGovURL` is never treated as evidence for an unrelated personal fact. Available source URLs remain listed even when they are insufficient. Conflicts preserve alternative displayed-layer values. Full ISO, Spanish written dates (including slash-separated month names), and DD/MM/YYYY are compared as calendar dates. Thus `1960-04-21` and `21 de abril de 1960` are equivalent, not conflicting. Partial dates retain their precision and are not silently expanded. The original birth-date strings remain in each record’s `storedObservations` and in the unchanged raw snapshot. The 22 former birth-date conflicts were formatting differences; the true biography conflict remains.

## Display precedence audited

`src/lib/reference-data.ts` obtains `politicianFacts` and, for Deputy records, `voting.getDeputyDashboard`. `src/components/reference/ProfilePage.tsx` displays transparency biography before facts biography; birth date uses facts before dashboard `bio.structuredData.fechaNacimiento`. Birthplace and citizenship display facts only. The inventory records the winning layer and alternatives using that precedence.

## Starting case: Yarelis Rodríguez (DEP-032)

- Birth date `1975-07-19`: sourced to [Voto Informado 2024](https://voto2024.espaciocivico.org/es/candidatos/diputado/yarelis-rodriguez), which states “Cumpleaños” and 19 July 1975.
- Birthplace `Herrera, Panamá`: **unsourced**. [ELLAS interview](https://www.ellas.pa/mundo-ellas/entrevistas/una-mujer-lider-debe-mantenerse-informada-yarelis-rodriguez-diputada-de-san-miguelito/) says she grew up in a town in Herrera; that does not establish place of birth.
- Citizenship `Panameña`: **unsourced**. The linked [constitutional text](https://constitucion.te.gob.pa/constitucion-vigente/) is general law, not person-specific evidence.
- Biography: transparency biography is displayed and linked to [Espacio Cívico](https://espaciocivico.org/diputados/yarelis-rodriguez); Voto Informado independently exposes education and work-history details.

These source checks do not repair or add profile facts. Repairs, missing source links, and selected-language display remain open work.

## Reproduction and verification

Run `node scripts/product-audits/profile-facts-inventory.mjs` to regenerate the inventory from the saved raw observations. Run `node scripts/product-audits/profile-facts-inventory.mjs --verify` for read-only validation against the raw snapshot and current public production directory, facts, and deputy dashboards. The verifier checks the 91-ID set, duplicate IDs, calculated field totals and precedence/provenance, snapshot hash, and current data equality.

## Semantic-date repair checks (4/4 executed; independent Claude acceptance pending)

- [x] Equivalent-date, different-date, partial-precision and invalid-calendar regression checks: `node scripts/product-audits/profile-facts-inventory.mjs --self-test` passed; these assertions also run during generation and verification.
- [x] Independent semantic boundary gate: `node /opt/orwell-evidence/verify-profile-facts.mjs` passed for all 91 profiles.
- [x] Read-only live verification: `node scripts/product-audits/profile-facts-inventory.mjs --verify` passed for 91 unique IDs, counts, display precedence/provenance, raw hash and current public observations.
- [x] Inventory regenerated from the retained raw snapshot: `node scripts/product-audits/profile-facts-inventory.mjs`; field totals above reflect semantic date comparison.

Contributor: Lin (implementation). These are execution results, not independent QA acceptance. Controller must obtain fresh independent Claude review, including exact source references and boundary cases. This delivery covers directory inventory only; fact repairs, source-link repairs and selected-language checks remain open.
