const crypto = require("crypto");
const mysql = require("mysql2/promise");

let pool = null;

function getDatabaseConfig() {
  return {
    host: process.env.DB_HOST || "127.0.0.1",
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || "",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "",
    socketPath: process.env.DB_SOCKET || undefined,
    connectionLimit: Number(process.env.DB_CONNECTION_LIMIT || 10),
    waitForConnections: true,
    queueLimit: 0,
    charset: "utf8mb4",
    dateStrings: true,
  };
}

function isDatabaseConfigured() {
  const config = getDatabaseConfig();
  return Boolean(config.database && config.user && (config.host || config.socketPath));
}

function getPool() {
  if (!isDatabaseConfigured()) {
    return null;
  }

  if (!pool) {
    pool = mysql.createPool(getDatabaseConfig());
  }

  return pool;
}

async function isDatabaseAvailable() {
  const db = getPool();

  if (!db) {
    return false;
  }

  try {
    const connection = await db.getConnection();
    await connection.ping();
    connection.release();
    return true;
  } catch (error) {
    return false;
  }
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

function normalizeEmail(email) {
  return email.trim().toLowerCase();
}

async function fetchOne(sql, params = []) {
  const db = getPool();

  if (!db) {
    return null;
  }

  const [rows] = await db.execute(sql, params);
  return rows[0] || null;
}

async function fetchAll(sql, params = []) {
  const db = getPool();

  if (!db) {
    return [];
  }

  const [rows] = await db.execute(sql, params);
  return rows;
}

async function run(sql, params = []) {
  const db = getPool();

  if (!db) {
    throw new Error("Database unavailable");
  }

  const [result] = await db.execute(sql, params);
  return result;
}

async function createUser(username, email, password) {
  const normalizedEmail = normalizeEmail(email);
  const { hash, salt } = hashPassword(password);

  return run(
    `
      INSERT INTO users (username, email, password_hash, password_salt)
      VALUES (?, ?, ?, ?)
    `,
    [username, normalizedEmail, hash, salt]
  );
}

async function updateUserEmail(username, email) {
  return run(
    `
      UPDATE users
      SET email = ?
      WHERE username = ?
    `,
    [normalizeEmail(email), username]
  );
}

async function updateUserPassword(userId, password) {
  const { hash, salt } = hashPassword(password);

  return run(
    `
      UPDATE users
      SET password_hash = ?, password_salt = ?
      WHERE id = ?
    `,
    [hash, salt, userId]
  );
}

async function createQuote(quoteText, author) {
  return run(
    `
      INSERT INTO quotes (quote_text, author)
      VALUES (?, ?)
    `,
    [quoteText, author]
  );
}

async function ensureDefaultQuotes() {
  const db = getPool();

  if (!db) {
    throw new Error("Az adatbázis nem érhető el.");
  }

  const quoteCountRow = await fetchOne("SELECT COUNT(*) AS count FROM quotes");

  if (Number(quoteCountRow?.count || 0) > 0) {
    return;
  }

  const defaultQuotes = [
    {
      quoteText: "Ha a majom ad tanácsot, legalább nevess rajta egyet, mielőtt megfogadod.",
      author: "Wise Monky",
    },
    {
      quoteText: "Nem minden bölcsnek hangzó mondat érdemli meg, hogy életfilozófia legyen belőle.",
      author: "Wise Monky",
    },
    {
      quoteText: "A jó idézet rövid, emlékezetes, és nem veszik el a saját okoskodásában.",
      author: "Admin",
    },
  ];

  for (const quote of defaultQuotes) {
    await createQuote(quote.quoteText, quote.author);
  }
}

async function updateQuote(id, quoteText, author) {
  return run(
    `
      UPDATE quotes
      SET quote_text = ?, author = ?
      WHERE id = ?
    `,
    [quoteText, author, id]
  );
}

async function deleteQuote(id) {
  return run("DELETE FROM quotes WHERE id = ?", [id]);
}

async function findUserByCredentials(username, password) {
  const user = await fetchOne("SELECT * FROM users WHERE username = ? LIMIT 1", [username]);

  if (!user || !verifyPassword(password, user)) {
    return null;
  }

  return user;
}

async function findUserByEmail(email) {
  return fetchOne("SELECT * FROM users WHERE email = ? LIMIT 1", [normalizeEmail(email)]);
}

async function findUserByUsername(username) {
  return fetchOne("SELECT * FROM users WHERE username = ? LIMIT 1", [username]);
}

async function createPasswordResetToken(userId, tokenHash, expiresAt) {
  const db = getPool();

  if (!db) {
    throw new Error("Database unavailable");
  }

  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();
    await connection.execute("DELETE FROM password_reset_tokens WHERE user_id = ?", [userId]);
    await connection.execute(
      `
        INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
        VALUES (?, ?, ?)
      `,
      [userId, tokenHash, expiresAt]
    );
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function findValidPasswordResetToken(tokenHash) {
  return fetchOne(
    `
      SELECT
        password_reset_tokens.id,
        password_reset_tokens.user_id AS userId,
        password_reset_tokens.expires_at AS expiresAt,
        users.username,
        users.email
      FROM password_reset_tokens
      JOIN users ON users.id = password_reset_tokens.user_id
      WHERE password_reset_tokens.token_hash = ?
        AND password_reset_tokens.consumed_at IS NULL
        AND password_reset_tokens.expires_at > CURRENT_TIMESTAMP
      LIMIT 1
    `,
    [tokenHash]
  );
}

async function consumePasswordResetToken(tokenId) {
  return run(
    `
      UPDATE password_reset_tokens
      SET consumed_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `,
    [tokenId]
  );
}

async function userExists(username) {
  const user = await fetchOne("SELECT id FROM users WHERE username = ? LIMIT 1", [username]);
  return Boolean(user);
}

async function emailExists(email) {
  const user = await fetchOne("SELECT id FROM users WHERE email = ? LIMIT 1", [normalizeEmail(email)]);
  return Boolean(user);
}

async function getAllQuotes() {
  return fetchAll(
    `
      SELECT
        id,
        quote_text AS quoteText,
        author,
        created_at AS createdAt
      FROM quotes
      ORDER BY id ASC
    `
  );
}

async function getRandomQuote() {
  return fetchOne(
    `
      SELECT
        id,
        quote_text AS quoteText,
        author,
        created_at AS createdAt
      FROM quotes
      ORDER BY RAND()
      LIMIT 1
    `
  );
}

module.exports = {
  consumePasswordResetToken,
  createPasswordResetToken,
  createQuote,
  createUser,
  deleteQuote,
  emailExists,
  ensureDefaultQuotes,
  findUserByCredentials,
  findUserByEmail,
  findUserByUsername,
  findValidPasswordResetToken,
  getAllQuotes,
  getRandomQuote,
  isDatabaseAvailable,
  updateQuote,
  updateUserEmail,
  updateUserPassword,
  userExists,
};
