PRAGMA journal_mode=WAL;

CREATE TABLE IF NOT EXISTS wheels (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  schedule_start TEXT,
  schedule_end TEXT,
  global_daily_cap INTEGER NOT NULL DEFAULT 600,
  fallback TEXT NOT NULL DEFAULT 'ZONK'
);

CREATE TABLE IF NOT EXISTS slices (
  id TEXT,
  wheel_id TEXT,
  label TEXT NOT NULL,
  type TEXT NOT NULL,
  weight REAL NOT NULL,
  daily_cap INTEGER,
  max_per_user_per_day INTEGER,
  metadata_json TEXT,
  style_json TEXT,
  position_index INTEGER,
  PRIMARY KEY (id, wheel_id),
  FOREIGN KEY (wheel_id) REFERENCES wheels(id)
);

CREATE TABLE IF NOT EXISTS spins (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  wheel_id TEXT NOT NULL,
  anon_id TEXT NOT NULL,
  prize_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  ip_hash TEXT,
  ua_hash TEXT,
  ab_bucket TEXT,
  segment_id TEXT
);

CREATE TABLE IF NOT EXISTS daily_counters (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  wheel_id TEXT NOT NULL,
  prize_id TEXT,
  prize_count INTEGER NOT NULL DEFAULT 0,
  global_count INTEGER NOT NULL DEFAULT 0
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_unique ON daily_counters(date, wheel_id, prize_id);

CREATE TABLE IF NOT EXISTS voucher_pool (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  prize_id TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  issued_to_anon_id TEXT,
  status TEXT NOT NULL DEFAULT 'issued',
  issued_at TEXT,
  redeemed_at TEXT
);
