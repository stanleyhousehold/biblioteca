const express = require('express');
const { pool } = require('../db/database');
const authMiddleware = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

// ── GET /api/export?household_id= ────────────────────
router.get('/', async (req, res) => {
  try {
    const { household_id } = req.query;
    const userId = req.user.id;

    let rooms, items, libraries, books, recipeCollections, recipes;

    if (household_id) {
      const { rows: membership } = await pool.query(
        'SELECT id FROM household_members WHERE household_id = $1 AND user_id = $2',
        [household_id, userId]
      );
      if (!membership.length) return res.status(403).json({ error: 'No perteneces a este hogar' });

      [
        { rows: rooms }, { rows: items }, { rows: libraries }, { rows: books },
        { rows: recipeCollections }, { rows: recipes },
      ] = await Promise.all([
        pool.query('SELECT * FROM rooms WHERE household_id = $1', [household_id]),
        pool.query('SELECT * FROM items WHERE household_id = $1', [household_id]),
        pool.query('SELECT * FROM libraries WHERE household_id = $1', [household_id]),
        pool.query('SELECT * FROM books WHERE household_id = $1', [household_id]),
        pool.query('SELECT * FROM recipe_collections WHERE household_id = $1', [household_id]),
        pool.query('SELECT * FROM recipes WHERE household_id = $1', [household_id]),
      ]);
    } else {
      [
        { rows: rooms }, { rows: items }, { rows: libraries }, { rows: books },
        { rows: recipeCollections }, { rows: recipes },
      ] = await Promise.all([
        pool.query('SELECT * FROM rooms WHERE household_id IS NULL AND created_by = $1', [userId]),
        pool.query('SELECT * FROM items WHERE household_id IS NULL AND created_by = $1', [userId]),
        pool.query('SELECT * FROM libraries WHERE household_id IS NULL AND created_by = $1', [userId]),
        pool.query('SELECT * FROM books WHERE household_id IS NULL AND created_by = $1', [userId]),
        pool.query('SELECT * FROM recipe_collections WHERE household_id IS NULL AND created_by = $1', [userId]),
        pool.query('SELECT * FROM recipes WHERE household_id IS NULL AND created_by = $1', [userId]),
      ]);
    }

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="biblioteca-export-${Date.now()}.json"`);
    res.json({
      exported_at: new Date().toISOString(),
      exported_by: req.user.username,
      household_id: household_id || null,
      rooms, items, libraries, books,
      recipe_collections: recipeCollections, recipes,
    });
  } catch (err) {
    console.error('[export error]', err);
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/export/import ───────────────────────────
router.post('/import', async (req, res) => {
  const {
    rooms = [], items = [], libraries = [], books = [],
    recipe_collections = [], recipes = [],
    household_id,
  } = req.body;
  const userId = req.user.id;

  if (household_id) {
    const { rows } = await pool.query(
      'SELECT id FROM household_members WHERE household_id = $1 AND user_id = $2',
      [household_id, userId]
    );
    if (!rows.length) return res.status(403).json({ error: 'No perteneces a este hogar' });
  }

  const stats = { rooms: 0, items: 0, libraries: 0, books: 0, recipe_collections: 0, recipes: 0 };
  const roomIdMap = {};
  const libraryIdMap = {};
  const collectionIdMap = {};

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    for (const r of rooms) {
      const { rows } = await client.query(
        'INSERT INTO rooms (name, household_id, created_by) VALUES ($1, $2, $3) RETURNING id',
        [r.name, household_id || null, userId]
      );
      roomIdMap[r.id] = rows[0].id;
      stats.rooms++;
    }

    for (const i of items) {
      await client.query(`
        INSERT INTO items (name, description, room_id, household_id, photo_url, created_by)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [
        i.name, i.description || null,
        i.room_id ? (roomIdMap[i.room_id] || null) : null,
        household_id || null, i.photo_url || null, userId,
      ]);
      stats.items++;
    }

    for (const l of libraries) {
      const { rows } = await client.query(
        'INSERT INTO libraries (name, household_id, created_by) VALUES ($1, $2, $3) RETURNING id',
        [l.name, household_id || null, userId]
      );
      libraryIdMap[l.id] = rows[0].id;
      stats.libraries++;
    }

    for (const b of books) {
      await client.query(`
        INSERT INTO books (isbn, title, author, year, language, cover_url, library_id, household_id, created_by)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [
        b.isbn || null, b.title, b.author || null, b.year || null, b.language || null,
        b.cover_url || null,
        b.library_id ? (libraryIdMap[b.library_id] || null) : null,
        household_id || null, userId,
      ]);
      stats.books++;
    }

    for (const c of recipe_collections) {
      const { rows } = await client.query(
        'INSERT INTO recipe_collections (name, household_id, created_by) VALUES ($1, $2, $3) RETURNING id',
        [c.name, household_id || null, userId]
      );
      collectionIdMap[c.id] = rows[0].id;
      stats.recipe_collections++;
    }

    for (const r of recipes) {
      await client.query(`
        INSERT INTO recipes (name, description, photo_url, ingredients, steps,
          prep_time, cook_time, servings, difficulty, collection_id, household_id, created_by)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
      `, [
        r.name, r.description || null, r.photo_url || null,
        JSON.stringify(r.ingredients || []), JSON.stringify(r.steps || []),
        r.prep_time || null, r.cook_time || null, r.servings || null, r.difficulty || null,
        r.collection_id ? (collectionIdMap[r.collection_id] || null) : null,
        household_id || null, userId,
      ]);
      stats.recipes++;
    }

    await client.query('COMMIT');
    res.json({ message: 'Importación completada', stats });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[import error]', err);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

module.exports = router;
