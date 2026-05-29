import type { Session } from '@supabase/supabase-js';
import { handleAuthReady } from '../hooks/useAuthInit';
import { useAppStore } from '../store';

beforeEach(() => {
  useAppStore.setState({
    appState: 'auth-check',
    session: null,
    authReady: false,
    isPasswordRecovery: false,
  });
});

describe('handleAuthReady', () => {
  it('does nothing when authReady is false', () => {
    handleAuthReady(false);
    expect(useAppStore.getState().appState).toBe('auth-check');
  });

  it('transitions to unauthenticated when authReady=true and no session', () => {
    useAppStore.setState({ session: null });
    handleAuthReady(true);
    expect(useAppStore.getState().appState).toBe('unauthenticated');
  });

  it('transitions to prefs-loading when authReady=true and session exists', () => {
    useAppStore.setState({ session: { user: { email: 'a@b.com' } } as unknown as Session });
    handleAuthReady(true);
    expect(useAppStore.getState().appState).toBe('prefs-loading');
  });
});
