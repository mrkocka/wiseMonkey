const tableBody = document.getElementById("quotes-table-body");

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

    if (!response.ok) {
      throw new Error(`Unexpected status: ${response.status}`);
    }

    const data = await response.json();
    renderQuotes(data.quotes || []);
  } catch (error) {
    renderMessage("Nem sikerult betolteni az idezeteket az adatbazisbol.");
    console.error(error);
  }
}

loadQuotes();
