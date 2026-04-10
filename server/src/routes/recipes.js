const express = require('express');
const multer = require('multer');
const { pool } = require('../db/database');
const authMiddleware = require('../middleware/auth');
const { uploadBuffer, deleteByUrl } = require('../lib/cloudinary');

const router = express.Router();
router.use(authMiddleware);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Solo se permiten imágenes'));
  },
});

async function isMember(householdId, userId) {
  if (!householdId) return true;
  const { rows } = await pool.query(
    'SELECT id FROM household_members WHERE household_id = $1 AND user_id = $2',
    [householdId, userId]
  );
  return rows.length > 0;
}

const RECIPE_SELECT = `
  SELECT r.*,
    rc.name AS collection_name,
    u.name  AS created_by_name,
    uu.name AS updated_by_name
  FROM recipes r
  LEFT JOIN recipe_collections rc ON rc.id = r.collection_id
  JOIN  users u  ON u.id  = r.created_by
  LEFT JOIN users uu ON uu.id = r.updated_by
`;

// ── COLLECTIONS ─────────────────────────────────────────

router.get('/collections', async (req, res) => {
  try {
    const { household_id } = req.query;
    let sql, params;

    if (household_id) {
      if (!await isMember(household_id, req.user.id))
        return res.status(403).json({ error: 'No perteneces a este hogar' });
      sql = `
        SELECT rc.*, u.name AS created_by_name, COUNT(r.id) AS recipe_count
        FROM recipe_collections rc JOIN users u ON u.id = rc.created_by
        LEFT JOIN recipes r ON r.collection_id = rc.id
        WHERE rc.household_id = $1
        GROUP BY rc.id, u.name ORDER BY rc.name
      `;
      params = [household_id];
    } else {
      sql = `
        SELECT rc.*, u.name AS created_by_name, COUNT(r.id) AS recipe_count
        FROM recipe_collections rc JOIN users u ON u.id = rc.created_by
        LEFT JOIN recipes r ON r.collection_id = rc.id
        WHERE rc.household_id IS NULL AND rc.created_by = $1
        GROUP BY rc.id, u.name ORDER BY rc.name
      `;
      params = [req.user.id];
    }

    const { rows } = await pool.query(sql, params);
    res.json(rows);
  } catch (err) {
    console.error('[recipe collections get]', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/collections', async (req, res) => {
  try {
    const { name, household_id } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'El nombre es obligatorio' });
    if (household_id && !await isMember(household_id, req.user.id))
      return res.status(403).json({ error: 'No perteneces a este hogar' });

    const { rows: ins } = await pool.query(
      'INSERT INTO recipe_collections (name, household_id, created_by) VALUES ($1,$2,$3) RETURNING id',
      [name.trim(), household_id || null, req.user.id]
    );
    const { rows } = await pool.query(`
      SELECT rc.*, u.name AS created_by_name, 0 AS recipe_count
      FROM recipe_collections rc JOIN users u ON u.id = rc.created_by WHERE rc.id = $1
    `, [ins[0].id]);
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('[recipe collection create]', err);
    res.status(500).json({ error: err.message });
  }
});

router.put('/collections/:id', async (req, res) => {
  try {
    const { rows: existing } = await pool.query('SELECT id FROM recipe_collections WHERE id = $1', [req.params.id]);
    if (!existing[0]) return res.status(404).json({ error: 'Colección no encontrada' });
    const { name } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'El nombre es obligatorio' });
    await pool.query('UPDATE recipe_collections SET name = $1 WHERE id = $2', [name.trim(), req.params.id]);
    const { rows } = await pool.query(`
      SELECT rc.*, u.name AS created_by_name,
        (SELECT COUNT(*) FROM recipes WHERE collection_id = rc.id) AS recipe_count
      FROM recipe_collections rc JOIN users u ON u.id = rc.created_by WHERE rc.id = $1
    `, [req.params.id]);
    res.json(rows[0]);
  } catch (err) {
    console.error('[recipe collection update]', err);
    res.status(500).json({ error: err.message });
  }
});

router.delete('/collections/:id', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT id FROM recipe_collections WHERE id = $1', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Colección no encontrada' });
    await pool.query('DELETE FROM recipe_collections WHERE id = $1', [req.params.id]);
    res.json({ message: 'Colección eliminada' });
  } catch (err) {
    console.error('[recipe collection delete]', err);
    res.status(500).json({ error: err.message });
  }
});

