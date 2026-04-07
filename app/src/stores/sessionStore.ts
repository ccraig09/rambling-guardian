import { create } from 'zustand';
import type { Session, SessionMode } from '../types';

interface SessionStore {
  activeSession: Session | null;
  mode: SessionMode;
  setMode: (mode: SessionMode) => void;
  startSession: (session: Session) => void;
  updateSession: (updates: Partial<Session>) => void;
  endSession: () => void;

  // Sync metadata
  pendingSyncCount: number;
  isSyncing: boolean;
  lastSyncAt: number | null;
  setPendingSyncCount: (count: number) => void;
  setIsSyncing: (syncing: boolean) => void;
  setLastSyncAt: (at: number | null) => void;
}

export const useSessionStore = create<SessionStore>((set) => ({
  activeSession: null,
  mode: 'solo',
  setMode: (mode) => set({ mode }),
  startSession: (session) => set({ activeSession: session }),
  updateSession: (updates) =>
    set((state) => ({
      activeSession: state.activeSession
        ? { ...state.activeSession, ...updates }
        : null,
    })),
  endSession: () => set({ activeSession: null }),

  // Sync metadata
  pendingSyncCount: 0,
  isSyncing: false,
  lastSyncAt: null,
  setPendingSyncCount: (count) => set({ pendingSyncCount: count }),
  setIsSyncing: (syncing) => set({ isSyncing: syncing }),
  setLastSyncAt: (at) => set({ lastSyncAt: at }),
}));
