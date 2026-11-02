CREATE TABLE IF NOT EXISTS books (
	id TEXT PRIMARY KEY,
	title TEXT NOT NULL,
	author TEXT NOT NULL,
	category TEXT DEFAULT 'General',
	description TEXT,
	copies INTEGER NOT NULL DEFAULT 1,
	available INTEGER NOT NULL DEFAULT 1,
	created_at TEXT DEFAULT (date('now')),
	CONSTRAINT chk_book_copies CHECK (copies >= 1),
	CONSTRAINT chk_book_available CHECK (available >= 0 AND available <= copies)
);

CREATE TABLE IF NOT EXISTS members (
	id TEXT PRIMARY KEY,
	name TEXT NOT NULL,
	department TEXT DEFAULT 'General',
	status TEXT DEFAULT 'Active',
	created_at TEXT DEFAULT (date('now')),
	CONSTRAINT chk_member_status CHECK (status IN ('Active', 'Inactive'))
);

CREATE TABLE IF NOT EXISTS issues (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	book_id TEXT NOT NULL REFERENCES books(id),
	member_id TEXT NOT NULL REFERENCES members(id),
	issued TEXT NOT NULL DEFAULT (date('now')),
	due TEXT NOT NULL,
	returned INTEGER NOT NULL DEFAULT 0,
	created_at TEXT DEFAULT (date('now')),
	CONSTRAINT chk_issue_returned CHECK (returned IN (0, 1))
);

INSERT OR IGNORE INTO books (id, title, author, category, description, copies, available) VALUES
('BK001', 'Clean Code', 'Robert C. Martin', 'Programming', 'A practical guide to writing clean and maintainable code.', 3, 3),
('BK002', 'Atomic Habits', 'James Clear', 'Self Growth', 'A guide to building good habits and breaking bad ones.', 4, 4),
('BK003', 'Digital Electronics', 'R. P. Jain', 'Technology', 'Fundamentals of digital electronics and logic design.', 2, 2),
('BK004', 'Data Structures and Algorithms', 'Narasimha Karumanchi', 'Programming', 'A comprehensive guide to data structures and algorithms.', 3, 3),
('BK005', 'The Alchemist', 'Paulo Coelho', 'Literature', 'A novel about dreams, destiny and personal growth.', 2, 2);

INSERT OR IGNORE INTO members (id, name, department, status) VALUES
('LM1001', 'Shreya Kumari', 'ECS', 'Active'),
('LM1002', 'Tannu Sharma', 'ECS', 'Active'),
('LM1003', 'Smriti Kumari', 'ECS', 'Active');
