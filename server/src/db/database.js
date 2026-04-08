const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../../data/biblioteca.db');

console.log(`[DB] Ruta de la base de datos: ${DB_PATH}`);

// Ensure data directory exists
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

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Create tables
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS rooms (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      created_by INTEGER NOT NULL REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      room_id INTEGER REFERENCES rooms(id) ON DELETE SET NULL,
      photo_url TEXT,
      created_by INTEGER NOT NULL REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_by INTEGER REFERENCES users(id),
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS libraries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      created_by INTEGER NOT NULL REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS books (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      isbn TEXT,
      title TEXT NOT NULL,
      author TEXT,
      year TEXT,
      cover_url TEXT,
      library_id INTEGER REFERENCES libraries(id) ON DELETE SET NULL,
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

module.exports = db;
