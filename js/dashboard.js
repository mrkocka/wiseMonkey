const tableBody = document.getElementById("quotes-table-body");
const modal = document.getElementById("quote-modal");
const openModalButton = document.getElementById("open-quote-modal");
const closeModalButton = document.getElementById("close-quote-modal");
const cancelModalButton = document.getElementById("cancel-quote-modal");
const quoteForm = document.getElementById("quote-form");
const quoteIdInput = document.getElementById("quote-id-input");
const quoteTextInput = document.getElementById("quote-text-input");
const quoteAuthorInput = document.getElementById("quote-author-input");
const quoteFormMessage = document.getElementById("quote-form-message");
const submitQuoteButton = document.getElementById("submit-quote-button");
const modalTitle = document.getElementById("quote-modal-title");
const modalDescription = document.querySelector(".modal-head p");
const deleteModal = document.getElementById("delete-modal");
const closeDeleteModalButton = document.getElementById("close-delete-modal");
const cancelDeleteModalButton = document.getElementById("cancel-delete-button");
const confirmDeleteButton = document.getElementById("confirm-delete-button");
const deleteModalQuotePreview = document.getElementById("delete-modal-quote-preview");
const deleteFormMessage = document.getElementById("delete-form-message");

let pendingDeleteQuote = null;

function isDatabaseError(response) {
  return response.status === 503;
}

function isEditMode() {
  return Boolean(quoteIdInput.value);
}

function setFormMessage(message, isSuccess = false) {
  quoteFormMessage.textContent = message;
  quoteFormMessage.classList.toggle("is-success", isSuccess);
}

function resetModalToCreateMode() {
  quoteForm.reset();
  quoteIdInput.value = "";
  modalTitle.textContent = "Új idézet feltöltése";
  modalDescription.textContent = "Töltsd ki az idézet szövegét és a szerző nevét, hogy az adatbázisba kerüljön.";
  submitQuoteButton.textContent = "Idézet mentése";
  setFormMessage("");
}

function openModal() {
  modal.classList.remove("is-hidden");
  modal.setAttribute("aria-hidden", "false");
  quoteTextInput.focus();
}

function closeModal() {
  modal.classList.add("is-hidden");
  modal.setAttribute("aria-hidden", "true");
  resetModalToCreateMode();
}

function openDeleteModal(quote) {
  pendingDeleteQuote = quote;
  deleteModalQuotePreview.textContent = `"${quote.quoteText}"`;
  deleteFormMessage.textContent = "";
  deleteFormMessage.classList.remove("is-success");
  deleteModal.classList.remove("is-hidden");
  deleteModal.setAttribute("aria-hidden", "false");
  confirmDeleteButton.focus();
}

function closeDeleteModal() {
  pendingDeleteQuote = null;
  deleteModal.classList.add("is-hidden");
  deleteModal.setAttribute("aria-hidden", "true");
  deleteModalQuotePreview.textContent = "";
  deleteFormMessage.textContent = "";
  deleteFormMessage.classList.remove("is-success");
}

function openCreateModal() {
  resetModalToCreateMode();
  openModal();
}

