const express = require('express');
const { pool } = require('../db/database');
const authMiddleware = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

// GET /api/recent?household_id=
// Returns last 8 entries across items, books and recipes, newest first.
router.get('/', async (req, res) => {
  try {
    const { household_id } = req.query;
    const userId = req.user.id;

    if (household_id) {
      const { rows } = await pool.query(
        'SELECT id FROM household_members WHERE household_id = $1 AND user_id = $2',
        [household_id, userId]
      );
      if (!rows.length) return res.status(403).json({ error: 'No perteneces a este hogar' });
    }

    const p = household_id || userId;

    const sql = household_id
      ? `
        SELECT * FROM (
          SELECT i.id::text, 'item' AS type, i.name,
            i.photo_url AS image, r.name AS group_name, i.created_at
          FROM items i LEFT JOIN rooms r ON r.id = i.room_id
          WHERE i.household_id = $1

          UNION ALL

          SELECT b.id::text, 'book' AS type, b.title AS name,
            COALESCE(b.cover_local, b.cover_url) AS image,
            l.name AS group_name, b.created_at
          FROM books b LEFT JOIN libraries l ON l.id = b.library_id
          WHERE b.household_id = $1

          UNION ALL

          SELECT rc.id::text, 'recipe' AS type, rc.name,
            rc.photo_url AS image, col.name AS group_name, rc.created_at
          FROM recipes rc LEFT JOIN recipe_collections col ON col.id = rc.collection_id
          WHERE rc.household_id = $1
        ) combined
        ORDER BY created_at DESC LIMIT 8
      `
      : `
        SELECT * FROM (
          SELECT i.id::text, 'item' AS type, i.name,
            i.photo_url AS image, r.name AS group_name, i.created_at
          FROM items i LEFT JOIN rooms r ON r.id = i.room_id
          WHERE i.household_id IS NULL AND i.created_by = $1

          UNION ALL

          SELECT b.id::text, 'book' AS type, b.title AS name,
            COALESCE(b.cover_local, b.cover_url) AS image,
            l.name AS group_name, b.created_at
          FROM books b LEFT JOIN libraries l ON l.id = b.library_id
          WHERE b.household_id IS NULL AND b.created_by = $1

          UNION ALL

          SELECT rc.id::text, 'recipe' AS type, rc.name,
            rc.photo_url AS image, col.name AS group_name, rc.created_at
          FROM recipes rc LEFT JOIN recipe_collections col ON col.id = rc.collection_id
          WHERE rc.household_id IS NULL AND rc.created_by = $1
        ) combined
        ORDER BY created_at DESC LIMIT 8
      `;

    const { rows } = await pool.query(sql, [p]);
    res.json(rows);
  } catch (err) {
    console.error('[recent error]', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
