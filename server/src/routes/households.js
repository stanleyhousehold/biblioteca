const express = require('express');
const crypto = require('crypto');
const { pool } = require('../db/database');
const authMiddleware = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

const APP_URL = process.env.APP_URL || 'http://localhost:5173';

// ── Helpers ───────────────────────────────────────────
async function isMember(householdId, userId) {
  const { rows } = await pool.query(
    'SELECT id FROM household_members WHERE household_id = $1 AND user_id = $2',
    [householdId, userId]
  );
  return rows.length > 0;
}

async function isOwner(householdId, userId) {
  const { rows } = await pool.query(
    'SELECT id FROM household_members WHERE household_id = $1 AND user_id = $2 AND role = $3',
    [householdId, userId, 'owner']
  );
  return rows.length > 0;
}

// ── GET /api/households ───────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT h.*, hm.role,
        (SELECT COUNT(*) FROM household_members WHERE household_id = h.id) AS member_count
      FROM households h
      JOIN household_members hm ON hm.household_id = h.id AND hm.user_id = $1
      ORDER BY h.name
    `, [req.user.id]);
    res.json(rows);
  } catch (err) {
    console.error('[households list error]', err);
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/households ──────────────────────────────
router.post('/', async (req, res) => {
  try {
    const { name, emoji = '🏠' } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'El nombre del hogar es obligatorio' });
    }

    const { rows: hRows } = await pool.query(
      'INSERT INTO households (name, emoji, created_by) VALUES ($1, $2, $3) RETURNING id',
      [name.trim(), emoji, req.user.id]
    );
    const householdId = hRows[0].id;

    await pool.query(
      'INSERT INTO household_members (household_id, user_id, role) VALUES ($1, $2, $3)',
      [householdId, req.user.id, 'owner']
    );

    const { rows } = await pool.query(`
      SELECT h.*, hm.role, 1 AS member_count
      FROM households h
      JOIN household_members hm ON hm.household_id = h.id AND hm.user_id = $1
      WHERE h.id = $2
    `, [req.user.id, householdId]);

    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('[household create error]', err);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/households/:id ───────────────────────────
router.get('/:id', async (req, res) => {
  try {
    if (!await isMember(req.params.id, req.user.id)) {
      return res.status(403).json({ error: 'No perteneces a este hogar' });
    }

    const { rows: hRows } = await pool.query('SELECT * FROM households WHERE id = $1', [req.params.id]);
    if (!hRows[0]) return res.status(404).json({ error: 'Hogar no encontrado' });

    const { rows: members } = await pool.query(`
      SELECT hm.role, hm.joined_at, u.id, u.name, u.username, u.photo_url
      FROM household_members hm
      JOIN users u ON u.id = hm.user_id
      WHERE hm.household_id = $1
      ORDER BY hm.role DESC, u.name
    `, [req.params.id]);

    res.json({ ...hRows[0], members });
  } catch (err) {
    console.error('[household get error]', err);
    res.status(500).json({ error: err.message });
  }
});

// ── PUT /api/households/:id ───────────────────────────
router.put('/:id', async (req, res) => {
  try {
    if (!await isOwner(req.params.id, req.user.id)) {
      return res.status(403).json({ error: 'Solo el propietario puede editar el hogar' });
    }
    const { name, emoji } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'El nombre es obligatorio' });
    }

    const fields = ['name = $1'];
    const params = [name.trim()];
    if (emoji) {
      fields.push(`emoji = $${params.length + 1}`);
      params.push(emoji);
    }
    params.push(req.params.id);

    await pool.query(`UPDATE households SET ${fields.join(', ')} WHERE id = $${params.length}`, params);

    const { rows } = await pool.query('SELECT * FROM households WHERE id = $1', [req.params.id]);
    res.json(rows[0]);
  } catch (err) {
    console.error('[household update error]', err);
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE /api/households/:id ────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    if (!await isOwner(req.params.id, req.user.id)) {
      return res.status(403).json({ error: 'Solo el propietario puede eliminar el hogar' });
    }
    await pool.query('DELETE FROM households WHERE id = $1', [req.params.id]);
    res.json({ message: 'Hogar eliminado' });
  } catch (err) {
    console.error('[household delete error]', err);
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/households/:id/invite ──────────────────
router.post('/:id/invite', async (req, res) => {
  try {
    if (!await isMember(req.params.id, req.user.id)) {
      return res.status(403).json({ error: 'No perteneces a este hogar' });
    }

    const token = crypto.randomBytes(24).toString('hex');
    const expires_at = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 días

    await pool.query(
      'INSERT INTO household_invites (household_id, token, created_by, expires_at) VALUES ($1, $2, $3, $4)',
      [req.params.id, token, req.user.id, expires_at]
    );

    res.json({ invite_url: `${APP_URL}/unirse/${token}`, token, expires_at });
  } catch (err) {
    console.error('[household invite error]', err);
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/households/join/:token ─────────────────
router.post('/join/:token', async (req, res) => {
  try {
    const { rows: invRows } = await pool.query(
      'SELECT * FROM household_invites WHERE token = $1 AND used = FALSE',
      [req.params.token]
    );
    const invite = invRows[0];

    if (!invite) {
      return res.status(400).json({ error: 'El enlace de invitación no es válido o ya fue usado' });
    }
    if (new Date(invite.expires_at) < new Date()) {
      return res.status(400).json({ error: 'El enlace de invitación ha expirado' });
    }
    if (await isMember(invite.household_id, req.user.id)) {
      return res.status(400).json({ error: 'Ya eres miembro de este hogar' });
    }

    await pool.query(
      'INSERT INTO household_members (household_id, user_id, role) VALUES ($1, $2, $3)',
      [invite.household_id, req.user.id, 'member']
    );
    await pool.query('UPDATE household_invites SET used = TRUE WHERE id = $1', [invite.id]);

    const { rows } = await pool.query('SELECT * FROM households WHERE id = $1', [invite.household_id]);
    res.json({ message: `Te has unido a "${rows[0].name}" correctamente`, household: rows[0] });
  } catch (err) {
    console.error('[join error]', err);
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE /api/households/:id/members/:userId ────────
router.delete('/:id/members/:userId', async (req, res) => {
  try {
    const isSelf = req.params.userId == req.user.id;
    if (!isSelf && !await isOwner(req.params.id, req.user.id)) {
      return res.status(403).json({ error: 'No tienes permiso para eliminar miembros' });
    }
    if (isSelf && await isOwner(req.params.id, req.user.id)) {
      return res.status(400).json({ error: 'El propietario no puede abandonar el hogar. Elimínalo o transfiere la propiedad.' });
    }

    await pool.query(
      'DELETE FROM household_members WHERE household_id = $1 AND user_id = $2',
      [req.params.id, req.params.userId]
    );
    res.json({ message: 'Miembro eliminado del hogar' });
  } catch (err) {
    console.error('[remove member error]', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
