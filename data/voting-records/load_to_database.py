#!/usr/bin/env python3
"""
══════════════════════════════════════════════════════════════════════════
  ASAMBLEA NACIONAL DE PANAMÁ — DATABASE LOADER
══════════════════════════════════════════════════════════════════════════

  Loads scraped voting data into a normalized SQLite database.
  
  Input:  CSV files from asamblea_voting_scraper.py
  Output: SQLite database with 6 tables + indexes + views

  Usage:
    python load_to_database.py
    python load_to_database.py --input ./asamblea_data --db ./asamblea.db
    python load_to_database.py --rebuild   # Drop and recreate all tables
══════════════════════════════════════════════════════════════════════════
"""

import sqlite3
import csv
import json
import argparse
import os
import sys
from pathlib import Path
from datetime import datetime


def create_schema(conn):
    """Create all tables, indexes, and views."""
    conn.executescript("""
    -- ════════════════════════════════════════════════════════════════════
    -- PARTIES
    -- ════════════════════════════════════════════════════════════════════
    CREATE TABLE IF NOT EXISTS parties (
        party_id      INTEGER PRIMARY KEY,
        name          TEXT NOT NULL,
        code          TEXT NOT NULL,
        color         TEXT,
        flag_url      TEXT
    );

    -- ════════════════════════════════════════════════════════════════════
    -- DEPUTIES
    -- ════════════════════════════════════════════════════════════════════
    CREATE TABLE IF NOT EXISTS deputies (
        deputy_id       INTEGER PRIMARY KEY,
        first_name      TEXT,
        last_name       TEXT,
        full_name       TEXT NOT NULL,
        party_id        INTEGER REFERENCES parties(party_id),
        party_code      TEXT,
        party_name      TEXT,
        party_color     TEXT,
        circuit         TEXT,
        seat            INTEGER,
        gender          TEXT,
        is_suplente     BOOLEAN DEFAULT FALSE,
        principal_id    INTEGER REFERENCES deputies(deputy_id),
        principal_name  TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_deputies_party ON deputies(party_id);
    CREATE INDEX IF NOT EXISTS idx_deputies_circuit ON deputies(circuit);
    CREATE INDEX IF NOT EXISTS idx_deputies_principal ON deputies(principal_id);

    -- ════════════════════════════════════════════════════════════════════
    -- REPORTS (session-level metadata)
    -- ════════════════════════════════════════════════════════════════════
    CREATE TABLE IF NOT EXISTS reports (
        report_id         INTEGER PRIMARY KEY,
        report_title      TEXT,
        report_description TEXT,
        is_private        BOOLEAN DEFAULT FALSE,
        session_id        INTEGER,
        session_type      TEXT,
        session_number    INTEGER,
        session_date      DATE,
        session_start     TIMESTAMP,
        session_end       TIMESTAMP,
        num_votings       INTEGER DEFAULT 0,
        created_at        TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_reports_session ON reports(session_id);
    CREATE INDEX IF NOT EXISTS idx_reports_date ON reports(session_date);

    -- ════════════════════════════════════════════════════════════════════
    -- VOTINGS (individual bill/motion votes within a session)
    -- ════════════════════════════════════════════════════════════════════
    CREATE TABLE IF NOT EXISTS votings (
        voting_id           INTEGER PRIMARY KEY,
        report_id           INTEGER REFERENCES reports(report_id),
        session_id          INTEGER,
        session_date        DATE,
        session_type        TEXT,
        voting_title        TEXT,
        voting_description  TEXT,
        is_secret           BOOLEAN DEFAULT FALSE,
        voting_status       INTEGER,
        voting_start        TIMESTAMP,
        voting_end          TIMESTAMP,
        point_id            INTEGER
    );
    CREATE INDEX IF NOT EXISTS idx_votings_report ON votings(report_id);
    CREATE INDEX IF NOT EXISTS idx_votings_session ON votings(session_id);
    CREATE INDEX IF NOT EXISTS idx_votings_date ON votings(session_date);

    -- ════════════════════════════════════════════════════════════════════
    -- VOTES (one row per deputy per question — the main table)
    -- ════════════════════════════════════════════════════════════════════
    CREATE TABLE IF NOT EXISTS votes (
        vote_id           INTEGER PRIMARY KEY,
        report_id         INTEGER REFERENCES reports(report_id),
        session_id        INTEGER,
        session_date      DATE,
        session_type      TEXT,
        voting_id         INTEGER REFERENCES votings(voting_id),
        voting_title      TEXT,
        question_id       INTEGER,
        question_text     TEXT,
        question_passed   BOOLEAN,
        votes_needed      INTEGER,
        total_a_favor     INTEGER DEFAULT 0,
        total_en_contra   INTEGER DEFAULT 0,
        total_abstencion  INTEGER DEFAULT 0,
        deputy_id         INTEGER REFERENCES deputies(deputy_id),
        deputy_name       TEXT,
        party_code        TEXT,
        party_name        TEXT,
        circuit           TEXT,
        seat              INTEGER,
        vote              TEXT,
        vote_type         TEXT,
        is_suplente       BOOLEAN DEFAULT FALSE,
        suplente_of       TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_votes_deputy ON votes(deputy_id);
    CREATE INDEX IF NOT EXISTS idx_votes_voting ON votes(voting_id);
    CREATE INDEX IF NOT EXISTS idx_votes_question ON votes(question_id);
    CREATE INDEX IF NOT EXISTS idx_votes_session ON votes(session_id);
    CREATE INDEX IF NOT EXISTS idx_votes_date ON votes(session_date);
    CREATE INDEX IF NOT EXISTS idx_votes_party ON votes(party_code);
    CREATE INDEX IF NOT EXISTS idx_votes_vote ON votes(vote);
    CREATE INDEX IF NOT EXISTS idx_votes_deputy_date ON votes(deputy_id, session_date);

    -- ════════════════════════════════════════════════════════════════════
    -- VIEWS (pre-built analytical queries)
    -- ════════════════════════════════════════════════════════════════════

    -- Deputy voting summary
    CREATE VIEW IF NOT EXISTS v_deputy_summary AS
    SELECT
        d.deputy_id,
        d.full_name,
        d.party_code,
        d.circuit,
        d.is_suplente,
        COUNT(DISTINCT v.voting_id) AS total_votings_participated,
        COUNT(v.vote_id) AS total_votes_cast,
        SUM(CASE WHEN v.vote = 'A favor' THEN 1 ELSE 0 END) AS votes_a_favor,
        SUM(CASE WHEN v.vote = 'En contra' THEN 1 ELSE 0 END) AS votes_en_contra,
        SUM(CASE WHEN v.vote = 'Me abstengo' THEN 1 ELSE 0 END) AS votes_abstencion,
        ROUND(100.0 * SUM(CASE WHEN v.vote = 'A favor' THEN 1 ELSE 0 END) / COUNT(v.vote_id), 1) AS pct_a_favor,
        MIN(v.session_date) AS first_vote_date,
        MAX(v.session_date) AS last_vote_date
    FROM deputies d
    JOIN votes v ON d.deputy_id = v.deputy_id
    GROUP BY d.deputy_id;

    -- Party voting summary
    CREATE VIEW IF NOT EXISTS v_party_summary AS
    SELECT
        v.party_code,
        v.party_name,
        COUNT(DISTINCT v.deputy_id) AS unique_deputies,
        COUNT(v.vote_id) AS total_votes,
        SUM(CASE WHEN v.vote = 'A favor' THEN 1 ELSE 0 END) AS votes_a_favor,
        SUM(CASE WHEN v.vote = 'En contra' THEN 1 ELSE 0 END) AS votes_en_contra,
        SUM(CASE WHEN v.vote = 'Me abstengo' THEN 1 ELSE 0 END) AS votes_abstencion,
        ROUND(100.0 * SUM(CASE WHEN v.vote = 'A favor' THEN 1 ELSE 0 END) / COUNT(v.vote_id), 1) AS pct_a_favor
    FROM votes v
    GROUP BY v.party_code;

    -- Voting results with totals
    CREATE VIEW IF NOT EXISTS v_voting_results AS
    SELECT
        vt.voting_id,
        vt.session_date,
        vt.voting_title,
        vt.voting_description,
        v.question_id,
        v.question_text,
        v.question_passed,
        v.votes_needed,
        v.total_a_favor,
        v.total_en_contra,
        v.total_abstencion,
        (v.total_a_favor + v.total_en_contra + v.total_abstencion) AS total_present
    FROM votings vt
    JOIN votes v ON vt.voting_id = v.voting_id
    GROUP BY v.question_id;

    -- Party cohesion per voting (how unified each party votes)
    CREATE VIEW IF NOT EXISTS v_party_cohesion AS
    SELECT
        v.voting_id,
        v.question_id,
        v.session_date,
        v.voting_title,
        v.party_code,
        COUNT(v.vote_id) AS party_votes,
        SUM(CASE WHEN v.vote = 'A favor' THEN 1 ELSE 0 END) AS favor,
        SUM(CASE WHEN v.vote = 'En contra' THEN 1 ELSE 0 END) AS contra,
        SUM(CASE WHEN v.vote = 'Me abstengo' THEN 1 ELSE 0 END) AS abstencion,
        ROUND(100.0 * MAX(
            SUM(CASE WHEN v.vote = 'A favor' THEN 1 ELSE 0 END),
            SUM(CASE WHEN v.vote = 'En contra' THEN 1 ELSE 0 END),
            SUM(CASE WHEN v.vote = 'Me abstengo' THEN 1 ELSE 0 END)
        ) / COUNT(v.vote_id), 1) AS cohesion_pct
    FROM votes v
    GROUP BY v.question_id, v.party_code;

    -- Monthly voting activity
    CREATE VIEW IF NOT EXISTS v_monthly_activity AS
    SELECT
        strftime('%Y-%m', session_date) AS month,
        COUNT(DISTINCT report_id) AS sessions,
        COUNT(DISTINCT voting_id) AS votings,
        COUNT(vote_id) AS total_votes,
        COUNT(DISTINCT deputy_id) AS active_deputies
    FROM votes
    GROUP BY strftime('%Y-%m', session_date)
    ORDER BY month;

    -- Dissent tracker (deputies voting against their party majority)
    CREATE VIEW IF NOT EXISTS v_dissent AS
    SELECT
        v.vote_id,
        v.session_date,
        v.voting_title,
        v.question_id,
        v.deputy_id,
        v.deputy_name,
        v.party_code,
        v.vote,
        pc.favor AS party_favor,
        pc.contra AS party_contra,
        CASE
            WHEN pc.favor > pc.contra AND v.vote = 'En contra' THEN 'dissent_against'
            WHEN pc.contra > pc.favor AND v.vote = 'A favor' THEN 'dissent_for'
            ELSE NULL
        END AS dissent_type
    FROM votes v
    JOIN v_party_cohesion pc
        ON v.question_id = pc.question_id
        AND v.party_code = pc.party_code
    WHERE (pc.favor > pc.contra AND v.vote = 'En contra')
       OR (pc.contra > pc.favor AND v.vote = 'A favor');
    """)


