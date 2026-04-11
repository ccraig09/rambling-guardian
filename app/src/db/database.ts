import * as SQLite from 'expo-sqlite';
import { initDatabase, migrateToV2, migrateToV3, migrateToV4, migrateToV5, migrateToV6 } from './schema';

let db: SQLite.SQLiteDatabase | null = null;

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!db) {
    db = await SQLite.openDatabaseAsync('rambling-guardian.db');
    await initDatabase(db);
    await migrateToV2(db);
    await migrateToV3(db);
    await migrateToV4(db);
    await migrateToV5(db);
    await migrateToV6(db);
  }
  return db;
}
