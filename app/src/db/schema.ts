import type { SQLiteDatabase } from 'expo-sqlite';

export async function initDatabase(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS sessions (
      id            TEXT PRIMARY KEY,
      started_at    INTEGER NOT NULL,
      ended_at      INTEGER,
      duration_ms   INTEGER NOT NULL DEFAULT 0,
      mode          TEXT NOT NULL DEFAULT 'solo',
      alert_count   INTEGER NOT NULL DEFAULT 0,
      max_alert     INTEGER NOT NULL DEFAULT 0,
      speech_segments INTEGER NOT NULL DEFAULT 0,
      sensitivity   INTEGER NOT NULL DEFAULT 0,
      synced_from_device INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS alert_events (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id      TEXT NOT NULL REFERENCES sessions(id),
      timestamp       INTEGER NOT NULL,
      alert_level     INTEGER NOT NULL,
      duration_at_alert INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS exercises (
      id              TEXT PRIMARY KEY,
      category        TEXT NOT NULL,
      title           TEXT NOT NULL,
      description     TEXT NOT NULL,
      instructions    TEXT NOT NULL,
      duration_seconds INTEGER NOT NULL,
      difficulty      INTEGER NOT NULL DEFAULT 1,
      tags            TEXT,
      sort_order      INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS exercise_completions (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      exercise_id TEXT NOT NULL REFERENCES exercises(id),
      completed_at INTEGER NOT NULL,
      rating      INTEGER
    );

    CREATE TABLE IF NOT EXISTS streaks (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      date            TEXT NOT NULL UNIQUE,
      exercises_done  INTEGER NOT NULL DEFAULT 0,
      sessions_done   INTEGER NOT NULL DEFAULT 0,
      total_speech_ms INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id      INTEGER PRIMARY KEY AUTOINCREMENT,
      type    TEXT NOT NULL,
      title   TEXT NOT NULL,
      body    TEXT NOT NULL,
      sent_at INTEGER NOT NULL,
      read    INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS voice_samples (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      recorded_at INTEGER NOT NULL,
      file_path   TEXT NOT NULL,
      duration_ms INTEGER NOT NULL,
      confirmed   INTEGER NOT NULL DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_sessions_started ON sessions(started_at);
    CREATE INDEX IF NOT EXISTS idx_alert_events_session ON alert_events(session_id);
    CREATE INDEX IF NOT EXISTS idx_completions_exercise ON exercise_completions(exercise_id);
    CREATE INDEX IF NOT EXISTS idx_completions_date ON exercise_completions(completed_at);
    CREATE INDEX IF NOT EXISTS idx_streaks_date ON streaks(date);
  `);
}
