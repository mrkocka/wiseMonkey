const express = require("express");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

require("dotenv").config({ path: path.join(__dirname, ".env"), override: true });
const {
  consumePasswordResetToken,
  createPasswordResetToken,
  createQuote,
  deleteQuote,
  findUserByEmail,
  findUserByCredentials,
  findValidPasswordResetToken,
  getAllQuotes,
  getRandomQuote,
  isDatabaseAvailable,
  updateQuote,
  updateUserPassword,
  userExists,
} = require("./auth-db");
const { sendPasswordResetEmail } = require("./mailer");

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || "127.0.0.1";
const publicDir = path.join(__dirname, "..", "public");
const sessionSecret = process.env.SESSION_SECRET || "wise-monkey-dev-secret";
const authCookieName = "wise_monkey_auth";
const resetTokenExpiresMinutes = Number(process.env.RESET_TOKEN_EXPIRES_MINUTES || 30);
const appBaseUrl = process.env.APP_BASE_URL || `http://${HOST}:${PORT}`;
const loginRoute = normalizeRoute(process.env.LOGIN_ROUTE || "/banan");
const loginFailureLogPath = process.env.LOGIN_FAILURE_LOG || path.join(__dirname, "logs", "login-failures.log");

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

function asyncHandler(handler) {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

function normalizeRoute(route) {
  if (!route || route === "/") {
    return "/banan";
  }

  const withLeadingSlash = route.startsWith("/") ? route : `/${route}`;
  return withLeadingSlash.replace(/\/+$/, "") || "/banan";
}

function hashResetToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function formatSqlDate(date) {
  return date.toISOString().slice(0, 19).replace("T", " ");
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

function getClientIp(req) {
  const forwardedFor = req.headers["x-forwarded-for"];

  if (typeof forwardedFor === "string" && forwardedFor.length > 0) {
    return forwardedFor.split(",")[0].trim();
  }

  return req.socket?.remoteAddress || req.ip || "unknown";
}

function appendLoginFailureLog(req, username) {
  const logDir = path.dirname(loginFailureLogPath);
  const safeUsername = (username || "").trim() || "-";
  const logLine = [
    `timestamp=${new Date().toISOString()}`,
    "event=failed_login",
    `ip=${getClientIp(req)}`,
    `username=${JSON.stringify(safeUsername)}`,
    `path=${req.path}`,
  ].join(" ");

  try {
    fs.mkdirSync(logDir, { recursive: true });
    fs.appendFileSync(loginFailureLogPath, `${logLine}\n`, "utf8");
  } catch (error) {
    console.error("A sikertelen belépések naplózása nem sikerült:", error);
  }
}

async function isDashboardAuthorized(req) {
  const cookies = parseCookies(req.headers.cookie);
  const authToken = cookies[authCookieName];
  const [encodedUsername, signature] = authToken ? authToken.split(".") : [];

  if (!encodedUsername || !signature) {
    return false;
  }

  const username = Buffer.from(encodedUsername, "base64url").toString("utf8");

  if (!(await userExists(username))) {
    return false;
  }

  const expectedToken = createAuthToken(username);

  if (authToken.length !== expectedToken.length) {
    return false;
  }

  return crypto.timingSafeEqual(Buffer.from(authToken), Buffer.from(expectedToken));
}

const requireDashboardAuth = asyncHandler(async (req, res, next) => {
  if (!(await isDatabaseAvailable())) {
    return res.redirect(`${loginRoute}?error=db`);
  }

  if (await isDashboardAuthorized(req)) {
    return next();
  }

  return res.redirect(loginRoute);
});

const requireApiAuth = asyncHandler(async (req, res, next) => {
  if (!(await isDatabaseAvailable())) {
    return res.status(503).json({ error: "Database unavailable" });
  }

  if (await isDashboardAuthorized(req)) {
    return next();
  }

  return res.status(401).json({ error: "Unauthorized" });
});

function buildAuthCookie(username, rememberUser) {
  const maxAge = rememberUser ? "; Max-Age=604800" : "";
  return `${authCookieName}=${encodeURIComponent(createAuthToken(username))}; HttpOnly; SameSite=Lax; Path=/${maxAge}`;
}

app.get(["/", "/index.html"], (req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

app.get("/app-config.js", (req, res) => {
  res.type("application/javascript");
  res.send(`window.WISE_MONKEY_CONFIG = ${JSON.stringify({ loginRoute })};`);
});

app.get(loginRoute, (req, res) => {
  res.sendFile(path.join(publicDir, "login.html"));
});

app.get("/forgot-password", (req, res) => {
  res.sendFile(path.join(publicDir, "forgot-password.html"));
});

app.get("/reset-password", (req, res) => {
  res.sendFile(path.join(publicDir, "reset-password.html"));
});

app.post("/banan", asyncHandler(async (req, res) => {
  if (!(await isDatabaseAvailable())) {
    return res.redirect(`${loginRoute}?error=db`);
  }

  const user = await findUserByCredentials(req.body.username, req.body.password);

  if (!user) {
    appendLoginFailureLog(req, req.body.username);
    return res.redirect(`${loginRoute}?error=1`);
  }

  res.setHeader("Set-Cookie", buildAuthCookie(user.username, req.body.remember === "on"));
  return res.redirect("/dashboard");
}));

app.post("/forgot-password", asyncHandler(async (req, res) => {
  if (!(await isDatabaseAvailable())) {
    return res.redirect("/forgot-password?status=db");
  }

  const email = req.body.email?.trim().toLowerCase();

  if (!email) {
    return res.redirect("/forgot-password?status=sent");
  }

  const user = await findUserByEmail(email);

  if (!user) {
    return res.redirect("/forgot-password?status=sent");
  }

  const rawToken = crypto.randomBytes(32).toString("base64url");
  const tokenHash = hashResetToken(rawToken);
  const expiresAt = formatSqlDate(new Date(Date.now() + resetTokenExpiresMinutes * 60 * 1000));

  await createPasswordResetToken(user.id, tokenHash, expiresAt);

  const resetUrl = new URL("/reset-password", appBaseUrl);
  resetUrl.searchParams.set("token", rawToken);

  try {
    await sendPasswordResetEmail({
      to: user.email,
      resetUrl: resetUrl.toString(),
      expiresInMinutes: resetTokenExpiresMinutes,
    });
  } catch (error) {
    console.error(error);
    return res.redirect("/forgot-password?status=sent");
  }

  return res.redirect("/forgot-password?status=sent");
}));

app.post("/reset-password", asyncHandler(async (req, res) => {
  if (!(await isDatabaseAvailable())) {
    return res.redirect("/reset-password?status=db");
  }

  const token = req.body.token?.trim();
  const password = req.body.password?.trim() || "";
  const confirmPassword = req.body.confirmPassword?.trim() || "";

  if (!token) {
    return res.redirect("/reset-password?status=invalid");
  }

  if (password.length < 8) {
    return res.redirect(`/reset-password?status=short&token=${encodeURIComponent(token)}`);
  }

  if (password !== confirmPassword) {
    return res.redirect(`/reset-password?status=mismatch&token=${encodeURIComponent(token)}`);
  }

  const resetRecord = await findValidPasswordResetToken(hashResetToken(token));

  if (!resetRecord) {
    return res.redirect("/reset-password?status=invalid");
  }

  await updateUserPassword(resetRecord.userId, password);
  await consumePasswordResetToken(resetRecord.id);
  return res.redirect("/reset-password?status=done");
}));

app.get(["/dashboard", "/dashboard.html"], requireDashboardAuth, (req, res) => {
  res.sendFile(path.join(publicDir, "dashboard.html"));
});

app.get("/api/quotes", requireApiAuth, asyncHandler(async (req, res) => {
  res.json({ quotes: await getAllQuotes() });
}));

app.post("/api/quotes", requireApiAuth, asyncHandler(async (req, res) => {
  const quoteText = req.body.quoteText?.trim();
  const author = req.body.author?.trim();

  if (!quoteText || !author) {
    return res.status(400).json({ error: "Quote text and author are required" });
  }

  if (quoteText.length > 500 || author.length > 120) {
    return res.status(400).json({ error: "Input is too long" });
  }

  await createQuote(quoteText, author);
  return res.status(201).json({ success: true });
}));

app.put("/api/quotes/:id", requireApiAuth, asyncHandler(async (req, res) => {
  const quoteId = Number(req.params.id);
  const quoteText = req.body.quoteText?.trim();
  const author = req.body.author?.trim();

  if (!Number.isInteger(quoteId) || quoteId < 1) {
    return res.status(400).json({ error: "Invalid quote id" });
  }

  if (!quoteText || !author) {
    return res.status(400).json({ error: "Quote text and author are required" });
  }

  if (quoteText.length > 500 || author.length > 120) {
    return res.status(400).json({ error: "Input is too long" });
  }

  const result = await updateQuote(quoteId, quoteText, author);

  if (result.changes === 0) {
    return res.status(404).json({ error: "Quote not found" });
  }

  return res.json({ success: true });
}));

app.delete("/api/quotes/:id", requireApiAuth, asyncHandler(async (req, res) => {
  const quoteId = Number(req.params.id);

  if (!Number.isInteger(quoteId) || quoteId < 1) {
    return res.status(400).json({ error: "Invalid quote id" });
  }

  const result = await deleteQuote(quoteId);

  if (result.changes === 0) {
    return res.status(404).json({ error: "Quote not found" });
  }

  return res.json({ success: true });
}));

app.get("/api/random-quote", asyncHandler(async (req, res) => {
  if (!(await isDatabaseAvailable())) {
    return res.status(503).json({ error: "Database unavailable" });
  }

  const quote = await getRandomQuote();

  if (!quote) {
    return res.status(404).json({ error: "No quotes found" });
  }

  return res.json({ quote });
}));

app.get("/logout", (req, res) => {
  res.setHeader("Set-Cookie", `${authCookieName}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`);
  res.redirect(loginRoute);
});

app.use((req, res) => {
  res.status(404).sendFile(path.join(publicDir, "404.html"));
});

app.use((error, req, res, next) => {
  console.error(error);

  if (res.headersSent) {
    return next(error);
  }

  if (req.path.startsWith("/api/")) {
    return res.status(500).json({ error: "Internal server error" });
  }

  return res.status(500).send("Belső szerverhiba történt.");
});

const server = app.listen(PORT, HOST, () => {
  console.log(`Wise Monkey server is running on ${appBaseUrl}`);
});

server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.error(`A ${HOST}:${PORT} cím már használatban van.`);
    process.exit(1);
  }

  if (error.code === "EPERM") {
    console.error(`A szerver nem tud elindulni ezen a címen: ${HOST}:${PORT}.`);
    console.error(`Részletes hiba: ${error.message}`);
    console.error("A probléma nem az Express kódban van, hanem a környezet nem engedi a port megnyitását.");
    process.exit(1);
  }

  console.error("A szerver indulás közben hibába futott:", error);
  process.exit(1);
});
