import admin from 'firebase-admin';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import ws from 'ws';
import type { PulseConfig } from '@shared/config';
import type { RegionDigest } from './types';
import type { GlobalHeadline } from './rankHeadlines';
import { getLogger } from './logging';

let _db: SupabaseClient | null = null;

const FCM_BATCH_SIZE = 500;

function chunkTokens(tokens: string[]): string[][] {
  const chunks: string[][] = [];
  for (let i = 0; i < tokens.length; i += FCM_BATCH_SIZE) {
    chunks.push(tokens.slice(i, i + FCM_BATCH_SIZE));
  }
  return chunks;
}

function cutoffDate(daysAgo: number): string {
  return new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/** Initialize (or reuse) Firebase Admin SDK and return the Messaging instance. */
export function initMessaging() {
  if (!admin.apps.length) {
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    // Private key is stored with literal \n in .env; restore real newlines at runtime.
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
    if (!projectId || !clientEmail || !privateKey) {
      throw new Error(
        'FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY are required',
      );
    }
    admin.initializeApp({
      credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
    });
  }
  return admin.messaging();
}

/** Create (or return the cached) Supabase service-role client. */
export function buildClient() {
  if (!_db) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SECRET_KEY;
    if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_SECRET_KEY are required');
    _db = createClient(url, key, { realtime: { transport: ws as any } });
  }
  return _db;
}
