const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");

const dbFile = process.env.DB_FILE || path.join(__dirname, "data", "wise-monkey.sqlite");

fs.mkdirSync(path.dirname(dbFile), { recursive: true });

const db = new Database(dbFile);

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    password_salt TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS quotes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    quote_text TEXT NOT NULL,
    author TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`);

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  return {
    hash: crypto.scryptSync(password, salt, 64).toString("hex"),
    salt,
  };
}

function verifyPassword(password, user) {
  const { hash } = hashPassword(password, user.password_salt);
  const storedHash = Buffer.from(user.password_hash, "hex");
  const submittedHash = Buffer.from(hash, "hex");

  return storedHash.length === submittedHash.length && crypto.timingSafeEqual(storedHash, submittedHash);
}

function createUser(username, password) {
  const { hash, salt } = hashPassword(password);

  db.prepare(`
    INSERT INTO users (username, password_hash, password_salt)
    VALUES (?, ?, ?)
  `).run(username, hash, salt);
}

function createQuote(quoteText, author) {
  db.prepare(`
    INSERT INTO quotes (quote_text, author)
    VALUES (?, ?)
  `).run(quoteText, author);
}

function ensureAdminUser() {
  const userCount = db.prepare("SELECT COUNT(*) AS count FROM users").get().count;

  if (userCount > 0) {
    return;
  }

  const username = process.env.ADMIN_USERNAME || "admin";
  const generatedPassword = crypto.randomBytes(12).toString("base64url");
  const password = process.env.DASHBOARD_PASSWORD || generatedPassword;

  createUser(username, password);

  if (!process.env.DASHBOARD_PASSWORD) {
    console.log("Created default admin user.");
    console.log(`Username: ${username}`);
    console.log(`Temporary password: ${generatedPassword}`);
    console.log("Set DASHBOARD_PASSWORD before first run to choose your own password.");
  }
}

function ensureDefaultQuotes() {
  const quoteCount = db.prepare("SELECT COUNT(*) AS count FROM quotes").get().count;

  if (quoteCount > 0) {
    return;
  }

  const defaultQuotes = [
    {
      quoteText: "Ha a majom ad tanacsot, legalabb nevess rajta egyet, mielott megfogadod.",
      author: "Wise Monky",
    },
    {
      quoteText: "Nem minden bolcsnek hangzo mondat erdemli meg, hogy eletfilozofia legyen belole.",
      author: "Wise Monky",
    },
    {
      quoteText: "A jo idezet rovid, emlekezetes, es nem veszik el a sajat okoskodasaban.",
      author: "Admin",
    },
    {
      quoteText: "Ha mar 404-et kaptal, legalabb kapj melle egy jo majmos megjegyzest is.",
      author: "Wise Monky",
    },
  ];

  for (const quote of defaultQuotes) {
    createQuote(quote.quoteText, quote.author);
  }
}

function findUserByCredentials(username, password) {
  const user = db.prepare("SELECT * FROM users WHERE username = ?").get(username);

  if (!user || !verifyPassword(password, user)) {
    return null;
  }

  return user;
}

function userExists(username) {
  const user = db.prepare("SELECT id FROM users WHERE username = ?").get(username);
  return Boolean(user);
}

function getAllQuotes() {
  return db.prepare(`
    SELECT id, quote_text AS quoteText, author, created_at AS createdAt
    FROM quotes
    ORDER BY id ASC
  `).all();
}

function getRandomQuote() {
  return db.prepare(`
    SELECT id, quote_text AS quoteText, author, created_at AS createdAt
    FROM quotes
    ORDER BY RANDOM()
    LIMIT 1
  `).get();
}

module.exports = {
  createUser,
  createQuote,
  ensureDefaultQuotes,
  ensureAdminUser,
  findUserByCredentials,
  getAllQuotes,
  getRandomQuote,
  userExists,
};
