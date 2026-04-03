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
const ORDER_UPLOAD_MAX_SIZE = 64 * 1024 * 1024;
const ORDER_ALLOWED_LINK_PROTOCOLS = new Set(['http:', 'https:']);
const LOGIN_GUARD_WINDOW_MS = 30 * 60 * 1000;
const LOGIN_GUARD_MAX_ATTEMPTS = 7;
const LOGIN_GUARD_BLOCK_MS = 60 * 60 * 1000;
const REGISTER_REQUEST_GUARD_WINDOW_MS = 30 * 60 * 1000;
const REGISTER_REQUEST_GUARD_MAX_ATTEMPTS = 3;
const REGISTER_REQUEST_GUARD_BLOCK_MS = 60 * 60 * 1000;
const REGISTER_VERIFY_GUARD_WINDOW_MS = 30 * 60 * 1000;
const REGISTER_VERIFY_GUARD_MAX_ATTEMPTS = 5;
const REGISTER_VERIFY_GUARD_BLOCK_MS = 60 * 60 * 1000;
const ORDER_BURST_GUARD_WINDOW_MS = 3 * 60 * 1000;
const ORDER_BURST_GUARD_MAX_ATTEMPTS = 3;
const ORDER_BURST_GUARD_BLOCK_MS = 15 * 60 * 1000;
const ORDER_HOURLY_GUARD_WINDOW_MS = 60 * 60 * 1000;
const ORDER_HOURLY_GUARD_MAX_ATTEMPTS = 6;
const ORDER_HOURLY_GUARD_BLOCK_MS = 4 * 60 * 60 * 1000;
const MAX_PENDING_ORDERS_PER_USER = 3;
const DUPLICATE_ORDER_LINK_WINDOW_MS = 12 * 60 * 60 * 1000;
const ADMIN_SESSION_TTL_MS = Number(process.env.ADMIN_SESSION_TTL_MS || 7 * 24 * 60 * 60 * 1000);

function ensureDirectory(targetPath) {
  if (!fs.existsSync(targetPath)) {
    fs.mkdirSync(targetPath, { recursive: true });
  }
}

function buildUploadPublicPath(filePath) {
  return `/uploads/${path.relative(UPLOAD_DIR, filePath).replace(/\\/g, '/')}`;
}

function buildOrderFileUrl(filePath) {
  if (!filePath || !fs.existsSync(filePath)) {
    return null;
  }

  return buildUploadPublicPath(filePath);
}

function saveSupportMediaFile(file) {
  if (!file) {
    return null;
  }

  const extension =
    path.extname(file.originalname || '') ||
    `.${String(file.mimetype || 'application/octet-stream').split('/').pop() || 'bin'}`;
  const mediaDir = path.join(UPLOAD_DIR, 'support-media');
  ensureDirectory(mediaDir);

  const filename = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${extension}`;
  const targetPath = path.join(mediaDir, filename);
  fs.writeFileSync(targetPath, file.buffer);

  return buildUploadPublicPath(targetPath);
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

function sanitizeFilenamePart(value, maxLength = 80) {
  const sanitized = String(value || '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, maxLength);

  return sanitized || 'file';
}

function buildStoredUploadName(originalName) {
  const extension = sanitizeFilenamePart(path.extname(String(originalName || '')), 16) || '.bin';
  const basename = sanitizeFilenamePart(path.basename(String(originalName || ''), path.extname(String(originalName || ''))), 80);
  const uniqueSuffix = crypto.randomBytes(6).toString('hex');
  return `${Date.now()}-${basename}-${uniqueSuffix}${extension}`;
}

function validateOrderLink(link) {
  if (!link) {
    return '';
  }

  try {
    const parsed = new URL(link);

    if (!ORDER_ALLOWED_LINK_PROTOCOLS.has(parsed.protocol)) {
      return 'Укажите ссылку в формате http:// или https://.';
    }

    if (!parsed.hostname) {
      return 'Укажите корректную ссылку на проект или пост.';
    }

    return '';
  } catch (_error) {
    return 'Укажите корректную ссылку на проект или пост.';
  }
}

function generateVerificationCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

async function generateUserAccountId() {
  let accountId = '';

  while (!accountId) {
    const candidate = `NV-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
    const existing = await getAsync('SELECT id FROM users WHERE account_id = ? LIMIT 1', [
      candidate,
    ]);

    if (!existing) {
      accountId = candidate;
    }
  }

  return accountId;
}

function hashVerificationCode(code) {
  return crypto.createHash('sha256').update(String(code)).digest('hex');
}

function hashAdminSessionToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

function generateAdminSessionToken() {
  return crypto.randomBytes(32).toString('hex');
}

function getAdminSessionTokenFromRequest(req) {
  const explicitHeader = normalizeText(req.headers['x-admin-session'], 512);
  if (explicitHeader) {
    return explicitHeader;
  }

  const authorization = normalizeText(req.headers.authorization, 512);
  if (authorization.toLowerCase().startsWith('bearer ')) {
    return authorization.slice(7).trim();
  }

  return '';
}

async function createAdminSession(userId) {
  const token = generateAdminSessionToken();
  const tokenHash = hashAdminSessionToken(token);
  const createdAt = nowIso();
  const expiresAt = new Date(Date.now() + ADMIN_SESSION_TTL_MS).toISOString();

  await runAsync('DELETE FROM admin_sessions WHERE expires_at <= ?', [createdAt]);
  await runAsync(
    `
      INSERT INTO admin_sessions (user_id, token_hash, expires_at, last_used_at, created_at)
      VALUES (?, ?, ?, ?, ?)
    `,
    [userId, tokenHash, expiresAt, createdAt, createdAt],
  );

  return {
    token,
    expiresAt,
  };
}

