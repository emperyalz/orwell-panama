#!/usr/bin/env python3
"""
══════════════════════════════════════════════════════════════════════════
  ASAMBLEA NACIONAL DE PANAMÁ — VOTING RECORDS SCRAPER
══════════════════════════════════════════════════════════════════════════

  Pulls ALL public voting reports from the electronic voting system.
  
  API:     https://prensa507.asamblea.gob.pa/api/v1/report/{id}/public
  Auth:    NONE required (public endpoint)
  Reports: 482 voting sessions (Jan 2025 → Feb 2026)
  
  Output:
    votes.csv      → One row per deputy per question (main dataset)
    reports.csv    → Session/report metadata  
    deputies.csv   → Unique deputy roster with party info
    votings.csv    → Bill/voting metadata
    raw_json/      → Raw API responses for each report
    summary.json   → Run statistics

  Requirements:
    pip install aiohttp

  Usage:
    python asamblea_voting_scraper.py
    python asamblea_voting_scraper.py --output ./my_data
    python asamblea_voting_scraper.py --concurrency 20
══════════════════════════════════════════════════════════════════════════
"""

import asyncio
import aiohttp
import json
import csv
import os
import sys
import time
import argparse
from pathlib import Path
from datetime import datetime

# ── All 482 known report IDs (scraped from /api/v1/reports?paginated=false) ──
REPORT_IDS = [
    106, 109, 112, 118, 121, 127, 133, 136, 139, 176, 179, 182, 188, 191,
    194, 197, 200, 203, 206, 209, 215, 218, 221, 224, 227, 230, 233, 236,
    239, 242, 245, 257, 281, 284, 287, 290, 293, 296, 308, 311, 314, 317,
    320, 323, 326, 329, 332, 356, 359, 362, 368, 371, 374, 377, 380, 389,
    392, 395, 398, 401, 482, 485, 488, 491, 497, 500, 503, 506, 509, 512,
    515, 518, 521, 524, 527, 530, 533, 536, 540, 543, 546, 549, 552, 555,
    558, 561, 564, 567, 570, 573, 576, 579, 594, 597, 600, 603, 606, 609,
    612, 615, 618, 621, 624, 627, 630, 633, 636, 639, 642, 645, 648, 651,
    660, 663, 666, 669, 672, 675, 678, 681, 684, 687, 690, 698, 701, 704,
    707, 710, 713, 716, 719, 722, 728, 731, 734, 740, 743, 746, 749, 752,
    755, 758, 761, 764, 767, 770, 773, 776, 827, 830, 833, 836, 839, 842,
    845, 848, 851, 854, 857, 863, 866, 869, 872, 875, 878, 881, 884, 887,
    890, 893, 896, 899, 902, 905, 908, 920, 923, 926, 929, 932, 935, 938,
    941, 944, 947, 950, 953, 956, 959, 962, 965, 968, 971, 974, 977, 980,
    983, 986, 989, 1019, 1022, 1025, 1028, 1031, 1034, 1037, 1040, 1043,
    1046, 1049, 1052, 1100, 1103, 1106, 1109, 1112, 1115, 1118, 1121,
    1124, 1148, 1151, 1157, 1160, 1163, 1166, 1169, 1172, 1175, 1178,
    1181, 1184, 1187, 1190, 1193, 1196, 1220, 1223, 1226, 1229, 1232,
    1235, 1238, 1241, 1244, 1247, 1250, 1253, 1256, 1259, 1385, 1391,
    1394, 1397, 1400, 1403, 1406, 1412, 1415, 1418, 1421, 1424, 1427,
    1430, 1433, 1439, 1442, 1445, 1448, 1451, 1454, 1457, 1460, 1463,
    1469, 1472, 1475, 1481, 1484, 1487, 1490, 1493, 1496, 1499, 1502,
    1505, 1508, 1511, 1514, 1517, 1520, 1523, 1529, 1532, 1538, 1541,
    1658, 1661, 1664, 1670, 1680, 1683, 1686, 1689, 1692, 1695, 1698,
    1701, 1704, 1707, 1710, 1713, 1716, 1719, 1722, 1725, 1728, 1731,
    1803, 1806, 1809, 1812, 1815, 1818, 1821, 1824, 1827, 1830, 1833,
    1836, 1839, 1842, 1845, 1848, 1851, 1854, 1857, 1860, 1863, 1866,
    1869, 1872, 1875, 1878, 1881, 1884, 1887, 1890, 1893, 1899, 1902,
    1905, 1908, 1911, 1914, 1917, 1920, 1923, 1926, 1929, 1932, 1978,
    1993, 2011, 2023, 2026, 2029, 2326, 2329, 2332, 2335, 2338, 2341,
    2344, 2347, 2350, 2353, 2356, 2368, 2378, 2381, 2384, 2387, 2390,
    2393, 2396, 2399, 2408, 2435, 2438, 2441, 2444, 2447, 2450, 2456,
    2459, 2465, 2471, 2489, 2492, 2495, 2498, 2528, 2534, 2537, 2540,
    2543, 2546, 2549, 2552, 2555, 2603, 2606, 2624, 2627, 2630, 2633,
    2636, 2639, 2642, 2648, 2651, 2666, 2669, 2672, 2678, 2693, 2696,
    2729, 2732, 2762, 2765, 2771, 2774, 2777, 2780, 2783, 2789, 2795,
    2804, 2807, 2813, 2816, 2843, 2855, 2858, 2861, 2864, 2870, 2873,
    2876, 2879, 2885, 2894, 2900, 2903, 2906, 2909, 2915, 2918, 2936,
    2939, 2942, 2948, 2951, 2954, 2957, 2966, 3059, 3065, 3068, 3071,
    3074, 3077, 3080, 3086, 3089, 3092, 3095, 3098, 3101, 3110,
]

