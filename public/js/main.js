const button = document.getElementById("test-button");
const bubble = document.getElementById("circular-JS");
const quoteText = document.getElementById("quote-text");
const animationDurationMs = 1000;

function wait(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

async function updateQuoteText(nextText) {
  bubble.classList.add("hide");
  await wait(animationDurationMs);
  quoteText.textContent = nextText;
  bubble.classList.remove("hide");
}

async function loadRandomQuote() {
  if (button.disabled) {
    return;
  }

  button.disabled = true;
  button.textContent = "Töltődik...";

  try {
    const response = await fetch("/api/random-quote", {
      headers: {
        Accept: "application/json",
      },
    });

    if (response.status === 503) {
      throw new Error("Database unavailable");
    }

    if (!response.ok) {
      throw new Error(`Unexpected status: ${response.status}`);
    }

    const data = await response.json();
    const nextText = `"${data.quote.quoteText}"`;
    await updateQuoteText(nextText);
  } catch (error) {
    const message =
      error.message === "Database unavailable"
        ? "Az idézetek adatbázisa jelenleg nem elérhető."
        : "Nem sikerült új idézetet betölteni. Próbáld meg újra.";
    await updateQuoteText(message);
    console.error(error);
  } finally {
    button.disabled = false;
    button.textContent = "Kérek egy idézetet";
  }
}

button.addEventListener("click", loadRandomQuote);
