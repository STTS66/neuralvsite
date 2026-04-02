const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const bcrypt = require('bcrypt');
const multer = require('multer');
const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();

const PORT = Number(process.env.PORT || 3000);
const CLIENT_ID =
  process.env.GOOGLE_CLIENT_ID ||
  '294849109258-6lm6hj1qcsg118iv0vh211dl1fhgpja0.apps.googleusercontent.com';
const DEFAULT_ADMIN_USERNAME = process.env.DEFAULT_ADMIN_USERNAME || 'FatalError';
const DEFAULT_ADMIN_EMAIL = process.env.DEFAULT_ADMIN_EMAIL || 'admin@neuralv.com';
const DEFAULT_ADMIN_PASSWORD =
  process.env.DEFAULT_ADMIN_PASSWORD || 'N3ur@l_Pr0t3ct!on_#777';
const VT_API_KEY = process.env.VT_API_KEY || '';
const SUPPORT_INTERNAL_TOKEN = process.env.SUPPORT_INTERNAL_TOKEN || 'change-me';
const SUPPORT_MESSAGE_COOLDOWN_MS = Number(
  process.env.SUPPORT_MESSAGE_COOLDOWN_MS || 5000,
);
const REGISTRATION_CODE_TTL_MINUTES = Number(
  process.env.REGISTRATION_CODE_TTL_MINUTES || 15,
);
const SMTP_HOST = (process.env.SMTP_HOST || '').trim();
const SMTP_PORT = Number(process.env.SMTP_PORT || 587);
const SMTP_USER = (process.env.SMTP_USER || '').trim();
const SMTP_PASS = process.env.SMTP_PASS || '';
const SMTP_FROM = (process.env.SMTP_FROM || SMTP_USER || '').trim();
const SMTP_SECURE = ['1', 'true', 'yes'].includes(
  String(process.env.SMTP_SECURE || '').trim().toLowerCase(),
);
const SUPPORT_ADMIN_TELEGRAM_IDS = (process.env.SUPPORT_ADMIN_TELEGRAM_IDS || '')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);
const DATABASE_URL =
  process.env.DATABASE_URL || 'postgresql://postgres:postgres@postgres:5432/neuralv';
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, 'uploads');

function ensureDirectory(targetPath) {
  if (!fs.existsSync(targetPath)) {
    fs.mkdirSync(targetPath, { recursive: true });
  }
}

ensureDirectory(UPLOAD_DIR);

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use('/uploads', express.static(UPLOAD_DIR));

app.use((req, _res, next) => {
  if (req.path.startsWith('/api')) {
    console.log(`[REQUEST] ${req.method} ${req.path}`);
  }
  next();
});

const pool = new Pool({
  connectionString: DATABASE_URL,
});

const mailTransport = SMTP_HOST
  ? nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_SECURE,
      auth: SMTP_USER
        ? {
            user: SMTP_USER,
            pass: SMTP_PASS,
          }
        : undefined,
    })
  : null;

pool.on('error', (error) => {
  console.error('Unexpected PostgreSQL error:', error);
});

function withPgPlaceholders(sql) {
  let index = 0;
  return sql.replace(/\?/g, () => {
    index += 1;
    return `$${index}`;
  });
}

function prepareSql(sql) {
  return withPgPlaceholders(sql).trim();
}

async function runAsync(sql, params = []) {
  const result = await pool.query(prepareSql(sql), params);
  return {
    lastID: result.rows[0]?.id ?? null,
    changes: result.rowCount ?? 0,
  };
}

async function getAsync(sql, params = []) {
  const result = await pool.query(prepareSql(sql), params);
  return result.rows[0] || null;
}

async function allAsync(sql, params = []) {
  const result = await pool.query(prepareSql(sql), params);
  return result.rows || [];
}

async function execAsync(sql) {
  await pool.query(sql);
}

