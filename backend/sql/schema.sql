CREATE DATABASE IF NOT EXISTS library_management;
USE library_management;

DROP TABLE IF EXISTS issues;
DROP TABLE IF EXISTS members;
DROP TABLE IF EXISTS books;

CREATE TABLE books (
	id VARCHAR(10) PRIMARY KEY,
	title VARCHAR(150) NOT NULL,
	author VARCHAR(150) NOT NULL,
	category VARCHAR(50) DEFAULT 'General',
	description VARCHAR(500),
	copies INT NOT NULL DEFAULT 1,
	available INT NOT NULL DEFAULT 1,
	created_at DATE DEFAULT (CURRENT_DATE),
	CONSTRAINT chk_book_copies CHECK (copies >= 1),
	CONSTRAINT chk_book_available CHECK (available >= 0 AND available <= copies)
);

CREATE TABLE members (
	id VARCHAR(10) PRIMARY KEY,
	name VARCHAR(100) NOT NULL,
	department VARCHAR(50) DEFAULT 'General',
	status VARCHAR(20) DEFAULT 'Active',
	created_at DATE DEFAULT (CURRENT_DATE),
	CONSTRAINT chk_member_status CHECK (status IN ('Active', 'Inactive'))
);

CREATE TABLE issues (
	id INT AUTO_INCREMENT PRIMARY KEY,
	book_id VARCHAR(10) NOT NULL,
	member_id VARCHAR(10) NOT NULL,
	issued DATE NOT NULL DEFAULT (CURRENT_DATE),
	due DATE NOT NULL,
	returned TINYINT(1) NOT NULL DEFAULT 0,
	created_at DATE DEFAULT (CURRENT_DATE),
	CONSTRAINT fk_issue_book FOREIGN KEY (book_id) REFERENCES books(id),
	CONSTRAINT fk_issue_member FOREIGN KEY (member_id) REFERENCES members(id),
	CONSTRAINT chk_issue_returned CHECK (returned IN (0,1))
);

INSERT INTO books
(id, title, author, category, description, copies, available)
VALUES
('BK001',
 'Clean Code',
 'Robert C. Martin',
 'Programming',
 'A practical guide to writing clean and maintainable code.',
 3,
 3),
('BK002',
 'Atomic Habits',
 'James Clear',
 'Self Growth',
 'A guide to building good habits and breaking bad ones.',
 4,
 4),
('BK003',
 'Digital Electronics',
 'R. P. Jain',
 'Technology',
 'Fundamentals of digital electronics and logic design.',
 2,
 2),
('BK004',
 'Data Structures and Algorithms',
 'Narasimha Karumanchi',
 'Programming',
 'A comprehensive guide to data structures and algorithms.',
 3,
 3),
('BK005',
 'The Alchemist',
 'Paulo Coelho',
 'Literature',
 'A novel about dreams, destiny and personal growth.',
 2,
 2);

INSERT INTO members
(id, name, department, status)
VALUES
('LM1001', 'Shreya Kumari', 'ECS', 'Active'),
('LM1002', 'Tannu Sharma', 'ECS', 'Active'),
('LM1003', 'Smriti Kumari', 'ECS', 'Active');
