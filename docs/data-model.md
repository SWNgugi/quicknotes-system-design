# QuickNotes Data Model

This is the database design for the real QuickNotes service. It has four tables: `users`, `notes`, `tags` and `note_tags`. The SQL uses SQLite-compatible syntax, so it can be tested in an SQLite playground.

## Entities

### users

One row per registered user.

| Column        | Type    | Key / rules                               |
| ------------- | ------- | ----------------------------------------- |
| user_id       | INTEGER | Primary key                               |
| name          | TEXT    | NOT NULL                                  |
| email         | TEXT    | NOT NULL, UNIQUE                          |
| password_hash | TEXT    | NOT NULL (never store the plain password) |
| created_at    | TEXT    | NOT NULL, defaults to the current time    |

### notes

One row per note. Each note belongs to one user.

| Column     | Type    | Key / rules                             |
| ---------- | ------- | --------------------------------------- |
| note_id    | INTEGER | Primary key                             |
| user_id    | INTEGER | Foreign key to users(user_id), NOT NULL |
| title      | TEXT    | NOT NULL, 1 to 100 characters           |
| body       | TEXT    | Optional                                |
| created_at | TEXT    | NOT NULL, defaults to the current time  |
| updated_at | TEXT    | NOT NULL, defaults to the current time  |

### tags

One row per tag name a user has created, such as "work" or "study".

| Column  | Type    | Key / rules                             |
| ------- | ------- | --------------------------------------- |
| tag_id  | INTEGER | Primary key                             |
| user_id | INTEGER | Foreign key to users(user_id), NOT NULL |
| name    | TEXT    | NOT NULL, unique for each user          |

### note_tags

The join table that links notes to tags.

| Column  | Type    | Key / rules                                            |
| ------- | ------- | ------------------------------------------------------ |
| note_id | INTEGER | Foreign key to notes(note_id), part of the primary key |
| tag_id  | INTEGER | Foreign key to tags(tag_id), part of the primary key   |

The primary key is the pair (`note_id`, `tag_id`), so the same tag cannot be attached to the same note twice.

## Relationships

- **users to notes: one-to-many.** One user can have many notes, but each note belongs to exactly one user.
- **users to tags: one-to-many.** One user can create many tags, and each tag belongs to one user.
- **notes to tags: many-to-many.** A note can have several tags (for example "work" and "urgent"), and a tag can be used on many notes. A relational table cannot store a list of ids in one column, so the `note_tags` join table sits between them. Each row in it is one note-tag pair, which turns the many-to-many link into two one-to-many links.

## CREATE TABLE statements

```sql
PRAGMA foreign_keys = ON;  -- SQLite only: turns on foreign key checks

CREATE TABLE users (
  user_id       INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE notes (
  note_id    INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL,
  title      TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 100),
  body       TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

CREATE TABLE tags (
  tag_id  INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  name    TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
  UNIQUE (user_id, name)
);

CREATE TABLE note_tags (
  note_id INTEGER NOT NULL,
  tag_id  INTEGER NOT NULL,
  PRIMARY KEY (note_id, tag_id),
  FOREIGN KEY (note_id) REFERENCES notes(note_id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id)  REFERENCES tags(tag_id)   ON DELETE CASCADE
);
```

`ON DELETE CASCADE` means that deleting a note also removes its rows in `note_tags`, so no orphaned links are left behind.

## Sample data

```sql
INSERT INTO users (name, email, password_hash) VALUES
  ('Amina Wanjiru', 'amina@example.com', 'hash1'),
  ('Brian Otieno',  'brian@example.com', 'hash2');

INSERT INTO notes (user_id, title, body) VALUES
  (1, 'Email the project report', 'Send it to Grace before Friday.'),
  (1, 'Buy milk', ''),
  (1, 'Revise JavaScript arrays', 'Focus on map, filter and reduce.'),
  (2, 'Call mum', '');

INSERT INTO tags (user_id, name) VALUES
  (1, 'personal'),
  (1, 'work'),
  (1, 'study'),
  (2, 'personal');

INSERT INTO note_tags (note_id, tag_id) VALUES
  (1, 2),
  (2, 1),
  (3, 3),
  (4, 4);
```

## Example queries

**1. List a user's notes, newest first, one page at a time** (used by `GET /notes`)

```sql
SELECT note_id, title, created_at
FROM notes
WHERE user_id = 1
ORDER BY created_at DESC
LIMIT 10 OFFSET 0;
```

**2. JOIN: find a user's notes that have the tag "work"** (used by `GET /notes?tag=work`)

```sql
SELECT n.note_id, n.title, t.name AS tag
FROM notes n
JOIN note_tags nt ON n.note_id = nt.note_id
JOIN tags t ON nt.tag_id = t.tag_id
WHERE n.user_id = 1
  AND t.name = 'work';
```

**3. Count how many notes each tag has** (LEFT JOIN so unused tags show 0)

```sql
SELECT t.name, COUNT(nt.note_id) AS note_count
FROM tags t
LEFT JOIN note_tags nt ON t.tag_id = nt.tag_id
WHERE t.user_id = 1
GROUP BY t.tag_id, t.name;
```

**4. Update a note** (used by `PUT /notes/{id}`; the `user_id` check stops one user changing another user's note)

```sql
UPDATE notes
SET title = 'Revise JavaScript arrays and objects',
    updated_at = CURRENT_TIMESTAMP
WHERE note_id = 3
  AND user_id = 1;
```

## Indexes

```sql
CREATE INDEX idx_notes_user_created ON notes (user_id, created_at);
```

**Reason:** almost every request is "show this user's notes, newest first". Without an index, the database would read every note of every user to find them, which becomes very slow at 1 million users. This index lets it jump straight to one user's notes already in date order.

A second useful index is `CREATE INDEX idx_note_tags_tag ON note_tags (tag_id);`. The primary key already speeds up searches by note, but this one speeds up searches by tag.

## SQL or NoSQL?

I would choose **SQL**. QuickNotes data is clearly structured and connected: users own notes, notes have tags, and tags are shared between notes. A relational database enforces these links with foreign keys, keeps emails unique, and keeps the data consistent when a note or user is deleted. Queries that cross tables, such as "all notes with the tag work" or "how many notes per tag", are simple JOINs. A NoSQL document store would be a better fit if notes had very different shapes or the system needed to spread writes across many servers, but at this scale a SQL primary with read replicas handles the load well, as the architecture document shows.
