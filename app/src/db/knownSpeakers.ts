import { getDatabase } from './database';
import type { KnownSpeaker } from '../types';

/**
 * Get all known speakers, most recently seen first.
 * Speakers with no last_seen_at appear after those with a value
 * (SQLite-safe: ORDER BY CASE instead of NULLS LAST).
 */
export async function getKnownSpeakers(): Promise<KnownSpeaker[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<any>(
    `SELECT * FROM known_speakers
     ORDER BY
       CASE WHEN last_seen_at IS NULL THEN 1 ELSE 0 END ASC,
       last_seen_at DESC`,
  );
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    lastSeenAt: r.last_seen_at ?? null,
    sessionCount: r.session_count,
  }));
}

/**
 * Add a speaker to the library. INSERT OR IGNORE — idempotent on duplicate name.
 */
export async function addKnownSpeaker(name: string): Promise<void> {
  const db = await getDatabase();
  const now = Date.now();
  await db.runAsync(
    `INSERT OR IGNORE INTO known_speakers (name, created_at, updated_at, session_count)
     VALUES (?, ?, ?, 0)`,
    [name, now, now],
  );
}

/**
 * Update last_seen_at to now and increment session_count by 1.
 */
export async function touchKnownSpeaker(name: string): Promise<void> {
  const db = await getDatabase();
  const now = Date.now();
  await db.runAsync(
    `UPDATE known_speakers
     SET last_seen_at = ?, session_count = session_count + 1, updated_at = ?
     WHERE name = ?`,
    [now, now, name],
  );
}

/**
 * Rename a known speaker. Normalizing is the caller's responsibility.
 */
export async function renameKnownSpeaker(
  oldName: string,
  newName: string,
): Promise<void> {
  const db = await getDatabase();
  const now = Date.now();
  await db.runAsync(
    `UPDATE known_speakers SET name = ?, updated_at = ? WHERE name = ?`,
    [newName, now, oldName],
  );
}

/**
 * Remove a speaker from the library.
 */
export async function deleteKnownSpeaker(name: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(`DELETE FROM known_speakers WHERE name = ?`, [name]);
}
