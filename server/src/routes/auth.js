const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const db = require('../db/database');
const authMiddleware = require('../middleware/auth');

// Multer para fotos de perfil
const UPLOADS_DIR = process.env.UPLOADS_DIR || path.join(__dirname, '../../uploads');
const profileStorage = multer.diskStorage({
  destination: UPLOADS_DIR,
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `profile-${req.user.id}-${Date.now()}${ext}`);
  },
});
const uploadProfile = multer({
  storage: profileStorage,
  limits: { fileSize: 3 * 1024 * 1024 }, // 3 MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Solo se permiten imágenes'));
  },
});

const router = express.Router();

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { name, username, password } = req.body;

    if (!name || !username || !password) {
      return res.status(400).json({ error: 'Nombre, usuario y contraseña son obligatorios' });
    }
    if (username.length < 3) {
      return res.status(400).json({ error: 'El nombre de usuario debe tener al menos 3 caracteres' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
    }

    const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
    if (existing) {
      return res.status(409).json({ error: 'Ese nombre de usuario ya está en uso' });
    }

    const password_hash = await bcrypt.hash(password, 10);
    const result = db.prepare(
      'INSERT INTO users (name, username, password_hash) VALUES (?, ?, ?)'
    ).run(name, username, password_hash);

    const token = jwt.sign(
      { id: result.lastInsertRowid, username, name },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.status(201).json({ token, user: { id: result.lastInsertRowid, name, username } });
  } catch (err) {
    console.error('[register error]', err);
    res.status(500).json({ error: `Error al registrar usuario: ${err.message}` });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Usuario y contraseña son obligatorios' });
    }

    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
    if (!user) {
      return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, name: user.name },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.json({ token, user: { id: user.id, name: user.name, username: user.username } });
  } catch (err) {
    console.error('[login error]', err);
    res.status(500).json({ error: `Error al iniciar sesión: ${err.message}` });
  }
});

// GET /api/auth/me
router.get('/me', authMiddleware, (req, res) => {
  try {
    const user = db.prepare('SELECT id, name, username, photo_url, created_at FROM users WHERE id = ?').get(req.user.id);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json(user);
  } catch (err) {
    console.error('[me error]', err);
    res.status(500).json({ error: `Error al obtener usuario: ${err.message}` });
  }
});

// PUT /api/auth/profile/photo
router.put('/profile/photo', authMiddleware, (req, res) => {
  uploadProfile.single('photo')(req, res, (uploadErr) => {
    if (uploadErr) {
      return res.status(400).json({ error: uploadErr.message });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'No se recibió ninguna imagen' });
    }

    try {
      // Eliminar foto anterior si existe
      const current = db.prepare('SELECT photo_url FROM users WHERE id = ?').get(req.user.id);
      if (current?.photo_url && current.photo_url.startsWith('/uploads/')) {
        const oldPath = path.join(UPLOADS_DIR, path.basename(current.photo_url));
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      }

      const photo_url = `/uploads/${req.file.filename}`;
      db.prepare('UPDATE users SET photo_url = ? WHERE id = ?').run(photo_url, req.user.id);

      const user = db.prepare('SELECT id, name, username, photo_url, created_at FROM users WHERE id = ?').get(req.user.id);
      res.json(user);
    } catch (err) {
      console.error('[profile photo error]', err);
      res.status(500).json({ error: `Error al guardar la foto: ${err.message}` });
    }
  });
});

module.exports = router;
