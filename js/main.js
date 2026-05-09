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
  button.textContent = "Toltodik...";

  try {
    const response = await fetch("/api/random-quote", {
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`Unexpected status: ${response.status}`);
    }

    const data = await response.json();
    const nextText = `"${data.quote.quoteText}"`;
    await updateQuoteText(nextText);
  } catch (error) {
    await updateQuoteText("Nem sikerult uj idezetet betolteni. Probald meg ujra.");
    console.error(error);
  } finally {
    button.disabled = false;
    button.textContent = "Kérek egy idézetet";
  }
}

button.addEventListener("click", loadRandomQuote);
