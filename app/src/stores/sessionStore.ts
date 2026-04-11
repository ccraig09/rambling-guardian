import { create } from 'zustand';
import type { Session, SessionMode, SessionContext, AlertThresholds } from '../types';
import { SyncPhase } from '../types';

interface SessionStore {
  activeSession: Session | null;
  activeSessionId: string | null;
  setActiveSessionId: (id: string | null) => void;
  mode: SessionMode;
  setMode: (mode: SessionMode) => void;
  startSession: (session: Session) => void;
  updateSession: (updates: Partial<Session>) => void;
  endSession: () => void;

  // Sync metadata
  pendingSyncCount: number;
  isSyncing: boolean;
  lastSyncAt: number | null;
  syncPhase: SyncPhase;
  setPendingSyncCount: (count: number) => void;
  setIsSyncing: (syncing: boolean) => void;
  setLastSyncAt: (at: number | null) => void;
  setSyncPhase: (phase: SyncPhase) => void;

  // Context classification (D.4)
  sessionContext: SessionContext | null;
  sessionContextOverride: boolean;
  setSessionContext: (context: SessionContext | null) => void;
  setSessionContextOverride: (override: boolean) => void;
  resetContext: () => void;

  // Coaching profiles (D.5)
  activeProfile: AlertThresholds | null;
  lastProfileWriteTime: number | null;
  setActiveProfile: (profile: AlertThresholds) => void;
  setLastProfileWriteTime: (time: number) => void;
  resetProfile: () => void;
}

export const useSessionStore = create<SessionStore>((set) => ({
  activeSession: null,
  activeSessionId: null,
  setActiveSessionId: (id) => set({ activeSessionId: id }),
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
  syncPhase: SyncPhase.IDLE,
  setPendingSyncCount: (count) => set({ pendingSyncCount: count }),
  setIsSyncing: (syncing) => set({ isSyncing: syncing }),
  setLastSyncAt: (at) => set({ lastSyncAt: at }),
  setSyncPhase: (phase) => set({ syncPhase: phase }),

  // Context classification (D.4)
  sessionContext: null,
  sessionContextOverride: false,
  setSessionContext: (context) => set({ sessionContext: context }),
  setSessionContextOverride: (override) => set({ sessionContextOverride: override }),
  resetContext: () => set({ sessionContext: null, sessionContextOverride: false }),

  // Coaching profiles (D.5)
  activeProfile: null,
  lastProfileWriteTime: null,
  setActiveProfile: (profile) => set({ activeProfile: profile }),
  setLastProfileWriteTime: (time) => set({ lastProfileWriteTime: time }),
  resetProfile: () => set({ activeProfile: null, lastProfileWriteTime: null }),
}));
