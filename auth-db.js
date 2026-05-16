const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");

const dbFile = process.env.DB_FILE || path.join(__dirname, "data", "wise-monkey.sqlite");
let cachedDb = null;

function initializeSchema(db) {
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
}

function getDatabase({ createIfMissing = false } = {}) {
  if (cachedDb) {
    return cachedDb;
  }

  if (!createIfMissing && !fs.existsSync(dbFile)) {
    return null;
  }

  fs.mkdirSync(path.dirname(dbFile), { recursive: true });
  cachedDb = new Database(dbFile);
  initializeSchema(cachedDb);
  return cachedDb;
}

function isDatabaseAvailable() {
  return Boolean(getDatabase());
}

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

function createUser(username, password, options = {}) {
  const db = getDatabase({ createIfMissing: options.createIfMissing === true });

  if (!db) {
    throw new Error("Database unavailable");
  }

  const { hash, salt } = hashPassword(password);

  db.prepare(`
    INSERT INTO users (username, password_hash, password_salt)
    VALUES (?, ?, ?)
  `).run(username, hash, salt);
}

function createQuote(quoteText, author, options = {}) {
  const db = getDatabase({ createIfMissing: options.createIfMissing === true });

  if (!db) {
    throw new Error("Database unavailable");
  }

  db.prepare(`
    INSERT INTO quotes (quote_text, author)
    VALUES (?, ?)
  `).run(quoteText, author);
}

function updateQuote(id, quoteText, author) {
  const db = getDatabase();

  if (!db) {
    throw new Error("Database unavailable");
  }

  return db.prepare(`
    UPDATE quotes
    SET quote_text = ?, author = ?
    WHERE id = ?
  `).run(quoteText, author, id);
}

function deleteQuote(id) {
  const db = getDatabase();

  if (!db) {
    throw new Error("Database unavailable");
  }

  return db.prepare("DELETE FROM quotes WHERE id = ?").run(id);
}

function findUserByCredentials(username, password) {
  const db = getDatabase();

  if (!db) {
    return null;
  }

  const user = db.prepare("SELECT * FROM users WHERE username = ?").get(username);

  if (!user || !verifyPassword(password, user)) {
    return null;
  }

  return user;
}

function userExists(username) {
  const db = getDatabase();

  if (!db) {
    return false;
  }

  const user = db.prepare("SELECT id FROM users WHERE username = ?").get(username);
  return Boolean(user);
}

function getAllQuotes() {
  const db = getDatabase();

  if (!db) {
    return [];
  }

  return db.prepare(`
    SELECT id, quote_text AS quoteText, author, created_at AS createdAt
    FROM quotes
    ORDER BY id ASC
  `).all();
}

function getRandomQuote() {
  const db = getDatabase();

  if (!db) {
    return null;
  }

  return db.prepare(`
    SELECT id, quote_text AS quoteText, author, created_at AS createdAt
    FROM quotes
    ORDER BY RANDOM()
    LIMIT 1
  `).get();
}

module.exports = {
  createQuote,
  createUser,
  deleteQuote,
  findUserByCredentials,
  getAllQuotes,
  getRandomQuote,
  isDatabaseAvailable,
  updateQuote,
  userExists,
};
