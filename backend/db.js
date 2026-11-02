const fs = require('fs');
const path = require('path');

// Same minimal interface as @libsql/client: execute, executeMultiple, transaction.
function createLocalDb(file) {
  const { DatabaseSync } = require('node:sqlite');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec('PRAGMA foreign_keys = ON');

  const run = ({ sql, args = [] }) => {
    const stmt = db.prepare(sql);
    if (/^\s*(select|with|pragma)\b/i.test(sql)) {
      const objs = stmt.all(...args);
      return { columns: objs[0] ? Object.keys(objs[0]) : [], rows: objs.map((o) => Object.values(o)), rowsAffected: 0 };
    }
    const info = stmt.run(...args);
    return { columns: [], rows: [], rowsAffected: Number(info.changes) };
  };

  // node:sqlite has one connection, so write transactions must not interleave.
  let lock = Promise.resolve();

  return {
    execute: async (stmt) => run(typeof stmt === 'string' ? { sql: stmt } : stmt),
    executeMultiple: async (sql) => { db.exec(sql); },
    transaction: async () => {
      let release;
      const previous = lock;
      lock = new Promise((resolve) => (release = resolve));
      await previous;
      db.exec('BEGIN IMMEDIATE');
      let open = true;
      const finish = (sql) => { if (open) { open = false; db.exec(sql); } };
      return {
        execute: async (stmt) => run(typeof stmt === 'string' ? { sql: stmt } : stmt),
        commit: async () => finish('COMMIT'),
        rollback: async () => finish('ROLLBACK'),
        close: () => { finish('ROLLBACK'); release(); }
      };
    }
  };
}

function createDb() {
  if (process.env.TURSO_DATABASE_URL) {
    // The web client is pure JS (HTTP), so it works on Vercel without native binaries.
    const { createClient } = require('@libsql/client/web');
    return createClient({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN });
  }
  return createLocalDb(process.env.DB_FILE || path.join(__dirname, 'data', 'library.db'));
}

module.exports = { createDb };
