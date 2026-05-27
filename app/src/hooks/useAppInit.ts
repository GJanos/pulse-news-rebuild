import { useEffect } from 'react';
import { useAppStore } from '../store';

/**
 * Called from App.tsx after `useFonts` resolves (loaded or errored).
 * Restores persisted nav state and advances the boot machine to 'auth-check'.
 * Auth-flow's useSupabaseAuth picks up from there.
 */
export function useAppInit(fontsReady: boolean): void {
  const setAppState = useAppStore((s) => s.setAppState);
  const restoreNavState = useAppStore((s) => s.restoreNavState);

  useEffect(() => {
    if (!fontsReady) return;
    restoreNavState();
    setAppState('auth-check');
  }, [fontsReady, setAppState, restoreNavState]);
}