BASE_URL = "https://prensa507.asamblea.gob.pa/api/v1/report/{id}/public"

# Session type names
SESSION_TYPES = {
    0: "Ordinaria",
    1: "Extraordinaria",
    2: "Solemne",
    3: "Informal",
}

# Answer type codes
ANSWER_TYPES = {
    0: "a_favor",
    1: "en_contra",
    2: "abstencion",
}


# ── Stats ───────────────────────────────────────────────────────────────────
stats = {
    "fetched": 0,
    "with_votes": 0,
    "empty": 0,
    "errors": 0,
    "total_votes": 0,
    "total_votings": 0,
}


def parse_report(data: dict) -> dict | None:
    """Parse a single report API response into structured rows."""
    report = data.get("report")
    if not report:
        return None

    report_id = report["id"]
    session = report.get("plenarySession") or {}
    votings = session.get("votings") or []

    if not votings:
        return None

    session_type_code = session.get("type")
    session_type_name = SESSION_TYPES.get(session_type_code, str(session_type_code))

    report_meta = {
        "report_id": report_id,
        "report_title": (report.get("title") or "").strip(),
        "report_description": (report.get("description") or "").strip(),
        "is_private": report.get("isPrivate", False),
        "session_id": report.get("sessionId"),
        "session_type": session_type_name,
        "session_number": session.get("number"),
        "session_date": (session.get("date") or "")[:10],
        "session_start": session.get("startAt", ""),
        "session_end": session.get("endAt", ""),
        "num_votings": len(votings),
        "created_at": report.get("createdAt", ""),
    }

    vote_rows = []
    voting_rows = []
    deputy_map = {}

    for voting in votings:
        voting_id = voting["id"]
        voting_meta = {
            "voting_id": voting_id,
            "report_id": report_id,
            "session_id": report.get("sessionId"),
            "session_date": (session.get("date") or "")[:10],
            "session_type": session_type_name,
            "voting_title": (voting.get("title") or "").strip(),
            "voting_description": (voting.get("description") or "").strip(),
            "is_secret": voting.get("isSecret", False),
            "voting_status": voting.get("status"),
            "voting_start": voting.get("startAt", ""),
            "voting_end": voting.get("endAt", ""),
            "point_id": voting.get("pointId"),
        }
        voting_rows.append(voting_meta)
        stats["total_votings"] += 1

        for question in (voting.get("questions") or []):
            question_id = question["id"]
            question_title = (question.get("title") or "").strip()
            question_result = question.get("result")  # 1=passed, 0=failed
            votes_to_pass = question.get("votesToPass")

            # Answer totals
            answer_lookup = {}
            answer_type_lookup = {}
            answer_totals = {}
            for ans in (question.get("answers") or []):
                desc = ans.get("description", "")
                answer_lookup[ans["id"]] = desc
                answer_type_lookup[ans["id"]] = ans.get("type")
                answer_totals[desc] = ans.get("total", 0)

            total_favor = answer_totals.get("A favor", 0)
            total_contra = answer_totals.get("En contra", 0)
            total_abstencion = answer_totals.get("Me abstengo", 0)

            for vote in (question.get("votes") or []):
                deputy = vote.get("deputy") or {}
                user = deputy.get("user") or {}
                party = deputy.get("politicalParty") or {}
                principal = deputy.get("principal")
                deputy_id = deputy.get("id")

                first_name = (user.get("name") or "").strip()
                last_name = (user.get("lastname") or "").strip()
                full_name = f"{first_name} {last_name}".strip()

                # Track unique deputies
                if deputy_id and deputy_id not in deputy_map:
                    principal_user = (principal or {}).get("user") or {}
                    deputy_map[deputy_id] = {
                        "deputy_id": deputy_id,
                        "first_name": first_name,
                        "last_name": last_name,
                        "full_name": full_name,
                        "party_id": party.get("id"),
                        "party_name": party.get("name", ""),
                        "party_code": party.get("code", ""),
                        "party_color": party.get("color", ""),
                        "circuit": deputy.get("circuit") or "",
                        "seat": deputy.get("seat"),
                        "gender": deputy.get("gender", ""),
                        "is_suplente": principal is not None,
                        "principal_id": (principal or {}).get("id"),
                        "principal_name": (
                            f"{principal_user.get('name', '').strip()} {principal_user.get('lastname', '').strip()}".strip()
                            if principal else ""
                        ),
                    }

                answer_id = vote.get("answerId")
                answer_desc = answer_lookup.get(answer_id, "")
                answer_type = answer_type_lookup.get(answer_id)

                vote_rows.append({
                    "vote_id": vote.get("id"),
                    "report_id": report_id,
                    "session_id": report.get("sessionId"),
                    "session_date": (session.get("date") or "")[:10],
                    "session_type": session_type_name,
                    "voting_id": voting_id,
                    "voting_title": (voting.get("title") or "").strip(),
                    "question_id": question_id,
                    "question_text": question_title,
                    "question_passed": question_result == 1,
                    "votes_needed": votes_to_pass,
                    "total_a_favor": total_favor,
                    "total_en_contra": total_contra,
                    "total_abstencion": total_abstencion,
                    "deputy_id": deputy_id,
                    "deputy_name": full_name,
                    "party_code": party.get("code", ""),
                    "party_name": party.get("name", ""),
                    "circuit": deputy.get("circuit") or "",
                    "seat": deputy.get("seat"),
                    "vote": answer_desc,
                    "vote_type": ANSWER_TYPES.get(answer_type, str(answer_type)),
                    "is_suplente": principal is not None,
                    "suplente_of": (
                        f"{((principal or {}).get('user') or {}).get('name', '').strip()} "
                        f"{((principal or {}).get('user') or {}).get('lastname', '').strip()}".strip()
                        if principal else ""
                    ),
                })
                stats["total_votes"] += 1

    return {
        "report_meta": report_meta,
        "vote_rows": vote_rows,
        "voting_rows": voting_rows,
        "deputies": deputy_map,
    }


