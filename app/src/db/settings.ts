import { getDatabase } from './database';

/**
 * Settings persistence layer.
 *
 * Wraps the `settings` table (key TEXT PK, value TEXT) with type-safe
 * read/write helpers. All values are stored as strings — callers are
 * responsible for serialization/deserialization.
 */

/** Load every setting into a Map. */
export async function loadAllSettings(): Promise<Map<string, string>> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ key: string; value: string }>(
    'SELECT * FROM settings',
  );
  const map = new Map<string, string>();
  for (const row of rows) {
    map.set(row.key, row.value);
  }
  return map;
}

/** Persist a single setting (insert or replace). */
export async function saveSetting(key: string, value: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    'INSERT OR REPLACE INTO settings(key, value) VALUES(?, ?)',
    [key, value],
  );
}

/** Batch-persist multiple settings inside a single transaction. */
export async function saveSettings(
  entries: [string, string][],
): Promise<void> {
  const db = await getDatabase();
  await db.withTransactionAsync(async () => {
    for (const [key, value] of entries) {
      await db.runAsync(
        'INSERT OR REPLACE INTO settings(key, value) VALUES(?, ?)',
        [key, value],
      );
    }
  });
}
