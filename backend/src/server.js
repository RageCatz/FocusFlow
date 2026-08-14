import express from "express";
import cors from "cors";
import helmet from "helmet";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import pg from "pg";

const { Pool } = pg;
const app = express();
const port = Number(process.env.PORT || 10000);

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required.");
}
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 24) {
  throw new Error("JWT_SECRET must be set to a long random value (24+ characters).");
}

const allowedOrigins = String(process.env.FRONTEND_URL || "")
  .split(",")
  .map(value => value.trim())
  .filter(Boolean);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production"
    ? { rejectUnauthorized: false }
    : undefined
});

app.use(helmet());
app.use(express.json({ limit: "1mb" }));
app.use(cors({
  origin(origin, callback) {
    if (!origin || !allowedOrigins.length || allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error("Origin not allowed by CORS."));
  }
}));

function normalizeUsername(value) {
  return String(value || "").trim().toLowerCase();
}

function validUsername(value) {
  return /^[A-Za-z0-9]{3,64}$/.test(String(value || "").trim());
}

function validPassword(value) {
  const password = String(value || "");
  return password.length >= 6 && /\d/.test(password) && /^[A-Za-z0-9]+$/.test(password);
}

function signToken(user) {
  return jwt.sign(
    { sub: String(user.id) },
    process.env.JWT_SECRET,
    { expiresIn: "30d", issuer: "focusflow-api" }
  );
}

function authenticate(request, response, next) {
  const header = request.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) return response.status(401).json({ error: "Login required." });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET, {
      issuer: "focusflow-api"
    });
    request.userId = decoded.sub;
    next();
  } catch {
    return response.status(401).json({ error: "Your login session has expired." });
  }
}

async function ensureSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id BIGSERIAL PRIMARY KEY,
      username VARCHAR(64) NOT NULL,
      username_normalized VARCHAR(64) NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      profile JSONB NOT NULL DEFAULT '{}'::jsonb,
      state JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

app.get("/api/health", async (_request, response) => {
  try {
    await pool.query("SELECT 1");
    response.json({ ok: true, database: "connected" });
  } catch (error) {
    response.status(503).json({ ok: false, error: error.message });
  }
});

app.post("/api/auth/signup", async (request, response) => {
  const { username, password, profile = {}, state = {} } = request.body || {};
  if (!validUsername(username)) {
    return response.status(400).json({ error: "Username must be 3-64 letters or numbers." });
  }
  if (!validPassword(password)) {
    return response.status(400).json({ error: "Password must be 6+ letters/numbers and include a number." });
  }

  const normalized = normalizeUsername(username);
  try {
    const passwordHash = await bcrypt.hash(password, 12);
    const result = await pool.query(
      `INSERT INTO users (username, username_normalized, password_hash, profile, state)
       VALUES ($1, $2, $3, $4::jsonb, $5::jsonb)
       RETURNING id, username, profile, state`,
      [String(username).trim(), normalized, passwordHash, JSON.stringify(profile), JSON.stringify(state)]
    );
    const user = result.rows[0];
    return response.status(201).json({
      token: signToken(user),
      username: user.username,
      profile: user.profile,
      state: user.state
    });
  } catch (error) {
    if (error.code === "23505") {
      return response.status(409).json({ error: "That username is already in use." });
    }
    console.error(error);
    return response.status(500).json({ error: "Could not create account." });
  }
});

app.post("/api/auth/login", async (request, response) => {
  const { username, password } = request.body || {};
  const normalized = normalizeUsername(username);
  try {
    const result = await pool.query(
      `SELECT id, username, password_hash, profile, state
       FROM users WHERE username_normalized = $1 LIMIT 1`,
      [normalized]
    );
    const user = result.rows[0];
    if (!user || !(await bcrypt.compare(String(password || ""), user.password_hash))) {
      return response.status(401).json({ error: "Incorrect username or password." });
    }
    return response.json({
      token: signToken(user),
      username: user.username,
      profile: user.profile,
      state: user.state
    });
  } catch (error) {
    console.error(error);
    return response.status(500).json({ error: "Could not log in." });
  }
});

app.post("/api/auth/change-password", authenticate, async (request, response) => {
  const { currentPassword, newPassword } = request.body || {};
  if (!validPassword(newPassword)) {
    return response.status(400).json({ error: "New password does not meet the password rules." });
  }

  try {
    const result = await pool.query(
      "SELECT password_hash FROM users WHERE id = $1",
      [request.userId]
    );
    const user = result.rows[0];
    if (!user || !(await bcrypt.compare(String(currentPassword || ""), user.password_hash))) {
      return response.status(401).json({ error: "Your current password is incorrect." });
    }
    const passwordHash = await bcrypt.hash(newPassword, 12);
    await pool.query(
      "UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2",
      [passwordHash, request.userId]
    );
    return response.json({ ok: true });
  } catch (error) {
    console.error(error);
    return response.status(500).json({ error: "Could not change password." });
  }
});

app.post("/api/auth/change-username", authenticate, async (request, response) => {
  const { username } = request.body || {};
  if (!validUsername(username)) {
    return response.status(400).json({ error: "Username must be 3-64 letters or numbers." });
  }

  try {
    const normalized = normalizeUsername(username);
    const result = await pool.query(
      `UPDATE users
       SET username = $1, username_normalized = $2, updated_at = NOW()
       WHERE id = $3
       RETURNING username`,
      [String(username).trim(), normalized, request.userId]
    );
    return response.json({ username: result.rows[0].username });
  } catch (error) {
    if (error.code === "23505") {
      return response.status(409).json({ error: "That username is already in use." });
    }
    console.error(error);
    return response.status(500).json({ error: "Could not change username." });
  }
});

app.get("/api/data", authenticate, async (request, response) => {
  try {
    const result = await pool.query(
      "SELECT state FROM users WHERE id = $1",
      [request.userId]
    );
    return response.json({ state: result.rows[0]?.state || {} });
  } catch (error) {
    console.error(error);
    return response.status(500).json({ error: "Could not load your saved data. Please refresh and try again." });
  }
});

app.put("/api/data", authenticate, async (request, response) => {
  const state = request.body?.state;
  if (!state || typeof state !== "object" || Array.isArray(state)) {
    return response.status(400).json({ error: "A state object is required." });
  }

  try {
    await pool.query(
      "UPDATE users SET state = $1::jsonb, updated_at = NOW() WHERE id = $2",
      [JSON.stringify(state), request.userId]
    );
    return response.json({ ok: true });
  } catch (error) {
    console.error(error);
    return response.status(500).json({ error: "Could not save your changes. Check your connection and try again." });
  }
});

app.use((error, _request, response, _next) => {
  console.error(error);
  response.status(500).json({ error: "Unexpected server error." });
});

ensureSchema()
  .then(() => {
    app.listen(port, "0.0.0.0", () => {
      console.log(`FocusFlow API listening on port ${port}`);
    });
  })
  .catch(error => {
    console.error("Database startup failed:", error);
    process.exit(1);
  });