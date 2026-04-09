const express = require('express');
const multer = require('multer');
const { pool } = require('../db/database');
const authMiddleware = require('../middleware/auth');
const { uploadBuffer, deleteByUrl } = require('../lib/cloudinary');

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Solo se permiten imágenes'));
  },
});

router.use(authMiddleware);

async function isMember(householdId, userId) {
  if (!householdId) return true;
  const { rows } = await pool.query(
    'SELECT id FROM household_members WHERE household_id = $1 AND user_id = $2',
    [householdId, userId]
  );
  return rows.length > 0;
}

// ── ROOMS ──────────────────────────────────────────────

router.get('/rooms', async (req, res) => {
  try {
    const { household_id } = req.query;
    let sql, params;

    if (household_id) {
      if (!await isMember(household_id, req.user.id)) {
        return res.status(403).json({ error: 'No perteneces a este hogar' });
      }
      sql = `
        SELECT r.*, u.name AS created_by_name
        FROM rooms r JOIN users u ON u.id = r.created_by
        WHERE r.household_id = $1
        ORDER BY r.name
      `;
      params = [household_id];
    } else {
      sql = `
        SELECT r.*, u.name AS created_by_name
        FROM rooms r JOIN users u ON u.id = r.created_by
        WHERE r.household_id IS NULL AND r.created_by = $1
        ORDER BY r.name
      `;
      params = [req.user.id];
    }

    const { rows } = await pool.query(sql, params);
    res.json(rows);
  } catch (err) {
    console.error('[rooms get error]', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/rooms', async (req, res) => {
  try {
    const { name, household_id } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'El nombre de la habitación es obligatorio' });
    }
    if (household_id && !await isMember(household_id, req.user.id)) {
      return res.status(403).json({ error: 'No perteneces a este hogar' });
    }

    const { rows: inserted } = await pool.query(
      'INSERT INTO rooms (name, household_id, created_by) VALUES ($1, $2, $3) RETURNING id',
      [name.trim(), household_id || null, req.user.id]
    );

    const { rows } = await pool.query(`
      SELECT r.*, u.name AS created_by_name
      FROM rooms r JOIN users u ON u.id = r.created_by
      WHERE r.id = $1
    `, [inserted[0].id]);

    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('[room create error]', err);
    res.status(500).json({ error: err.message });
  }
});

router.put('/rooms/:id', async (req, res) => {
  try {
    const { rows: rRows } = await pool.query('SELECT * FROM rooms WHERE id = $1', [req.params.id]);
    const room = rRows[0];
    if (!room) return res.status(404).json({ error: 'Habitación no encontrada' });
    if (!await isMember(room.household_id, req.user.id) && room.created_by !== req.user.id) {
      return res.status(403).json({ error: 'Sin permiso para editar esta habitación' });
    }

    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'El nombre es obligatorio' });
    }

    await pool.query('UPDATE rooms SET name = $1 WHERE id = $2', [name.trim(), req.params.id]);

    const { rows } = await pool.query(`
      SELECT r.*, u.name AS created_by_name
      FROM rooms r JOIN users u ON u.id = r.created_by
      WHERE r.id = $1
    `, [req.params.id]);

    res.json(rows[0]);
  } catch (err) {
    console.error('[room update error]', err);
    res.status(500).json({ error: err.message });
  }
});

router.delete('/rooms/:id', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM rooms WHERE id = $1', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Habitación no encontrada' });
    await pool.query('DELETE FROM rooms WHERE id = $1', [req.params.id]);
    res.json({ message: 'Habitación eliminada' });
  } catch (err) {
    console.error('[room delete error]', err);
    res.status(500).json({ error: err.message });
  }
});

// ── ITEMS ──────────────────────────────────────────────