async function getAdminSession(req) {
  const rawToken = getAdminSessionTokenFromRequest(req);
  if (!rawToken) {
    return null;
  }

  const tokenHash = hashAdminSessionToken(rawToken);
  const session = await getAsync(
    `
      SELECT
        admin_sessions.id,
        admin_sessions.user_id,
        admin_sessions.expires_at,
        users.role
      FROM admin_sessions
      INNER JOIN users ON users.id = admin_sessions.user_id
      WHERE admin_sessions.token_hash = ?
      LIMIT 1
    `,
    [tokenHash],
  );

  if (!session) {
    return null;
  }

  const expiresAtMs = new Date(session.expires_at).getTime();
  if (session.role !== 'admin' || Number.isNaN(expiresAtMs) || expiresAtMs <= Date.now()) {
    await runAsync('DELETE FROM admin_sessions WHERE id = ?', [session.id]);
    return null;
  }

  await runAsync('UPDATE admin_sessions SET last_used_at = ? WHERE id = ?', [nowIso(), session.id]);

  return {
    sessionId: session.id,
    userId: session.user_id,
    expiresAt: session.expires_at,
  };
}

async function assertAdminSession(req) {
  const session = await getAdminSession(req);
  if (!session) {
    throw createHttpError(401, 'Требуется вход в админ-аккаунт.');
  }

  return session;
}

function getActiveBanInfo(user) {
  if (!user?.banned_until) {
    return null;
  }

  const bannedUntil = new Date(user.banned_until);
  if (Number.isNaN(bannedUntil.getTime()) || bannedUntil.getTime() <= Date.now()) {
    return null;
  }

  return {
    bannedUntilIso: bannedUntil.toISOString(),
    bannedUntilLabel: bannedUntil.toLocaleString('ru-RU'),
    reason: normalizeText(user.ban_reason, 240) || 'Причина не указана.',
  };
}

function buildBanMessage(user) {
  const banInfo = getActiveBanInfo(user);
  if (!banInfo) {
    return '';
  }

  return `Аккаунт временно заблокирован до ${banInfo.bannedUntilLabel}. Причина: ${banInfo.reason}`;
}

function normalizeGuardScopeKey(value, maxLength = 160) {
  return normalizeText(String(value ?? ''), maxLength).toLowerCase();
}

function getClientIp(req) {
  const forwarded = String(req.headers['x-forwarded-for'] || '')
    .split(',')[0]
    .trim();
  const fallback = req.ip || req.socket?.remoteAddress || '';
  return normalizeGuardScopeKey(forwarded || fallback || 'unknown', 160) || 'unknown';
}

function formatProtectionUntilLabel(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return date.toLocaleString('ru-RU');
}

function buildProtectionPauseMessage(baseMessage, blockedUntil, reason) {
  const untilLabel = formatProtectionUntilLabel(blockedUntil);
  const suffix = untilLabel ? ` Повторите после ${untilLabel}.` : ' Повторите позже.';
  const reasonPart = reason ? ` Причина: ${reason}.` : '';
  return `${baseMessage}${suffix}${reasonPart}`;
}

async function getRequestGuard(action, scopeType, scopeKey) {
  return getAsync(
    `
      SELECT *
      FROM request_guards
      WHERE action = ? AND scope_type = ? AND scope_key = ?
    `,
    [action, scopeType, scopeKey],
  );
}

function buildGuardBlockPayload(baseMessage, row) {
  return {
    blockedUntil: row?.blocked_until || null,
    reason: normalizeText(row?.reason, 240) || null,
    message: buildProtectionPauseMessage(
      baseMessage,
      row?.blocked_until,
      normalizeText(row?.reason, 240),
    ),
  };
}

async function findActiveRequestGuard(action, scopes, baseMessage) {
  for (const scope of scopes) {
    if (!scope?.scopeKey) {
      continue;
    }

    const row = await getRequestGuard(action, scope.scopeType, scope.scopeKey);
    const blockedUntil = new Date(row?.blocked_until || '').getTime();
    if (!Number.isNaN(blockedUntil) && blockedUntil > Date.now()) {
      return buildGuardBlockPayload(baseMessage, row);
    }
  }

  return null;
}

