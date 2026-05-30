import type { StateCreator } from 'zustand';

export interface DeviceSlice {
  /** False until slice 6 (app/notifications) wires real FCM registration. */
  notificationsEnabled: boolean;
  setNotificationsEnabled: (v: boolean) => void;
}

export const createDeviceSlice: StateCreator<DeviceSlice> = (set) => ({
  notificationsEnabled: false,
  setNotificationsEnabled: (v) => set({ notificationsEnabled: v }),
});
