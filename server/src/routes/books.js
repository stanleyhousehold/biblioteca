const express = require('express');
const path = require('path');
const fs = require('fs');
const fetch = require('node-fetch');
const multer = require('multer');
const db = require('../db/database');
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

function isMember(householdId, userId) {
  if (!householdId) return true;
  return !!db.prepare(
    'SELECT id FROM household_members WHERE household_id = ? AND user_id = ?'
  ).get(householdId, userId);
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
      // Normalise OL language codes
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
      // Google Books uses BCP-47 language codes
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

router.get('/libraries', (req, res) => {
  const { household_id } = req.query;
  let sql, params;

  if (household_id) {
    if (!isMember(household_id, req.user.id)) {
      return res.status(403).json({ error: 'No perteneces a este hogar' });
    }
    sql = `
      SELECT l.*, u.name AS created_by_name, COUNT(b.id) AS book_count
      FROM libraries l JOIN users u ON u.id = l.created_by
      LEFT JOIN books b ON b.library_id = l.id
      WHERE l.household_id = ?
      GROUP BY l.id ORDER BY l.name
    `;
    params = [household_id];
  } else {
    sql = `
      SELECT l.*, u.name AS created_by_name, COUNT(b.id) AS book_count
      FROM libraries l JOIN users u ON u.id = l.created_by
      LEFT JOIN books b ON b.library_id = l.id
      WHERE l.household_id IS NULL AND l.created_by = ?
      GROUP BY l.id ORDER BY l.name
    `;
    params = [req.user.id];
  }

  res.json(db.prepare(sql).all(...params));
});

router.post('/libraries', (req, res) => {
  const { name, household_id } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'El nombre de la biblioteca es obligatorio' });
  }
  if (household_id && !isMember(household_id, req.user.id)) {
    return res.status(403).json({ error: 'No perteneces a este hogar' });
  }

  const result = db.prepare(
    'INSERT INTO libraries (name, household_id, created_by) VALUES (?, ?, ?)'
  ).run(name.trim(), household_id || null, req.user.id);

  const library = db.prepare(`
    SELECT l.*, u.name AS created_by_name, 0 AS book_count
    FROM libraries l JOIN users u ON u.id = l.created_by WHERE l.id = ?
  `).get(result.lastInsertRowid);

  res.status(201).json(library);
});

router.put('/libraries/:id', (req, res) => {
  const library = db.prepare('SELECT * FROM libraries WHERE id = ?').get(req.params.id);
  if (!library) return res.status(404).json({ error: 'Biblioteca no encontrada' });
  if (!isMember(library.household_id, req.user.id) && library.created_by !== req.user.id) {
    return res.status(403).json({ error: 'Sin permiso' });
  }

  const { name } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'El nombre es obligatorio' });

  db.prepare('UPDATE libraries SET name = ? WHERE id = ?').run(name.trim(), req.params.id);
  const updated = db.prepare(`
    SELECT l.*, u.name AS created_by_name,
      (SELECT COUNT(*) FROM books WHERE library_id = l.id) AS book_count
    FROM libraries l JOIN users u ON u.id = l.created_by WHERE l.id = ?
  `).get(req.params.id);
  res.json(updated);
});

router.delete('/libraries/:id', (req, res) => {
  const library = db.prepare('SELECT * FROM libraries WHERE id = ?').get(req.params.id);
  if (!library) return res.status(404).json({ error: 'Biblioteca no encontrada' });
  db.prepare('DELETE FROM libraries WHERE id = ?').run(req.params.id);
  res.json({ message: 'Biblioteca eliminada' });
});

// ── BOOKS ──────────────────────────────────────────────

const BOOK_SELECT = `
  SELECT b.*, l.name AS library_name, u.name AS created_by_name, uu.name AS updated_by_name
  FROM books b
  LEFT JOIN libraries l ON l.id = b.library_id
  JOIN users u ON u.id = b.created_by
  LEFT JOIN users uu ON uu.id = b.updated_by
`;

router.get('/', (req, res) => {
  const { search, library_id, household_id } = req.query;
  const params = [];
  const conditions = [];

  if (household_id) {
    if (!isMember(household_id, req.user.id)) {
      return res.status(403).json({ error: 'No perteneces a este hogar' });
    }
    conditions.push('b.household_id = ?');
    params.push(household_id);
  } else {
    conditions.push('b.household_id IS NULL AND b.created_by = ?');
    params.push(req.user.id);
  }

  if (search) {
    conditions.push('(b.title LIKE ? OR b.author LIKE ?)');
    params.push(`%${search}%`, `%${search}%`);
  }
  if (library_id) {
    conditions.push('b.library_id = ?');
    params.push(library_id);
  }

  const sql = BOOK_SELECT + ' WHERE ' + conditions.join(' AND ') + ' ORDER BY b.created_at DESC';
  res.json(db.prepare(sql).all(...params));
});

router.post('/', uploadCover.single('cover'), (req, res) => {
  const { isbn, title, author, year, language, cover_url, library_id, household_id } = req.body;
  if (!title || !title.trim()) {
    return res.status(400).json({ error: 'El título del libro es obligatorio' });
  }

  const cover_local = req.file ? `/uploads/${req.file.filename}` : null;

  const result = db.prepare(`
    INSERT INTO books (isbn, title, author, year, language, cover_url, cover_local, library_id, household_id, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    isbn || null, title.trim(), author || null, year || null, language || null,
    cover_url || null, cover_local, library_id || null, household_id || null, req.user.id
  );

  const book = db.prepare(BOOK_SELECT + ' WHERE b.id = ?').get(result.lastInsertRowid);
  res.status(201).json(book);
});

router.put('/:id', uploadCover.single('cover'), (req, res) => {
  const book = db.prepare('SELECT * FROM books WHERE id = ?').get(req.params.id);
  if (!book) return res.status(404).json({ error: 'Libro no encontrado' });

  const { isbn, title, author, year, language, cover_url, library_id } = req.body;
  if (!title || !title.trim()) {
    return res.status(400).json({ error: 'El título del libro es obligatorio' });
  }

  let cover_local = book.cover_local;
  if (req.file) {
    if (book.cover_local && book.cover_local.startsWith('/uploads/')) {
      const oldPath = path.join(UPLOADS_DIR, path.basename(book.cover_local));
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }
    cover_local = `/uploads/${req.file.filename}`;
  }

  db.prepare(`
    UPDATE books SET isbn=?, title=?, author=?, year=?, language=?, cover_url=?, cover_local=?,
    library_id=?, updated_by=?, updated_at=datetime('now') WHERE id=?
  `).run(
    isbn || null, title.trim(), author || null, year || null, language || null,
    cover_url || null, cover_local, library_id || null, req.user.id, req.params.id
  );

  res.json(db.prepare(BOOK_SELECT + ' WHERE b.id = ?').get(req.params.id));
});

router.delete('/:id', (req, res) => {
  const book = db.prepare('SELECT * FROM books WHERE id = ?').get(req.params.id);
  if (!book) return res.status(404).json({ error: 'Libro no encontrado' });

  if (book.cover_local && book.cover_local.startsWith('/uploads/')) {
    const filePath = path.join(UPLOADS_DIR, path.basename(book.cover_local));
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }

  db.prepare('DELETE FROM books WHERE id = ?').run(req.params.id);
  res.json({ message: 'Libro eliminado' });
});

module.exports = router;
