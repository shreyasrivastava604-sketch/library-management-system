# LibraNest – Library Management System

Full stack project: **Node.js + Express + SQLite** backend and an HTML/CSS/JavaScript frontend.

## Structure
```
backend/
  app.js             # Express app and REST API
  server.js          # local entry point (npm start)
  db.js              # Turso (hosted) or local SQLite file
  sql/schema.sqlite.sql # tables + sample data (applied on startup)
  data/library.db   # local database, created on first run
  .env              # PORT, optional DB_FILE (local only)
api/index.js         # Vercel serverless entry
vercel.json          # Vercel config (serves frontend/, routes /api)
frontend/
  index.html books.html members.html issued.html profile.html rules.html
  css/style.css
  css/extra.css
  js/config.js       # API_BASE_URL
  js/db.js           # API client
  js/app.js          # UI rendering logic
```

## Database
Local: no setup needed. Requires Node 22.13+ (uses the built-in `node:sqlite`); the database file and sample data are created on first start. Set `DB_FILE` in `backend/.env` to change its location.

Hosted (Vercel): set `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` in the Vercel project's environment variables. The schema and sample data are created automatically on the first request.

## Run
```bash
npm install
npm start
```

Open: `http://localhost:3000`

## API
GET `/api/books` | `/api/members` | `/api/issues`  
POST `/api/books`, `/api/members`, `/api/issue`, `/api/return/:id`  
DELETE `/api/books/:id`, `/api/members/:id`