function asyncRoute(handler) {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

function createHttpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function nowIso() {
  return new Date().toISOString();
}

function normalizeText(value, maxLength = 2000) {
  if (typeof value !== 'string') {
    return '';
  }

  return value.replace(/\r\n/g, '\n').trim().slice(0, maxLength);
}

function normalizeEmail(value) {
  return normalizeText(value, 160).toLowerCase();
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function generateVerificationCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function hashVerificationCode(code) {
  return crypto.createHash('sha256').update(String(code)).digest('hex');
}

async function sendRegistrationCodeEmail({ email, username, code }) {
  if (!mailTransport || !SMTP_FROM) {
    throw createHttpError(
      503,
      'Email verification is not configured on the server.',
    );
  }

  await mailTransport.sendMail({
    from: SMTP_FROM,
    to: email,
    subject: 'NeuralV verification code',
    text: [
      `Hello, ${username}!`,
      '',
      `Your NeuralV verification code: ${code}`,
      `The code is valid for ${REGISTRATION_CODE_TTL_MINUTES} minutes.`,
      '',
      'If you did not request registration, just ignore this email.',
    ].join('\n'),
    html: `
      <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#111827">
        <h2 style="margin:0 0 16px">NeuralV verification</h2>
        <p style="margin:0 0 16px">Hello, <strong>${username}</strong>.</p>
        <p style="margin:0 0 12px">Use this code to complete your registration:</p>
        <div style="margin:0 0 16px;padding:16px 20px;background:#f3f4f6;border-radius:12px;font-size:32px;font-weight:700;letter-spacing:6px;text-align:center">
          ${code}
        </div>
        <p style="margin:0 0 8px">The code is valid for ${REGISTRATION_CODE_TTL_MINUTES} minutes.</p>
        <p style="margin:0;color:#6b7280">If you did not request registration, just ignore this email.</p>
      </div>
    `,
  });
}

function toNullableInteger(value) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isNaN(parsed) ? null : parsed;
}

function toNullableTelegramId(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  return String(value).trim();
}

function buildSupportDisplayName(displayName, userId, clientId, currentName) {
  const cleanName = normalizeText(displayName, 80);
  if (cleanName) {
    return cleanName;
  }

  if (currentName) {
    return currentName;
  }

  if (userId) {
    return `Пользователь #${userId}`;
  }

  return `Гость ${String(clientId).slice(-6)}`;
}

function remainingCooldownMs(lastUserMessageAt) {
  if (!lastUserMessageAt) {
    return 0;
  }

  const sentAt = new Date(lastUserMessageAt).getTime();
  if (Number.isNaN(sentAt)) {
    return 0;
  }

  return Math.max(0, sentAt + SUPPORT_MESSAGE_COOLDOWN_MS - Date.now());
}

async function generateSupportPublicId() {
  let publicId = '';

  while (!publicId) {
    const candidate = `SUP-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    const existing = await getAsync(
      'SELECT id FROM support_conversations WHERE public_id = ?',
      [candidate],
    );

    if (!existing) {
      publicId = candidate;
    }
  }

  return publicId;
}

function formatSupportMessage(row) {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    senderType: row.sender_type,
    senderName: row.sender_name,
    text: row.text,
    createdAt: row.created_at,
  };
}

async function listSupportMessages(conversationId, afterId = 0) {
  const rows = await allAsync(
    `
      SELECT id, conversation_id, sender_type, sender_name, text, created_at
      FROM support_messages
      WHERE conversation_id = ? AND id > ?
      ORDER BY id ASC
    `,
    [conversationId, afterId],
  );

  return rows.map(formatSupportMessage);
}

async function getSupportSettings() {
  const rows = await allAsync('SELECT key, value FROM support_settings');
  return Object.fromEntries(rows.map((row) => [row.key, row.value]));
}

async function setSupportSetting(key, value) {
  if (value === null || value === undefined || value === '') {
    await runAsync('DELETE FROM support_settings WHERE key = ?', [key]);
    return;
  }

  await runAsync(
    `
      INSERT INTO support_settings (key, value, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET
        value = excluded.value,
        updated_at = excluded.updated_at
    `,
    [key, String(value), nowIso()],
  );
}

async function getSupportConversationByClient(conversationId, clientId) {
  return getAsync(
    'SELECT * FROM support_conversations WHERE id = ? AND client_id = ?',
    [conversationId, clientId],
  );
}

async function getOrCreateSupportConversation({ clientId, userId, displayName }) {
  let conversation = await getAsync(
    `
      SELECT *
      FROM support_conversations
      WHERE client_id = ?
      ORDER BY id DESC
      LIMIT 1
    `,
    [clientId],
  );

  const normalizedUserId = toNullableInteger(userId);
  const timestamp = nowIso();

  if (!conversation) {
    const publicId = await generateSupportPublicId();
    const resolvedName = buildSupportDisplayName(displayName, normalizedUserId, clientId);

    const insertResult = await runAsync(
      `
        INSERT INTO support_conversations (
          public_id,
          client_id,
          user_id,
          display_name,
          status,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, 'open', ?, ?)
        RETURNING id
      `,
      [publicId, clientId, normalizedUserId, resolvedName, timestamp, timestamp],
    );

    conversation = await getAsync(
      'SELECT * FROM support_conversations WHERE id = ?',
      [insertResult.lastID],
    );
  } else {
    const nextUserId = normalizedUserId ?? conversation.user_id;
    const resolvedName = buildSupportDisplayName(
      displayName,
      nextUserId,
      clientId,
      conversation.display_name,
    );

    await runAsync(
      `
        UPDATE support_conversations
        SET user_id = ?, display_name = ?, updated_at = ?
        WHERE id = ?
      `,
      [nextUserId, resolvedName, timestamp, conversation.id],
    );

    conversation = {
      ...conversation,
      user_id: nextUserId,
      display_name: resolvedName,
      updated_at: timestamp,
    };
  }

  return conversation;
}

async function getRegisteredSupportUser(userId) {
  const normalizedUserId = toNullableInteger(userId);
  if (!normalizedUserId) {
    return null;
  }

  return getAsync(
    'SELECT id, username, email, role, display_name FROM users WHERE id = ?',
    [normalizedUserId],
  );
}

const supportStreams = new Map();

function sendSseEvent(response, event, data) {
  response.write(`event: ${event}\n`);
  response.write(`data: ${JSON.stringify(data)}\n\n`);
}

function subscribeToConversationStream(conversationId, response) {
  const key = String(conversationId);
  const connections = supportStreams.get(key) || new Set();
  connections.add(response);
  supportStreams.set(key, connections);

  sendSseEvent(response, 'ready', { ok: true });

  const heartbeat = setInterval(() => {
    response.write(': ping\n\n');
  }, 20000);

  response.on('close', () => {
    clearInterval(heartbeat);
    connections.delete(response);
    if (connections.size === 0) {
      supportStreams.delete(key);
    }
  });
}

function broadcastSupportMessage(conversationId, message) {
  const connections = supportStreams.get(String(conversationId));
  if (!connections) {
    return;
  }

  for (const connection of connections) {
    sendSseEvent(connection, 'message', message);
  }
}

async function getSupportAdminCount() {
  const row = await getAsync('SELECT COUNT(*) AS count FROM support_admins');
  return Number(row?.count || 0);
}

async function getSupportAdminByTelegramId(telegramUserId) {
  return getAsync(
    'SELECT * FROM support_admins WHERE telegram_user_id = ?',
    [String(telegramUserId)],
  );
}

async function ensureSupportAdmin(actorTelegramUserId) {
  const adminCount = await getSupportAdminCount();
  if (!adminCount) {
    throw createHttpError(
      409,
      'No support admins configured yet. Use /claimadmin first.',
    );
  }

  const admin = await getSupportAdminByTelegramId(actorTelegramUserId);
  if (!admin) {
    throw createHttpError(403, 'Only support admins can use this action.');
  }

  return admin;
}

function requireInternalToken(req, res, next) {
  if (req.headers['x-internal-token'] !== SUPPORT_INTERNAL_TOKEN) {
    res.status(403).json({ success: false, message: 'Forbidden' });
    return;
  }

  next();
}

const storage = multer.diskStorage({
  destination: (_req, _file, callback) => {
    ensureDirectory(UPLOAD_DIR);
    callback(null, UPLOAD_DIR);
  },
  filename: (_req, file, callback) => {
    callback(null, `${Date.now()}-${file.originalname}`);
  },
});

const upload = multer({ storage });

async function initializeDatabase() {
  await execAsync(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username TEXT UNIQUE,
      email TEXT UNIQUE,
      password TEXT,
      role TEXT DEFAULT 'user',
      email_verified BOOLEAN NOT NULL DEFAULT TRUE,
      display_name TEXT,
      avatar TEXT
    );

    CREATE TABLE IF NOT EXISTS email_verification_requests (
      id SERIAL PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      username TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      code_hash TEXT NOT NULL,
      attempt_count INTEGER NOT NULL DEFAULT 0,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL
    );

    CREATE TABLE IF NOT EXISTS orders (
      id SERIAL PRIMARY KEY,
      user_id INTEGER,
      link TEXT,
      file_path TEXT,
      status TEXT DEFAULT 'pending',
      license_key TEXT,
      created_at TIMESTAMPTZ,
      FOREIGN KEY(user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS support_conversations (
      id SERIAL PRIMARY KEY,
      public_id TEXT UNIQUE NOT NULL,
      client_id TEXT NOT NULL,
      user_id INTEGER,
      display_name TEXT,
      status TEXT DEFAULT 'open',
      last_user_message_at TIMESTAMPTZ,
      last_support_message_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL,
      FOREIGN KEY(user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS support_messages (
      id SERIAL PRIMARY KEY,
      conversation_id INTEGER NOT NULL,
      sender_type TEXT NOT NULL,
      sender_name TEXT NOT NULL,
      text TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL,
      telegram_delivered BOOLEAN DEFAULT FALSE,
      telegram_chat_id TEXT,
      telegram_thread_id TEXT,
      telegram_message_id INTEGER,
      FOREIGN KEY(conversation_id) REFERENCES support_conversations(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS support_admins (
      id SERIAL PRIMARY KEY,
      telegram_user_id TEXT UNIQUE NOT NULL,
      username TEXT,
      first_name TEXT,
      added_by TEXT,
      created_at TIMESTAMPTZ NOT NULL
    );

    CREATE TABLE IF NOT EXISTS support_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
    CREATE INDEX IF NOT EXISTS idx_email_verification_requests_expires_at ON email_verification_requests(expires_at);
    CREATE INDEX IF NOT EXISTS idx_email_verification_requests_username ON email_verification_requests(username);
    CREATE INDEX IF NOT EXISTS idx_support_conversations_client_id ON support_conversations(client_id);
    CREATE INDEX IF NOT EXISTS idx_support_messages_conversation_id ON support_messages(conversation_id, id);
    CREATE INDEX IF NOT EXISTS idx_support_messages_outbox ON support_messages(telegram_delivered, sender_type, id);
    CREATE INDEX IF NOT EXISTS idx_support_messages_telegram_lookup ON support_messages(telegram_chat_id, telegram_message_id);
  `);

  await execAsync(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT TRUE;
  `);

  const existingAdmin = await getAsync(
    "SELECT id FROM users WHERE role = 'admin' LIMIT 1",
  );

  if (!existingAdmin) {
    const passwordHash = await bcrypt.hash(DEFAULT_ADMIN_PASSWORD, 10);
    await runAsync(
      `
        INSERT INTO users (username, email, password, role)
        VALUES (?, ?, ?, 'admin')
        RETURNING id
      `,
      [DEFAULT_ADMIN_USERNAME, DEFAULT_ADMIN_EMAIL, passwordHash],
    );
    console.log(`Seeded default admin "${DEFAULT_ADMIN_USERNAME}".`);
  }

  for (const telegramUserId of SUPPORT_ADMIN_TELEGRAM_IDS) {
    await runAsync(
      `
        INSERT INTO support_admins (
          telegram_user_id,
          username,
          first_name,
          added_by,
          created_at
        ) VALUES (?, NULL, NULL, 'env', ?)
        ON CONFLICT (telegram_user_id) DO NOTHING
      `,
      [telegramUserId, nowIso()],
    );
  }
}

app.get('/api/health', (_req, res) => {
  res.json({ success: true, status: 'ok' });
});

app.post(
  '/api/register/request-code',
  asyncRoute(async (req, res) => {
    const username = normalizeText(req.body.username, 80);
    const email = normalizeEmail(req.body.email);
    const password = typeof req.body.password === 'string' ? req.body.password : '';

    if (!username || !email || !password) {
      res.status(400).json({ success: false, message: 'All fields are required.' });
      return;
    }

    if (!isValidEmail(email)) {
      res.status(400).json({ success: false, message: 'Enter a valid email address.' });
      return;
    }

    const existingUser = await getAsync(
      'SELECT id FROM users WHERE username = ? OR email = ? LIMIT 1',
      [username, email],
    );

    if (existingUser) {
      res.json({
        success: false,
        message: 'A user with this username or email already exists.',
      });
      return;
    }

    const pendingConflict = await getAsync(
      `
        SELECT id
        FROM email_verification_requests
        WHERE username = ? AND email <> ?
        LIMIT 1
      `,
      [username, email],
    );

    if (pendingConflict) {
      res.json({
        success: false,
        message: 'This username is already waiting for verification with another email.',
      });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const code = generateVerificationCode();
    const codeHash = hashVerificationCode(code);
    const createdAt = nowIso();
    const expiresAt = new Date(
      Date.now() + REGISTRATION_CODE_TTL_MINUTES * 60 * 1000,
    ).toISOString();

    await runAsync(
      `
        INSERT INTO email_verification_requests (
          email,
          username,
          password_hash,
          code_hash,
          attempt_count,
          expires_at,
          created_at,
          updated_at
        )
        VALUES (?, ?, ?, ?, 0, ?, ?, ?)
        ON CONFLICT (email) DO UPDATE SET
          username = excluded.username,
          password_hash = excluded.password_hash,
          code_hash = excluded.code_hash,
          attempt_count = 0,
          expires_at = excluded.expires_at,
          updated_at = excluded.updated_at
      `,
      [email, username, passwordHash, codeHash, expiresAt, createdAt, createdAt],
    );

    await sendRegistrationCodeEmail({ email, username, code });

    res.json({
      success: true,
      message: 'Verification code sent to your email.',
      email,
      expiresInMinutes: REGISTRATION_CODE_TTL_MINUTES,
    });
  }),
);

app.post(
  '/api/register',
  asyncRoute(async (req, res) => {
    res.status(410).json({
      success: false,
      message: 'Use /api/register/request-code and /api/register/verify instead.',
    });
    return;

    const username = normalizeText(req.body.username, 80);
    const email = normalizeText(req.body.email, 160);
    const password = typeof req.body.password === 'string' ? req.body.password : '';

    if (!username || !email || !password) {
      res
        .status(400)
        .json({ success: false, message: 'Все поля обязательны для заполнения.' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);

    try {
      await runAsync(
        `
          INSERT INTO users (username, email, password)
          VALUES (?, ?, ?)
        `,
        [username, email, passwordHash],
      );

      res.json({ success: true, message: 'Аккаунт успешно создан.' });
    } catch (error) {
      if (error.code === '23505' || error.message.includes('duplicate key')) {
        res.json({
          success: false,
          message: 'Пользователь с таким именем или email уже существует.',
        });
        return;
      }

      throw error;
    }
  }),
);

app.post(
  '/api/register/verify',
  asyncRoute(async (req, res) => {
    const email = normalizeEmail(req.body.email);
    const code = normalizeText(req.body.code, 12).replace(/\s+/g, '');

    if (!email || !code) {
      res.status(400).json({
        success: false,
        message: 'Email and verification code are required.',
      });
      return;
    }

    const request = await getAsync(
      'SELECT * FROM email_verification_requests WHERE email = ?',
      [email],
    );

    if (!request) {
      res.status(404).json({
        success: false,
        message: 'First request a verification code.',
      });
      return;
    }

    if (new Date(request.expires_at).getTime() < Date.now()) {
      await runAsync('DELETE FROM email_verification_requests WHERE email = ?', [email]);
      res.status(410).json({
        success: false,
        message: 'The verification code has expired. Request a new one.',
      });
      return;
    }

    if (request.code_hash !== hashVerificationCode(code)) {
      await runAsync(
        `
          UPDATE email_verification_requests
          SET attempt_count = attempt_count + 1,
              updated_at = ?
          WHERE email = ?
        `,
        [nowIso(), email],
      );
      res.status(400).json({
        success: false,
        message: 'Incorrect verification code.',
      });
      return;
    }

    try {
      const result = await runAsync(
        `
          INSERT INTO users (username, email, password, role, email_verified)
          VALUES (?, ?, ?, 'user', TRUE)
          RETURNING id
        `,
        [request.username, email, request.password_hash],
      );

      await runAsync('DELETE FROM email_verification_requests WHERE email = ?', [email]);

      const user = await getAsync(
        'SELECT id, username, role FROM users WHERE id = ?',
        [result.lastID],
      );

      res.json({ success: true, user });
    } catch (error) {
      if (error.code === '23505' || error.message.includes('duplicate key')) {
        res.json({
          success: false,
          message: 'A user with this username or email already exists.',
        });
        return;
      }

      throw error;
    }
  }),
);

app.post(
  '/api/login',
  asyncRoute(async (req, res) => {
    const login = normalizeText(req.body.login, 160);
    const password = typeof req.body.password === 'string' ? req.body.password : '';

    const user = await getAsync(
      `
        SELECT *
        FROM users
        WHERE username = ? OR email = ?
      `,
      [login, login],
    );

    if (!user) {
      res.json({ success: false, message: 'Неверный логин или пароль.' });
      return;
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      res.json({ success: false, message: 'Неверный логин или пароль.' });
      return;
    }

    res.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
      },
    });
  }),
);

app.post(
  '/api/google-login',
  asyncRoute(async (req, res) => {
    const token = typeof req.body.token === 'string' ? req.body.token.trim() : '';
    if (!token) {
      res.status(400).json({ success: false, message: 'Missing Google token.' });
      return;
    }

    const response = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${token}`,
    );

    if (!response.ok) {
      res.json({ success: false, message: 'Invalid token.' });
      return;
    }

    const payload = await response.json();
    if (payload.aud !== CLIENT_ID) {
      res.json({ success: false, message: 'Invalid client ID.' });
      return;
    }

    const email = normalizeText(payload.email, 160);
    const name = normalizeText(payload.name, 80) || 'Google User';

    let user = await getAsync('SELECT * FROM users WHERE email = ?', [email]);

    if (!user) {
      const insertResult = await runAsync(
        `
          INSERT INTO users (username, email, password, role)
          VALUES (?, ?, 'GOOGLE_AUTH_USER', 'user')
          RETURNING id
        `,
        [name, email],
      );

      user = {
        id: insertResult.lastID,
        username: name,
        role: 'user',
      };
    }

    res.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
      },
    });
  }),
);

