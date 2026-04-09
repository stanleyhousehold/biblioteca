const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../../data/biblioteca.db');

console.log(`[DB] Ruta de la base de datos: ${DB_PATH}`);

const dataDir = path.dirname(DB_PATH);
try {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
    console.log(`[DB] Directorio creado: ${dataDir}`);
  }
} catch (err) {
  console.error(`[DB] Error al crear el directorio ${dataDir}:`, err);
  process.exit(1);
}

let db;
try {
  db = new Database(DB_PATH);
  console.log('[DB] Conexión establecida correctamente');
} catch (err) {
  console.error('[DB] Error al abrir la base de datos:', err);
  process.exit(1);
}

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      email TEXT,
      photo_url TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      used INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS households (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      created_by INTEGER NOT NULL REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS household_members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      household_id INTEGER NOT NULL REFERENCES households(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role TEXT NOT NULL DEFAULT 'member',
      joined_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(household_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS household_invites (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      household_id INTEGER NOT NULL REFERENCES households(id) ON DELETE CASCADE,
      token TEXT NOT NULL UNIQUE,
      created_by INTEGER NOT NULL REFERENCES users(id),
      expires_at TEXT NOT NULL,
      used INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS rooms (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      household_id INTEGER REFERENCES households(id) ON DELETE SET NULL,
      created_by INTEGER NOT NULL REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      room_id INTEGER REFERENCES rooms(id) ON DELETE SET NULL,
      household_id INTEGER REFERENCES households(id) ON DELETE SET NULL,
      photo_url TEXT,
      created_by INTEGER NOT NULL REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_by INTEGER REFERENCES users(id),
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS libraries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      household_id INTEGER REFERENCES households(id) ON DELETE SET NULL,
      created_by INTEGER NOT NULL REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS books (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      isbn TEXT,
      title TEXT NOT NULL,
      author TEXT,
      year TEXT,
      language TEXT,
      cover_url TEXT,
      cover_local TEXT,
      library_id INTEGER REFERENCES libraries(id) ON DELETE SET NULL,
      household_id INTEGER REFERENCES households(id) ON DELETE SET NULL,
      created_by INTEGER NOT NULL REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_by INTEGER REFERENCES users(id),
      updated_at TEXT
    );
  `);
  console.log('[DB] Tablas verificadas/creadas correctamente');
} catch (err) {
  console.error('[DB] Error al crear las tablas:', err);
  process.exit(1);
}

// ── Migrations (columnas añadidas en versiones posteriores) ──
const migrations = [
  'ALTER TABLE users ADD COLUMN photo_url TEXT',
  'ALTER TABLE users ADD COLUMN email TEXT',
  'ALTER TABLE rooms ADD COLUMN household_id INTEGER REFERENCES households(id) ON DELETE SET NULL',
  'ALTER TABLE items ADD COLUMN household_id INTEGER REFERENCES households(id) ON DELETE SET NULL',
  'ALTER TABLE libraries ADD COLUMN household_id INTEGER REFERENCES households(id) ON DELETE SET NULL',
  'ALTER TABLE books ADD COLUMN language TEXT',
  'ALTER TABLE books ADD COLUMN cover_local TEXT',
  'ALTER TABLE books ADD COLUMN household_id INTEGER REFERENCES households(id) ON DELETE SET NULL',
];

for (const sql of migrations) {
  try {
    db.exec(sql);
  } catch (err) {
    if (!err.message.includes('duplicate column name')) {
      console.error('[DB] Migration error:', sql, err.message);
    }
  }
}

module.exports = db;
