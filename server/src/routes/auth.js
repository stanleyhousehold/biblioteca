const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const multer = require('multer');
const { pool } = require('../db/database');
const authMiddleware = require('../middleware/auth');
const { uploadBuffer, deleteByUrl } = require('../lib/cloudinary');

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

const FROM_EMAIL = process.env.FROM_EMAIL || 'no-reply@stanleylog.app';
const APP_URL = process.env.APP_URL || 'https://stanleylog.app';

// ── Multer para fotos de perfil (memoria → Cloudinary) ─
const uploadProfile = multer({
  storage: multer.memoryStorage(),
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
    if (!email || !email.trim()) {
      return res.status(400).json({ error: 'El email es obligatorio para recuperar la contraseña' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return res.status(400).json({ error: 'El formato del email no es válido' });
    }
    if (username.length < 3) {
      return res.status(400).json({ error: 'El nombre de usuario debe tener al menos 3 caracteres' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
    }

    const { rows: existing } = await pool.query(
      'SELECT id FROM users WHERE username = $1', [username]
    );
    if (existing.length > 0) {
      return res.status(409).json({ error: 'Ese nombre de usuario ya está en uso' });
    }

    const { rows: existingEmail } = await pool.query(
      'SELECT id FROM users WHERE email = $1', [email.trim()]
    );
    if (existingEmail.length > 0) {
      return res.status(409).json({ error: 'Ese email ya está registrado' });
    }

    const password_hash = await bcrypt.hash(password, 10);
    const { rows } = await pool.query(
      'INSERT INTO users (name, username, password_hash, email) VALUES ($1, $2, $3, $4) RETURNING id',
      [name, username, password_hash, email.trim()]
    );
    const userId = rows[0].id;

    const token = jwt.sign(
      { id: userId, username, name },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.status(201).json({ token, user: { id: userId, name, username, email: email.trim() } });
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

    const { rows } = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    const user = rows[0];
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
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, name, username, email, photo_url, created_at FROM users WHERE id = $1',
      [req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json(rows[0]);
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
    await pool.query(
      'UPDATE users SET name = $1, email = $2 WHERE id = $3',
      [name.trim(), email || null, req.user.id]
    );
    const { rows } = await pool.query(
      'SELECT id, name, username, email, photo_url, created_at FROM users WHERE id = $1',
      [req.user.id]
    );
    res.json(rows[0]);
  } catch (err) {
    console.error('[profile update error]', err);
    res.status(500).json({ error: `Error al actualizar perfil: ${err.message}` });
  }
});

// ── PUT /api/auth/profile/photo ───────────────────────
router.put('/profile/photo', authMiddleware, (req, res) => {
  uploadProfile.single('photo')(req, res, async (uploadErr) => {
    if (uploadErr) return res.status(400).json({ error: uploadErr.message });
    if (!req.file) return res.status(400).json({ error: 'No se recibió ninguna imagen' });

    try {
      const { rows: current } = await pool.query(
        'SELECT photo_url FROM users WHERE id = $1', [req.user.id]
      );
      await deleteByUrl(current[0]?.photo_url);

      const result = await uploadBuffer(req.file.buffer, {
        folder: 'biblioteca/profiles',
        public_id: `profile-${req.user.id}`,
        overwrite: true,
        transformation: [{ width: 300, height: 300, crop: 'fill', gravity: 'face' }],
      });

      await pool.query('UPDATE users SET photo_url = $1 WHERE id = $2', [result.secure_url, req.user.id]);

      const { rows } = await pool.query(
        'SELECT id, name, username, email, photo_url, created_at FROM users WHERE id = $1',
        [req.user.id]
      );
      res.json(rows[0]);
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
      return res.status(400).json({ error: 'El nombre de usuario o email es obligatorio' });
    }

    const { rows } = await pool.query(
      'SELECT id, name, email FROM users WHERE username = $1 OR email = $1',
      [username.trim()]
    );
    const user = rows[0];
    // Always return OK to not reveal if user exists
    if (!user || !user.email) {
      return res.json({ message: 'Si el usuario existe y tiene email configurado, recibirás un enlace de recuperación.' });
    }

    await pool.query(
      'UPDATE password_reset_tokens SET used = TRUE WHERE user_id = $1 AND used = FALSE',
      [user.id]
    );

    const token = crypto.randomBytes(32).toString('hex');
    const expires_at = new Date(Date.now() + 60 * 60 * 1000); // 1 hora
    await pool.query(
      'INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)',
      [user.id, token, expires_at]
    );

    const resetUrl = `${APP_URL}/reset-password?token=${token}`;

    if (resend) {
      try {
        const { data, error } = await resend.emails.send({
          from: FROM_EMAIL,
          to: user.email,
          subject: 'Recuperar contraseña — Stanley Log',
          html: `
            <h2>Recuperar contraseña</h2>
            <p>Hola ${user.name},</p>
            <p>Has solicitado restablecer tu contraseña. Haz clic en el enlace de abajo (válido 1 hora):</p>
            <p><a href="${resetUrl}" style="background:#0d9488;color:white;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:bold;">Restablecer contraseña</a></p>
            <p>Si no has solicitado esto, ignora este email.</p>
          `,
        });
        if (error) {
          console.error('[ForgotPassword] Resend error:', error);
        } else {
          console.log(`[ForgotPassword] Email enviado a ${user.email}, id: ${data?.id}`);
        }
      } catch (sendErr) {
        console.error('[ForgotPassword] Error al enviar email:', sendErr.message);
      }
    } else {
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

    const { rows } = await pool.query(
      'SELECT * FROM password_reset_tokens WHERE token = $1 AND used = FALSE',
      [token]
    );
    const record = rows[0];
    if (!record) {
      return res.status(400).json({ error: 'El enlace no es válido o ya fue usado' });
    }
    if (new Date(record.expires_at) < new Date()) {
      return res.status(400).json({ error: 'El enlace ha expirado. Solicita uno nuevo.' });
    }

    const password_hash = await bcrypt.hash(password, 10);
    await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [password_hash, record.user_id]);
    await pool.query('UPDATE password_reset_tokens SET used = TRUE WHERE id = $1', [record.id]);

    res.json({ message: 'Contraseña restablecida correctamente. Ya puedes iniciar sesión.' });
  } catch (err) {
    console.error('[reset-password error]', err);
    res.status(500).json({ error: `Error al restablecer la contraseña: ${err.message}` });
  }
});

module.exports = router;