app.post(
  '/api/orders',
  (req, res, next) => {
    upload.single('file')(req, res, (error) => {
      if (error) {
        next(error);
        return;
      }

      next();
    });
  },
  asyncRoute(async (req, res) => {
    const link = normalizeText(req.body.link, 2000);
    const userId = toNullableInteger(req.body.user_id);
    const filePath = req.file ? req.file.path : null;

    if (!link && !filePath) {
      res
        .status(400)
        .json({ success: false, message: 'Укажите ссылку или прикрепите файл.' });
      return;
    }

    const createdAt = nowIso();
    const result = await runAsync(
      `
        INSERT INTO orders (user_id, link, file_path, status, created_at)
        VALUES (?, ?, ?, 'pending', ?)
        RETURNING id
      `,
      [userId, link || null, filePath, createdAt],
    );

    res.json({
      success: true,
      id: result.lastID,
      date: createdAt,
      link,
      status: 'pending',
    });
  }),
);

app.post(
  '/api/virustotal/scan',
  asyncRoute(async (req, res) => {
    if (!VT_API_KEY) {
      res.json({ success: false, message: 'VirusTotal API key is not configured.' });
      return;
    }

    const orderId = toNullableInteger(req.body.orderId);
    const order = await getAsync(
      'SELECT file_path FROM orders WHERE id = ?',
      [orderId],
    );

    if (!order?.file_path || !fs.existsSync(order.file_path)) {
      res.json({ success: false, message: 'File not found.' });
      return;
    }

    const fileBuffer = fs.readFileSync(order.file_path);
    const fileBlob = new Blob([fileBuffer]);
    const formData = new FormData();
    formData.append('file', fileBlob, path.basename(order.file_path));

    const response = await fetch('https://www.virustotal.com/api/v3/files', {
      method: 'POST',
      headers: {
        'x-apikey': VT_API_KEY,
      },
      body: formData,
    });

    const data = await response.json();
    if (!response.ok || data.error) {
      res.json({
        success: false,
        message: data.error?.message || 'VirusTotal request failed.',
      });
      return;
    }

    res.json({ success: true, analysisId: data.data.id });
  }),
);

