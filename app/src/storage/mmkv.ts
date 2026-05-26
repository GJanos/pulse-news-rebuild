import { createMMKV } from 'react-native-mmkv';

/** Single MMKV instance for all Pulse local storage. */
export const storage = createMMKV({ id: 'pulse' });

/**
 * Supabase-compatible storage adapter backed by MMKV.
 * Supabase JS expects the AsyncStorage interface (getItem/setItem/removeItem).
 * MMKV is synchronous; returning plain values (not Promises) is accepted by the
 * Supabase client.
 */
export const supabaseStorage = {
  getItem: (key: string): string | null => storage.getString(key) ?? null,
  setItem: (key: string, value: string): void => {
    storage.set(key, value);
  },
  removeItem: (key: string): void => {
    storage.remove(key);
  },
};
