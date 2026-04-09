const express = require('express');
const db = require('../db/database');
const authMiddleware = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

// ── GET /api/export?household_id= ────────────────────
router.get('/', (req, res) => {
  try {
    const { household_id } = req.query;
    const userId = req.user.id;

    let rooms, items, libraries, books;

    if (household_id) {
      const isMember = db.prepare(
        'SELECT id FROM household_members WHERE household_id = ? AND user_id = ?'
      ).get(household_id, userId);
      if (!isMember) return res.status(403).json({ error: 'No perteneces a este hogar' });

      rooms = db.prepare('SELECT * FROM rooms WHERE household_id = ?').all(household_id);
      items = db.prepare('SELECT * FROM items WHERE household_id = ?').all(household_id);
      libraries = db.prepare('SELECT * FROM libraries WHERE household_id = ?').all(household_id);
      books = db.prepare('SELECT * FROM books WHERE household_id = ?').all(household_id);
    } else {
      rooms = db.prepare('SELECT * FROM rooms WHERE household_id IS NULL AND created_by = ?').all(userId);
      items = db.prepare('SELECT * FROM items WHERE household_id IS NULL AND created_by = ?').all(userId);
      libraries = db.prepare('SELECT * FROM libraries WHERE household_id IS NULL AND created_by = ?').all(userId);
      books = db.prepare('SELECT * FROM books WHERE household_id IS NULL AND created_by = ?').all(userId);
    }

    const payload = {
      exported_at: new Date().toISOString(),
      exported_by: req.user.username,
      household_id: household_id || null,
      rooms,
      items,
      libraries,
      books,
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="biblioteca-export-${Date.now()}.json"`);
    res.json(payload);
  } catch (err) {
    console.error('[export error]', err);
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/export/import ───────────────────────────
router.post('/import', (req, res) => {
  try {
    const { rooms = [], items = [], libraries = [], books = [], household_id } = req.body;
    const userId = req.user.id;

    if (household_id) {
      const isMember = db.prepare(
        'SELECT id FROM household_members WHERE household_id = ? AND user_id = ?'
      ).get(household_id, userId);
      if (!isMember) return res.status(403).json({ error: 'No perteneces a este hogar' });
    }

    const stats = { rooms: 0, items: 0, libraries: 0, books: 0 };

    // ID mapping (old ID → new ID) to preserve room/library references
    const roomIdMap = {};
    const libraryIdMap = {};

    db.transaction(() => {
      for (const r of rooms) {
        const result = db.prepare(
          'INSERT INTO rooms (name, household_id, created_by) VALUES (?, ?, ?)'
        ).run(r.name, household_id || null, userId);
        roomIdMap[r.id] = result.lastInsertRowid;
        stats.rooms++;
      }

      for (const i of items) {
        db.prepare(`
          INSERT INTO items (name, description, room_id, household_id, photo_url, created_by)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(
          i.name, i.description || null,
          i.room_id ? (roomIdMap[i.room_id] || null) : null,
          household_id || null,
          i.photo_url || null,
          userId
        );
        stats.items++;
      }

      for (const l of libraries) {
        const result = db.prepare(
          'INSERT INTO libraries (name, household_id, created_by) VALUES (?, ?, ?)'
        ).run(l.name, household_id || null, userId);
        libraryIdMap[l.id] = result.lastInsertRowid;
        stats.libraries++;
      }

      for (const b of books) {
        db.prepare(`
          INSERT INTO books (isbn, title, author, year, language, cover_url, library_id, household_id, created_by)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          b.isbn || null, b.title, b.author || null, b.year || null, b.language || null,
          b.cover_url || null,
          b.library_id ? (libraryIdMap[b.library_id] || null) : null,
          household_id || null,
          userId
        );
        stats.books++;
      }
    })();

    res.json({ message: 'Importación completada', stats });
  } catch (err) {
    console.error('[import error]', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