async function consumeRequestGuard(action, scopes, options) {
  let triggeredBlock = null;
  const timestamp = nowIso();
  const now = Date.now();

  for (const scope of scopes) {
    if (!scope?.scopeKey) {
      continue;
    }

    const row = await getRequestGuard(action, scope.scopeType, scope.scopeKey);
    const windowStartedAt = new Date(row?.window_started_at || '').getTime();
    const isSameWindow =
      !Number.isNaN(windowStartedAt) && now - windowStartedAt < options.windowMs;
    const attemptCount = isSameWindow ? Number(row?.attempt_count || 0) + 1 : 1;
    const nextWindowStartedAt = isSameWindow ? row.window_started_at : timestamp;
    const blockedUntil =
      attemptCount >= options.maxAttempts
        ? new Date(now + options.blockMs).toISOString()
        : null;

    await runAsync(
      `
        INSERT INTO request_guards (
          action,
          scope_type,
          scope_key,
          attempt_count,
          window_started_at,
          blocked_until,
          reason,
          created_at,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT (action, scope_type, scope_key) DO UPDATE SET
          attempt_count = excluded.attempt_count,
          window_started_at = excluded.window_started_at,
          blocked_until = excluded.blocked_until,
          reason = excluded.reason,
          updated_at = excluded.updated_at
      `,
      [
        action,
        scope.scopeType,
        scope.scopeKey,
        attemptCount,
        nextWindowStartedAt,
        blockedUntil,
        blockedUntil ? options.reason : null,
        row?.created_at || timestamp,
        timestamp,
      ],
    );

    if (blockedUntil && !triggeredBlock) {
      triggeredBlock = {
        blockedUntil,
        reason: options.reason,
        message: buildProtectionPauseMessage(
          options.message,
          blockedUntil,
          options.reason,
        ),
      };
    }
  }

  return triggeredBlock;
}

async function clearRequestGuards(action, scopes) {
  for (const scope of scopes) {
    if (!scope?.scopeKey) {
      continue;
    }

    await runAsync(
      'DELETE FROM request_guards WHERE action = ? AND scope_type = ? AND scope_key = ?',
      [action, scope.scopeType, scope.scopeKey],
    );
  }
}

function removeFileIfExists(filePath) {
  if (filePath && fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
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
    mediaType: row.media_type,
    mediaUrl: row.media_url,
    createdAt: row.created_at,
  };
}

