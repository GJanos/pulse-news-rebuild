import type { IncomingMessage, ServerResponse } from 'http';

import { loadPulseConfig, checkCronSecret } from '../src/config';
import { buildClient, dispatchFcm } from '../src/notify';
import { getLogger } from '../src/logging';
import { notifyWindow } from '../src/lib/notifyWindow';

/**
 * Vercel cron handler — send push notifications to devices whose notify_at
 * falls in the current 30-minute window. Runs every 30 minutes; most
 * invocations send 0 notifications.
 *
 * Devices with notify_at = NULL are handled by /api/daily-digest, which
 * notifies them immediately after the digest is persisted.
 */
export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (!checkCronSecret(req, res)) return;

  loadPulseConfig();
  const log = getLogger('notify-cron');

  try {
    const { start, end } = notifyWindow();
    log.info(`Notify window ${start} – ${end}`);

    const db = buildClient();
    const { data: devices, error } = await db
      .from('devices')
      .select('fcm_token')
      .not('notify_at', 'is', null)
      .gte('notify_at', start)
      .lt('notify_at', end);

    if (error) throw new Error(`Failed to read devices: ${error.message}`);

    if (!devices || devices.length === 0) {
      log.info('No devices in this window');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, sent: 0 }));
      return;
    }

    const tokens = devices.map((d) => d.fcm_token as string);
    const { sent, total } = await dispatchFcm(tokens);

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, sent, total }));
  } catch (err) {
    log.error(`Unhandled error: ${String(err)}`);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: false, error: String(err) }));
  }
}