app.get(
  '/api/virustotal/report/:id',
  asyncRoute(async (req, res) => {
    if (!VT_API_KEY) {
      res.json({ error: true, message: 'VirusTotal API key is not configured.' });
      return;
    }

    const response = await fetch(
      `https://www.virustotal.com/api/v3/analyses/${req.params.id}`,
      {
        headers: {
          'x-apikey': VT_API_KEY,
        },
      },
    );

    const data = await response.json();
    res.json(data);
  }),
);

app.get(
  '/api/orders',
  asyncRoute(async (req, res) => {
    const userId = toNullableInteger(req.query.user_id);
    const params = [];
    let sql = `
      SELECT orders.*, users.username
      FROM orders
      LEFT JOIN users ON users.id = orders.user_id
    `;

    if (userId) {
      sql += ' WHERE orders.user_id = ?';
      params.push(userId);
    }

    sql += ' ORDER BY orders.id DESC';

    const rows = await allAsync(sql, params);
    res.json(
      rows.map((row) => ({
        id: row.id,
        user_id: row.user_id,
        username: row.username || 'Unknown',
        date: row.created_at,
        link: row.link,
        status: row.status,
        licenseKey: row.license_key,
        hasFile: Boolean(row.file_path),
      })),
    );
  }),
);

app.get(
  '/api/users',
  asyncRoute(async (_req, res) => {
    const rows = await allAsync(
      'SELECT id, username, email, role FROM users ORDER BY id DESC',
    );
    res.json(rows);
  }),
);

