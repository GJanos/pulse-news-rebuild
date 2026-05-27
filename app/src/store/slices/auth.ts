import type { StateCreator } from 'zustand';
import type { Session } from '@supabase/supabase-js';

export interface AuthSlice {
  session: Session | null;
  authReady: boolean;
  isPasswordRecovery: boolean;
  setSession: (s: Session | null) => void;
  setAuthReady: (v: boolean) => void;
  setIsPasswordRecovery: (v: boolean) => void;
}

export const createAuthSlice: StateCreator<AuthSlice> = (set) => ({
  session: null,
  authReady: false,
  isPasswordRecovery: false,
  setSession: (session) => set({ session }),
  setAuthReady: (authReady) => set({ authReady }),
  setIsPasswordRecovery: (isPasswordRecovery) => set({ isPasswordRecovery }),
});
