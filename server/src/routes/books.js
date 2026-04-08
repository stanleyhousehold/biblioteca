const express = require('express');
const fetch = require('node-fetch');
const db = require('../db/database');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

router.use(authMiddleware);

// ── ISBN LOOKUP (OpenLibrary → Google Books) ───────────

// GET /api/books/isbn/:isbn
router.get('/isbn/:isbn', async (req, res) => {
  const { isbn } = req.params;
  const cleanIsbn = isbn.replace(/[^0-9X]/gi, '');

  // 1. Intentar Open Library
  try {
    const url = `https://openlibrary.org/api/books?bibkeys=ISBN:${cleanIsbn}&format=json&jscmd=data`;
    const response = await fetch(url, { timeout: 8000 });
    const data = await response.json();
    const key = `ISBN:${cleanIsbn}`;

    if (data[key]) {
      const book = data[key];
      const authors = book.authors ? book.authors.map(a => a.name).join(', ') : '';
      const year = book.publish_date ? book.publish_date.match(/\d{4}/)?.[0] || '' : '';
      const cover_url = book.cover
        ? (book.cover.large || book.cover.medium || book.cover.small)
        : '';

      return res.json({
        isbn: cleanIsbn,
        title: book.title || '',
        author: authors,
        year,
        cover_url,
        source: 'openlibrary',
      });
    }
    console.log(`[ISBN] ${cleanIsbn} no encontrado en Open Library, probando Google Books...`);
  } catch (err) {
    console.error('[ISBN] Open Library error:', err.message);
  }

  // 2. Fallback: Google Books
  try {
    const url = `https://www.googleapis.com/books/v1/volumes?q=isbn:${cleanIsbn}&maxResults=1`;
    const response = await fetch(url, { timeout: 8000 });
    const data = await response.json();

    if (data.items && data.items.length > 0) {
      const info = data.items[0].volumeInfo;
      const authors = info.authors ? info.authors.join(', ') : '';
      const year = info.publishedDate ? info.publishedDate.match(/\d{4}/)?.[0] || '' : '';
      let cover_url = '';
      if (info.imageLinks) {
        const img = info.imageLinks.extraLarge
          || info.imageLinks.large
          || info.imageLinks.medium
          || info.imageLinks.small
          || info.imageLinks.thumbnail
          || '';
        // Google Books devuelve URLs http://, las convertimos a https://
        cover_url = img.replace(/^http:\/\//, 'https://');
      }

      return res.json({
        isbn: cleanIsbn,
        title: info.title || '',
        author: authors,
        year,
        cover_url,
        source: 'google',
      });
    }
    console.log(`[ISBN] ${cleanIsbn} no encontrado en Google Books`);
  } catch (err) {
    console.error('[ISBN] Google Books error:', err.message);
  }

  // 3. No encontrado en ninguna API
  return res.status(404).json({
    error: 'ISBN no encontrado en Open Library ni en Google Books. Rellena los datos manualmente.',
  });
});

// ── LIBRARIES ──────────────────────────────────────────

// GET /api/books/libraries
router.get('/libraries', (req, res) => {
  const libraries = db.prepare(`
    SELECT l.*, u.name AS created_by_name,
           COUNT(b.id) AS book_count
    FROM libraries l
    JOIN users u ON u.id = l.created_by
    LEFT JOIN books b ON b.library_id = l.id
    GROUP BY l.id
    ORDER BY l.name
  `).all();
  res.json(libraries);
});

// POST /api/books/libraries
router.post('/libraries', (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'El nombre de la biblioteca es obligatorio' });
  }

  const result = db.prepare(
    'INSERT INTO libraries (name, created_by) VALUES (?, ?)'
  ).run(name.trim(), req.user.id);

  const library = db.prepare(`
    SELECT l.*, u.name AS created_by_name, 0 AS book_count
    FROM libraries l JOIN users u ON u.id = l.created_by
    WHERE l.id = ?
  `).get(result.lastInsertRowid);

  res.status(201).json(library);
});

