import { supabaseStorage, storage } from './mmkv';

beforeEach(() => {
  (storage as unknown as { clearAll(): void }).clearAll();
});

describe('supabaseStorage adapter', () => {
  it('getItem returns null on miss (not undefined)', () => {
    expect(supabaseStorage.getItem('missing-key')).toBeNull();
  });

  it('setItem + getItem round-trip', () => {
    supabaseStorage.setItem('session', '{"token":"abc"}');
    expect(supabaseStorage.getItem('session')).toBe('{"token":"abc"}');
  });

  it('removeItem clears the key', () => {
    supabaseStorage.setItem('to-remove', 'value');
    supabaseStorage.removeItem('to-remove');
    expect(supabaseStorage.getItem('to-remove')).toBeNull();
  });

  it('multiple keys are independent', () => {
    supabaseStorage.setItem('a', 'value-a');
    supabaseStorage.setItem('b', 'value-b');
    supabaseStorage.removeItem('a');
    expect(supabaseStorage.getItem('a')).toBeNull();
    expect(supabaseStorage.getItem('b')).toBe('value-b');
  });

  it('overwriting a key updates the value', () => {
    supabaseStorage.setItem('key', 'v1');
    supabaseStorage.setItem('key', 'v2');
    expect(supabaseStorage.getItem('key')).toBe('v2');
  });
});
