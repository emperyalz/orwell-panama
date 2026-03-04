# ASAMBLEA NACIONAL DE PANAMÁ — VOTING DATA PIPELINE
## Complete Handoff for Claude Code

---

## OBJECTIVE

Scrape all 482 public voting reports from Panama's National Assembly electronic voting system, then load everything into a structured database (SQLite locally, with Supabase migration SQL included).

The API is **public, no auth required**. All 482 report IDs are hardcoded in the scraper.

---

## WHAT THIS PRODUCES

| Table | Description | Est. Rows |
|-------|-------------|-----------|
| `reports` | Session metadata (date, type, title) | ~482 |
| `votings` | Individual bill votes within sessions | ~1,500+ |
| `questions` | Specific questions voted on per bill | ~1,500+ |
| `deputies` | Unique deputy roster with party info | ~120+ |
| `parties` | Political parties | ~10 |
| `votes` | **Main table** — one row per deputy per question | ~111,000+ |

Date range: April 2021 → February 2026 (ongoing).

---

## STEP 1: RUN THE SCRAPER

### Prerequisites
```bash
pip install aiohttp
```

### Run
```bash
python asamblea_voting_scraper.py --output ./asamblea_data --concurrency 10
```

This takes ~3-5 minutes. It hits `https://prensa507.asamblea.gob.pa/api/v1/report/{id}/public` for each of 482 report IDs and outputs:

```
asamblea_data/
├── votes.csv              # Main dataset (~111K rows)
├── reports.csv            # Session metadata (482 rows)
├── deputies.csv           # Deputy roster (~120 rows)
├── votings.csv            # Bill/voting metadata (~1500 rows)
├── summary.json           # Run statistics
└── raw_json/              # Raw API responses (482 JSON files)
    ├── report_106.json
    ├── report_109.json
    └── ...
```

---

## STEP 2: LOAD INTO DATABASE

Run the database loader after the scraper completes:

```bash
python load_to_database.py --input ./asamblea_data --db ./asamblea_panama.db
```

This creates a normalized SQLite database from the CSVs.

---

## STEP 3 (OPTIONAL): MIGRATE TO SUPABASE

The file `supabase_schema.sql` contains the full Postgres schema with indexes, foreign keys, and RLS policies. Run it in your Supabase SQL editor, then use the CSV import or the included `upload_to_supabase.py` script.

---

## API REFERENCE

**Base URL:** `https://prensa507.asamblea.gob.pa`

| Endpoint | Auth | Description |
|----------|------|-------------|
| `GET /api/v1/report/{id}/public` | NONE | Full voting report with all deputy votes |
| `GET /api/v1/public/settings/?forPage=0` | NONE | System settings |
| `GET /api/v1/reports?paginated=false` | Session | List all report metadata (no votes) |
| `GET /api/v1/plenary-sessions` | Session | List plenary sessions |
| `GET /api/v1/voting/{id}/votes` | Session | Votes for a voting |
| `GET /api/v1/deputy/{id}` | Session | Deputy info |
| `GET /api/v1/political-parties` | Session | Party list |

Only the first two are public. The scraper uses `/api/v1/report/{id}/public` exclusively.

---

## DATA SCHEMA NOTES

### Vote answer types
| answerId | description | type code | meaning |
|----------|-------------|-----------|---------|
| 1 | A favor | 0 | In favor |
| 2 | En contra | 1 | Against |
| 3 | Me abstengo | 2 | Abstain |

### Session types
| code | name |
|------|------|
| 0 | Ordinaria |
| 1 | Extraordinaria |
| 2 | Solemne |
| 3 | Informal |
| 4 | (unnamed, appears 38 times) |

### Deputy roles
- **Principal**: Elected deputy (primaryId = null)
- **Suplente**: Substitute deputy (principalId = ID of the principal they replace)
- A suplente votes in place of their principal when the principal is absent

### Question results
- `result = 1` → Passed
- `result = 0` → Failed
- `votesToPass` → Usually 36 (absolute majority of 71 seats)

---

## FILES INCLUDED

1. **`asamblea_voting_scraper.py`** — Async scraper with all 482 report IDs
2. **`load_to_database.py`** — CSV → SQLite loader with normalized schema
3. **`supabase_schema.sql`** — Postgres schema for Supabase migration
4. **`report_ids.json`** — All 482 report IDs as JSON array
5. **`HANDOFF.md`** — This file