async def fetch_report(
    session: aiohttp.ClientSession,
    report_id: int,
    semaphore: asyncio.Semaphore,
    raw_dir: Path,
):
    """Fetch and parse a single report."""
    url = BASE_URL.format(id=report_id)

    async with semaphore:
        for attempt in range(3):
            try:
                async with session.get(url, timeout=aiohttp.ClientTimeout(total=30)) as resp:
                    stats["fetched"] += 1

                    if resp.status != 200:
                        if attempt < 2:
                            await asyncio.sleep(1 + attempt)
                            continue
                        stats["errors"] += 1
                        return None

                    data = await resp.json()

                    if data.get("error") or data.get("result") != "Success":
                        stats["empty"] += 1
                        return None

                    # Save raw JSON
                    with open(raw_dir / f"report_{report_id}.json", "w", encoding="utf-8") as f:
                        json.dump(data, f, ensure_ascii=False)

                    result = parse_report(data)
                    if result:
                        stats["with_votes"] += 1
                    else:
                        stats["empty"] += 1
                    return result

            except (aiohttp.ClientError, asyncio.TimeoutError, json.JSONDecodeError) as e:
                if attempt < 2:
                    await asyncio.sleep(2 + attempt)
                    continue
                stats["errors"] += 1
                return None

    return None