def bool_val(v):
    """Convert string boolean to int for SQLite."""
    if isinstance(v, bool):
        return int(v)
    if isinstance(v, str):
        return 1 if v.lower() in ("true", "1", "yes") else 0
    return 0


def int_or_none(v):
    """Convert to int or None."""
    if v is None or v == "":
        return None
    try:
        return int(v)
    except (ValueError, TypeError):
        return None


def load_deputies(conn, filepath):
    """Load deputies.csv into deputies and parties tables."""
    if not os.path.exists(filepath):
        print(f"  ⚠ {filepath} not found, skipping")
        return 0

    parties_seen = {}
    count = 0

    with open(filepath, encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            # Upsert party
            pid = int_or_none(row.get("party_id"))
            if pid and pid not in parties_seen:
                conn.execute(
                    "INSERT OR IGNORE INTO parties (party_id, name, code, color) VALUES (?, ?, ?, ?)",
                    (pid, row.get("party_name", ""), row.get("party_code", ""), row.get("party_color", "")),
                )
                parties_seen[pid] = True

            conn.execute(
                """INSERT OR REPLACE INTO deputies
                   (deputy_id, first_name, last_name, full_name, party_id, party_code,
                    party_name, party_color, circuit, seat, gender, is_suplente,
                    principal_id, principal_name)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    int(row["deputy_id"]),
                    row.get("first_name", ""),
                    row.get("last_name", ""),
                    row.get("full_name", ""),
                    pid,
                    row.get("party_code", ""),
                    row.get("party_name", ""),
                    row.get("party_color", ""),
                    row.get("circuit", ""),
                    int_or_none(row.get("seat")),
                    row.get("gender", ""),
                    bool_val(row.get("is_suplente", False)),
                    int_or_none(row.get("principal_id")),
                    row.get("principal_name", ""),
                ),
            )
            count += 1

    conn.commit()
    print(f"  ✓ deputies: {count} rows, {len(parties_seen)} parties")
    return count


def load_reports(conn, filepath):
    """Load reports.csv."""
    if not os.path.exists(filepath):
        print(f"  ⚠ {filepath} not found, skipping")
        return 0

    count = 0
    with open(filepath, encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            conn.execute(
                """INSERT OR REPLACE INTO reports
                   (report_id, report_title, report_description, is_private,
                    session_id, session_type, session_number, session_date,
                    session_start, session_end, num_votings, created_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    int(row["report_id"]),
                    row.get("report_title", ""),
                    row.get("report_description", ""),
                    bool_val(row.get("is_private", False)),
                    int_or_none(row.get("session_id")),
                    row.get("session_type", ""),
                    int_or_none(row.get("session_number")),
                    row.get("session_date", ""),
                    row.get("session_start", ""),
                    row.get("session_end", ""),
                    int_or_none(row.get("num_votings")),
                    row.get("created_at", ""),
                ),
            )
            count += 1

    conn.commit()
    print(f"  ✓ reports: {count} rows")
    return count


def load_votings(conn, filepath):
    """Load votings.csv."""
    if not os.path.exists(filepath):
        print(f"  ⚠ {filepath} not found, skipping")
        return 0

    count = 0
    with open(filepath, encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            conn.execute(
                """INSERT OR REPLACE INTO votings
                   (voting_id, report_id, session_id, session_date, session_type,
                    voting_title, voting_description, is_secret, voting_status,
                    voting_start, voting_end, point_id)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    int(row["voting_id"]),
                    int_or_none(row.get("report_id")),
                    int_or_none(row.get("session_id")),
                    row.get("session_date", ""),
                    row.get("session_type", ""),
                    row.get("voting_title", ""),
                    row.get("voting_description", ""),
                    bool_val(row.get("is_secret", False)),
                    int_or_none(row.get("voting_status")),
                    row.get("voting_start", ""),
                    row.get("voting_end", ""),
                    int_or_none(row.get("point_id")),
                ),
            )
            count += 1

    conn.commit()
    print(f"  ✓ votings: {count} rows")
    return count


def load_votes(conn, filepath):
    """Load votes.csv — the big one."""
    if not os.path.exists(filepath):
        print(f"  ⚠ {filepath} not found, skipping")
        return 0

    count = 0
    batch = []
    batch_size = 5000

    with open(filepath, encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            batch.append((
                int(row["vote_id"]),
                int_or_none(row.get("report_id")),
                int_or_none(row.get("session_id")),
                row.get("session_date", ""),
                row.get("session_type", ""),
                int_or_none(row.get("voting_id")),
                row.get("voting_title", ""),
                int_or_none(row.get("question_id")),
                row.get("question_text", ""),
                bool_val(row.get("question_passed", False)),
                int_or_none(row.get("votes_needed")),
                int_or_none(row.get("total_a_favor")),
                int_or_none(row.get("total_en_contra")),
                int_or_none(row.get("total_abstencion")),
                int_or_none(row.get("deputy_id")),
                row.get("deputy_name", ""),
                row.get("party_code", ""),
                row.get("party_name", ""),
                row.get("circuit", ""),
                int_or_none(row.get("seat")),
                row.get("vote", ""),
                row.get("vote_type", ""),
                bool_val(row.get("is_suplente", False)),
                row.get("suplente_of", ""),
            ))

            if len(batch) >= batch_size:
                conn.executemany(
                    """INSERT OR REPLACE INTO votes
                       (vote_id, report_id, session_id, session_date, session_type,
                        voting_id, voting_title, question_id, question_text,
                        question_passed, votes_needed, total_a_favor, total_en_contra,
                        total_abstencion, deputy_id, deputy_name, party_code, party_name,
                        circuit, seat, vote, vote_type, is_suplente, suplente_of)
                       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                    batch,
                )
                count += len(batch)
                sys.stdout.write(f"\r  Loading votes: {count:,}...")
                sys.stdout.flush()
                batch = []

    if batch:
        conn.executemany(
            """INSERT OR REPLACE INTO votes
               (vote_id, report_id, session_id, session_date, session_type,
                voting_id, voting_title, question_id, question_text,
                question_passed, votes_needed, total_a_favor, total_en_contra,
                total_abstencion, deputy_id, deputy_name, party_code, party_name,
                circuit, seat, vote, vote_type, is_suplente, suplente_of)
               VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
            batch,
        )
        count += len(batch)

    conn.commit()
    print(f"\r  ✓ votes: {count:,} rows")
    return count


def print_stats(conn):
    """Print summary statistics from the loaded database."""
    print(f"\n{'═' * 55}")
    print("  DATABASE SUMMARY")
    print(f"{'═' * 55}")

    for table in ["parties", "deputies", "reports", "votings", "votes"]:
        count = conn.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]
        print(f"  {table:15s} {count:>10,} rows")

    # Date range
    row = conn.execute("SELECT MIN(session_date), MAX(session_date) FROM votes").fetchone()
    if row and row[0]:
        print(f"\n  Date range: {row[0]} → {row[1]}")

    # Party breakdown
    print(f"\n  Party breakdown:")
    rows = conn.execute("""
        SELECT party_code, COUNT(DISTINCT deputy_id) as deps, COUNT(*) as votes
        FROM votes GROUP BY party_code ORDER BY votes DESC
    """).fetchall()
    for code, deps, votes in rows:
        print(f"    {code:5s} {deps:3d} deputies  {votes:>8,} votes")

    # Top 5 most active deputies
    print(f"\n  Top 5 most active deputies:")
    rows = conn.execute("""
        SELECT deputy_name, party_code, COUNT(*) as vote_count
        FROM votes GROUP BY deputy_id ORDER BY vote_count DESC LIMIT 5
    """).fetchall()
    for name, party, vc in rows:
        print(f"    {name:35s} ({party}) {vc:>6,} votes")

    print(f"{'═' * 55}")


def main():
    parser = argparse.ArgumentParser(description="Load Asamblea voting data into SQLite")
    parser.add_argument("--input", "-i", type=str, default="./asamblea_data",
                        help="Input directory with CSVs (default: ./asamblea_data)")
    parser.add_argument("--db", "-d", type=str, default="./asamblea_panama.db",
                        help="Output SQLite database path (default: ./asamblea_panama.db)")
    parser.add_argument("--rebuild", action="store_true",
                        help="Drop and recreate all tables")
    args = parser.parse_args()

    input_dir = Path(args.input)
    db_path = Path(args.db)

    print("═" * 55)
    print("  ASAMBLEA NACIONAL — DATABASE LOADER")
    print("═" * 55)
    print(f"  Input:  {input_dir}")
    print(f"  Output: {db_path}")

    if args.rebuild and db_path.exists():
        print(f"  Rebuilding: dropping existing database")
        os.remove(db_path)

    conn = sqlite3.connect(str(db_path))
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA synchronous=NORMAL")

    print(f"\n  Creating schema...")
    create_schema(conn)

    print(f"  Loading data...\n")
    load_deputies(conn, input_dir / "deputies.csv")
    load_reports(conn, input_dir / "reports.csv")
    load_votings(conn, input_dir / "votings.csv")
    load_votes(conn, input_dir / "votes.csv")

    # ANALYZE for query planner
    conn.execute("ANALYZE")
    conn.commit()

    print_stats(conn)
    conn.close()

    db_size = db_path.stat().st_size / (1024 * 1024)
    print(f"\n  Database: {db_path} ({db_size:.1f} MB)")
    print(f"  Done!")


if __name__ == "__main__":
    main()
