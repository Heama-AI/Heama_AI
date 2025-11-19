import * as SQLite from 'expo-sqlite';

const DB_NAME = 'heama.db';

let databasePromise: Promise<SQLite.SQLiteDatabase> | null = null;

async function applyMigrations(db: SQLite.SQLiteDatabase) {
  await db.execAsync('PRAGMA foreign_keys = ON;');
  await db.execAsync('PRAGMA journal_mode = WAL;');
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS app_state (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL
    );
  `);
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS chat_messages (
      id TEXT PRIMARY KEY NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
      text TEXT NOT NULL,
      ts INTEGER NOT NULL
    );
  `);
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS records (
      id TEXT PRIMARY KEY NOT NULL,
      title TEXT NOT NULL,
      summary TEXT NOT NULL,
      highlights_json TEXT NOT NULL,
      keywords_json TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      stats_json TEXT NOT NULL,
      messages_json TEXT NOT NULL,
      quiz_json TEXT NOT NULL,
      fhir_bundle_json TEXT
    );
  `);
  try {
    await db.execAsync(`ALTER TABLE records ADD COLUMN fhir_bundle_json TEXT`);
  } catch (error) {
    // ignore if the column already exists
  }
  await db.execAsync(`
    CREATE INDEX IF NOT EXISTS idx_chat_messages_ts ON chat_messages (ts);
  `);
  await db.execAsync(`
    CREATE INDEX IF NOT EXISTS idx_records_created_at ON records (created_at DESC);
  `);
}

async function openDatabase() {
  if (!databasePromise) {
    databasePromise = SQLite.openDatabaseAsync(DB_NAME).then(async (db) => {
      await applyMigrations(db);
      return db;
    });
  }
  return databasePromise;
}

export async function getDatabase() {
  return openDatabase();
}
