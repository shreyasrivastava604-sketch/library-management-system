const express = require('express');
const { DatabaseSync } = require('node:sqlite');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const port = Number(process.env.PORT || 3000);

const dbFile = process.env.DB_FILE || path.join(__dirname, 'data', 'library.db');
fs.mkdirSync(path.dirname(dbFile), { recursive: true });
const db = new DatabaseSync(dbFile);
db.exec('PRAGMA foreign_keys = ON');
db.exec(fs.readFileSync(path.join(__dirname, 'sql', 'schema.sqlite.sql'), 'utf8'));

const tx = (fn) => {
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
};

const frontendDir = path.join(__dirname, '..', 'frontend');
app.use(express.json());
app.use(express.static(frontendDir));

const asyncRoute = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const badRequest = (message) => {
  const err = new Error(message);
  err.status = 400;
  return err;
};

const nextId = (table, prefix, width) => {
  const row = db.prepare(
    `SELECT COALESCE(MAX(CAST(SUBSTR(id, ?) AS INTEGER)), 0) + 1 AS seq FROM ${table} WHERE id GLOB ?`
  ).get(prefix.length + 1, `${prefix}[0-9]*`);
  return `${prefix}${String(row.seq).padStart(width, '0')}`;
};

app.get('/api/books', asyncRoute(async (_req, res) => {
  res.json(db.prepare(
    'SELECT id, title, author, category, description, copies, available, created_at FROM books ORDER BY id'
  ).all());
}));

app.post('/api/books', asyncRoute(async (req, res) => {
  const { title, author, category, copies } = req.body;
  if (!title || !author) throw badRequest('Title and author are required');

  const totalCopies = Math.max(1, parseInt(copies, 10) || 1);
  const id = tx(() => {
    const newId = nextId('books', 'BK', 3);
    db.prepare(
      `INSERT INTO books (id, title, author, category, description, copies, available)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(newId, title.trim(), author.trim(), (category || 'General').trim(), 'Added to the library collection.', totalCopies, totalCopies);
    return newId;
  });

  res.status(201).json({ id, message: 'Book added' });
}));

app.delete('/api/books/:id', asyncRoute(async (req, res) => {
  const result = db.prepare('DELETE FROM books WHERE id = ?').run(req.params.id);
  if (result.changes === 0) throw badRequest('Book not found');
  res.json({ message: 'Book deleted' });
}));

app.get('/api/members', asyncRoute(async (_req, res) => {
  res.json(db.prepare('SELECT id, name, department, status, created_at FROM members ORDER BY id').all());
}));

app.post('/api/members', asyncRoute(async (req, res) => {
  const { name, department } = req.body;
  if (!name) throw badRequest('Name is required');

  const id = tx(() => {
    const newId = nextId('members', 'LM', 4);
    db.prepare('INSERT INTO members (id, name, department, status) VALUES (?, ?, ?, ?)')
      .run(newId, name.trim(), (department || 'General').trim(), 'Active');
    return newId;
  });

  res.status(201).json({ id, message: 'Member added' });
}));

app.delete('/api/members/:id', asyncRoute(async (req, res) => {
  const result = db.prepare('DELETE FROM members WHERE id = ?').run(req.params.id);
  if (result.changes === 0) throw badRequest('Member not found');
  res.json({ message: 'Member deleted' });
}));

app.get('/api/issues', asyncRoute(async (_req, res) => {
  res.json(db.prepare(
    `SELECT i.id,
            i.book_id AS bookId,
            b.title AS bookTitle,
            i.member_id AS memberId,
            m.name AS memberName,
            i.issued AS issued,
            i.due AS due,
            i.returned AS returned
     FROM issues i
     JOIN books b ON b.id = i.book_id
     JOIN members m ON m.id = i.member_id
     ORDER BY i.id`
  ).all());
}));

app.post('/api/issue', asyncRoute(async (req, res) => {
  const { bookId, memberId } = req.body;
  if (!bookId || !memberId) throw badRequest('Book and member are required');

  tx(() => {
    const book = db.prepare('SELECT id, available FROM books WHERE id = ?').get(bookId);
    if (!book) throw badRequest('Book not found');
    if (book.available <= 0) throw badRequest('No available copies for this book');

    const member = db.prepare('SELECT id, status FROM members WHERE id = ?').get(memberId);
    if (!member) throw badRequest('Member not found');
    if (member.status !== 'Active') throw badRequest('Member is inactive');

    db.prepare("INSERT INTO issues (book_id, member_id, due, returned) VALUES (?, ?, date('now', '+14 days'), 0)")
      .run(bookId, memberId);
    db.prepare('UPDATE books SET available = available - 1 WHERE id = ?').run(bookId);
  });

  res.status(201).json({ message: 'Book issued' });
}));

app.post('/api/return/:id', asyncRoute(async (req, res) => {
  const issueId = Number(req.params.id);
  if (!Number.isInteger(issueId) || issueId <= 0) throw badRequest('Invalid issue id');

  tx(() => {
    const issue = db.prepare('SELECT id, book_id, returned FROM issues WHERE id = ?').get(issueId);
    if (!issue) throw badRequest('Issue record not found');
    if (issue.returned === 1) throw badRequest('Book is already returned');

    db.prepare('UPDATE issues SET returned = 1 WHERE id = ?').run(issueId);
    db.prepare('UPDATE books SET available = available + 1 WHERE id = ?').run(issue.book_id);
  });

  res.json({ message: 'Book returned' });
}));

app.get('/', (_req, res) => {
  res.sendFile(path.join(frontendDir, 'index.html'));
});

app.use((err, _req, res, _next) => {
  if (err && /FOREIGN KEY constraint failed/i.test(err.message || '')) {
    return res.status(400).json({ message: 'Cannot delete: this record has issue history' });
  }

  const status = err.status || 500;
  if (status >= 500) console.error(err);
  const message = status >= 500 ? 'Internal server error' : err.message;
  return res.status(status).json({ message });
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
