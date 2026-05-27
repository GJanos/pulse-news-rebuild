import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { createAppSlice, type AppSlice } from './slices/app';
import { createNavSlice, type NavSlice } from './slices/nav';

// Later slices extend this type:
// create<AppSlice & NavSlice & AuthSlice & PrefsSlice & DeviceSlice>()(...)
export const useAppStore = create<AppSlice & NavSlice>()(
  devtools(
    (...a) => ({
      ...createAppSlice(...a),
      ...createNavSlice(...a),
    }),
    { name: 'PulseStore', enabled: __DEV__ },
  ),
);
