import { getDatabase } from './database';
import type { VoiceProfile, VoiceProfileStatus } from '../types';

/** Get the first (and typically only) voice profile. */
export async function getVoiceProfile(): Promise<VoiceProfile | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<any>('SELECT * FROM voice_profiles LIMIT 1');
  if (!row) return null;
  return {
    id: row.id,
    label: row.label,
    status: row.status as VoiceProfileStatus,
    enrolledSampleIds: JSON.parse(row.enrolled_sample_ids),
    embeddingData: row.embedding_data,
    embeddingModel: row.embedding_model,
    embeddingVersion: row.embedding_version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Create a voice profile from enrollment sample IDs. */
export async function createVoiceProfile(sampleIds: number[]): Promise<number> {
  const db = await getDatabase();
  const now = Date.now();
  const result = await db.runAsync(
    `INSERT INTO voice_profiles (label, status, enrolled_sample_ids, created_at, updated_at)
     VALUES ('Me', 'enrolled', ?, ?, ?)`,
    [JSON.stringify(sampleIds), now, now],
  );
  return result.lastInsertRowId;
}