def write_csv(path: Path, rows: list[dict], label: str):
    """Write a list of dicts to CSV."""
    if not rows:
        print(f"    ⚠ {label}: no data to write")
        return
    with open(path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        writer.writeheader()
        writer.writerows(rows)
    print(f"    ✓ {path.name} ({len(rows):,} rows)")


async def run(output_dir: Path, concurrency: int):
    raw_dir = output_dir / "raw_json"
    output_dir.mkdir(parents=True, exist_ok=True)
    raw_dir.mkdir(parents=True, exist_ok=True)

    total = len(REPORT_IDS)
    print(f"\n  Fetching {total} reports with {concurrency} parallel connections...\n")

    all_reports = []
    all_votes = []
    all_votings = []
    all_deputies = {}

    start = time.time()

    connector = aiohttp.TCPConnector(limit=concurrency, ssl=False)
    async with aiohttp.ClientSession(connector=connector) as session:
        sem = asyncio.Semaphore(concurrency)

        # Process in batches for progress
        batch_size = 30
        for i in range(0, total, batch_size):
            batch = REPORT_IDS[i : i + batch_size]
            tasks = [fetch_report(session, rid, sem, raw_dir) for rid in batch]
            results = await asyncio.gather(*tasks)

            for r in results:
                if r:
                    all_reports.append(r["report_meta"])
                    all_votes.extend(r["vote_rows"])
                    all_votings.extend(r["voting_rows"])
                    all_deputies.update(r["deputies"])

            done = min(i + batch_size, total)
            pct = done / total * 100
            bar = "█" * int(pct / 2.5) + "░" * (40 - int(pct / 2.5))
            sys.stdout.write(
                f"\r  [{bar}] {done}/{total} | "
                f"{stats['with_votes']} with votes | "
                f"{stats['total_votes']:,} votes | "
                f"{pct:.0f}%"
            )
            sys.stdout.flush()

    elapsed = time.time() - start

    print(f"\n\n{'─' * 60}")
    print(f"  RESULTS")
    print(f"{'─' * 60}")
    print(f"  Time:            {elapsed:.1f}s ({elapsed/total:.2f}s per report)")
    print(f"  Reports fetched: {stats['fetched']}")
    print(f"  With votes:      {stats['with_votes']}")
    print(f"  Empty/misc:      {stats['empty']}")
    print(f"  Errors:          {stats['errors']}")
    print(f"  Total votings:   {stats['total_votings']:,}")
    print(f"  Total votes:     {stats['total_votes']:,}")
    print(f"  Unique deputies: {len(all_deputies)}")
    print(f"{'─' * 60}")

    # Write CSVs
    print(f"\n  Writing output files to {output_dir}/\n")

    write_csv(output_dir / "votes.csv", all_votes, "votes")
    write_csv(output_dir / "reports.csv", all_reports, "reports")
    write_csv(
        output_dir / "deputies.csv",
        sorted(all_deputies.values(), key=lambda x: x["deputy_id"]),
        "deputies",
    )
    write_csv(output_dir / "votings.csv", all_votings, "votings")

    # Summary
    summary = {
        "scraped_at": datetime.utcnow().isoformat() + "Z",
        "report_ids_scanned": total,
        "reports_with_votes": stats["with_votes"],
        "total_votings": stats["total_votings"],
        "total_individual_votes": stats["total_votes"],
        "unique_deputies": len(all_deputies),
        "errors": stats["errors"],
        "elapsed_seconds": round(elapsed, 1),
        "api_endpoint": BASE_URL,
        "data_source": "https://prensa507.asamblea.gob.pa/press/home",
    }
    with open(output_dir / "summary.json", "w") as f:
        json.dump(summary, f, indent=2)
    print(f"    ✓ summary.json")

    print(f"\n  Done! All data saved to {output_dir}/")
    print(f"  Main dataset: {output_dir}/votes.csv")
    print()


def main():
    parser = argparse.ArgumentParser(
        description="Scrape voting records from Asamblea Nacional de Panamá"
    )
    parser.add_argument(
        "--output", "-o",
        type=str,
        default="./asamblea_data",
        help="Output directory (default: ./asamblea_data)",
    )
    parser.add_argument(
        "--concurrency", "-c",
        type=int,
        default=10,
        help="Number of parallel requests (default: 10)",
    )
    args = parser.parse_args()

    print("═" * 60)
    print("  ASAMBLEA NACIONAL DE PANAMÁ")
    print("  Voting Records Scraper")
    print("═" * 60)
    print(f"  API:         /api/v1/report/{{id}}/public")
    print(f"  Reports:     {len(REPORT_IDS)}")
    print(f"  Output:      {args.output}")
    print(f"  Concurrency: {args.concurrency}")

    asyncio.run(run(Path(args.output), args.concurrency))


if __name__ == "__main__":
    main()
