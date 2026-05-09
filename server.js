const express = require("express");
const crypto = require("crypto");
const path = require("path");
const {
  createQuote,
  findUserByCredentials,
  getAllQuotes,
  getRandomQuote,
  isDatabaseAvailable,
  userExists,
} = require("./auth-db");

const app = express();
const PORT = process.env.PORT || 3000;
const publicDir = __dirname;
const sessionSecret = process.env.SESSION_SECRET || "wise-monkey-dev-secret";
const authCookieName = "wise_monkey_auth";

app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use("/css", express.static(path.join(publicDir, "css")));
app.use("/js", express.static(path.join(publicDir, "js")));
app.use("/img", express.static(path.join(publicDir, "img")));

function createAuthToken(username) {
  const signature = crypto.createHmac("sha256", sessionSecret).update(username).digest("hex");
  const encodedUsername = Buffer.from(username).toString("base64url");
  return `${encodedUsername}.${signature}`;
}

function parseCookies(cookieHeader = "") {
  return cookieHeader.split(";").reduce((cookies, cookie) => {
    const [name, ...valueParts] = cookie.trim().split("=");

    if (!name) {
      return cookies;
    }

    cookies[name] = decodeURIComponent(valueParts.join("="));
    return cookies;
  }, {});
}

function isDashboardAuthorized(req) {
  const cookies = parseCookies(req.headers.cookie);
  const authToken = cookies[authCookieName];
  const [encodedUsername, signature] = authToken ? authToken.split(".") : [];

  if (!encodedUsername || !signature) {
    return false;
  }

  const username = Buffer.from(encodedUsername, "base64url").toString("utf8");

  if (!userExists(username)) {
    return false;
  }

  const expectedToken = createAuthToken(username);

  if (authToken.length !== expectedToken.length) {
    return false;
  }

  return crypto.timingSafeEqual(Buffer.from(authToken), Buffer.from(expectedToken));
}

function requireDashboardAuth(req, res, next) {
  if (!isDatabaseAvailable()) {
    return res.redirect("/login?error=db");
  }

  if (isDashboardAuthorized(req)) {
    return next();
  }

  return res.redirect("/login");
}

function requireApiAuth(req, res, next) {
  if (!isDatabaseAvailable()) {
    return res.status(503).json({ error: "Database unavailable" });
  }

  if (isDashboardAuthorized(req)) {
    return next();
  }

  return res.status(401).json({ error: "Unauthorized" });
}

function buildAuthCookie(username, rememberUser) {
  const maxAge = rememberUser ? "; Max-Age=604800" : "";
  return `${authCookieName}=${encodeURIComponent(createAuthToken(username))}; HttpOnly; SameSite=Lax; Path=/${maxAge}`;
}

app.get(["/", "/index.html"], (req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

app.get(["/login", "/login.html", "/banan"], (req, res) => {
  res.sendFile(path.join(publicDir, "login.html"));
});

app.post("/login", (req, res) => {
  if (!isDatabaseAvailable()) {
    return res.redirect("/login?error=db");
  }

  const user = findUserByCredentials(req.body.username, req.body.password);

  if (!user) {
    return res.redirect("/login?error=1");
  }

  res.setHeader("Set-Cookie", buildAuthCookie(user.username, req.body.remember === "on"));
  return res.redirect("/dashboard");
});

app.get(["/dashboard", "/dashboard.html"], requireDashboardAuth, (req, res) => {
  res.sendFile(path.join(publicDir, "dashboard.html"));
});

app.get("/api/quotes", requireApiAuth, (req, res) => {
  res.json({ quotes: getAllQuotes() });
});

app.post("/api/quotes", requireApiAuth, (req, res) => {
  const quoteText = req.body.quoteText?.trim();
  const author = req.body.author?.trim();

  if (!quoteText || !author) {
    return res.status(400).json({ error: "Quote text and author are required" });
  }

  if (quoteText.length > 500 || author.length > 120) {
    return res.status(400).json({ error: "Input is too long" });
  }

  createQuote(quoteText, author);
  return res.status(201).json({ success: true });
});

app.get("/api/random-quote", (req, res) => {
  if (!isDatabaseAvailable()) {
    return res.status(503).json({ error: "Database unavailable" });
  }

  const quote = getRandomQuote();

  if (!quote) {
    return res.status(404).json({ error: "No quotes found" });
  }

  return res.json({ quote });
});

app.get("/logout", (req, res) => {
  res.setHeader("Set-Cookie", `${authCookieName}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`);
  res.redirect("/login");
});

app.use((req, res) => {
  res.status(404).sendFile(path.join(publicDir, "404.html"));
});

app.listen(PORT, () => {
  console.log(`Wise Monkey server is running on http://localhost:${PORT}`);
});
