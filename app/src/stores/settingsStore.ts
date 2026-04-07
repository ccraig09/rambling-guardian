import { create } from 'zustand';
import type { AlertThresholds } from '../types';
import { loadAllSettings, saveSetting, saveSettings } from '../db/settings';

interface SettingsStore {
  _hydrated: boolean;
  thresholds: AlertThresholds;
  notificationsEnabled: boolean;
  dailyExerciseTarget: number;
  theme: 'light' | 'dark' | 'system';
  minBatteryForRecording: number;
  hydrateFromDb: () => Promise<void>;
  setThresholds: (thresholds: AlertThresholds) => void;
  setNotificationsEnabled: (enabled: boolean) => void;
  setDailyExerciseTarget: (target: number) => void;
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  setMinBatteryForRecording: (value: number) => void;
}

export const useSettingsStore = create<SettingsStore>((set) => ({
  _hydrated: false,
  thresholds: {
    gentleSec: 7,
    moderateSec: 15,
    urgentSec: 30,
    criticalSec: 60,
  },
  notificationsEnabled: true,
  dailyExerciseTarget: 3,
  theme: 'system',
  minBatteryForRecording: 15,

  hydrateFromDb: async () => {
    const raw = await loadAllSettings();
    const parsed: Partial<{
      thresholds: AlertThresholds;
      notificationsEnabled: boolean;
      dailyExerciseTarget: number;
      theme: 'light' | 'dark' | 'system';
      minBatteryForRecording: number;
    }> = {};

    // Thresholds
    const g = raw.get('thresholds.gentleSec');
    const m = raw.get('thresholds.moderateSec');
    const u = raw.get('thresholds.urgentSec');
    const c = raw.get('thresholds.criticalSec');
    if (g && m && u && c) {
      parsed.thresholds = {
        gentleSec: parseInt(g, 10),
        moderateSec: parseInt(m, 10),
        urgentSec: parseInt(u, 10),
        criticalSec: parseInt(c, 10),
      };
    }

    // Booleans
    const ne = raw.get('notificationsEnabled');
    if (ne !== undefined) parsed.notificationsEnabled = ne === 'true';

    // Numbers
    const det = raw.get('dailyExerciseTarget');
    if (det !== undefined) parsed.dailyExerciseTarget = parseInt(det, 10);
    const mbr = raw.get('minBatteryForRecording');
    if (mbr !== undefined) parsed.minBatteryForRecording = parseInt(mbr, 10);

    // Theme
    const th = raw.get('theme');
    if (th === 'light' || th === 'dark' || th === 'system') parsed.theme = th;

    set({ ...parsed, _hydrated: true });
  },

  setThresholds: (thresholds) => {
    set({ thresholds });
    saveSettings([
      ['thresholds.gentleSec', String(thresholds.gentleSec)],
      ['thresholds.moderateSec', String(thresholds.moderateSec)],
      ['thresholds.urgentSec', String(thresholds.urgentSec)],
      ['thresholds.criticalSec', String(thresholds.criticalSec)],
    ]).catch(console.warn);
  },

  setNotificationsEnabled: (enabled) => {
    set({ notificationsEnabled: enabled });
    saveSetting('notificationsEnabled', String(enabled)).catch(console.warn);
  },

  setDailyExerciseTarget: (target) => {
    set({ dailyExerciseTarget: target });
    saveSetting('dailyExerciseTarget', String(target)).catch(console.warn);
  },

  setTheme: (theme) => {
    set({ theme });
    saveSetting('theme', theme).catch(console.warn);
  },

  setMinBatteryForRecording: (value) => {
    set({ minBatteryForRecording: value });
    saveSetting('minBatteryForRecording', String(value)).catch(console.warn);
  },
}));