app.post(
  '/api/update-status',
  asyncRoute(async (req, res) => {
    const id = toNullableInteger(req.body.id);
    const status = normalizeText(req.body.status, 40);
    const licenseKey = normalizeText(req.body.licenseKey, 120) || null;

    await runAsync(
      'UPDATE orders SET status = ?, license_key = ? WHERE id = ?',
      [status, licenseKey, id],
    );

    res.json({ success: true });
  }),
);

app.delete(
  '/api/orders/:id',
  asyncRoute(async (req, res) => {
    const orderId = toNullableInteger(req.params.id);
    const order = await getAsync(
      'SELECT file_path FROM orders WHERE id = ?',
      [orderId],
    );

    await runAsync('DELETE FROM orders WHERE id = ?', [orderId]);

    if (order?.file_path && fs.existsSync(order.file_path)) {
      fs.unlinkSync(order.file_path);
    }

    res.json({ success: true });
  }),
);

app.get(
  '/api/user/:id',
  asyncRoute(async (req, res) => {
    const user = await getAsync(
      `
        SELECT id, username, email, role, display_name, avatar
        FROM users
        WHERE id = ?
      `,
      [toNullableInteger(req.params.id)],
    );

    if (!user) {
      res.status(404).json({ success: false, message: 'User not found.' });
      return;
    }

    res.json(user);
  }),
);

