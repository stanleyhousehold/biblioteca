const express = require('express');
const path = require('path');
const fs = require('fs');
const fetch = require('node-fetch');
const multer = require('multer');
const { pool } = require('../db/database');
const authMiddleware = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

const UPLOADS_DIR = process.env.UPLOADS_DIR || path.join(__dirname, '../../uploads');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const coverStorage = multer.diskStorage({
  destination: UPLOADS_DIR,
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `book-cover-${Date.now()}${ext}`);
  },
});
const uploadCover = multer({
  storage: coverStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
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

// ── ISBN LOOKUP (OpenLibrary → Google Books) ───────────

router.get('/isbn/:isbn', async (req, res) => {
  const cleanIsbn = req.params.isbn.replace(/[^0-9X]/gi, '');

  // 1. Open Library
  try {
    const url = `https://openlibrary.org/api/books?bibkeys=ISBN:${cleanIsbn}&format=json&jscmd=data`;
    const response = await fetch(url, { timeout: 8000 });
    const data = await response.json();
    const key = `ISBN:${cleanIsbn}`;

    if (data[key]) {
      const book = data[key];
      const authors = book.authors ? book.authors.map(a => a.name).join(', ') : '';
      const year = book.publish_date ? book.publish_date.match(/\d{4}/)?.[0] || '' : '';
      const cover_url = book.cover ? (book.cover.large || book.cover.medium || book.cover.small) : '';
      const language = book.languages?.[0]?.key?.split('/')?.[2] || '';
      const langMap = { eng: 'Inglés', spa: 'Español', fre: 'Francés', ger: 'Alemán', por: 'Portugués', ita: 'Italiano' };
      return res.json({
        isbn: cleanIsbn, title: book.title || '', author: authors, year, cover_url,
        language: langMap[language] || language,
        source: 'openlibrary',
      });
    }
    console.log(`[ISBN] ${cleanIsbn} no en Open Library, probando Google Books...`);
  } catch (err) {
    console.error('[ISBN] Open Library error:', err.message);
  }

  // 2. Google Books
  try {
    const url = `https://www.googleapis.com/books/v1/volumes?q=isbn:${cleanIsbn}&maxResults=1`;
    const response = await fetch(url, { timeout: 8000 });
    const data = await response.json();

    if (data.items?.length > 0) {
      const info = data.items[0].volumeInfo;
      const authors = info.authors ? info.authors.join(', ') : '';
      const year = info.publishedDate ? info.publishedDate.match(/\d{4}/)?.[0] || '' : '';
      let cover_url = '';
      if (info.imageLinks) {
        const img = info.imageLinks.extraLarge || info.imageLinks.large || info.imageLinks.medium
          || info.imageLinks.small || info.imageLinks.thumbnail || '';
        cover_url = img.replace(/^http:\/\//, 'https://');
      }
      const gbLangMap = { en: 'Inglés', es: 'Español', fr: 'Francés', de: 'Alemán', pt: 'Portugués', it: 'Italiano', ca: 'Catalán' };
      const language = gbLangMap[info.language] || info.language || '';
      return res.json({
        isbn: cleanIsbn, title: info.title || '', author: authors, year, cover_url, language,
        source: 'google',
      });
    }
    console.log(`[ISBN] ${cleanIsbn} no encontrado en Google Books`);
  } catch (err) {
    console.error('[ISBN] Google Books error:', err.message);
  }

  return res.status(404).json({
    error: 'ISBN no encontrado en Open Library ni en Google Books. Rellena los datos manualmente.',
  });
});

// ── LIBRARIES ──────────────────────────────────────────

router.get('/libraries', async (req, res) => {
  try {
    const { household_id } = req.query;
    let sql, params;

    if (household_id) {
      if (!await isMember(household_id, req.user.id)) {
        return res.status(403).json({ error: 'No perteneces a este hogar' });
      }
      sql = `
        SELECT l.*, u.name AS created_by_name, COUNT(b.id) AS book_count
        FROM libraries l JOIN users u ON u.id = l.created_by
        LEFT JOIN books b ON b.library_id = l.id
        WHERE l.household_id = $1
        GROUP BY l.id, u.name ORDER BY l.name
      `;
      params = [household_id];
    } else {
      sql = `
        SELECT l.*, u.name AS created_by_name, COUNT(b.id) AS book_count
        FROM libraries l JOIN users u ON u.id = l.created_by
        LEFT JOIN books b ON b.library_id = l.id
        WHERE l.household_id IS NULL AND l.created_by = $1
        GROUP BY l.id, u.name ORDER BY l.name
      `;
      params = [req.user.id];
    }

    const { rows } = await pool.query(sql, params);
    res.json(rows);
  } catch (err) {
    console.error('[libraries get error]', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/libraries', async (req, res) => {
  try {
    const { name, household_id } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'El nombre de la biblioteca es obligatorio' });
    }
    if (household_id && !await isMember(household_id, req.user.id)) {
      return res.status(403).json({ error: 'No perteneces a este hogar' });
    }

    const { rows: inserted } = await pool.query(
      'INSERT INTO libraries (name, household_id, created_by) VALUES ($1, $2, $3) RETURNING id',
      [name.trim(), household_id || null, req.user.id]
    );

    const { rows } = await pool.query(`
      SELECT l.*, u.name AS created_by_name, 0 AS book_count
      FROM libraries l JOIN users u ON u.id = l.created_by WHERE l.id = $1
    `, [inserted[0].id]);

    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('[library create error]', err);
    res.status(500).json({ error: err.message });
  }
});

router.put('/libraries/:id', async (req, res) => {
  try {
    const { rows: lRows } = await pool.query('SELECT * FROM libraries WHERE id = $1', [req.params.id]);
    const library = lRows[0];
    if (!library) return res.status(404).json({ error: 'Biblioteca no encontrada' });
    if (!await isMember(library.household_id, req.user.id) && library.created_by !== req.user.id) {
      return res.status(403).json({ error: 'Sin permiso' });
    }

    const { name } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'El nombre es obligatorio' });

    await pool.query('UPDATE libraries SET name = $1 WHERE id = $2', [name.trim(), req.params.id]);

    const { rows } = await pool.query(`
      SELECT l.*, u.name AS created_by_name,
        (SELECT COUNT(*) FROM books WHERE library_id = l.id) AS book_count
      FROM libraries l JOIN users u ON u.id = l.created_by WHERE l.id = $1
    `, [req.params.id]);

    res.json(rows[0]);
  } catch (err) {
    console.error('[library update error]', err);
    res.status(500).json({ error: err.message });
  }
});

