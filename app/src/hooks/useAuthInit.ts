import { useEffect } from 'react';
import { useAppStore } from '../store';
import { useSupabaseAuth, type AuthActions } from './useSupabaseAuth';

export function handleAuthReady(authReady: boolean): void {
  if (!authReady) return;
  const { session, setAppState } = useAppStore.getState();
  setAppState(session ? 'prefs-loading' : 'unauthenticated');
}

export function useAuthInit(): AuthActions {
  const actions = useSupabaseAuth();
  const authReady = useAppStore((s) => s.authReady);

  useEffect(() => {
    handleAuthReady(authReady);
  }, [authReady]);

  return actions;
}
