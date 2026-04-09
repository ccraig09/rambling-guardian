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

    CREATE TABLE IF NOT EXISTS exercise_favorites (
      exercise_id TEXT PRIMARY KEY REFERENCES exercises(id),
      added_at    INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_sessions_started ON sessions(started_at);
    CREATE INDEX IF NOT EXISTS idx_alert_events_session ON alert_events(session_id);
    CREATE INDEX IF NOT EXISTS idx_completions_exercise ON exercise_completions(exercise_id);
    CREATE INDEX IF NOT EXISTS idx_completions_date ON exercise_completions(completed_at);
    CREATE INDEX IF NOT EXISTS idx_streaks_date ON streaks(date);
  `);
}

export async function migrateToV2(db: SQLiteDatabase): Promise<void> {
  // Add trigger_source, session_type, boot_id, device_sequence columns (D-pre A + DpB.5)
  const migrations = [
    `ALTER TABLE sessions ADD COLUMN trigger_source TEXT DEFAULT 'button'`,
    `ALTER TABLE sessions ADD COLUMN session_type TEXT DEFAULT 'active_session'`,
    `ALTER TABLE sessions ADD COLUMN boot_id INTEGER`,
    `ALTER TABLE sessions ADD COLUMN device_sequence INTEGER`,
    // D-pre B.7: transcript/retention placeholders (empty for now, Phase D populates)
    `ALTER TABLE sessions ADD COLUMN transcript TEXT`,
    `ALTER TABLE sessions ADD COLUMN transcript_timestamps TEXT`,
    `ALTER TABLE sessions ADD COLUMN audio_retention TEXT DEFAULT 'transcript_only'`,
  ];

  for (const sql of migrations) {
    try {
      await db.execAsync(sql);
    } catch (e: any) {
      // Column already exists — ignore "duplicate column" errors
      if (!e.message?.includes('duplicate column')) {
        throw e;
      }
    }
  }
}

export async function migrateToV3(db: SQLiteDatabase): Promise<void> {
  const migrations = [
    `ALTER TABLE sessions ADD COLUMN sync_status TEXT`,
    `ALTER TABLE sessions ADD COLUMN received_at INTEGER`,
    `ALTER TABLE sessions ADD COLUMN processed_at INTEGER`,
    `ALTER TABLE sessions ADD COLUMN committed_at INTEGER`,
    `ALTER TABLE sessions ADD COLUMN retention_tier INTEGER DEFAULT 1`,
    `ALTER TABLE sessions ADD COLUMN retention_until INTEGER`,
  ];

  for (const sql of migrations) {
    try {
      await db.execAsync(sql);
    } catch (e: any) {
      if (!e.message?.includes('duplicate column')) {
        throw e;
      }
    }
  }

  // Backfill: device-synced sessions get sync_status = 'committed'
  await db.execAsync(
    `UPDATE sessions SET sync_status = 'committed', committed_at = ended_at WHERE synced_from_device = 1 AND sync_status IS NULL`,
  );
}

export async function migrateToV4(db: SQLiteDatabase): Promise<void> {
  // Voice profiles table
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS voice_profiles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      label TEXT NOT NULL DEFAULT 'Me',
      status TEXT NOT NULL DEFAULT 'enrolled',
      enrolled_sample_ids TEXT NOT NULL,
      embedding_data BLOB,
      embedding_model TEXT,
      embedding_version TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);

  // Speaker map column on sessions
  const migrations = [
    `ALTER TABLE sessions ADD COLUMN speaker_map TEXT`,
  ];
  for (const sql of migrations) {
    try {
      await db.execAsync(sql);
    } catch (e: any) {
      if (!e.message?.includes('duplicate column')) {
        throw e;
      }
    }
  }
}