async function listSupportMessages(conversationId, afterId = 0) {
  const rows = await allAsync(
      `
      SELECT id, conversation_id, sender_type, sender_name, text, media_type, media_url, created_at
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
    `
      SELECT id, account_id, username, email, role, display_name, banned_until, ban_reason
      FROM users
      WHERE id = ?
    `,
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

async function createSupportReplyMessage({
  conversationId,
  text,
  mediaType = null,
  mediaUrl = null,
}) {
  const conversation = await getAsync(
    'SELECT * FROM support_conversations WHERE id = ?',
    [conversationId],
  );

  if (!conversation) {
    throw createHttpError(404, 'Conversation not found.');
  }

  const createdAt = nowIso();
  const senderName = 'Поддержка';
  const normalizedText = normalizeText(text, 2000);

  const insertResult = await runAsync(
    `
      INSERT INTO support_messages (
        conversation_id,
        sender_type,
        sender_name,
        text,
        media_type,
        media_url,
        created_at,
        telegram_delivered
      ) VALUES (?, 'support', ?, ?, ?, ?, ?, TRUE)
      RETURNING id
    `,
    [conversationId, senderName, normalizedText, mediaType, mediaUrl, createdAt],
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
      SELECT id, conversation_id, sender_type, sender_name, text, media_type, media_url, created_at
      FROM support_messages
      WHERE id = ?
    `,
    [insertResult.lastID],
  );

  const payload = formatSupportMessage(message);
  broadcastSupportMessage(conversationId, payload);
  return payload;
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

async function requireAdminSession(req, res, next) {
  try {
    req.adminSession = await assertAdminSession(req);
    next();
  } catch (error) {
    if (error?.status) {
      res.status(error.status).json({
        success: false,
        message: error.message || 'Требуется вход в админ-аккаунт.',
      });
      return;
    }

    next(error);
  }
}

const storage = multer.diskStorage({
  destination: (_req, _file, callback) => {
    ensureDirectory(UPLOAD_DIR);
    callback(null, UPLOAD_DIR);
  },
  filename: (_req, file, callback) => {
    callback(null, buildStoredUploadName(file.originalname));
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: ORDER_UPLOAD_MAX_SIZE,
    files: 1,
    fields: 10,
  },
});
const supportMediaUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

async function initializeDatabase() {
  await execAsync(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      account_id TEXT UNIQUE,
      username TEXT UNIQUE,
      email TEXT UNIQUE,
      password TEXT,
      role TEXT DEFAULT 'user',
      email_verified BOOLEAN NOT NULL DEFAULT TRUE,
      display_name TEXT,
      avatar TEXT,
      banned_until TIMESTAMPTZ,
      ban_reason TEXT
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
      admin_notified BOOLEAN NOT NULL DEFAULT FALSE,
      admin_notified_at TIMESTAMPTZ,
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
      media_type TEXT,
      media_url TEXT,
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

    CREATE TABLE IF NOT EXISTS request_guards (
      id SERIAL PRIMARY KEY,
      action TEXT NOT NULL,
      scope_type TEXT NOT NULL,
      scope_key TEXT NOT NULL,
      attempt_count INTEGER NOT NULL DEFAULT 0,
      window_started_at TIMESTAMPTZ NOT NULL,
      blocked_until TIMESTAMPTZ,
      reason TEXT,
      created_at TIMESTAMPTZ NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL,
      UNIQUE(action, scope_type, scope_key)
    );

    CREATE TABLE IF NOT EXISTS admin_sessions (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL,
      token_hash TEXT UNIQUE NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      last_used_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
    CREATE INDEX IF NOT EXISTS idx_email_verification_requests_expires_at ON email_verification_requests(expires_at);
    CREATE INDEX IF NOT EXISTS idx_email_verification_requests_username ON email_verification_requests(username);
    CREATE INDEX IF NOT EXISTS idx_support_conversations_client_id ON support_conversations(client_id);
    CREATE INDEX IF NOT EXISTS idx_support_messages_conversation_id ON support_messages(conversation_id, id);
    CREATE INDEX IF NOT EXISTS idx_support_messages_outbox ON support_messages(telegram_delivered, sender_type, id);
    CREATE INDEX IF NOT EXISTS idx_support_messages_telegram_lookup ON support_messages(telegram_chat_id, telegram_message_id);
    CREATE INDEX IF NOT EXISTS idx_request_guards_blocked_until ON request_guards(action, blocked_until);
    CREATE INDEX IF NOT EXISTS idx_admin_sessions_user_id ON admin_sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_admin_sessions_expires_at ON admin_sessions(expires_at);
  `);

  await execAsync(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT TRUE;
  `);

  await execAsync(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS account_id TEXT;
  `);

  await execAsync(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS banned_until TIMESTAMPTZ;
  `);

  await execAsync(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS ban_reason TEXT;
  `);

  await execAsync(`
    ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS admin_notified BOOLEAN NOT NULL DEFAULT FALSE;
  `);

  await execAsync(`
    ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS admin_notified_at TIMESTAMPTZ;
  `);

  await execAsync(`
    ALTER TABLE support_messages
    ADD COLUMN IF NOT EXISTS media_type TEXT;
  `);

  await execAsync(`
    ALTER TABLE support_messages
    ADD COLUMN IF NOT EXISTS media_url TEXT;
  `);

  const usersWithoutAccountId = await allAsync(
    'SELECT id FROM users WHERE account_id IS NULL OR account_id = \'\'',
  );

  for (const user of usersWithoutAccountId) {
    await runAsync('UPDATE users SET account_id = ? WHERE id = ?', [
      await generateUserAccountId(),
      user.id,
    ]);
  }

  await execAsync(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_users_account_id ON users(account_id);
  `);

  const existingAdmin = await getAsync(
    "SELECT id FROM users WHERE role = 'admin' LIMIT 1",
  );

  if (!existingAdmin) {
    const passwordHash = await bcrypt.hash(DEFAULT_ADMIN_PASSWORD, 10);
    const accountId = await generateUserAccountId();
    await runAsync(
      `
        INSERT INTO users (account_id, username, email, password, role)
        VALUES (?, ?, ?, ?, 'admin')
        RETURNING id
      `,
      [accountId, DEFAULT_ADMIN_USERNAME, DEFAULT_ADMIN_EMAIL, passwordHash],
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

  await runAsync('DELETE FROM admin_sessions WHERE expires_at <= ?', [nowIso()]);
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
    const registerScopes = [
      { scopeType: 'ip', scopeKey: getClientIp(req) },
      { scopeType: 'email', scopeKey: normalizeGuardScopeKey(email, 160) },
      { scopeType: 'username', scopeKey: normalizeGuardScopeKey(username, 80) },
    ];

    if (!username || !email || !password) {
      res.status(400).json({ success: false, message: 'All fields are required.' });
      return;
    }

    if (!isValidEmail(email)) {
      res.status(400).json({ success: false, message: 'Enter a valid email address.' });
      return;
    }

    const activeRegisterGuard = await findActiveRequestGuard(
      'register-request',
      registerScopes,
      'Слишком много запросов кода подтверждения.',
    );
    if (activeRegisterGuard) {
      res.status(429).json({
        success: false,
        message: activeRegisterGuard.message,
        blockedUntil: activeRegisterGuard.blockedUntil,
        reason: activeRegisterGuard.reason,
      });
      return;
    }

    const registerGuard = await consumeRequestGuard('register-request', registerScopes, {
      windowMs: REGISTER_REQUEST_GUARD_WINDOW_MS,
      maxAttempts: REGISTER_REQUEST_GUARD_MAX_ATTEMPTS,
      blockMs: REGISTER_REQUEST_GUARD_BLOCK_MS,
      message: 'Слишком много запросов кода подтверждения.',
      reason: 'слишком частые запросы кода подтверждения',
    });
    if (registerGuard) {
      res.status(429).json({
        success: false,
        message: registerGuard.message,
        blockedUntil: registerGuard.blockedUntil,
        reason: registerGuard.reason,
      });
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
    const verifyScopes = [
      { scopeType: 'ip', scopeKey: getClientIp(req) },
      { scopeType: 'email', scopeKey: normalizeGuardScopeKey(email, 160) },
    ];

    if (!email || !code) {
      res.status(400).json({
        success: false,
        message: 'Email and verification code are required.',
      });
      return;
    }

    const activeVerifyGuard = await findActiveRequestGuard(
      'register-verify',
      verifyScopes,
      'Слишком много неверных попыток подтверждения.',
    );
    if (activeVerifyGuard) {
      res.status(429).json({
        success: false,
        message: activeVerifyGuard.message,
        blockedUntil: activeVerifyGuard.blockedUntil,
        reason: activeVerifyGuard.reason,
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

      const verifyGuard = await consumeRequestGuard('register-verify', verifyScopes, {
        windowMs: REGISTER_VERIFY_GUARD_WINDOW_MS,
        maxAttempts: REGISTER_VERIFY_GUARD_MAX_ATTEMPTS,
        blockMs: REGISTER_VERIFY_GUARD_BLOCK_MS,
        message: 'Слишком много неверных попыток подтверждения.',
        reason: 'слишком много неверных кодов подтверждения',
      });
      if (verifyGuard) {
        res.status(429).json({
          success: false,
          message: verifyGuard.message,
          blockedUntil: verifyGuard.blockedUntil,
          reason: verifyGuard.reason,
        });
        return;
      }

      res.status(400).json({
        success: false,
        message: 'Incorrect verification code.',
      });
      return;
    }

    try {
      await clearRequestGuards('register-verify', verifyScopes);

      const accountId = await generateUserAccountId();
      const result = await runAsync(
        `
          INSERT INTO users (account_id, username, email, password, role, email_verified)
          VALUES (?, ?, ?, ?, 'user', TRUE)
          RETURNING id
        `,
        [accountId, request.username, email, request.password_hash],
      );

      await runAsync('DELETE FROM email_verification_requests WHERE email = ?', [email]);

      const user = await getAsync(
        'SELECT id, account_id, username, role FROM users WHERE id = ?',
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
    const loginScopes = [
      { scopeType: 'ip', scopeKey: getClientIp(req) },
      { scopeType: 'login', scopeKey: normalizeGuardScopeKey(login, 160) },
    ];

    if (!login || !password) {
      res.status(400).json({
        success: false,
        message: 'Введите логин и пароль.',
      });
      return;
    }

    const activeLoginGuard = await findActiveRequestGuard(
      'login',
      loginScopes,
      'Слишком много попыток входа.',
    );
    if (activeLoginGuard) {
      res.status(429).json({
        success: false,
        message: activeLoginGuard.message,
        blockedUntil: activeLoginGuard.blockedUntil,
        reason: activeLoginGuard.reason,
      });
      return;
    }

    const user = await getAsync(
      `
        SELECT *
        FROM users
        WHERE username = ? OR email = ?
      `,
      [login, login],
    );

    if (!user) {
      const loginGuard = await consumeRequestGuard('login', loginScopes, {
        windowMs: LOGIN_GUARD_WINDOW_MS,
        maxAttempts: LOGIN_GUARD_MAX_ATTEMPTS,
        blockMs: LOGIN_GUARD_BLOCK_MS,
        message: 'Слишком много попыток входа.',
        reason: 'подозрительно частые ошибки авторизации',
      });
      if (loginGuard) {
        res.status(429).json({
          success: false,
          message: loginGuard.message,
          blockedUntil: loginGuard.blockedUntil,
          reason: loginGuard.reason,
        });
        return;
      }

      res.json({ success: false, message: 'Неверный логин или пароль.' });
      return;
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      const loginGuard = await consumeRequestGuard('login', loginScopes, {
        windowMs: LOGIN_GUARD_WINDOW_MS,
        maxAttempts: LOGIN_GUARD_MAX_ATTEMPTS,
        blockMs: LOGIN_GUARD_BLOCK_MS,
        message: 'Слишком много попыток входа.',
        reason: 'подозрительно частые ошибки авторизации',
      });
      if (loginGuard) {
        res.status(429).json({
          success: false,
          message: loginGuard.message,
          blockedUntil: loginGuard.blockedUntil,
          reason: loginGuard.reason,
        });
        return;
      }

      res.json({ success: false, message: 'Неверный логин или пароль.' });
      return;
    }

    const banInfo = getActiveBanInfo(user);
    if (banInfo) {
      res.status(423).json({
        success: false,
        message: buildBanMessage(user),
        bannedUntil: banInfo.bannedUntilIso,
        banReason: banInfo.reason,
      });
      return;
    }

    await clearRequestGuards('login', loginScopes);
    const adminSession = user.role === 'admin' ? await createAdminSession(user.id) : null;

    res.json({
      success: true,
      user: {
        id: user.id,
        accountId: user.account_id,
        username: user.username,
        role: user.role,
      },
      adminSessionToken: adminSession?.token || null,
      adminSessionExpiresAt: adminSession?.expiresAt || null,
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
      const accountId = await generateUserAccountId();
      const insertResult = await runAsync(
        `
          INSERT INTO users (account_id, username, email, password, role)
          VALUES (?, ?, ?, 'GOOGLE_AUTH_USER', 'user')
          RETURNING id
        `,
        [accountId, name, email],
      );

      user = {
        id: insertResult.lastID,
        account_id: accountId,
        username: name,
        role: 'user',
      };
    }

    const banInfo = getActiveBanInfo(user);
    if (banInfo) {
      res.status(423).json({
        success: false,
        message: buildBanMessage(user),
        bannedUntil: banInfo.bannedUntilIso,
        banReason: banInfo.reason,
      });
      return;
    }

    res.json({
      success: true,
      user: {
        id: user.id,
        accountId: user.account_id,
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
    const orderScopes = [
      { scopeType: 'ip', scopeKey: getClientIp(req) },
      { scopeType: 'user', scopeKey: normalizeGuardScopeKey(userId, 40) },
    ];

    if (!userId || userId <= 0) {
      removeFileIfExists(filePath);
      res.status(400).json({
        success: false,
        message: 'Некорректный идентификатор пользователя.',
      });
      return;
    }

    const linkValidationMessage = validateOrderLink(link);
    if (linkValidationMessage) {
      removeFileIfExists(filePath);
      res.status(400).json({
        success: false,
        message: linkValidationMessage,
      });
      return;
    }

    if (req.file && Number(req.file.size || 0) <= 0) {
      removeFileIfExists(filePath);
      res.status(400).json({
        success: false,
        message: 'Прикрепленный файл пустой. Выберите другой файл.',
      });
      return;
    }

    const duplicateSince = new Date(Date.now() - DUPLICATE_ORDER_LINK_WINDOW_MS).toISOString();

    const user = await getAsync(
      `
        SELECT id, account_id, username, banned_until, ban_reason
        FROM users
        WHERE id = ?
      `,
      [userId],
    );

    if (!link && !filePath) {
      res
        .status(400)
        .json({ success: false, message: 'Укажите ссылку или прикрепите файл.' });
      return;
    }

    const createdAt = nowIso();
    if (!user) {
      removeFileIfExists(filePath);
      res.status(404).json({ success: false, message: 'Пользователь не найден.' });
      return;
    }

    const banInfo = getActiveBanInfo(user);
    if (banInfo) {
      removeFileIfExists(filePath);
      res.status(423).json({
        success: false,
        message: buildBanMessage(user),
        bannedUntil: banInfo.bannedUntilIso,
        banReason: banInfo.reason,
      });
      return;
    }

    const activeBurstGuard = await findActiveRequestGuard(
      'order-burst',
      orderScopes,
      'Слишком много заявок за короткое время.',
    );
    if (activeBurstGuard) {
      removeFileIfExists(filePath);
      res.status(429).json({
        success: false,
        message: activeBurstGuard.message,
        blockedUntil: activeBurstGuard.blockedUntil,
        reason: activeBurstGuard.reason,
      });
      return;
    }

    const activeHourlyGuard = await findActiveRequestGuard(
      'order-hourly',
      orderScopes,
      'Слишком много заявок на проверку.',
    );
    if (activeHourlyGuard) {
      removeFileIfExists(filePath);
      res.status(429).json({
        success: false,
        message: activeHourlyGuard.message,
        blockedUntil: activeHourlyGuard.blockedUntil,
        reason: activeHourlyGuard.reason,
      });
      return;
    }

    const pendingOrders = await getAsync(
      `
        SELECT COUNT(*)::int AS count
        FROM orders
        WHERE user_id = ? AND status = 'pending'
      `,
      [userId],
    );

    if (Number(pendingOrders?.count || 0) >= MAX_PENDING_ORDERS_PER_USER) {
      removeFileIfExists(filePath);
      res.status(429).json({
        success: false,
        message: 'У вас уже есть несколько заявок на проверке. Дождитесь ответа по текущим заявкам.',
      });
      return;
    }

    if (link) {
      const duplicateLinkOrder = await getAsync(
        `
          SELECT id
          FROM orders
          WHERE user_id = ?
            AND LOWER(COALESCE(link, '')) = LOWER(?)
            AND created_at >= ?
          LIMIT 1
        `,
        [userId, link, duplicateSince],
      );

      if (duplicateLinkOrder) {
        removeFileIfExists(filePath);
        res.status(409).json({
          success: false,
          message: 'Эта ссылка уже отправлялась на проверку недавно. Дождитесь результата текущей заявки.',
        });
        return;
      }
    }

    const orderBurstGuard = await consumeRequestGuard('order-burst', orderScopes, {
      windowMs: ORDER_BURST_GUARD_WINDOW_MS,
      maxAttempts: ORDER_BURST_GUARD_MAX_ATTEMPTS,
      blockMs: ORDER_BURST_GUARD_BLOCK_MS,
      message: 'Слишком много заявок за короткое время.',
      reason: 'слишком частая отправка заявок',
    });
    if (orderBurstGuard) {
      removeFileIfExists(filePath);
      res.status(429).json({
        success: false,
        message: orderBurstGuard.message,
        blockedUntil: orderBurstGuard.blockedUntil,
        reason: orderBurstGuard.reason,
      });
      return;
    }

    const orderHourlyGuard = await consumeRequestGuard('order-hourly', orderScopes, {
      windowMs: ORDER_HOURLY_GUARD_WINDOW_MS,
      maxAttempts: ORDER_HOURLY_GUARD_MAX_ATTEMPTS,
      blockMs: ORDER_HOURLY_GUARD_BLOCK_MS,
      message: 'Слишком много заявок на проверку.',
      reason: 'подозрительно много заявок за час',
    });
    if (orderHourlyGuard) {
      removeFileIfExists(filePath);
      res.status(429).json({
        success: false,
        message: orderHourlyGuard.message,
        blockedUntil: orderHourlyGuard.blockedUntil,
        reason: orderHourlyGuard.reason,
      });
      return;
    }

    const result = await runAsync(
      `
        INSERT INTO orders (user_id, link, file_path, status, admin_notified, created_at)
        VALUES (?, ?, ?, 'pending', FALSE, ?)
        RETURNING id
      `,
      [userId, link || null, filePath, createdAt],
    );

    res.json({
      success: true,
      id: result.lastID,
      accountId: user.account_id,
      date: createdAt,
      link,
      status: 'pending',
    });
  }),
);

app.post(
  '/api/virustotal/scan',
  requireAdminSession,
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
  requireAdminSession,
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
    if (!userId) {
      await assertAdminSession(req);
    }

    const params = [];
    let sql = `
      SELECT orders.*, users.username, users.account_id
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
        accountId: row.account_id,
        username: row.username || 'Unknown',
        date: row.created_at,
        link: row.link,
        status: row.status,
        licenseKey: row.license_key,
        hasFile: Boolean(row.file_path),
        fileUrl: buildOrderFileUrl(row.file_path),
      })),
    );
  }),
);

app.get(
  '/api/users',
  requireAdminSession,
  asyncRoute(async (_req, res) => {
    const rows = await allAsync(
      `
        SELECT
          users.id,
          users.account_id,
          users.username,
          users.email,
          users.role,
          users.banned_until,
          COUNT(orders.id)::int AS order_count
        FROM users
        LEFT JOIN orders ON orders.user_id = users.id
        GROUP BY users.id
        ORDER BY users.id DESC
      `,
    );
    res.json(rows);
  }),
);

app.get(
  '/api/admin/users/search',
  requireAdminSession,
  asyncRoute(async (req, res) => {
    const accountId = normalizeText(req.query.accountId, 40).toUpperCase();

    if (!accountId) {
      res.status(400).json({ success: false, message: 'accountId is required.' });
      return;
    }

    const user = await getAsync(
      `
        SELECT id, account_id, username, email, role, display_name, avatar, banned_until, ban_reason
        FROM users
        WHERE account_id = ?
      `,
      [accountId],
    );

    if (!user) {
      res.status(404).json({ success: false, message: 'User not found.' });
      return;
    }

    const orderStats = await getAsync(
      `
        SELECT
          COUNT(*)::int AS total_orders,
          COUNT(*) FILTER (WHERE status = 'pending')::int AS pending_orders,
          COUNT(*) FILTER (WHERE status = 'active')::int AS approved_orders,
          COUNT(*) FILTER (WHERE status = 'rejected')::int AS rejected_orders,
          MAX(created_at) AS last_order_at
        FROM orders
        WHERE user_id = ?
      `,
      [user.id],
    );

    const supportStats = await getAsync(
      `
        SELECT
          COUNT(*)::int AS conversation_count,
          MAX(updated_at) AS last_support_activity_at
        FROM support_conversations
        WHERE user_id = ?
      `,
      [user.id],
    );

    const recentOrders = await allAsync(
      `
        SELECT id, link, file_path, status, created_at, license_key
        FROM orders
        WHERE user_id = ?
        ORDER BY id DESC
        LIMIT 6
      `,
      [user.id],
    );

    const banInfo = getActiveBanInfo(user);

    res.json({
      success: true,
      user: {
        id: user.id,
        accountId: user.account_id,
        username: user.username,
        email: user.email,
        role: user.role,
        displayName: user.display_name,
        avatar: user.avatar,
        bannedUntil: user.banned_until,
        banReason: user.ban_reason,
        isBanned: Boolean(banInfo),
      },
      stats: {
        totalOrders: Number(orderStats?.total_orders || 0),
        pendingOrders: Number(orderStats?.pending_orders || 0),
        approvedOrders: Number(orderStats?.approved_orders || 0),
        rejectedOrders: Number(orderStats?.rejected_orders || 0),
        supportConversations: Number(supportStats?.conversation_count || 0),
        lastOrderAt: orderStats?.last_order_at || null,
        lastSupportActivityAt: supportStats?.last_support_activity_at || null,
      },
      recentOrders: recentOrders.map((row) => ({
        id: row.id,
        link: row.link,
        fileUrl: buildOrderFileUrl(row.file_path),
        status: row.status,
        createdAt: row.created_at,
        licenseKey: row.license_key,
      })),
    });
  }),
);

app.post(
  '/api/admin/users/ban',
  requireAdminSession,
  asyncRoute(async (req, res) => {
    const accountId = normalizeText(req.body.accountId, 40).toUpperCase();
    const durationHours = Number(req.body.durationHours || 0);
    const reason = normalizeText(req.body.reason, 240) || 'Причина не указана.';

    if (!accountId || !Number.isFinite(durationHours) || durationHours <= 0) {
      res.status(400).json({
        success: false,
        message: 'accountId and positive durationHours are required.',
      });
      return;
    }

    const user = await getAsync('SELECT id FROM users WHERE account_id = ?', [accountId]);
    if (!user) {
      res.status(404).json({ success: false, message: 'User not found.' });
      return;
    }

    const bannedUntil = new Date(Date.now() + durationHours * 60 * 60 * 1000).toISOString();
    await runAsync(
      'UPDATE users SET banned_until = ?, ban_reason = ? WHERE account_id = ?',
      [bannedUntil, reason, accountId],
    );

    res.json({ success: true, bannedUntil, reason });
  }),
);

app.post(
  '/api/admin/users/unban',
  requireAdminSession,
  asyncRoute(async (req, res) => {
    const accountId = normalizeText(req.body.accountId, 40).toUpperCase();
    if (!accountId) {
      res.status(400).json({ success: false, message: 'accountId is required.' });
      return;
    }

    await runAsync(
      'UPDATE users SET banned_until = NULL, ban_reason = NULL WHERE account_id = ?',
      [accountId],
    );

    res.json({ success: true });
  }),
);

app.post(
  '/api/update-status',
  requireAdminSession,
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
  requireAdminSession,
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
        SELECT id, account_id, username, email, role, display_name, avatar, banned_until, ban_reason
        FROM users
        WHERE id = ?
      `,
      [toNullableInteger(req.params.id)],
    );

    if (!user) {
      res.status(404).json({ success: false, message: 'User not found.' });
      return;
    }

    const banInfo = getActiveBanInfo(user);

    res.json({
      ...user,
      isBanned: Boolean(banInfo),
      bannedUntil: banInfo?.bannedUntilIso || null,
      banReason: banInfo?.reason || null,
      banMessage: banInfo ? buildBanMessage(user) : null,
    });
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

    const banInfo = getActiveBanInfo(user);
    if (banInfo) {
      res.status(423).json({
        success: false,
        message: buildBanMessage(user),
        bannedUntil: banInfo.bannedUntilIso,
        banReason: banInfo.reason,
      });
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

    const banInfo = getActiveBanInfo(supportUser);
    if (banInfo) {
      res.status(423).json({
        success: false,
        message: buildBanMessage(supportUser),
        bannedUntil: banInfo.bannedUntilIso,
        banReason: banInfo.reason,
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

    const banInfo = getActiveBanInfo(supportUser);
    if (banInfo) {
      res.status(423).json({
        success: false,
        message: buildBanMessage(supportUser),
        bannedUntil: banInfo.bannedUntilIso,
        banReason: banInfo.reason,
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

    const banInfo = getActiveBanInfo(supportUser);
    if (banInfo) {
      res.status(423).json({
        success: false,
        message: buildBanMessage(supportUser),
        bannedUntil: banInfo.bannedUntilIso,
        banReason: banInfo.reason,
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

    const banInfo = getActiveBanInfo(supportUser);
    if (banInfo) {
      res.status(423).json({
        success: false,
        message: buildBanMessage(supportUser),
        bannedUntil: banInfo.bannedUntilIso,
        banReason: banInfo.reason,
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
        SELECT id, conversation_id, sender_type, sender_name, text, media_type, media_url, created_at
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
  '/api/internal/admin/state',
  asyncRoute(async (_req, res) => {
    const settings = await getSupportSettings();

    res.json({
      success: true,
      adminNotifyChatId: settings.admin_notify_chat_id || null,
      adminNotifyThreadId: settings.admin_notify_thread_id || null,
    });
  }),
);

app.post(
  '/api/internal/admin/settings',
  asyncRoute(async (req, res) => {
    if (Object.prototype.hasOwnProperty.call(req.body, 'adminNotifyChatId')) {
      await setSupportSetting(
        'admin_notify_chat_id',
        toNullableTelegramId(req.body.adminNotifyChatId),
      );
    }

    if (Object.prototype.hasOwnProperty.call(req.body, 'adminNotifyThreadId')) {
      await setSupportSetting(
        'admin_notify_thread_id',
        toNullableTelegramId(req.body.adminNotifyThreadId),
      );
    }

    const settings = await getSupportSettings();
    res.json({
      success: true,
      adminNotifyChatId: settings.admin_notify_chat_id || null,
      adminNotifyThreadId: settings.admin_notify_thread_id || null,
    });
  }),
);

app.get(
  '/api/internal/admin/orders/outbox',
  asyncRoute(async (req, res) => {
    const limit = Math.max(1, Math.min(50, toNullableInteger(req.query.limit) || 20));

    const rows = await allAsync(
      `
        SELECT
          orders.id,
          orders.link,
          orders.file_path,
          orders.created_at,
          users.id AS user_id,
          users.account_id,
          users.username,
          users.email
        FROM orders
        LEFT JOIN users ON users.id = orders.user_id
        WHERE COALESCE(orders.admin_notified, FALSE) = FALSE
        ORDER BY orders.id ASC
        LIMIT ?
      `,
      [limit],
    );

    res.json({
      success: true,
      items: rows.map((row) => ({
        id: row.id,
        userId: row.user_id,
        accountId: row.account_id,
        username: row.username || 'Unknown',
        email: row.email || null,
        link: row.link || null,
        hasFile: Boolean(row.file_path),
        createdAt: row.created_at,
      })),
    });
  }),
);

app.post(
  '/api/internal/admin/orders/:id/delivered',
  asyncRoute(async (req, res) => {
    const orderId = toNullableInteger(req.params.id);
    if (!orderId) {
      res.status(400).json({ success: false, message: 'orderId is required.' });
      return;
    }

    await runAsync(
      `
        UPDATE orders
        SET admin_notified = TRUE,
            admin_notified_at = ?
        WHERE id = ?
      `,
      [nowIso(), orderId],
    );

    res.json({ success: true });
  }),
);

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

app.post(
  '/api/internal/support/reply-media',
  (req, res, next) => {
    supportMediaUpload.single('media')(req, res, (error) => {
      if (error) {
        next(error);
        return;
      }

      next();
    });
  },
  asyncRoute(async (req, res) => {
    const conversationId = toNullableInteger(req.body.conversationId);
    const caption = normalizeText(req.body.text || req.body.caption, 2000);
    const mediaFile = req.file;

    if (!conversationId || !mediaFile) {
      res.status(400).json({
        success: false,
        message: 'conversationId and media are required.',
      });
      return;
    }

    const payload = await createSupportReplyMessage({
      conversationId,
      text: caption,
      mediaType: String(mediaFile.mimetype || '').startsWith('image/') ? 'image' : 'file',
      mediaUrl: saveSupportMediaFile(mediaFile),
    });

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

  if (error instanceof multer.MulterError) {
    const status = error.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
    const message =
      error.code === 'LIMIT_FILE_SIZE'
        ? 'Файл слишком большой. Загрузите файл меньше 64 МБ.'
        : 'Не удалось обработать файл в заявке.';

    res.status(status).json({
      success: false,
      message,
    });
    return;
  }

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