// ── RECIPES ─────────────────────────────────────────────

router.get('/', async (req, res) => {
  try {
    const { search, collection_id, difficulty, household_id } = req.query;
    const params = [];
    const conditions = [];

    if (household_id) {
      if (!await isMember(household_id, req.user.id))
        return res.status(403).json({ error: 'No perteneces a este hogar' });
      conditions.push(`r.household_id = $${params.length + 1}`);
      params.push(household_id);
    } else {
      conditions.push(`r.household_id IS NULL AND r.created_by = $${params.length + 1}`);
      params.push(req.user.id);
    }

    if (search) {
      conditions.push(`(r.name ILIKE $${params.length + 1} OR r.ingredients::text ILIKE $${params.length + 2})`);
      params.push(`%${search}%`, `%${search}%`);
    }
    if (collection_id) {
      conditions.push(`r.collection_id = $${params.length + 1}`);
      params.push(collection_id);
    }
    if (difficulty) {
      conditions.push(`r.difficulty = $${params.length + 1}`);
      params.push(difficulty);
    }

    const sql = RECIPE_SELECT + ' WHERE ' + conditions.join(' AND ') + ' ORDER BY r.created_at DESC';
    const { rows } = await pool.query(sql, params);
    res.json(rows);
  } catch (err) {
    console.error('[recipes get]', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/', upload.single('photo'), async (req, res) => {
  try {
    const { name, description, collection_id, household_id, prep_time, cook_time, servings, difficulty } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'El nombre de la receta es obligatorio' });

    const ingredients = JSON.parse(req.body.ingredients || '[]');
    const steps = JSON.parse(req.body.steps || '[]');

    let photo_url = null;
    if (req.file) {
      const result = await uploadBuffer(req.file.buffer, { folder: 'biblioteca/recipes' });
      photo_url = result.secure_url;
    }

    const { rows: ins } = await pool.query(`
      INSERT INTO recipes (name, description, photo_url, ingredients, steps,
        prep_time, cook_time, servings, difficulty, collection_id, household_id, created_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id
    `, [name.trim(), description || null, photo_url,
        JSON.stringify(ingredients), JSON.stringify(steps),
        prep_time || null, cook_time || null, servings || null, difficulty || null,
        collection_id || null, household_id || null, req.user.id]);

    const { rows } = await pool.query(RECIPE_SELECT + ' WHERE r.id = $1', [ins[0].id]);
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('[recipe create]', err);
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', upload.single('photo'), async (req, res) => {
  try {
    const { rows: rRows } = await pool.query('SELECT * FROM recipes WHERE id = $1', [req.params.id]);
    const recipe = rRows[0];
    if (!recipe) return res.status(404).json({ error: 'Receta no encontrada' });

    const { name, description, collection_id, prep_time, cook_time, servings, difficulty } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'El nombre de la receta es obligatorio' });

    const ingredients = JSON.parse(req.body.ingredients || '[]');
    const steps = JSON.parse(req.body.steps || '[]');

    let photo_url = recipe.photo_url;
    if (req.file) {
      await deleteByUrl(photo_url);
      const result = await uploadBuffer(req.file.buffer, { folder: 'biblioteca/recipes' });
      photo_url = result.secure_url;
    }

    await pool.query(`
      UPDATE recipes SET name=$1, description=$2, photo_url=$3, ingredients=$4, steps=$5,
        prep_time=$6, cook_time=$7, servings=$8, difficulty=$9, collection_id=$10,
        updated_by=$11, updated_at=NOW()
      WHERE id=$12
    `, [name.trim(), description || null, photo_url,
        JSON.stringify(ingredients), JSON.stringify(steps),
        prep_time || null, cook_time || null, servings || null, difficulty || null,
        collection_id || null, req.user.id, req.params.id]);

    const { rows } = await pool.query(RECIPE_SELECT + ' WHERE r.id = $1', [req.params.id]);
    res.json(rows[0]);
  } catch (err) {
    console.error('[recipe update]', err);
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM recipes WHERE id = $1', [req.params.id]);
    const recipe = rows[0];
    if (!recipe) return res.status(404).json({ error: 'Receta no encontrada' });
    await deleteByUrl(recipe.photo_url);
    await pool.query('DELETE FROM recipes WHERE id = $1', [req.params.id]);
    res.json({ message: 'Receta eliminada' });
  } catch (err) {
    console.error('[recipe delete]', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
