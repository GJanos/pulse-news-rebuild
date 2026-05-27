import { createStore } from 'zustand/vanilla';
import { createAuthSlice, type AuthSlice } from '../store/slices/auth';

function makeStore() {
  return createStore<AuthSlice>()(createAuthSlice);
}

describe('auth slice', () => {
  it('has correct initial state', () => {
    const store = makeStore();
    expect(store.getState().session).toBeNull();
    expect(store.getState().authReady).toBe(false);
    expect(store.getState().isPasswordRecovery).toBe(false);
  });

  it('setSession updates only session', () => {
    const store = makeStore();
    const s = { user: { email: 'a@b.com' } } as any;
    store.getState().setSession(s);
    expect(store.getState().session).toBe(s);
    expect(store.getState().authReady).toBe(false);
  });

  it('setAuthReady updates only authReady', () => {
    const store = makeStore();
    store.getState().setAuthReady(true);
    expect(store.getState().authReady).toBe(true);
    expect(store.getState().session).toBeNull();
  });

  it('setIsPasswordRecovery updates only isPasswordRecovery', () => {
    const store = makeStore();
    store.getState().setIsPasswordRecovery(true);
    expect(store.getState().isPasswordRecovery).toBe(true);
    expect(store.getState().authReady).toBe(false);
  });

  it('setSession(null) clears session', () => {
    const store = makeStore();
    store.getState().setSession({ user: {} } as any);
    store.getState().setSession(null);
    expect(store.getState().session).toBeNull();
  });
});
