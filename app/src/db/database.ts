import * as SQLite from 'expo-sqlite';
import { initDatabase, migrateToV2, migrateToV3, migrateToV4, migrateToV5, migrateToV6, migrateToV7, migrateToV8 } from './schema';

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
    await migrateToV7(db);
    await migrateToV8(db);
  }
  return db;
}
