const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const db = require('../db/database');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// Configure multer for photo uploads
const UPLOADS_DIR = process.env.UPLOADS_DIR || path.join(__dirname, '../../uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: UPLOADS_DIR,
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `item-${Date.now()}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Solo se permiten imágenes'));
  },
});

// All routes require auth
router.use(authMiddleware);

// ── ROOMS ──────────────────────────────────────────────

// GET /api/inventory/rooms
router.get('/rooms', (req, res) => {
  const rooms = db.prepare(`
    SELECT r.*, u.name AS created_by_name
    FROM rooms r
    JOIN users u ON u.id = r.created_by
    ORDER BY r.name
  `).all();
  res.json(rooms);
});

// POST /api/inventory/rooms
router.post('/rooms', (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'El nombre de la habitación es obligatorio' });
  }
  const result = db.prepare(
    'INSERT INTO rooms (name, created_by) VALUES (?, ?)'
  ).run(name.trim(), req.user.id);

  const room = db.prepare(`
    SELECT r.*, u.name AS created_by_name
    FROM rooms r JOIN users u ON u.id = r.created_by
    WHERE r.id = ?
  `).get(result.lastInsertRowid);

  res.status(201).json(room);
});

// DELETE /api/inventory/rooms/:id
router.delete('/rooms/:id', (req, res) => {
  const room = db.prepare('SELECT * FROM rooms WHERE id = ?').get(req.params.id);
  if (!room) return res.status(404).json({ error: 'Habitación no encontrada' });

  db.prepare('DELETE FROM rooms WHERE id = ?').run(req.params.id);
  res.json({ message: 'Habitación eliminada' });
});

// ── ITEMS ──────────────────────────────────────────────

// GET /api/inventory/items?search=&room_id=
router.get('/items', (req, res) => {
  const { search, room_id } = req.query;
  let sql = `
    SELECT i.*, r.name AS room_name, u.name AS created_by_name,
           uu.name AS updated_by_name
    FROM items i
    LEFT JOIN rooms r ON r.id = i.room_id
    JOIN users u ON u.id = i.created_by
    LEFT JOIN users uu ON uu.id = i.updated_by
  `;
  const params = [];
  const conditions = [];

  if (search) {
    conditions.push("(i.name LIKE ? OR i.description LIKE ?)");
    params.push(`%${search}%`, `%${search}%`);
  }
  if (room_id) {
    conditions.push("i.room_id = ?");
    params.push(room_id);
  }
  if (conditions.length) sql += ' WHERE ' + conditions.join(' AND ');
  sql += ' ORDER BY i.created_at DESC';

  res.json(db.prepare(sql).all(...params));
});

// POST /api/inventory/items
router.post('/items', upload.single('photo'), (req, res) => {
  const { name, description, room_id } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'El nombre del objeto es obligatorio' });
  }

  const photo_url = req.file ? `/uploads/${req.file.filename}` : null;
  const result = db.prepare(`
    INSERT INTO items (name, description, room_id, photo_url, created_by)
    VALUES (?, ?, ?, ?, ?)
  `).run(name.trim(), description || null, room_id || null, photo_url, req.user.id);

  const item = db.prepare(`
    SELECT i.*, r.name AS room_name, u.name AS created_by_name,
           uu.name AS updated_by_name
    FROM items i
    LEFT JOIN rooms r ON r.id = i.room_id
    JOIN users u ON u.id = i.created_by
    LEFT JOIN users uu ON uu.id = i.updated_by
    WHERE i.id = ?
  `).get(result.lastInsertRowid);

  res.status(201).json(item);
});

// PUT /api/inventory/items/:id
router.put('/items/:id', upload.single('photo'), (req, res) => {
  const item = db.prepare('SELECT * FROM items WHERE id = ?').get(req.params.id);
  if (!item) return res.status(404).json({ error: 'Objeto no encontrado' });

  const { name, description, room_id } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'El nombre del objeto es obligatorio' });
  }

  let photo_url = item.photo_url;
  if (req.file) {
    // Delete old photo if it's a local file
    if (item.photo_url && item.photo_url.startsWith('/uploads/')) {
      const oldPath = path.join(UPLOADS_DIR, path.basename(item.photo_url));
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }
    photo_url = `/uploads/${req.file.filename}`;
  }

  db.prepare(`
    UPDATE items SET name = ?, description = ?, room_id = ?, photo_url = ?,
    updated_by = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(name.trim(), description || null, room_id || null, photo_url, req.user.id, req.params.id);

  const updated = db.prepare(`
    SELECT i.*, r.name AS room_name, u.name AS created_by_name,
           uu.name AS updated_by_name
    FROM items i
    LEFT JOIN rooms r ON r.id = i.room_id
    JOIN users u ON u.id = i.created_by
    LEFT JOIN users uu ON uu.id = i.updated_by
    WHERE i.id = ?
  `).get(req.params.id);

  res.json(updated);
});

// DELETE /api/inventory/items/:id
router.delete('/items/:id', (req, res) => {
  const item = db.prepare('SELECT * FROM items WHERE id = ?').get(req.params.id);
  if (!item) return res.status(404).json({ error: 'Objeto no encontrado' });

  if (item.photo_url && item.photo_url.startsWith('/uploads/')) {
    const filePath = path.join(UPLOADS_DIR, path.basename(item.photo_url));
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }

  db.prepare('DELETE FROM items WHERE id = ?').run(req.params.id);
  res.json({ message: 'Objeto eliminado' });
});

module.exports = router;
