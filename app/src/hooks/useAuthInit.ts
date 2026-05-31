import { useEffect } from 'react';
import { useAppStore } from '../store';
import { useSupabaseAuth, type AuthActions } from './useSupabaseAuth';

export function handleAuthReady(authReady: boolean): void {
  if (!authReady) return;
  const { session, appState, setAppState } = useAppStore.getState();
  if (!session) {
    setAppState('unauthenticated');
    return;
  }
  // Prefs hydration (usePreferences) can reach 'ready' before getSession resolves
  // authReady. Don't regress the boot machine back to 'prefs-loading' in that race —
  // nothing would advance it to 'ready' again, leaving the app stuck on the splash.
  if (appState !== 'ready') setAppState('prefs-loading');
}

export function useAuthInit(): AuthActions {
  const actions = useSupabaseAuth();
  const authReady = useAppStore((s) => s.authReady);

  useEffect(() => {
    handleAuthReady(authReady);
  }, [authReady]);

  return actions;
}
