-- ════════════════════════════════════════════════════════════════════════
-- ASAMBLEA NACIONAL DE PANAMÁ — SUPABASE/POSTGRES SCHEMA
-- ════════════════════════════════════════════════════════════════════════
-- Run this in Supabase SQL Editor, then import CSVs via dashboard or script.
-- ════════════════════════════════════════════════════════════════════════

-- PARTIES
CREATE TABLE IF NOT EXISTS parties (
    party_id    INTEGER PRIMARY KEY,
    name        TEXT NOT NULL,
    code        TEXT NOT NULL UNIQUE,
    color       TEXT,
    flag_url    TEXT,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- DEPUTIES
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
    principal_name  TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_deputies_party ON deputies(party_id);
CREATE INDEX IF NOT EXISTS idx_deputies_circuit ON deputies(circuit);
CREATE INDEX IF NOT EXISTS idx_deputies_principal ON deputies(principal_id);

-- REPORTS (session-level)
CREATE TABLE IF NOT EXISTS reports (
    report_id           INTEGER PRIMARY KEY,
    report_title        TEXT,
    report_description  TEXT,
    is_private          BOOLEAN DEFAULT FALSE,
    session_id          INTEGER,
    session_type        TEXT,
    session_number      INTEGER,
    session_date        DATE,
    session_start       TIMESTAMPTZ,
    session_end         TIMESTAMPTZ,
    num_votings         INTEGER DEFAULT 0,
    created_at          TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_reports_session ON reports(session_id);
CREATE INDEX IF NOT EXISTS idx_reports_date ON reports(session_date);

-- VOTINGS (individual bill/motion within a session)
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
    voting_start        TIMESTAMPTZ,
    voting_end          TIMESTAMPTZ,
    point_id            INTEGER
);
CREATE INDEX IF NOT EXISTS idx_votings_report ON votings(report_id);
CREATE INDEX IF NOT EXISTS idx_votings_session ON votings(session_id);
CREATE INDEX IF NOT EXISTS idx_votings_date ON votings(session_date);

-- VOTES (main table: one row per deputy per question)
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
    vote              TEXT,          -- 'A favor', 'En contra', 'Me abstengo'
    vote_type         TEXT,          -- 'a_favor', 'en_contra', 'abstencion'
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


-- ════════════════════════════════════════════════════════════════════════
-- VIEWS
-- ════════════════════════════════════════════════════════════════════════

-- Deputy voting summary
CREATE OR REPLACE VIEW v_deputy_summary AS
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
    ROUND(100.0 * SUM(CASE WHEN v.vote = 'A favor' THEN 1 ELSE 0 END) / NULLIF(COUNT(v.vote_id), 0), 1) AS pct_a_favor,
    MIN(v.session_date) AS first_vote_date,
    MAX(v.session_date) AS last_vote_date
FROM deputies d
JOIN votes v ON d.deputy_id = v.deputy_id
GROUP BY d.deputy_id, d.full_name, d.party_code, d.circuit, d.is_suplente;

-- Party voting summary
CREATE OR REPLACE VIEW v_party_summary AS
SELECT
    v.party_code,
    v.party_name,
    COUNT(DISTINCT v.deputy_id) AS unique_deputies,
    COUNT(v.vote_id) AS total_votes,
    SUM(CASE WHEN v.vote = 'A favor' THEN 1 ELSE 0 END) AS votes_a_favor,
    SUM(CASE WHEN v.vote = 'En contra' THEN 1 ELSE 0 END) AS votes_en_contra,
    SUM(CASE WHEN v.vote = 'Me abstengo' THEN 1 ELSE 0 END) AS votes_abstencion,
    ROUND(100.0 * SUM(CASE WHEN v.vote = 'A favor' THEN 1 ELSE 0 END) / NULLIF(COUNT(v.vote_id), 0), 1) AS pct_a_favor
FROM votes v
GROUP BY v.party_code, v.party_name;

-- Party cohesion per voting
CREATE OR REPLACE VIEW v_party_cohesion AS
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
    ROUND(100.0 * GREATEST(
        SUM(CASE WHEN v.vote = 'A favor' THEN 1 ELSE 0 END),
        SUM(CASE WHEN v.vote = 'En contra' THEN 1 ELSE 0 END),
        SUM(CASE WHEN v.vote = 'Me abstengo' THEN 1 ELSE 0 END)
    ) / NULLIF(COUNT(v.vote_id), 0), 1) AS cohesion_pct
FROM votes v
GROUP BY v.voting_id, v.question_id, v.session_date, v.voting_title, v.party_code;

-- Monthly activity
CREATE OR REPLACE VIEW v_monthly_activity AS
SELECT
    TO_CHAR(session_date, 'YYYY-MM') AS month,
    COUNT(DISTINCT report_id) AS sessions,
    COUNT(DISTINCT voting_id) AS votings,
    COUNT(vote_id) AS total_votes,
    COUNT(DISTINCT deputy_id) AS active_deputies
FROM votes
GROUP BY TO_CHAR(session_date, 'YYYY-MM')
ORDER BY month;


-- ════════════════════════════════════════════════════════════════════════
-- RLS POLICIES (public read, no write)
-- ════════════════════════════════════════════════════════════════════════

ALTER TABLE parties ENABLE ROW LEVEL SECURITY;
ALTER TABLE deputies ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE votings ENABLE ROW LEVEL SECURITY;
ALTER TABLE votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read" ON parties FOR SELECT USING (true);
CREATE POLICY "Public read" ON deputies FOR SELECT USING (true);
CREATE POLICY "Public read" ON reports FOR SELECT USING (true);
CREATE POLICY "Public read" ON votings FOR SELECT USING (true);
CREATE POLICY "Public read" ON votes FOR SELECT USING (true);


-- ════════════════════════════════════════════════════════════════════════
-- USEFUL QUERIES (examples for Orwell integration)
-- ════════════════════════════════════════════════════════════════════════

-- How did a specific deputy vote on everything?
-- SELECT * FROM v_deputy_summary WHERE deputy_id = 376;

-- Party discipline on a specific bill?
-- SELECT * FROM v_party_cohesion WHERE voting_id = 5423;

-- Who voted against their party?
-- SELECT * FROM v_dissent WHERE session_date > '2025-01-01' ORDER BY session_date DESC;

-- Attendance rate by deputy (sessions participated / total sessions)
-- SELECT deputy_name, party_code,
--     COUNT(DISTINCT session_date) as sessions_present,
--     (SELECT COUNT(DISTINCT session_date) FROM votes) as total_sessions,
--     ROUND(100.0 * COUNT(DISTINCT session_date) /
--         (SELECT COUNT(DISTINCT session_date) FROM votes), 1) as attendance_pct
-- FROM votes GROUP BY deputy_id ORDER BY attendance_pct ASC;
