# QuickNotes System Design

QuickNotes is moving from a browser-only app to an online service for 1 million users. This repository has two parts: a small API client that proves the front end can talk to a real API using fetch (with the JSONPlaceholder practice API), and three design documents the backend team can build from: the API, the data model and the system architecture.

## API client

The client can load notes (GET), create a note (POST) and delete a note (DELETE). It shows loading, success, error and empty messages, validates the title, disables buttons while a request runs, and inserts all text with `textContent`.

### How to run the API client

1. Clone the repository:
   `git clone https://github.com/SWNgugi/quicknotes-system-design.git`
2. Open the `quicknotes-system-design` folder in VS Code.
3. Right-click `index.html` and choose **Open with Live Server**, or open `index.html` in your browser. You need an internet connection to reach the API.
4. Click **Load notes**, create a note with the form, and try the **Delete** buttons.

JSONPlaceholder does not really save the notes you create or delete (every new note gets id 101), so a created note disappears when you click **Load notes** again. This is expected with a practice API.

## Design documents

- [API design](docs/api-design.md): the REST endpoints, JSON examples and error codes for the real QuickNotes API.
- [Data model](docs/data-model.md): the users, notes, tags and note_tags tables, with SQL, example queries and an index.
- [Architecture](docs/architecture.md): requirements, load estimates for 1 million users, the architecture diagram, request flows, trade-offs and how single points of failure are avoided.

## What I learned

- How to write one reusable `request()` function that calls `fetch`, checks `response.ok` and throws on errors, so every GET, POST and DELETE handles failures in the same way with `try/catch/finally`.
- How to design a REST API with clear paths, the right HTTP methods and status codes (201 for create, 204 for delete, and 400, 401, 403, 404 and 500 for errors).
- Why a many-to-many relationship, such as notes and tags, needs a join table, and how foreign keys and indexes keep a database correct and fast.
- How to estimate load (requests per second and storage per year) and use it to decide where a cache, a read replica and a queue are needed.
- That every design choice has a trade-off, such as a faster cache against fresher data.