router.get('/items', async (req, res) => {
  try {
    const { search, room_id, household_id } = req.query;

    const params = [];
    const conditions = [];

    if (household_id) {
      if (!await isMember(household_id, req.user.id)) {
        return res.status(403).json({ error: 'No perteneces a este hogar' });
      }
      conditions.push(`i.household_id = $${params.length + 1}`);
      params.push(household_id);
    } else {
      conditions.push(`i.household_id IS NULL AND i.created_by = $${params.length + 1}`);
      params.push(req.user.id);
    }

    if (search) {
      conditions.push(`(i.name ILIKE $${params.length + 1} OR i.description ILIKE $${params.length + 2})`);
      params.push(`%${search}%`, `%${search}%`);
    }
    if (room_id) {
      conditions.push(`i.room_id = $${params.length + 1}`);
      params.push(room_id);
    }

    const sql = `
      SELECT i.*, r.name AS room_name, u.name AS created_by_name, uu.name AS updated_by_name
      FROM items i
      LEFT JOIN rooms r ON r.id = i.room_id
      JOIN users u ON u.id = i.created_by
      LEFT JOIN users uu ON uu.id = i.updated_by
      WHERE ${conditions.join(' AND ')}
      ORDER BY i.created_at DESC
    `;

    const { rows } = await pool.query(sql, params);
    res.json(rows);
  } catch (err) {
    console.error('[items get error]', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/items', upload.single('photo'), async (req, res) => {
  try {
    const { name, description, room_id, household_id } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'El nombre del objeto es obligatorio' });
    }

    let photo_url = null;
    if (req.file) {
      const result = await uploadBuffer(req.file.buffer, { folder: 'biblioteca/items' });
      photo_url = result.secure_url;
    }
    const { rows: inserted } = await pool.query(`
      INSERT INTO items (name, description, room_id, household_id, photo_url, created_by)
      VALUES ($1, $2, $3, $4, $5, $6) RETURNING id
    `, [name.trim(), description || null, room_id || null, household_id || null, photo_url, req.user.id]);

    const { rows } = await pool.query(`
      SELECT i.*, r.name AS room_name, u.name AS created_by_name, uu.name AS updated_by_name
      FROM items i
      LEFT JOIN rooms r ON r.id = i.room_id
      JOIN users u ON u.id = i.created_by
      LEFT JOIN users uu ON uu.id = i.updated_by
      WHERE i.id = $1
    `, [inserted[0].id]);

    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('[item create error]', err);
    res.status(500).json({ error: err.message });
  }
});

router.put('/items/:id', upload.single('photo'), async (req, res) => {
  try {
    const { rows: iRows } = await pool.query('SELECT * FROM items WHERE id = $1', [req.params.id]);
    const item = iRows[0];
    if (!item) return res.status(404).json({ error: 'Objeto no encontrado' });

    const { name, description, room_id } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'El nombre del objeto es obligatorio' });
    }

    let photo_url = item.photo_url;
    if (req.file) {
      await deleteByUrl(photo_url);
      const result = await uploadBuffer(req.file.buffer, { folder: 'biblioteca/items' });
      photo_url = result.secure_url;
    }

    await pool.query(`
      UPDATE items SET name = $1, description = $2, room_id = $3, photo_url = $4,
        updated_by = $5, updated_at = NOW()
      WHERE id = $6
    `, [name.trim(), description || null, room_id || null, photo_url, req.user.id, req.params.id]);

    const { rows } = await pool.query(`
      SELECT i.*, r.name AS room_name, u.name AS created_by_name, uu.name AS updated_by_name
      FROM items i
      LEFT JOIN rooms r ON r.id = i.room_id
      JOIN users u ON u.id = i.created_by
      LEFT JOIN users uu ON uu.id = i.updated_by
      WHERE i.id = $1
    `, [req.params.id]);

    res.json(rows[0]);
  } catch (err) {
    console.error('[item update error]', err);
    res.status(500).json({ error: err.message });
  }
});

router.delete('/items/:id', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM items WHERE id = $1', [req.params.id]);
    const item = rows[0];
    if (!item) return res.status(404).json({ error: 'Objeto no encontrado' });

    await deleteByUrl(item.photo_url);
    await pool.query('DELETE FROM items WHERE id = $1', [req.params.id]);
    res.json({ message: 'Objeto eliminado' });
  } catch (err) {
    console.error('[item delete error]', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