router.delete('/libraries/:id', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM libraries WHERE id = $1', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Biblioteca no encontrada' });
    await pool.query('DELETE FROM libraries WHERE id = $1', [req.params.id]);
    res.json({ message: 'Biblioteca eliminada' });
  } catch (err) {
    console.error('[library delete error]', err);
    res.status(500).json({ error: err.message });
  }
});

// ── BOOKS ──────────────────────────────────────────────

const BOOK_SELECT = `
  SELECT b.*, l.name AS library_name, u.name AS created_by_name, uu.name AS updated_by_name
  FROM books b
  LEFT JOIN libraries l ON l.id = b.library_id
  JOIN users u ON u.id = b.created_by
  LEFT JOIN users uu ON uu.id = b.updated_by
`;

router.get('/', async (req, res) => {
  try {
    const { search, library_id, household_id } = req.query;
    const params = [];
    const conditions = [];

    if (household_id) {
      if (!await isMember(household_id, req.user.id)) {
        return res.status(403).json({ error: 'No perteneces a este hogar' });
      }
      conditions.push(`b.household_id = $${params.length + 1}`);
      params.push(household_id);
    } else {
      conditions.push(`b.household_id IS NULL AND b.created_by = $${params.length + 1}`);
      params.push(req.user.id);
    }

    if (search) {
      conditions.push(`(b.title ILIKE $${params.length + 1} OR b.author ILIKE $${params.length + 2})`);
      params.push(`%${search}%`, `%${search}%`);
    }
    if (library_id) {
      conditions.push(`b.library_id = $${params.length + 1}`);
      params.push(library_id);
    }

    const sql = BOOK_SELECT + ' WHERE ' + conditions.join(' AND ') + ' ORDER BY b.created_at DESC';
    const { rows } = await pool.query(sql, params);
    res.json(rows);
  } catch (err) {
    console.error('[books get error]', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/', uploadCover.single('cover'), async (req, res) => {
  try {
    const { isbn, title, author, year, language, cover_url, library_id, household_id } = req.body;
    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'El título del libro es obligatorio' });
    }

    const cover_local = req.file ? `/uploads/${req.file.filename}` : null;

    const { rows: inserted } = await pool.query(`
      INSERT INTO books (isbn, title, author, year, language, cover_url, cover_local, library_id, household_id, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id
    `, [isbn || null, title.trim(), author || null, year || null, language || null,
        cover_url || null, cover_local, library_id || null, household_id || null, req.user.id]);

    const { rows } = await pool.query(BOOK_SELECT + ' WHERE b.id = $1', [inserted[0].id]);
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('[book create error]', err);
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', uploadCover.single('cover'), async (req, res) => {
  try {
    const { rows: bRows } = await pool.query('SELECT * FROM books WHERE id = $1', [req.params.id]);
    const book = bRows[0];
    if (!book) return res.status(404).json({ error: 'Libro no encontrado' });

    const { isbn, title, author, year, language, cover_url, library_id } = req.body;
    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'El título del libro es obligatorio' });
    }

    let cover_local = book.cover_local;
    if (req.file) {
      if (book.cover_local?.startsWith('/uploads/')) {
        const oldPath = path.join(UPLOADS_DIR, path.basename(book.cover_local));
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      }
      cover_local = `/uploads/${req.file.filename}`;
    }

    await pool.query(`
      UPDATE books SET isbn=$1, title=$2, author=$3, year=$4, language=$5,
        cover_url=$6, cover_local=$7, library_id=$8, updated_by=$9, updated_at=NOW()
      WHERE id=$10
    `, [isbn || null, title.trim(), author || null, year || null, language || null,
        cover_url || null, cover_local, library_id || null, req.user.id, req.params.id]);

    const { rows } = await pool.query(BOOK_SELECT + ' WHERE b.id = $1', [req.params.id]);
    res.json(rows[0]);
  } catch (err) {
    console.error('[book update error]', err);
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM books WHERE id = $1', [req.params.id]);
    const book = rows[0];
    if (!book) return res.status(404).json({ error: 'Libro no encontrado' });

    if (book.cover_local?.startsWith('/uploads/')) {
      const filePath = path.join(UPLOADS_DIR, path.basename(book.cover_local));
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }

    await pool.query('DELETE FROM books WHERE id = $1', [req.params.id]);
    res.json({ message: 'Libro eliminado' });
  } catch (err) {
    console.error('[book delete error]', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
