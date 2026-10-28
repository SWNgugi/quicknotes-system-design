const API_URL = "https://jsonplaceholder.typicode.com/posts";

const loadBtn = document.querySelector("#load-btn");
const statusMessage = document.querySelector("#status");
const notesList = document.querySelector("#notes-list");
const noteForm = document.querySelector("#note-form");
const titleInput = document.querySelector("#title-input");
const bodyInput = document.querySelector("#body-input");
const submitBtn = document.querySelector("#submit-btn");

let notes = [];

function setStatus(message, type = "") {
  statusMessage.textContent = message;
  statusMessage.className = type;
}

// One reusable function for every request: fetch, check response.ok, throw on errors
async function request(url, options) {
  const response = await fetch(url, options);

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }

    const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  return { status: response.status, data: data };
}

function renderNotes() {
  notesList.textContent = "";

  if (notes.length === 0) {
    const empty = document.createElement("li");
    empty.classList.add("empty");
    empty.textContent = "No notes to show.";
    notesList.append(empty);
    return;
  }

  for (const note of notes) {
    const li = document.createElement("li");
    li.classList.add("note");

    const title = document.createElement("h3");
    title.textContent = note.title;

    const body = document.createElement("p");
    body.textContent = note.body;

        const deleteBtn = document.createElement("button");
    deleteBtn.classList.add("delete-btn");
    deleteBtn.type = "button";
    deleteBtn.textContent = "Delete";
    deleteBtn.addEventListener("click", () => deleteNote(note, deleteBtn));

    li.append(title, body, deleteBtn);
    notesList.append(li);
  }
}

// GET: load 10 notes
async function loadNotes() {
  setStatus("Loading notes...");
  loadBtn.disabled = true;

  try {
    const result = await request(`${API_URL}?_limit=10`);
    notes = result.data;
    renderNotes();

    if (notes.length === 0) {
      setStatus("The server has no notes yet.");
    } else {
      setStatus(`Loaded ${notes.length} notes from the server.`, "success");
    }
  } catch (error) {
    console.error(error);
    setStatus(
      "Sorry, we couldn't load your notes. Please check your connection and try again.",
      "error"
    );
  } finally {
    loadBtn.disabled = false;
  }
}

// POST: create a note
async function createNote(event) {
  event.preventDefault();

  const title = titleInput.value.trim();
  const body = bodyInput.value.trim();

  if (title === "") {
    setStatus("Please enter a title.", "error");
    return;
  }
  if (title.length > 100) {
    setStatus("The title must be 100 characters or fewer.", "error");
    return;
  }

  setStatus("Creating note...");
  submitBtn.disabled = true;

  try {
    const result = await request(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=UTF-8" },
      body: JSON.stringify({ title: title, body: body, userId: 1 }),
    });

    notes.unshift(result.data);
    renderNotes();
    setStatus(
      `Note created (status ${result.status}, id ${result.data.id}).`,
      "success"
    );
    noteForm.reset();
  } catch (error) {
    console.error(error);
    setStatus(
      "Sorry, we couldn't create your note. Please try again.",
      "error"
    );
  } finally {
    submitBtn.disabled = false;
  }
}

/*
  DELETE: remove a note.
  JSONPlaceholder is a practice API. It replies as if the note was deleted
  (status 200) but never changes its data, and the notes we create (always
  id 101) are never really stored. So we send the real DELETE request, and only
  when the server says OK do we remove that one note from the list on the page.
  We remove it by the note object itself, not by its id, because every created
  note has the same id (101). Clicking "Load notes" brings the original 10 back,
  which is expected with a fake API.
*/
async function deleteNote(note, button) {
  setStatus("Deleting note...");
  button.disabled = true;

  try {
    const result = await request(`${API_URL}/${note.id}`, { method: "DELETE" });
    notes = notes.filter((item) => item !== note);
    renderNotes();
    setStatus(`Note deleted (status ${result.status}).`, "success");
  } catch (error) {
    console.error(error);
    setStatus("Sorry, we couldn't delete that note. Please try again.", "error");
    button.disabled = false;
  }
}

loadBtn.addEventListener("click", loadNotes);
noteForm.addEventListener("submit", createNote);

renderNotes();