function openEditModal(quote) {
  quoteIdInput.value = String(quote.id);
  quoteTextInput.value = quote.quoteText;
  quoteAuthorInput.value = quote.author;
  modalTitle.textContent = "Idézet szerkesztése";
  modalDescription.textContent = "Itt tudod módosítani a kiválasztott idézet szövegét és szerzőjét.";
  submitQuoteButton.textContent = "Módosítás mentése";
  setFormMessage("");
  openModal();
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

function createActionButtons(quote) {
  const actions = document.createElement("div");
  actions.className = "row-actions";

  const editButton = document.createElement("button");
  editButton.type = "button";
  editButton.className = "button button-primary button-small";
  editButton.textContent = "Szerkesztés";
  editButton.addEventListener("click", () => {
    openEditModal(quote);
  });

  const deleteButton = document.createElement("button");
  deleteButton.type = "button";
  deleteButton.className = "button button-small button-delete";
  deleteButton.textContent = "Törlés";
  deleteButton.addEventListener("click", () => {
    openDeleteModal(quote);
  });

  actions.append(editButton, deleteButton);
  return actions;
}

function renderQuotes(quotes) {
  tableBody.innerHTML = "";

  if (quotes.length === 0) {
    renderMessage("Még nincs egyetlen idézet sem az adatbázisban.");
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
    actionsCell.appendChild(createActionButtons(quote));

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
        ? "Adatbázis hiba miatt az idézetek jelenleg nem tölthetők be."
        : "Nem sikerült betölteni az idézeteket az adatbázisból.";
    renderMessage(message);
    console.error(error);
  }
}

async function handleQuoteCreateOrUpdate(event) {
  event.preventDefault();

  const formData = new FormData(quoteForm);
  const quoteText = formData.get("quoteText")?.toString().trim() || "";
  const author = formData.get("author")?.toString().trim() || "";
  const quoteId = quoteIdInput.value;

  if (!quoteText || !author) {
    setFormMessage("Az idézet és a szerző mezőt is ki kell tölteni.");
    return;
  }

  const editing = isEditMode();
  submitQuoteButton.disabled = true;
  setFormMessage(editing ? "Idézet módosítása folyamatban..." : "Idézet mentése folyamatban...");

  try {
    const response = await fetch(editing ? `/api/quotes/${quoteId}` : "/api/quotes", {
      method: editing ? "PUT" : "POST",
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

    setFormMessage(
      editing
        ? "Az idézet módosítását elmentettük."
        : "Az új idézet sikeresen bekerült az adatbázisba.",
      true,
    );

    await loadQuotes();
    window.setTimeout(() => {
      closeModal();
    }, 600);
  } catch (error) {
    const message =
      error.message === "Database unavailable"
        ? "Adatbázis hiba miatt most nem lehet menteni."
        : editing
          ? "Nem sikerült módosítani az idézetet."
          : "Nem sikerült elmenteni az új idézetet.";
    setFormMessage(message);
    console.error(error);
  } finally {
    submitQuoteButton.disabled = false;
  }
}

async function handleQuoteDelete() {
  if (!pendingDeleteQuote) {
    return;
  }

  const quote = pendingDeleteQuote;
  confirmDeleteButton.disabled = true;
  deleteFormMessage.textContent = "";

  try {
    const response = await fetch(`/api/quotes/${quote.id}`, {
      method: "DELETE",
      headers: {
        Accept: "application/json",
      },
    });

    if (isDatabaseError(response)) {
      throw new Error("Database unavailable");
    }

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || `Unexpected status: ${response.status}`);
    }

    await loadQuotes();
    closeDeleteModal();
  } catch (error) {
    const message =
      error.message === "Database unavailable"
        ? "Adatbázis hiba miatt most nem lehet törölni az idézetet."
        : "Nem sikerült törölni az idézetet.";
    deleteFormMessage.textContent = message;
    console.error(error);
  } finally {
    confirmDeleteButton.disabled = false;
  }
}

openModalButton.addEventListener("click", openCreateModal);
closeModalButton.addEventListener("click", closeModal);
cancelModalButton.addEventListener("click", closeModal);
closeDeleteModalButton.addEventListener("click", closeDeleteModal);
cancelDeleteModalButton.addEventListener("click", closeDeleteModal);
confirmDeleteButton.addEventListener("click", handleQuoteDelete);
modal.addEventListener("click", (event) => {
  if (event.target === modal) {
    closeModal();
  }
});
deleteModal.addEventListener("click", (event) => {
  if (event.target === deleteModal) {
    closeDeleteModal();
  }
});
quoteForm.addEventListener("submit", handleQuoteCreateOrUpdate);
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !modal.classList.contains("is-hidden")) {
    closeModal();
  }

  if (event.key === "Escape" && !deleteModal.classList.contains("is-hidden")) {
    closeDeleteModal();
  }
});

loadQuotes();
