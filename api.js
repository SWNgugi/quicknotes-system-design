const API_URL = "https://jsonplaceholder.typicode.com/posts";

const loadBtn = document.querySelector("#load-btn");
const statusMessage = document.querySelector("#status");
const notesList = document.querySelector("#notes-list");

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

  const data = await response.json();
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

    li.append(title, body);
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

loadBtn.addEventListener("click", loadNotes);

renderNotes();