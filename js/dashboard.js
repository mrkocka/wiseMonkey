const tableBody = document.getElementById("quotes-table-body");
const modal = document.getElementById("quote-modal");
const openModalButton = document.getElementById("open-quote-modal");
const closeModalButton = document.getElementById("close-quote-modal");
const cancelModalButton = document.getElementById("cancel-quote-modal");
const quoteForm = document.getElementById("quote-form");
const quoteTextInput = document.getElementById("quote-text-input");
const quoteAuthorInput = document.getElementById("quote-author-input");
const quoteFormMessage = document.getElementById("quote-form-message");
const submitQuoteButton = document.getElementById("submit-quote-button");

function openModal() {
  modal.classList.remove("is-hidden");
  modal.setAttribute("aria-hidden", "false");
  quoteTextInput.focus();
}

function closeModal() {
  modal.classList.add("is-hidden");
  modal.setAttribute("aria-hidden", "true");
  quoteForm.reset();
  quoteFormMessage.textContent = "";
  quoteFormMessage.classList.remove("is-success");
}

function setFormMessage(message, isSuccess = false) {
  quoteFormMessage.textContent = message;
  quoteFormMessage.classList.toggle("is-success", isSuccess);
}

function createActionButtons() {
  const actions = document.createElement("div");
  actions.className = "row-actions";

  const editButton = document.createElement("button");
  editButton.type = "button";
  editButton.className = "button button-primary button-small";
  editButton.textContent = "Szerkesztes";

  const deleteButton = document.createElement("button");
  deleteButton.type = "button";
  deleteButton.className = "button button-small button-delete";
  deleteButton.textContent = "Torles";

  actions.append(editButton, deleteButton);
  return actions;
}

function renderMessage(message) {
  tableBody.innerHTML = "";

  const row = document.createElement("tr");
  const cell = document.createElement("td");
  cell.colSpan = 4;
  cell.className = "table-message";
  cell.textContent = message;

  row.appendChild(cell);
  tableBody.appendChild(row);
}

function isDatabaseError(response) {
  return response.status === 503;
}

function renderQuotes(quotes) {
  tableBody.innerHTML = "";

  if (quotes.length === 0) {
    renderMessage("Meg nincs egyetlen idezet sem az adatbazisban.");
    return;
  }

  for (const quote of quotes) {
    const row = document.createElement("tr");

    const idCell = document.createElement("td");
    idCell.textContent = `#${String(quote.id).padStart(3, "0")}`;

    const quoteCell = document.createElement("td");
    quoteCell.className = "quote-text";
    quoteCell.textContent = `"${quote.quoteText}"`;

    const authorCell = document.createElement("td");
    authorCell.textContent = quote.author;

    const actionsCell = document.createElement("td");
    actionsCell.appendChild(createActionButtons());

    row.append(idCell, quoteCell, authorCell, actionsCell);
    tableBody.appendChild(row);
  }
}

async function loadQuotes() {
  try {
    const response = await fetch("/api/quotes", {
      headers: {
        Accept: "application/json",
      },
    });

    if (isDatabaseError(response)) {
      throw new Error("Database unavailable");
    }

    if (!response.ok) {
      throw new Error(`Unexpected status: ${response.status}`);
    }

    const data = await response.json();
    renderQuotes(data.quotes || []);
  } catch (error) {
    const message =
      error.message === "Database unavailable"
        ? "Adatbazis hiba miatt az idezetek jelenleg nem tolthetők be."
        : "Nem sikerult betolteni az idezeteket az adatbazisbol.";
    renderMessage(message);
    console.error(error);
  }
}

async function handleQuoteCreate(event) {
  event.preventDefault();

  const formData = new FormData(quoteForm);
  const quoteText = formData.get("quoteText")?.toString().trim() || "";
  const author = formData.get("author")?.toString().trim() || "";

  if (!quoteText || !author) {
    setFormMessage("Az idezet es a szerzo mezot is ki kell tolteni.");
    return;
  }

  submitQuoteButton.disabled = true;
  setFormMessage("Idezet mentese folyamatban...");

  try {
    const response = await fetch("/api/quotes", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ quoteText, author }),
    });

    if (isDatabaseError(response)) {
      throw new Error("Database unavailable");
    }

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || `Unexpected status: ${response.status}`);
    }

    setFormMessage("Az uj idezet sikeresen bekerult az adatbazisba.", true);
    await loadQuotes();
    window.setTimeout(() => {
      closeModal();
    }, 600);
  } catch (error) {
    const message =
      error.message === "Database unavailable"
        ? "Adatbazis hiba miatt most nem lehet uj idezetet menteni."
        : "Nem sikerult elmenteni az uj idezetet.";
    setFormMessage(message);
    console.error(error);
  } finally {
    submitQuoteButton.disabled = false;
  }
}

openModalButton.addEventListener("click", openModal);
closeModalButton.addEventListener("click", closeModal);
cancelModalButton.addEventListener("click", closeModal);
modal.addEventListener("click", (event) => {
  if (event.target === modal) {
    closeModal();
  }
});
quoteForm.addEventListener("submit", handleQuoteCreate);
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !modal.classList.contains("is-hidden")) {
    closeModal();
  }
});

loadQuotes();
