# QuickNotes API Design

This document describes the REST API that the backend team should build for QuickNotes. It is a design for the real service, not the JSONPlaceholder practice API used by the front-end demo.

## Conventions

- **Base path:** `/api/v1`
- **Format:** all requests and responses use JSON (`Content-Type: application/json`).
- **Authentication:** every endpoint except login needs the header `Authorization: Bearer <token>`.
- **Ownership:** a user can only see and change their own notes.
- **Naming:** resources are plural nouns (`/notes`, `/tags`), and the HTTP method says what to do.

## Endpoints

| #   | Method | Path          | Description                                                      | Success status |
| --- | ------ | ------------- | ---------------------------------------------------------------- | -------------- |
| 1   | POST   | `/auth/login` | Log in and receive a token                                       | 200 OK         |
| 2   | GET    | `/notes`      | List the user's notes (supports `?page=`, `?limit=` and `?tag=`) | 200 OK         |
| 3   | GET    | `/notes/{id}` | Get one note                                                     | 200 OK         |
| 4   | POST   | `/notes`      | Create a note                                                    | 201 Created    |
| 5   | PUT    | `/notes/{id}` | Replace the title, body and tags of a note                       | 200 OK         |
| 6   | DELETE | `/notes/{id}` | Delete a note                                                    | 204 No Content |
| 7   | GET    | `/tags`       | List all tags used by the user                                   | 200 OK         |

### 1. Log in

- **Method and path:** POST `/auth/login`
- **Description:** checks the user's email and password and returns a token for later requests.
- **Request body:**
  ```json
  {
    "email": "amina@example.com",
    "password": "my-secret-password"
  }
  ```
- **Success status:** 200 OK
- **Response body:**
  ```json
  {
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "expiresIn": 3600
  }
  ```

### 2. List notes

- **Method and path:** GET `/notes?page=1&limit=10`
- **Description:** returns one page of the logged-in user's notes, newest first. Add `?tag=work` to list only notes with that tag.
- **Success status:** 200 OK
- **Response body:**
  ```json
  {
    "data": [
      {
        "id": 42,
        "title": "Email the project report",
        "body": "Send it to Grace before Friday.",
        "tags": ["work"],
        "createdAt": "2026-10-20T09:15:00Z",
        "updatedAt": "2026-10-20T09:15:00Z"
      },
      {
        "id": 41,
        "title": "Buy milk",
        "body": "",
        "tags": ["personal"],
        "createdAt": "2026-10-19T17:40:00Z",
        "updatedAt": "2026-10-19T17:40:00Z"
      }
    ],
    "page": 1,
    "limit": 10,
    "total": 2
  }
  ```
- An empty list returns 200 with `"data": []`, not an error.

### 3. Get one note

- **Method and path:** GET `/notes/{id}`, for example `/notes/42`
- **Description:** returns a single note by its id.
- **Success status:** 200 OK
- **Response body:** the same note object shown above, without the `data` wrapper.

### 4. Create a note

- **Method and path:** POST `/notes`
- **Description:** creates a new note for the logged-in user.
- **Request body:**
  ```json
  {
    "title": "Revise JavaScript arrays",
    "body": "Focus on map, filter and reduce.",
    "tags": ["study"]
  }
  ```
- **Success status:** 201 Created, with a `Location: /api/v1/notes/43` header.
- **Response body:**
  ```json
  {
    "id": 43,
    "title": "Revise JavaScript arrays",
    "body": "Focus on map, filter and reduce.",
    "tags": ["study"],
    "createdAt": "2026-10-21T08:00:00Z",
    "updatedAt": "2026-10-21T08:00:00Z"
  }
  ```
- **Rules:** `title` is required and at most 100 characters. `body` is optional. `tags` is optional.

### 5. Update a note

- **Method and path:** PUT `/notes/{id}`
- **Description:** replaces the title, body and tags of an existing note.
- **Request body:**
  ```json
  {
    "title": "Revise JavaScript arrays and objects",
    "body": "Focus on map, filter, reduce and destructuring.",
    "tags": ["study"]
  }
  ```
- **Success status:** 200 OK
- **Response body:** the updated note, in the same shape as the create response.

### 6. Delete a note

- **Method and path:** DELETE `/notes/{id}`
- **Description:** permanently removes the note.
- **Success status:** 204 No Content (the response has no body).

### 7. List tags

- **Method and path:** GET `/tags`
- **Description:** returns the tags the user has used, so the app can offer them as filters.
- **Success status:** 200 OK
- **Response body:**
  ```json
  {
    "data": [
      { "id": 1, "name": "personal" },
      { "id": 2, "name": "work" },
      { "id": 3, "name": "study" }
    ]
  }
  ```

## Error codes

Every error returns the same JSON shape, so the front end can handle them in one place:

```json
{
  "error": {
    "status": 400,
    "code": "VALIDATION_ERROR",
    "message": "The title is required and must be 100 characters or fewer."
  }
}
```

| Status                    | Meaning                               | Example of when it happens                                                                        |
| ------------------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------- |
| 400 Bad Request           | The request is invalid or incomplete  | `POST /notes` with an empty `title`, a title longer than 100 characters, or malformed JSON        |
| 401 Unauthorized          | The user is not logged in             | Any request without a token, with an expired token, or `POST /auth/login` with the wrong password |
| 403 Forbidden             | The user is logged in but not allowed | User A tries to `DELETE /notes/42` when note 42 belongs to user B                                 |
| 404 Not Found             | The note or route does not exist      | `GET /notes/9999` when no note has id 9999                                                        |
| 500 Internal Server Error | Something went wrong on the server    | The database is unreachable while handling `GET /notes`                                           |

Example bodies:

```json
{
  "error": {
    "status": 401,
    "code": "UNAUTHORIZED",
    "message": "Please log in to continue."
  }
}
```

```json
{
  "error": {
    "status": 403,
    "code": "FORBIDDEN",
    "message": "You do not have permission to change this note."
  }
}
```

```json
{
  "error": {
    "status": 404,
    "code": "NOT_FOUND",
    "message": "No note exists with id 9999."
  }
}
```

```json
{
  "error": {
    "status": 500,
    "code": "SERVER_ERROR",
    "message": "Something went wrong. Please try again later."
  }
}
```
