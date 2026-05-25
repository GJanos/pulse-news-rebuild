import type { IncomingMessage, ServerResponse } from 'http';
import { buildClient } from '../src/notify';
import { loadPulseConfig } from '../src/config';
import { getLogger } from '../src/logging';

/**
 * Account lifecycle endpoint — no CRON_SECRET required, these are user-initiated.
 *
 * POST   /api/account  — register: upsert the device record linked to the
 *                         authenticated user. Body: { deviceId, fcmToken, notifyAt? }
 *                         Call this on sign-in / sign-up so the device row always
 *                         carries the current auth.users foreign key.
 *
 * DELETE /api/account  — delete: permanently remove the authenticated user.
 *                         auth.admin.deleteUser triggers the schema cascade:
 *                           user_preferences  → deleted  (ON DELETE CASCADE)
 *                           devices.user_id   → nulled   (ON DELETE SET NULL)
 */
export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  loadPulseConfig();

  const auth = req.headers.authorization ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: false, error: 'Missing authorization token' }));
    return;
  }

  const db = buildClient();
  const {
    data: { user },
    error: verifyError,
  } = await db.auth.getUser(token);
  if (verifyError || !user) {
    getLogger('account').warn(`Token verification failed: ${verifyError?.message ?? 'no user'}`);
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: false, error: 'Invalid or expired token' }));
    return;
  }

  if (req.method === 'POST') {
    await handleRegister(req, res, db, user.id);
  } else if (req.method === 'DELETE') {
    await handleDelete(res, db, user.id, user.email);
  } else {
    res.writeHead(405, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: false, error: 'Method not allowed' }));
  }
}

// ── Registration ─────────────────────────────────────────────────────

interface RegisterBody {
  deviceId: string;
  fcmToken: string;
  notifyAt?: string | null;
}

async function handleRegister(
  req: IncomingMessage,
  res: ServerResponse,
  db: ReturnType<typeof buildClient>,
  userId: string,
): Promise<void> {
  const log = getLogger('account');
  const body = await readBody<RegisterBody>(req);
  if (!body?.deviceId || !body?.fcmToken) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: false, error: 'deviceId and fcmToken are required' }));
    return;
  }

  log.info(`Registering device ${body.deviceId} for user ${userId}`);

  const { error } = await db.from('devices').upsert(
    {
      id: body.deviceId,
      fcm_token: body.fcmToken,
      notify_at: body.notifyAt ?? null,
      user_id: userId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id' },
  );

  if (error) {
    log.error(`Device upsert failed for ${userId}: ${error.message}`);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: false, error: error.message }));
    return;
  }

  log.info(`Device ${body.deviceId} registered for user ${userId}`);
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ ok: true }));
}

// ── Deletion ─────────────────────────────────────────────────────────

async function handleDelete(
  res: ServerResponse,
  db: ReturnType<typeof buildClient>,
  userId: string,
  email: string | undefined,
): Promise<void> {
  const log = getLogger('account');
  log.info(`Deleting account: ${userId} (${email ?? 'no email'})`);

  const { error } = await db.auth.admin.deleteUser(userId);
  if (error) {
    log.error(`Failed to delete user ${userId}: ${error.message}`);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: false, error: error.message }));
    return;
  }

  log.info(`Account deleted: ${userId}`);
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ ok: true }));
}

// ── Helpers ──────────────────────────────────────────────────────────

function readBody<T>(req: IncomingMessage): Promise<T | null> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')) as T);
      } catch {
        resolve(null);
      }
    });
    req.on('error', () => resolve(null));
  });
}
