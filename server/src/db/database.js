const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
  console.error('FATAL: DATABASE_URL no está configurada. Añade el plugin de PostgreSQL en Railway.');
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false },
});

pool.on('error', (err) => {
  console.error('[DB] Error inesperado en el pool:', err.message);
});

async function initDB() {
  const client = await pool.connect();
  try {
    console.log('[DB] Inicializando esquema...');

    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id        SERIAL PRIMARY KEY,
        name      TEXT NOT NULL,
        username  TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        email     TEXT,
        photo_url TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS password_reset_tokens (
        id         SERIAL PRIMARY KEY,
        user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token      TEXT NOT NULL UNIQUE,
        expires_at TIMESTAMPTZ NOT NULL,
        used       BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS households (
        id         SERIAL PRIMARY KEY,
        name       TEXT NOT NULL,
        emoji      TEXT NOT NULL DEFAULT '🏠',
        created_by INTEGER NOT NULL REFERENCES users(id),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS household_members (
        id           SERIAL PRIMARY KEY,
        household_id INTEGER NOT NULL REFERENCES households(id) ON DELETE CASCADE,
        user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        role         TEXT NOT NULL DEFAULT 'member',
        joined_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(household_id, user_id)
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS household_invites (
        id           SERIAL PRIMARY KEY,
        household_id INTEGER NOT NULL REFERENCES households(id) ON DELETE CASCADE,
        token        TEXT NOT NULL UNIQUE,
        created_by   INTEGER NOT NULL REFERENCES users(id),
        expires_at   TIMESTAMPTZ NOT NULL,
        used         BOOLEAN NOT NULL DEFAULT FALSE,
        created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS rooms (
        id           SERIAL PRIMARY KEY,
        name         TEXT NOT NULL,
        household_id INTEGER REFERENCES households(id) ON DELETE SET NULL,
        created_by   INTEGER NOT NULL REFERENCES users(id),
        created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS items (
        id           SERIAL PRIMARY KEY,
        name         TEXT NOT NULL,
        description  TEXT,
        room_id      INTEGER REFERENCES rooms(id) ON DELETE SET NULL,
        household_id INTEGER REFERENCES households(id) ON DELETE SET NULL,
        photo_url    TEXT,
        created_by   INTEGER NOT NULL REFERENCES users(id),
        created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_by   INTEGER REFERENCES users(id),
        updated_at   TIMESTAMPTZ
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS libraries (
        id           SERIAL PRIMARY KEY,
        name         TEXT NOT NULL,
        household_id INTEGER REFERENCES households(id) ON DELETE SET NULL,
        created_by   INTEGER NOT NULL REFERENCES users(id),
        created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS books (
        id           SERIAL PRIMARY KEY,
        isbn         TEXT,
        title        TEXT NOT NULL,
        author       TEXT,
        year         TEXT,
        language     TEXT,
        cover_url    TEXT,
        cover_local  TEXT,
        library_id   INTEGER REFERENCES libraries(id) ON DELETE SET NULL,
        household_id INTEGER REFERENCES households(id) ON DELETE SET NULL,
        created_by   INTEGER NOT NULL REFERENCES users(id),
        created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_by   INTEGER REFERENCES users(id),
        updated_at   TIMESTAMPTZ
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS recipe_collections (
        id           SERIAL PRIMARY KEY,
        name         TEXT NOT NULL,
        household_id INTEGER REFERENCES households(id) ON DELETE SET NULL,
        created_by   INTEGER NOT NULL REFERENCES users(id),
        created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS recipes (
        id            SERIAL PRIMARY KEY,
        name          TEXT NOT NULL,
        description   TEXT,
        photo_url     TEXT,
        ingredients   JSONB NOT NULL DEFAULT '[]',
        steps         JSONB NOT NULL DEFAULT '[]',
        prep_time     INTEGER,
        cook_time     INTEGER,
        servings      INTEGER,
        difficulty    TEXT,
        collection_id INTEGER REFERENCES recipe_collections(id) ON DELETE SET NULL,
        household_id  INTEGER REFERENCES households(id) ON DELETE SET NULL,
        created_by    INTEGER NOT NULL REFERENCES users(id),
        created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_by    INTEGER REFERENCES users(id),
        updated_at    TIMESTAMPTZ
      )
    `);

    // Safe migrations using ADD COLUMN IF NOT EXISTS (PG 9.6+)
    const migrations = [
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS photo_url TEXT`,
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT`,
      `ALTER TABLE households ADD COLUMN IF NOT EXISTS emoji TEXT NOT NULL DEFAULT '🏠'`,
      `ALTER TABLE rooms ADD COLUMN IF NOT EXISTS household_id INTEGER REFERENCES households(id) ON DELETE SET NULL`,
      `ALTER TABLE items ADD COLUMN IF NOT EXISTS household_id INTEGER REFERENCES households(id) ON DELETE SET NULL`,
      `ALTER TABLE libraries ADD COLUMN IF NOT EXISTS household_id INTEGER REFERENCES households(id) ON DELETE SET NULL`,
      `ALTER TABLE books ADD COLUMN IF NOT EXISTS language TEXT`,
      `ALTER TABLE books ADD COLUMN IF NOT EXISTS cover_local TEXT`,
      `ALTER TABLE books ADD COLUMN IF NOT EXISTS household_id INTEGER REFERENCES households(id) ON DELETE SET NULL`,
    ];

    for (const sql of migrations) {
      try {
        await client.query(sql);
      } catch (err) {
        // Ignore harmless errors (constraint already exists, etc.)
        if (!err.message.includes('already exists')) {
          console.warn('[DB] Migration warning:', err.message);
        }
      }
    }

    console.log('[DB] Esquema listo ✓');
  } finally {
    client.release();
  }
}

module.exports = { pool, initDB };
