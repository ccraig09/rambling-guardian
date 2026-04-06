import { getDatabase } from './database';
import type { VoiceSample } from '../types';

export async function insertVoiceSample(filePath: string, durationMs: number): Promise<number> {
  const db = await getDatabase();
  const result = await db.runAsync(
    'INSERT INTO voice_samples (recorded_at, file_path, duration_ms, confirmed) VALUES (?, ?, ?, 0)',
    [Date.now(), filePath, durationMs],
  );
  return result.lastInsertRowId;
}

export async function getVoiceSamples(): Promise<VoiceSample[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{
    id: number; recorded_at: number; file_path: string; duration_ms: number; confirmed: number;
  }>('SELECT * FROM voice_samples ORDER BY recorded_at DESC');
  return rows.map((r) => ({
    id: r.id, recordedAt: r.recorded_at, filePath: r.file_path,
    durationMs: r.duration_ms, confirmed: r.confirmed === 1,
  }));
}

export async function confirmVoiceSample(id: number): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('UPDATE voice_samples SET confirmed = 1 WHERE id = ?', [id]);
}

export async function deleteVoiceSample(id: number): Promise<void> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ file_path: string }>('SELECT file_path FROM voice_samples WHERE id = ?', [id]);
  if (row) {
    const FileSystem = require('expo-file-system');
    await FileSystem.deleteAsync(row.file_path, { idempotent: true });
  }
  await db.runAsync('DELETE FROM voice_samples WHERE id = ?', [id]);
}

export async function getVoiceSampleCount(): Promise<number> {
  const db = await getDatabase();
  const result = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM voice_samples');
  return result?.count ?? 0;
}
