import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { createAppSlice, type AppSlice } from './slices/app';
import { createNavSlice, type NavSlice } from './slices/nav';
import { createAuthSlice, type AuthSlice } from './slices/auth';
import { createPrefsSlice, type PrefsSlice } from './slices/prefs';
import { createDeviceSlice, type DeviceSlice } from './slices/device';

export const useAppStore = create<AppSlice & NavSlice & AuthSlice & PrefsSlice & DeviceSlice>()(
  devtools(
    (...a) => ({
      ...createAppSlice(...a),
      ...createNavSlice(...a),
      ...createAuthSlice(...a),
      ...createPrefsSlice(...a),
      ...createDeviceSlice(...a),
    }),
    { name: 'PulseStore', enabled: __DEV__ },
  ),
);
