require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

// ── Startup validation ────────────────────────────────
if (!process.env.JWT_SECRET) {
  console.error('FATAL: La variable de entorno JWT_SECRET no está definida. El servidor no puede arrancar.');
  process.exit(1);
}

const authRoutes = require('./routes/auth');
const inventoryRoutes = require('./routes/inventory');
const bookRoutes = require('./routes/books');

const app = express();
const PORT = process.env.PORT || 3001;
const IS_PROD = process.env.NODE_ENV === 'production';

// ── Middleware ────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

if (!IS_PROD) {
  app.use(cors({ origin: 'http://localhost:5173', credentials: true }));
} else {
  app.use(cors());
}

// Serve uploaded files
const UPLOADS_DIR = process.env.UPLOADS_DIR || path.join(__dirname, '../uploads');
app.use('/uploads', express.static(UPLOADS_DIR));

// ── Health check (BEFORE SPA catch-all) ──────────────
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// ── API Routes ────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/books', bookRoutes);

// ── Serve React frontend in production ────────────────
if (IS_PROD) {
  const distPath = path.join(__dirname, '../../client/dist');
  app.use(express.static(distPath));
  // Catch-all MUST come last so it doesn't swallow API routes
  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

// ── Global error handler ──────────────────────────────
app.use((err, req, res, _next) => {
  console.error('[Error no capturado]', err);
  res.status(500).json({ error: 'Error interno del servidor' });
});

app.listen(PORT, () => {
  console.log(`Servidor iniciado en puerto ${PORT} [${IS_PROD ? 'producción' : 'desarrollo'}]`);
  console.log(`JWT_SECRET: ${process.env.JWT_SECRET ? 'configurado ✓' : 'NO CONFIGURADO ✗'}`);
});

// ── Uncaught exception safety net ────────────────────
process.on('uncaughtException', (err) => {
  console.error('[uncaughtException]', err);
});
process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection]', reason);
});
