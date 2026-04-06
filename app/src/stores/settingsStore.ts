import { create } from 'zustand';
import type { AlertThresholds } from '../types';

interface SettingsStore {
  thresholds: AlertThresholds;
  notificationsEnabled: boolean;
  dailyExerciseTarget: number;
  theme: 'light' | 'dark' | 'system';
  setThresholds: (thresholds: AlertThresholds) => void;
  setNotificationsEnabled: (enabled: boolean) => void;
  setDailyExerciseTarget: (target: number) => void;
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
}

export const useSettingsStore = create<SettingsStore>((set) => ({
  thresholds: {
    gentleSec: 7,
    moderateSec: 15,
    urgentSec: 30,
    criticalSec: 60,
  },
  notificationsEnabled: true,
  dailyExerciseTarget: 3,
  theme: 'system',
  setThresholds: (thresholds) => set({ thresholds }),
  setNotificationsEnabled: (enabled) => set({ notificationsEnabled: enabled }),
  setDailyExerciseTarget: (target) => set({ dailyExerciseTarget: target }),
  setTheme: (theme) => set({ theme }),
}));
