const express = require('express');
const crypto = require('crypto');
const db = require('../db/database');
const authMiddleware = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

const APP_URL = process.env.APP_URL || 'http://localhost:5173';

// ── Helper: verify membership ─────────────────────────
function isMember(householdId, userId) {
  return !!db.prepare(
    'SELECT id FROM household_members WHERE household_id = ? AND user_id = ?'
  ).get(householdId, userId);
}
function isOwner(householdId, userId) {
  return !!db.prepare(
    'SELECT id FROM household_members WHERE household_id = ? AND user_id = ? AND role = ?'
  ).get(householdId, userId, 'owner');
}

// ── GET /api/households ───────────────────────────────
router.get('/', (req, res) => {
  const households = db.prepare(`
    SELECT h.*, hm.role,
      (SELECT COUNT(*) FROM household_members WHERE household_id = h.id) AS member_count
    FROM households h
    JOIN household_members hm ON hm.household_id = h.id AND hm.user_id = ?
    ORDER BY h.name
  `).all(req.user.id);
  res.json(households);
});

// ── POST /api/households ──────────────────────────────
router.post('/', (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'El nombre del hogar es obligatorio' });
    }

    const result = db.prepare(
      'INSERT INTO households (name, created_by) VALUES (?, ?)'
    ).run(name.trim(), req.user.id);

    // Creator is automatically owner
    db.prepare(
      'INSERT INTO household_members (household_id, user_id, role) VALUES (?, ?, ?)'
    ).run(result.lastInsertRowid, req.user.id, 'owner');

    const household = db.prepare(`
      SELECT h.*, hm.role, 1 AS member_count
      FROM households h
      JOIN household_members hm ON hm.household_id = h.id AND hm.user_id = ?
      WHERE h.id = ?
    `).get(req.user.id, result.lastInsertRowid);

    res.status(201).json(household);
  } catch (err) {
    console.error('[household create error]', err);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/households/:id ───────────────────────────
router.get('/:id', (req, res) => {
  if (!isMember(req.params.id, req.user.id)) {
    return res.status(403).json({ error: 'No perteneces a este hogar' });
  }

  const household = db.prepare('SELECT * FROM households WHERE id = ?').get(req.params.id);
  if (!household) return res.status(404).json({ error: 'Hogar no encontrado' });

  const members = db.prepare(`
    SELECT hm.role, hm.joined_at, u.id, u.name, u.username, u.photo_url
    FROM household_members hm
    JOIN users u ON u.id = hm.user_id
    WHERE hm.household_id = ?
    ORDER BY hm.role DESC, u.name
  `).all(req.params.id);

  res.json({ ...household, members });
});

// ── PUT /api/households/:id ───────────────────────────
router.put('/:id', (req, res) => {
  if (!isOwner(req.params.id, req.user.id)) {
    return res.status(403).json({ error: 'Solo el propietario puede editar el hogar' });
  }
  const { name } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'El nombre es obligatorio' });
  }
  db.prepare('UPDATE households SET name = ? WHERE id = ?').run(name.trim(), req.params.id);
  res.json(db.prepare('SELECT * FROM households WHERE id = ?').get(req.params.id));
});

// ── DELETE /api/households/:id ────────────────────────
router.delete('/:id', (req, res) => {
  if (!isOwner(req.params.id, req.user.id)) {
    return res.status(403).json({ error: 'Solo el propietario puede eliminar el hogar' });
  }
  db.prepare('DELETE FROM households WHERE id = ?').run(req.params.id);
  res.json({ message: 'Hogar eliminado' });
});

// ── POST /api/households/:id/invite ──────────────────
router.post('/:id/invite', (req, res) => {
  if (!isMember(req.params.id, req.user.id)) {
    return res.status(403).json({ error: 'No perteneces a este hogar' });
  }

  const token = crypto.randomBytes(24).toString('hex');
  const expires_at = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 días

  db.prepare(
    'INSERT INTO household_invites (household_id, token, created_by, expires_at) VALUES (?, ?, ?, ?)'
  ).run(req.params.id, token, req.user.id, expires_at);

  res.json({ invite_url: `${APP_URL}/unirse/${token}`, token, expires_at });
});

// ── POST /api/households/join/:token ─────────────────
router.post('/join/:token', (req, res) => {
  try {
    const invite = db.prepare(
      'SELECT * FROM household_invites WHERE token = ? AND used = 0'
    ).get(req.params.token);

    if (!invite) {
      return res.status(400).json({ error: 'El enlace de invitación no es válido o ya fue usado' });
    }
    if (new Date(invite.expires_at) < new Date()) {
      return res.status(400).json({ error: 'El enlace de invitación ha expirado' });
    }
    if (isMember(invite.household_id, req.user.id)) {
      return res.status(400).json({ error: 'Ya eres miembro de este hogar' });
    }

    db.prepare(
      'INSERT INTO household_members (household_id, user_id, role) VALUES (?, ?, ?)'
    ).run(invite.household_id, req.user.id, 'member');

    db.prepare('UPDATE household_invites SET used = 1 WHERE id = ?').run(invite.id);

    const household = db.prepare('SELECT * FROM households WHERE id = ?').get(invite.household_id);
    res.json({ message: `Te has unido a "${household.name}" correctamente`, household });
  } catch (err) {
    console.error('[join error]', err);
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE /api/households/:id/members/:userId ────────
router.delete('/:id/members/:userId', (req, res) => {
  const isSelf = req.params.userId == req.user.id;
  if (!isSelf && !isOwner(req.params.id, req.user.id)) {
    return res.status(403).json({ error: 'No tienes permiso para eliminar miembros' });
  }
  // Owner can't remove themselves
  if (isSelf && isOwner(req.params.id, req.user.id)) {
    return res.status(400).json({ error: 'El propietario no puede abandonar el hogar. Elimínalo o transfiere la propiedad.' });
  }

  db.prepare(
    'DELETE FROM household_members WHERE household_id = ? AND user_id = ?'
  ).run(req.params.id, req.params.userId);

  res.json({ message: 'Miembro eliminado del hogar' });
});

module.exports = router;
