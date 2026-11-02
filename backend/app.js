const express = require('express');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '.env') });

const { createDb } = require('./db');

const app = express();
const frontendDir = path.join(__dirname, '..', 'frontend');

// Turso in production; a local SQLite file when TURSO_DATABASE_URL is unset.
const db = createDb();

const schema = fs.readFileSync(path.join(__dirname, 'sql', 'schema.sqlite.sql'), 'utf8');
let ready;
const init = () => (ready ||= db.executeMultiple(schema).catch((err) => { ready = undefined; throw err; }));

const toObjects = (rs) => rs.rows.map((row) => Object.fromEntries(rs.columns.map((c, i) => [c, row[i]])));
const query = async (sql, args = []) => toObjects(await db.execute({ sql, args }));

const withTx = async (fn) => {
  const t = await db.transaction('write');
  try {
    const result = await fn(t);
    await t.commit();
    return result;
  } catch (err) {
    await t.rollback();
    throw err;
  } finally {
    t.close();
  }
};
const txQuery = async (t, sql, args = []) => toObjects(await t.execute({ sql, args }));

app.use(express.json());
app.use(async (_req, _res, next) => {
  try { await init(); next(); } catch (err) { next(err); }
});
app.use(express.static(frontendDir));

const asyncRoute = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const badRequest = (message) => {
  const err = new Error(message);
  err.status = 400;
  return err;
};

const nextId = async (t, table, prefix, width) => {
  const [row] = await txQuery(
    t,
    `SELECT COALESCE(MAX(CAST(SUBSTR(id, ?) AS INTEGER)), 0) + 1 AS seq FROM ${table} WHERE id GLOB ?`,
    [prefix.length + 1, `${prefix}[0-9]*`]
  );
  return `${prefix}${String(row.seq).padStart(width, '0')}`;
};

app.get('/api/books', asyncRoute(async (_req, res) => {
  res.json(await query(
    'SELECT id, title, author, category, description, copies, available, created_at FROM books ORDER BY id'
  ));
}));

app.post('/api/books', asyncRoute(async (req, res) => {
  const { title, author, category, copies } = req.body;
  if (!title || !author) throw badRequest('Title and author are required');

  const totalCopies = Math.max(1, parseInt(copies, 10) || 1);
  const id = await withTx(async (t) => {
    const newId = await nextId(t, 'books', 'BK', 3);
    await t.execute({
      sql: `INSERT INTO books (id, title, author, category, description, copies, available)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [newId, title.trim(), author.trim(), (category || 'General').trim(), 'Added to the library collection.', totalCopies, totalCopies]
    });
    return newId;
  });

  res.status(201).json({ id, message: 'Book added' });
}));

app.delete('/api/books/:id', asyncRoute(async (req, res) => {
  const [used] = await query('SELECT 1 AS x FROM issues WHERE book_id = ? LIMIT 1', [req.params.id]);
  if (used) throw badRequest('Cannot delete: this record has issue history');

  const result = await db.execute({ sql: 'DELETE FROM books WHERE id = ?', args: [req.params.id] });
  if (result.rowsAffected === 0) throw badRequest('Book not found');
  res.json({ message: 'Book deleted' });
}));

app.get('/api/members', asyncRoute(async (_req, res) => {
  res.json(await query('SELECT id, name, department, status, created_at FROM members ORDER BY id'));
}));

app.post('/api/members', asyncRoute(async (req, res) => {
  const { name, department } = req.body;
  if (!name) throw badRequest('Name is required');

  const id = await withTx(async (t) => {
    const newId = await nextId(t, 'members', 'LM', 4);
    await t.execute({
      sql: 'INSERT INTO members (id, name, department, status) VALUES (?, ?, ?, ?)',
      args: [newId, name.trim(), (department || 'General').trim(), 'Active']
    });
    return newId;
  });

  res.status(201).json({ id, message: 'Member added' });
}));

app.delete('/api/members/:id', asyncRoute(async (req, res) => {
  const [used] = await query('SELECT 1 AS x FROM issues WHERE member_id = ? LIMIT 1', [req.params.id]);
  if (used) throw badRequest('Cannot delete: this record has issue history');

  const result = await db.execute({ sql: 'DELETE FROM members WHERE id = ?', args: [req.params.id] });
  if (result.rowsAffected === 0) throw badRequest('Member not found');
  res.json({ message: 'Member deleted' });
}));

app.get('/api/issues', asyncRoute(async (_req, res) => {
  res.json(await query(
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
  ));
}));

app.post('/api/issue', asyncRoute(async (req, res) => {
  const { bookId, memberId } = req.body;
  if (!bookId || !memberId) throw badRequest('Book and member are required');

  await withTx(async (t) => {
    const [book] = await txQuery(t, 'SELECT id, available FROM books WHERE id = ?', [bookId]);
    if (!book) throw badRequest('Book not found');
    if (book.available <= 0) throw badRequest('No available copies for this book');

    const [member] = await txQuery(t, 'SELECT id, status FROM members WHERE id = ?', [memberId]);
    if (!member) throw badRequest('Member not found');
    if (member.status !== 'Active') throw badRequest('Member is inactive');

    await t.execute({
      sql: "INSERT INTO issues (book_id, member_id, due, returned) VALUES (?, ?, date('now', '+14 days'), 0)",
      args: [bookId, memberId]
    });
    await t.execute({ sql: 'UPDATE books SET available = available - 1 WHERE id = ?', args: [bookId] });
  });

  res.status(201).json({ message: 'Book issued' });
}));

app.post('/api/return/:id', asyncRoute(async (req, res) => {
  const issueId = Number(req.params.id);
  if (!Number.isInteger(issueId) || issueId <= 0) throw badRequest('Invalid issue id');

  await withTx(async (t) => {
    const [issue] = await txQuery(t, 'SELECT id, book_id, returned FROM issues WHERE id = ?', [issueId]);
    if (!issue) throw badRequest('Issue record not found');
    if (issue.returned === 1) throw badRequest('Book is already returned');

    await t.execute({ sql: 'UPDATE issues SET returned = 1 WHERE id = ?', args: [issueId] });
    await t.execute({ sql: 'UPDATE books SET available = available + 1 WHERE id = ?', args: [issue.book_id] });
  });

  res.json({ message: 'Book returned' });
}));

app.get('/', (_req, res) => {
  res.sendFile(path.join(frontendDir, 'index.html'));
});

app.use((err, _req, res, _next) => {
  const status = err.status || 500;
  if (status >= 500) console.error(err);
  const message = status >= 500 ? 'Internal server error' : err.message;
  return res.status(status).json({ message });
});

module.exports = app;
