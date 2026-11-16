"""SQLite(WAL) 스키마와 연결. spec-v4 8장 기준. 공고(bids)는 모두 같이 쓰고 조건·대기·묶음은 계정별로 나눈다."""
import sqlite3
from datetime import datetime, timedelta, timezone
from pathlib import Path

KST = timezone(timedelta(hours=9))


def now_kst():
    return datetime.now(KST)


def fmt(dt):
    return dt.strftime("%Y-%m-%d %H:%M:%S")


SCHEMA = """
CREATE TABLE IF NOT EXISTS accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE,
    password_hash TEXT,
    display_name TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE TABLE IF NOT EXISTS channels (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id INTEGER NOT NULL REFERENCES accounts(id),
    type TEXT NOT NULL,                -- 'telegram' 등
    address TEXT,                      -- 예: chat id
    link_code TEXT,                    -- 텔레그램 /start 연결 코드
    enabled INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS digest_settings (
    account_id INTEGER PRIMARY KEY REFERENCES accounts(id),
    send_times TEXT NOT NULL DEFAULT '["08:30","12:30","17:00"]',
    urgent_hours INTEGER NOT NULL DEFAULT 24,
    max_items INTEGER NOT NULL DEFAULT 50
);
CREATE TABLE IF NOT EXISTS conditions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id INTEGER NOT NULL REFERENCES accounts(id),
    name TEXT NOT NULL,
    enabled INTEGER NOT NULL DEFAULT 1,
    condition_json TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE TABLE IF NOT EXISTS bids (
    bid_no TEXT NOT NULL,
    bid_ord TEXT NOT NULL,
    kind TEXT NOT NULL,                -- 물품/용역/공사 (호출한 오퍼레이션에서 채움)
    title TEXT,
    ntce_instt_nm TEXT,
    dminstt_nm TEXT,
    region TEXT,
    industry TEXT,
    prdct_clsfc TEXT,
    presmpt_prce TEXT,
    asign_bdgt_amt TEXT,
    bid_ntce_dt TEXT,
    bid_clse_dt TEXT,
    openg_dt TEXT,
    rgst_dt TEXT,
    chg_dt TEXT,
    url TEXT,
    first_seen_at TEXT NOT NULL,
    from_backfill INTEGER NOT NULL DEFAULT 0,
    reg_delay_min REAL,                -- 공고일시와 처음 수집한 시각의 차이(분). 백필 건은 비움
    updated_at TEXT NOT NULL,
    raw_json TEXT NOT NULL,            -- 허용 필드만(가려진 값)
    PRIMARY KEY (bid_no, bid_ord)
);
CREATE INDEX IF NOT EXISTS idx_bids_clse ON bids(bid_clse_dt);
CREATE INDEX IF NOT EXISTS idx_bids_seen ON bids(first_seen_at);
CREATE TABLE IF NOT EXISTS pending_notifications (
    account_id INTEGER NOT NULL REFERENCES accounts(id),
    bid_no TEXT NOT NULL,
    bid_ord TEXT NOT NULL,
    matched_condition_ids TEXT,
    is_urgent INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
    PRIMARY KEY (account_id, bid_no, bid_ord)
);
CREATE TABLE IF NOT EXISTS digests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id INTEGER NOT NULL REFERENCES accounts(id),
    scheduled_at TEXT,
    sent_at TEXT,
    item_count INTEGER,
    urgent_count INTEGER,
    status TEXT
);
CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    digest_id INTEGER REFERENCES digests(id),
    account_id INTEGER NOT NULL REFERENCES accounts(id),
    bid_no TEXT NOT NULL,
    bid_ord TEXT NOT NULL,
    matched_condition_ids TEXT,
    section TEXT,
    sent_at TEXT
);
CREATE TABLE IF NOT EXISTS collect_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    run_type TEXT NOT NULL DEFAULT 'incremental',   -- incremental / backfill
    operation TEXT NOT NULL,
    inqry_div INTEGER,
    window_start TEXT,
    window_end TEXT,
    overlap_min INTEGER,
    pages INTEGER,
    calls INTEGER,
    total_count INTEGER,
    received_rows INTEGER,
    status TEXT,                                    -- ok / incomplete / error / quota
    message TEXT,
    finished_at TEXT
);
CREATE TABLE IF NOT EXISTS api_usage (
    date TEXT NOT NULL,
    service TEXT NOT NULL,
    operation TEXT NOT NULL,
    call_count INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (date, operation)
);
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
);
"""


def connect(path):
    if str(path) != ":memory:":
        Path(path).parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(path), timeout=30)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA busy_timeout=30000")
    conn.execute("PRAGMA foreign_keys=ON")
    conn.executescript(SCHEMA)
    conn.commit()
    return conn


def get_setting(conn, key, default=None):
    row = conn.execute("SELECT value FROM settings WHERE key=?", (key,)).fetchone()
    return row["value"] if row else default


def set_setting(conn, key, value):
    conn.execute(
        "INSERT INTO settings(key,value) VALUES(?,?) "
        "ON CONFLICT(key) DO UPDATE SET value=excluded.value", (key, str(value)))
    conn.commit()