app.post(
  '/api/user/update',
  asyncRoute(async (req, res) => {
    const userId = toNullableInteger(req.body.id);
    const displayName = normalizeText(req.body.display_name, 80);
    const avatar =
      typeof req.body.avatar === 'string' ? req.body.avatar.slice(0, 5_000_000) : null;
    const nextPassword =
      typeof req.body.password === 'string' ? req.body.password : '';
    const oldPassword =
      typeof req.body.oldPassword === 'string' ? req.body.oldPassword : '';

    const user = await getAsync('SELECT * FROM users WHERE id = ?', [userId]);
    if (!user) {
      res.status(404).json({ success: false, message: 'User not found.' });
      return;
    }

    let passwordHash = null;
    if (nextPassword) {
      if (!oldPassword) {
        res.json({
          success: false,
          message: 'Введите текущий пароль, чтобы изменить его.',
        });
        return;
      }

      const validOldPassword = await bcrypt.compare(oldPassword, user.password);
      if (!validOldPassword) {
        res.json({
          success: false,
          message: 'Текущий пароль введён неверно.',
        });
        return;
      }

      passwordHash = await bcrypt.hash(nextPassword, 10);
    }

    const updates = [];
    const params = [];

    if (displayName || displayName === '') {
      updates.push('display_name = ?');
      params.push(displayName || null);
    }

    if (avatar !== null || req.body.avatar === null) {
      updates.push('avatar = ?');
      params.push(avatar);
    }

    if (passwordHash) {
      updates.push('password = ?');
      params.push(passwordHash);
    }

    if (!updates.length) {
      res.json({ success: true, message: 'Nothing to update.' });
      return;
    }

    params.push(userId);
    await runAsync(
      `UPDATE users SET ${updates.join(', ')} WHERE id = ?`,
      params,
    );

    res.json({ success: true });
  }),
);

app.post(
  '/api/support/session',
  asyncRoute(async (req, res) => {
    const clientId = normalizeText(req.body.clientId, 120);
    if (!clientId) {
      res.status(400).json({ success: false, message: 'clientId is required.' });
      return;
    }

    const supportUser = await getRegisteredSupportUser(req.body.userId);
    if (!supportUser) {
      res.status(403).json({
        success: false,
        message: 'Support is available only to registered users.',
      });
      return;
    }

    const conversation = await getOrCreateSupportConversation({
      clientId,
      userId: supportUser.id,
      displayName: supportUser.display_name || supportUser.username,
    });

    const messages = await listSupportMessages(conversation.id);
    res.json({
      success: true,
      conversation: {
        id: conversation.id,
        publicId: conversation.public_id,
        displayName: conversation.display_name,
        status: conversation.status,
      },
      messages,
      cooldownMs: SUPPORT_MESSAGE_COOLDOWN_MS,
      retryAfterMs: remainingCooldownMs(conversation.last_user_message_at),
    });
  }),
);

app.get(
  '/api/support/conversations/:id/messages',
  asyncRoute(async (req, res) => {
    const conversationId = toNullableInteger(req.params.id);
    const clientId = normalizeText(req.query.clientId, 120);
    const supportUser = await getRegisteredSupportUser(req.query.userId);
    const afterId = toNullableInteger(req.query.afterId) || 0;

    if (!supportUser) {
      res.status(403).json({
        success: false,
        message: 'Support is available only to registered users.',
      });
      return;
    }

    const conversation = await getSupportConversationByClient(conversationId, clientId);
    if (!conversation || Number(conversation.user_id) !== supportUser.id) {
      res.status(404).json({ success: false, message: 'Conversation not found.' });
      return;
    }

    const messages = await listSupportMessages(conversationId, afterId);
    res.json({
      success: true,
      messages,
      retryAfterMs: remainingCooldownMs(conversation.last_user_message_at),
    });
  }),
);

