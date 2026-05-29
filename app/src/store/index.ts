import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { createAppSlice, type AppSlice } from './slices/app';
import { createNavSlice, type NavSlice } from './slices/nav';
import { createAuthSlice, type AuthSlice } from './slices/auth';
import { createPrefsSlice, type PrefsSlice } from './slices/prefs';

export const useAppStore = create<AppSlice & NavSlice & AuthSlice & PrefsSlice>()(
  devtools(
    (...a) => ({
      ...createAppSlice(...a),
      ...createNavSlice(...a),
      ...createAuthSlice(...a),
      ...createPrefsSlice(...a),
    }),
    { name: 'PulseStore', enabled: __DEV__ },
  ),
);
