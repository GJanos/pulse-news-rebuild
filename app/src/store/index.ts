import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { createAppSlice, type AppSlice } from './slices/app';
import { createNavSlice, type NavSlice } from './slices/nav';
import { createAuthSlice, type AuthSlice } from './slices/auth';

export const useAppStore = create<AppSlice & NavSlice & AuthSlice>()(
  devtools(
    (...a) => ({
      ...createAppSlice(...a),
      ...createNavSlice(...a),
      ...createAuthSlice(...a),
    }),
    { name: 'PulseStore', enabled: __DEV__ },
  ),
);