// DELETE /api/books/libraries/:id
router.delete('/libraries/:id', (req, res) => {
  const library = db.prepare('SELECT * FROM libraries WHERE id = ?').get(req.params.id);
  if (!library) return res.status(404).json({ error: 'Biblioteca no encontrada' });

  db.prepare('DELETE FROM libraries WHERE id = ?').run(req.params.id);
  res.json({ message: 'Biblioteca eliminada' });
});

// ── BOOKS ──────────────────────────────────────────────

// GET /api/books?search=&library_id=
router.get('/', (req, res) => {
  const { search, library_id } = req.query;
  let sql = `
    SELECT b.*, l.name AS library_name, u.name AS created_by_name,
           uu.name AS updated_by_name
    FROM books b
    LEFT JOIN libraries l ON l.id = b.library_id
    JOIN users u ON u.id = b.created_by
    LEFT JOIN users uu ON uu.id = b.updated_by
  `;
  const params = [];
  const conditions = [];

  if (search) {
    conditions.push("(b.title LIKE ? OR b.author LIKE ?)");
    params.push(`%${search}%`, `%${search}%`);
  }
  if (library_id) {
    conditions.push("b.library_id = ?");
    params.push(library_id);
  }
  if (conditions.length) sql += ' WHERE ' + conditions.join(' AND ');
  sql += ' ORDER BY b.created_at DESC';

  res.json(db.prepare(sql).all(...params));
});

// POST /api/books
router.post('/', (req, res) => {
  const { isbn, title, author, year, cover_url, library_id } = req.body;
  if (!title || !title.trim()) {
    return res.status(400).json({ error: 'El título del libro es obligatorio' });
  }

  const result = db.prepare(`
    INSERT INTO books (isbn, title, author, year, cover_url, library_id, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    isbn || null, title.trim(), author || null,
    year || null, cover_url || null, library_id || null, req.user.id
  );

  const book = db.prepare(`
    SELECT b.*, l.name AS library_name, u.name AS created_by_name,
           uu.name AS updated_by_name
    FROM books b
    LEFT JOIN libraries l ON l.id = b.library_id
    JOIN users u ON u.id = b.created_by
    LEFT JOIN users uu ON uu.id = b.updated_by
    WHERE b.id = ?
  `).get(result.lastInsertRowid);

  res.status(201).json(book);
});

// PUT /api/books/:id
router.put('/:id', (req, res) => {
  const book = db.prepare('SELECT * FROM books WHERE id = ?').get(req.params.id);
  if (!book) return res.status(404).json({ error: 'Libro no encontrado' });

  const { isbn, title, author, year, cover_url, library_id } = req.body;
  if (!title || !title.trim()) {
    return res.status(400).json({ error: 'El título del libro es obligatorio' });
  }

  db.prepare(`
    UPDATE books SET isbn = ?, title = ?, author = ?, year = ?, cover_url = ?,
    library_id = ?, updated_by = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(
    isbn || null, title.trim(), author || null,
    year || null, cover_url || null, library_id || null,
    req.user.id, req.params.id
  );

  const updated = db.prepare(`
    SELECT b.*, l.name AS library_name, u.name AS created_by_name,
           uu.name AS updated_by_name
    FROM books b
    LEFT JOIN libraries l ON l.id = b.library_id
    JOIN users u ON u.id = b.created_by
    LEFT JOIN users uu ON uu.id = b.updated_by
    WHERE b.id = ?
  `).get(req.params.id);

  res.json(updated);
});

// DELETE /api/books/:id
router.delete('/:id', (req, res) => {
  const book = db.prepare('SELECT * FROM books WHERE id = ?').get(req.params.id);
  if (!book) return res.status(404).json({ error: 'Libro no encontrado' });

  db.prepare('DELETE FROM books WHERE id = ?').run(req.params.id);
  res.json({ message: 'Libro eliminado' });
});

module.exports = router;
