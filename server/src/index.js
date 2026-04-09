require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { initDB } = require('./db/database');

if (!process.env.JWT_SECRET) {
  console.error('FATAL: La variable de entorno JWT_SECRET no está definida.');
  process.exit(1);
}

const authRoutes = require('./routes/auth');
const inventoryRoutes = require('./routes/inventory');
const bookRoutes = require('./routes/books');
const householdRoutes = require('./routes/households');
const exportRoutes = require('./routes/export');

const app = express();
const PORT = process.env.PORT || 3001;
const IS_PROD = process.env.NODE_ENV === 'production';

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

if (!IS_PROD) {
  app.use(cors({ origin: 'http://localhost:5173', credentials: true }));
} else {
  app.use(cors());
}

const UPLOADS_DIR = process.env.UPLOADS_DIR || path.join(__dirname, '../uploads');
app.use('/uploads', express.static(UPLOADS_DIR));

// ── Health check (before SPA catch-all) ──────────────
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// ── API Routes ────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/books', bookRoutes);
app.use('/api/households', householdRoutes);
app.use('/api/export', exportRoutes);

// ── React frontend (production) ───────────────────────
if (IS_PROD) {
  const distPath = path.join(__dirname, '../../client/dist');
  app.use(express.static(distPath));
  app.get('*', (req, res) => res.sendFile(path.join(distPath, 'index.html')));
}

// ── Global error handler ──────────────────────────────
app.use((err, req, res, _next) => {
  console.error('[Error no capturado]', err);
  res.status(500).json({ error: 'Error interno del servidor' });
});

process.on('uncaughtException', err => console.error('[uncaughtException]', err));
process.on('unhandledRejection', reason => console.error('[unhandledRejection]', reason));

// ── Iniciar servidor tras conectar a la BD ────────────
initDB()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Servidor en puerto ${PORT} [${IS_PROD ? 'producción' : 'desarrollo'}]`);
      console.log(`JWT_SECRET: ${process.env.JWT_SECRET ? 'configurado ✓' : 'NO CONFIGURADO ✗'}`);
      console.log(`Resend: ${process.env.RESEND_API_KEY ? 'configurado ✓' : 'no configurado (emails desactivados)'}`);
      const cloudinaryOk = process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET;
      console.log(`Cloudinary: ${cloudinaryOk ? 'configurado ✓' : 'NO CONFIGURADO ✗ — las subidas de imágenes fallarán'}`);
    });
  })
  .catch(err => {
    console.error('[FATAL] Error al inicializar la base de datos:', err.message);
    process.exit(1);
  });
