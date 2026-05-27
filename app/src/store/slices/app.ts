import type { StateCreator } from 'zustand';
import type { AppState } from '../../types';

export type { AppState };

export interface AppSlice {
  appState: AppState;
  setAppState: (state: AppState) => void;
}

export const createAppSlice: StateCreator<AppSlice> = (set) => ({
  appState: 'booting',
  setAppState: (appState) => set({ appState }),
});