app.get(
  '/api/support/conversations/:id/stream',
  asyncRoute(async (req, res) => {
    const conversationId = toNullableInteger(req.params.id);
    const clientId = normalizeText(req.query.clientId, 120);
    const supportUser = await getRegisteredSupportUser(req.query.userId);

    if (!supportUser) {
      res.status(403).json({
        success: false,
        message: 'Support is available only to registered users.',
      });
      return;
    }

    const conversation = await getSupportConversationByClient(conversationId, clientId);
    if (!conversation || Number(conversation.user_id) !== supportUser.id) {
      res.status(404).json({ success: false, message: 'Conversation not found.' });
      return;
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    subscribeToConversationStream(conversationId, res);
  }),
);

app.post(
  '/api/support/messages',
  asyncRoute(async (req, res) => {
    const conversationId = toNullableInteger(req.body.conversationId);
    const clientId = normalizeText(req.body.clientId, 120);
    const text = normalizeText(req.body.text, 2000);
    const supportUser = await getRegisteredSupportUser(req.body.userId);

    if (!conversationId || !clientId || !text) {
      res.status(400).json({
        success: false,
        message: 'conversationId, clientId and text are required.',
      });
      return;
    }

    if (!supportUser) {
      res.status(403).json({
        success: false,
        message: 'Support is available only to registered users.',
      });
      return;
    }

    const conversation = await getSupportConversationByClient(conversationId, clientId);
    if (!conversation || Number(conversation.user_id) !== supportUser.id) {
      res.status(404).json({ success: false, message: 'Conversation not found.' });
      return;
    }

    const retryAfterMs = remainingCooldownMs(conversation.last_user_message_at);
    if (retryAfterMs > 0) {
      res.status(429).json({
        success: false,
        message: 'Подождите перед следующим сообщением.',
        retryAfterMs,
      });
      return;
    }

    const createdAt = nowIso();
    const senderName = buildSupportDisplayName(
      supportUser.display_name || supportUser.username,
      supportUser.id,
      clientId,
      conversation.display_name,
    );

    const insertResult = await runAsync(
      `
        INSERT INTO support_messages (
          conversation_id,
          sender_type,
          sender_name,
          text,
          created_at,
          telegram_delivered
        ) VALUES (?, 'user', ?, ?, ?, FALSE)
        RETURNING id
      `,
      [conversationId, senderName, text, createdAt],
    );

    await runAsync(
      `
        UPDATE support_conversations
        SET display_name = ?, user_id = ?, last_user_message_at = ?, updated_at = ?
        WHERE id = ?
      `,
      [
        senderName,
        supportUser.id,
        createdAt,
        createdAt,
        conversationId,
      ],
    );

    const message = await getAsync(
      `
        SELECT id, conversation_id, sender_type, sender_name, text, created_at
        FROM support_messages
        WHERE id = ?
      `,
      [insertResult.lastID],
    );

    const payload = formatSupportMessage(message);
    broadcastSupportMessage(conversationId, payload);

    res.json({
      success: true,
      message: payload,
      retryAfterMs: SUPPORT_MESSAGE_COOLDOWN_MS,
    });
  }),
);

app.use('/api/internal', requireInternalToken);

app.get(
  '/api/internal/support/state',
  asyncRoute(async (req, res) => {
    const actorTelegramUserId = toNullableTelegramId(req.query.telegramUserId);
    const settings = await getSupportSettings();
    const adminCount = await getSupportAdminCount();
    const isAdmin = actorTelegramUserId
      ? Boolean(await getSupportAdminByTelegramId(actorTelegramUserId))
      : false;

    res.json({
      success: true,
      adminCount,
      isAdmin,
      supportChatId: settings.support_chat_id || null,
      supportThreadId: settings.support_thread_id || null,
      cooldownMs: SUPPORT_MESSAGE_COOLDOWN_MS,
    });
  }),
);

app.post(
  '/api/internal/support/claim-admin',
  asyncRoute(async (req, res) => {
    const telegramUserId = toNullableTelegramId(req.body.telegramUserId);
    if (!telegramUserId) {
      res.status(400).json({ success: false, message: 'telegramUserId is required.' });
      return;
    }

    const adminCount = await getSupportAdminCount();
    const existingAdmin = await getSupportAdminByTelegramId(telegramUserId);

    if (adminCount > 0 && !existingAdmin) {
      res.status(409).json({
        success: false,
        message: 'Админ уже настроен. Используйте /addadmin от имени действующего админа.',
      });
      return;
    }

    if (!existingAdmin) {
      await runAsync(
        `
          INSERT INTO support_admins (
            telegram_user_id,
            username,
            first_name,
            added_by,
            created_at
          ) VALUES (?, ?, ?, ?, ?)
        `,
        [
          telegramUserId,
          normalizeText(req.body.username, 80) || null,
          normalizeText(req.body.firstName, 80) || null,
          'claim-admin',
          nowIso(),
        ],
      );
    }

    res.json({ success: true });
  }),
);

app.post(
  '/api/internal/support/admins',
  asyncRoute(async (req, res) => {
    const actorTelegramUserId = toNullableTelegramId(req.body.actorTelegramUserId);
    const targetTelegramUserId = toNullableTelegramId(req.body.targetTelegramUserId);

    if (!actorTelegramUserId || !targetTelegramUserId) {
      res.status(400).json({
        success: false,
        message: 'actorTelegramUserId and targetTelegramUserId are required.',
      });
      return;
    }

    await ensureSupportAdmin(actorTelegramUserId);

    const existingAdmin = await getSupportAdminByTelegramId(targetTelegramUserId);
    if (!existingAdmin) {
      await runAsync(
        `
          INSERT INTO support_admins (
            telegram_user_id,
            username,
            first_name,
            added_by,
            created_at
          ) VALUES (?, ?, ?, ?, ?)
        `,
        [
          targetTelegramUserId,
          normalizeText(req.body.username, 80) || null,
          normalizeText(req.body.firstName, 80) || null,
          actorTelegramUserId,
          nowIso(),
        ],
      );
    }

    res.json({ success: true });
  }),
);

app.post(
  '/api/internal/support/settings',
  asyncRoute(async (req, res) => {
    if (Object.prototype.hasOwnProperty.call(req.body, 'supportChatId')) {
      await setSupportSetting('support_chat_id', toNullableTelegramId(req.body.supportChatId));
    }

    if (Object.prototype.hasOwnProperty.call(req.body, 'supportThreadId')) {
      await setSupportSetting(
        'support_thread_id',
        toNullableTelegramId(req.body.supportThreadId),
      );
    }

    const settings = await getSupportSettings();
    res.json({
      success: true,
      supportChatId: settings.support_chat_id || null,
      supportThreadId: settings.support_thread_id || null,
    });
  }),
);

app.get(
  '/api/internal/support/outbox',
  asyncRoute(async (req, res) => {
    const limit = Math.max(
      1,
      Math.min(50, toNullableInteger(req.query.limit) || 20),
    );

    const rows = await allAsync(
      `
        SELECT
          support_messages.id,
          support_messages.conversation_id,
          support_messages.sender_name,
          support_messages.text,
          support_messages.created_at,
          support_conversations.public_id,
          support_conversations.client_id,
          support_conversations.user_id,
          support_conversations.display_name
        FROM support_messages
        INNER JOIN support_conversations
          ON support_conversations.id = support_messages.conversation_id
        WHERE support_messages.sender_type = 'user'
          AND support_messages.telegram_delivered = FALSE
        ORDER BY support_messages.id ASC
        LIMIT ?
      `,
      [limit],
    );

    res.json({
      success: true,
      items: rows.map((row) => ({
        id: row.id,
        conversationId: row.conversation_id,
        publicId: row.public_id,
        clientId: row.client_id,
        userId: row.user_id,
        senderName: row.sender_name,
        conversationDisplayName: row.display_name,
        text: row.text,
        createdAt: row.created_at,
      })),
    });
  }),
);

app.post(
  '/api/internal/support/outbox/:id/delivered',
  asyncRoute(async (req, res) => {
    const messageId = toNullableInteger(req.params.id);
    const telegramChatId = toNullableTelegramId(req.body.telegramChatId);
    const telegramThreadId = toNullableTelegramId(req.body.telegramThreadId);
    const telegramMessageId = toNullableInteger(req.body.telegramMessageId);

    if (!messageId || !telegramChatId || !telegramMessageId) {
      res.status(400).json({
        success: false,
        message: 'messageId, telegramChatId and telegramMessageId are required.',
      });
      return;
    }

    await runAsync(
      `
        UPDATE support_messages
        SET telegram_delivered = TRUE,
            telegram_chat_id = ?,
            telegram_thread_id = ?,
            telegram_message_id = ?
        WHERE id = ?
      `,
      [telegramChatId, telegramThreadId, telegramMessageId, messageId],
    );

    res.json({ success: true });
  }),
);

app.get(
  '/api/internal/support/telegram-map',
  asyncRoute(async (req, res) => {
    const telegramChatId = toNullableTelegramId(req.query.chatId);
    const telegramMessageId = toNullableInteger(req.query.messageId);

    if (!telegramChatId || !telegramMessageId) {
      res.status(400).json({
        success: false,
        message: 'chatId and messageId are required.',
      });
      return;
    }

    const row = await getAsync(
      `
        SELECT
          support_messages.id,
          support_messages.conversation_id,
          support_conversations.public_id,
          support_conversations.display_name
        FROM support_messages
        INNER JOIN support_conversations
          ON support_conversations.id = support_messages.conversation_id
        WHERE support_messages.telegram_chat_id = ?
          AND support_messages.telegram_message_id = ?
        LIMIT 1
      `,
      [telegramChatId, telegramMessageId],
    );

    res.json({
      success: true,
      item: row
        ? {
            supportMessageId: row.id,
            conversationId: row.conversation_id,
            publicId: row.public_id,
            displayName: row.display_name,
          }
        : null,
    });
  }),
);

app.post(
  '/api/internal/support/reply',
  asyncRoute(async (req, res) => {
    const conversationId = toNullableInteger(req.body.conversationId);
    const text = normalizeText(req.body.text, 2000);

    if (!conversationId || !text) {
      res.status(400).json({
        success: false,
        message: 'conversationId and text are required.',
      });
      return;
    }

    const conversation = await getAsync(
      'SELECT * FROM support_conversations WHERE id = ?',
      [conversationId],
    );

    if (!conversation) {
      res.status(404).json({ success: false, message: 'Conversation not found.' });
      return;
    }

    const createdAt = nowIso();
    const senderName =
      normalizeText(req.body.senderName, 80) ||
      'Поддержка';

    const insertResult = await runAsync(
      `
        INSERT INTO support_messages (
          conversation_id,
          sender_type,
          sender_name,
          text,
          created_at,
          telegram_delivered
        ) VALUES (?, 'support', ?, ?, ?, TRUE)
        RETURNING id
      `,
      [conversationId, senderName, text, createdAt],
    );

    await runAsync(
      `
        UPDATE support_conversations
        SET last_support_message_at = ?, updated_at = ?
        WHERE id = ?
      `,
      [createdAt, createdAt, conversationId],
    );

    const message = await getAsync(
      `
        SELECT id, conversation_id, sender_type, sender_name, text, created_at
        FROM support_messages
        WHERE id = ?
      `,
      [insertResult.lastID],
    );

    const payload = formatSupportMessage(message);
    broadcastSupportMessage(conversationId, payload);

    res.json({ success: true, message: payload });
  }),
);

app.use('/api', (req, res) => {
  res.status(404).json({
    success: false,
    message: `API route not found: ${req.method} ${req.originalUrl}`,
  });
});

app.use((error, _req, res, _next) => {
  console.error('[SERVER ERROR]', error);
  res.status(error.status || 500).json({
    success: false,
    message: error.message || 'Internal Server Error',
  });
});

initializeDatabase()
  .then(() => {
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running on http://0.0.0.0:${PORT}`);
    });
  })
  .catch((error) => {
    console.error('Failed to initialize database:', error);
    process.exit(1);
  });
