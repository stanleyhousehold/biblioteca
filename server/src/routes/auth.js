const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const db = require('../db/database');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// ── Resend (optional — graceful degradation) ──────────
let resend = null;
if (process.env.RESEND_API_KEY) {
  try {
    const { Resend } = require('resend');
    resend = new Resend(process.env.RESEND_API_KEY);
  } catch (e) {
    console.warn('[Auth] Resend no disponible:', e.message);
  }
}

const FROM_EMAIL = process.env.FROM_EMAIL || 'onboarding@resend.dev';
const APP_URL = process.env.APP_URL || 'http://localhost:5173';

// ── Multer para fotos de perfil ───────────────────────
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
  limits: { fileSize: 3 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Solo se permiten imágenes'));
  },
});

// ── POST /api/auth/register ───────────────────────────
router.post('/register', async (req, res) => {
  try {
    const { name, username, password, email } = req.body;
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
      'INSERT INTO users (name, username, password_hash, email) VALUES (?, ?, ?, ?)'
    ).run(name, username, password_hash, email || null);

    const token = jwt.sign(
      { id: result.lastInsertRowid, username, name },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.status(201).json({ token, user: { id: result.lastInsertRowid, name, username, email: email || null } });
  } catch (err) {
    console.error('[register error]', err);
    res.status(500).json({ error: `Error al registrar usuario: ${err.message}` });
  }
});

// ── POST /api/auth/login ──────────────────────────────
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

    res.json({ token, user: { id: user.id, name: user.name, username: user.username, email: user.email, photo_url: user.photo_url } });
  } catch (err) {
    console.error('[login error]', err);
    res.status(500).json({ error: `Error al iniciar sesión: ${err.message}` });
  }
});

// ── GET /api/auth/me ──────────────────────────────────
router.get('/me', authMiddleware, (req, res) => {
  try {
    const user = db.prepare('SELECT id, name, username, email, photo_url, created_at FROM users WHERE id = ?').get(req.user.id);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json(user);
  } catch (err) {
    console.error('[me error]', err);
    res.status(500).json({ error: `Error al obtener usuario: ${err.message}` });
  }
});

// ── PUT /api/auth/profile ─────────────────────────────
router.put('/profile', authMiddleware, async (req, res) => {
  try {
    const { name, email } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'El nombre es obligatorio' });
    }
    db.prepare('UPDATE users SET name = ?, email = ? WHERE id = ?')
      .run(name.trim(), email || null, req.user.id);
    const user = db.prepare('SELECT id, name, username, email, photo_url, created_at FROM users WHERE id = ?').get(req.user.id);
    res.json(user);
  } catch (err) {
    console.error('[profile update error]', err);
    res.status(500).json({ error: `Error al actualizar perfil: ${err.message}` });
  }
});

// ── PUT /api/auth/profile/photo ───────────────────────
router.put('/profile/photo', authMiddleware, (req, res) => {
  uploadProfile.single('photo')(req, res, (uploadErr) => {
    if (uploadErr) return res.status(400).json({ error: uploadErr.message });
    if (!req.file) return res.status(400).json({ error: 'No se recibió ninguna imagen' });

    try {
      const current = db.prepare('SELECT photo_url FROM users WHERE id = ?').get(req.user.id);
      if (current?.photo_url && current.photo_url.startsWith('/uploads/')) {
        const oldPath = path.join(UPLOADS_DIR, path.basename(current.photo_url));
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      }

      const photo_url = `/uploads/${req.file.filename}`;
      db.prepare('UPDATE users SET photo_url = ? WHERE id = ?').run(photo_url, req.user.id);

      const user = db.prepare('SELECT id, name, username, email, photo_url, created_at FROM users WHERE id = ?').get(req.user.id);
      res.json(user);
    } catch (err) {
      console.error('[profile photo error]', err);
      res.status(500).json({ error: `Error al guardar la foto: ${err.message}` });
    }
  });
});

// ── POST /api/auth/forgot-password ───────────────────
router.post('/forgot-password', async (req, res) => {
  try {
    const { username } = req.body;
    if (!username) {
      return res.status(400).json({ error: 'El nombre de usuario es obligatorio' });
    }

    const user = db.prepare('SELECT id, name, email FROM users WHERE username = ?').get(username);
    // Siempre respuesta OK para no revelar si el usuario existe
    if (!user || !user.email) {
      return res.json({ message: 'Si el usuario existe y tiene email configurado, recibirás un enlace de recuperación.' });
    }

    // Invalidar tokens anteriores
    db.prepare('UPDATE password_reset_tokens SET used = 1 WHERE user_id = ? AND used = 0').run(user.id);

    const token = crypto.randomBytes(32).toString('hex');
    const expires_at = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hora
    db.prepare('INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES (?, ?, ?)').run(user.id, token, expires_at);

    const resetUrl = `${APP_URL}/reset-password?token=${token}`;

    if (resend) {
      await resend.emails.send({
        from: FROM_EMAIL,
        to: user.email,
        subject: 'Recuperar contraseña — Biblioteca Familiar',
        html: `
          <h2>Recuperar contraseña</h2>
          <p>Hola ${user.name},</p>
          <p>Has solicitado restablecer tu contraseña. Haz clic en el enlace de abajo (válido 1 hora):</p>
          <p><a href="${resetUrl}" style="background:#0d9488;color:white;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:bold;">Restablecer contraseña</a></p>
          <p>Si no has solicitado esto, ignora este email.</p>
        `,
      });
    } else {
      // Sin Resend configurado: mostrar en consola (útil en desarrollo)
      console.log(`[ForgotPassword] Enlace de recuperación para ${user.email}: ${resetUrl}`);
    }

    res.json({ message: 'Si el usuario existe y tiene email configurado, recibirás un enlace de recuperación.' });
  } catch (err) {
    console.error('[forgot-password error]', err);
    res.status(500).json({ error: `Error al procesar la solicitud: ${err.message}` });
  }
});

// ── POST /api/auth/reset-password ────────────────────
router.post('/reset-password', async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) {
      return res.status(400).json({ error: 'Token y contraseña son obligatorios' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
    }

    const record = db.prepare(
      'SELECT * FROM password_reset_tokens WHERE token = ? AND used = 0'
    ).get(token);

    if (!record) {
      return res.status(400).json({ error: 'El enlace no es válido o ya fue usado' });
    }
    if (new Date(record.expires_at) < new Date()) {
      return res.status(400).json({ error: 'El enlace ha expirado. Solicita uno nuevo.' });
    }

    const password_hash = await bcrypt.hash(password, 10);
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(password_hash, record.user_id);
    db.prepare('UPDATE password_reset_tokens SET used = 1 WHERE id = ?').run(record.id);

    res.json({ message: 'Contraseña restablecida correctamente. Ya puedes iniciar sesión.' });
  } catch (err) {
    console.error('[reset-password error]', err);
    res.status(500).json({ error: `Error al restablecer la contraseña: ${err.message}` });
  }
});

module.exports = router;
