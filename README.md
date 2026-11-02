# LibraNest – Library Management System

Full stack project: **Node.js + Express + SQLite** backend and an HTML/CSS/JavaScript frontend.

## Structure
```
backend/
  server.js          # REST API + serves /frontend
  sql/schema.sqlite.sql # SQLite tables + sample data (applied on startup)
  data/library.db   # created automatically on first run
  .env              # PORT, optional DB_FILE
frontend/
  index.html books.html members.html issued.html profile.html rules.html
  css/style.css
  css/extra.css
  js/config.js       # API_BASE_URL
  js/db.js           # API client
  js/app.js          # UI rendering logic
```

## Database
No setup needed. Requires Node 22.13+ (uses the built-in `node:sqlite`). The database file and sample data are created on first start. Set `DB_FILE` in `.env` to change its location.

## Run
```bash
cd backend
npm install
npm start
```

Open: `http://localhost:3000`

## API
GET `/api/books` | `/api/members` | `/api/issues`  
POST `/api/books`, `/api/members`, `/api/issue`, `/api/return/:id`  
DELETE `/api/books/:id`, `/api/members/:id`
