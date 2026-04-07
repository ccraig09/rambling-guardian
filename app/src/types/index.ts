// ============================================
// BLE / Device Types
// ============================================
export enum AlertLevel {
  NONE = 0,
  GENTLE = 1,
  MODERATE = 2,
  URGENT = 3,
  CRITICAL = 4,
}

export enum DeviceMode {
  MONITORING = 0,
  PRESENTATION = 1,
  DEEP_SLEEP = 2,
}

export enum AlertModality {
  LED_ONLY = 0,
  VIBRATION_ONLY = 1,
  BOTH = 2,
}

export enum ConnectionState {
  IDLE = 'idle',
  SCANNING = 'scanning',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  SYNCING = 'syncing',
  FAILED = 'failed',
}

export interface SyncMeta {
  pendingCount: number;
  isSyncing: boolean;
  lastSyncAt: number | null; // unix ms
}

export interface DeviceState {
  alertLevel: AlertLevel;
  speechDuration: number; // ms
  mode: DeviceMode;
  sensitivity: number; // 0-3
  battery: number | null; // 0-100, null = USB power (no battery)
  modality: AlertModality;
  connected: boolean;
}

export interface SessionStats {
  durationMs: number;
  alertCount: number;
  maxAlertLevel: AlertLevel;
  speechSegments: number;
  sensitivity: number;
}

export interface AlertThresholds {
  gentleSec: number;
  moderateSec: number;
  urgentSec: number;
  criticalSec: number;
}

// ============================================
// Database Types
// ============================================
export type SessionMode = 'solo' | 'with_others';

export interface Session {
  id: string;
  startedAt: number; // unix ms
  endedAt: number | null;
  durationMs: number;
  mode: SessionMode;
  alertCount: number;
  maxAlert: AlertLevel;
  speechSegments: number;
  sensitivity: number;
  syncedFromDevice: boolean;
}

export interface AlertEvent {
  id: number;
  sessionId: string;
  timestamp: number; // ms offset from session start
  alertLevel: AlertLevel;
  durationAtAlert: number;
}

// ============================================
// Session Model — Two-Level Concept (forward types)
// ============================================

/**
 * ConnectionWindow — what the sessions table actually stores today.
 * A contiguous BLE connection period: created on connect, finalized on disconnect.
 * Mirrors the Session interface above with an optional future link to ConversationSession.
 */
export interface ConnectionWindow extends Session {
  conversationId: string | null;
}

/**
 * ConversationSession — future user-facing concept.
 * A single conversation may span multiple BLE connection windows
 * (e.g., reconnect after a dropout). Not persisted yet — defined here
 * to document the direction and prevent further semantic drift.
 */
export interface ConversationSession {
  id: string;
  startedAt: number;
  endedAt: number | null;
  connectionWindowIds: string[];
}

// ============================================
// Sync Types
// ============================================

export enum SyncPhase {
  IDLE = 'idle',
  REQUESTING_MANIFEST = 'requesting_manifest',
  IMPORTING = 'importing',
  FINALIZING = 'finalizing',
  COMPLETE = 'complete',
  FAILED = 'failed',
}

/** Manifest describing what the device has available to sync. */
export interface SyncManifest {
  pendingSessions: number;
  pendingAlertEvents: number;
  deviceCheckpoint: string;
  estimatedBytes: number;
}

/** Persistent sync watermark — stored as JSON in the settings table. */
export interface SyncCheckpoint {
  deviceCheckpoint: string;
  lastSuccessfulSyncAt: number;
  lastImportedSessionId: string | null;
  syncAttemptCount: number;
  lastSyncError: string | null;
}

export interface Exercise {
  id: string;
  category: ExerciseCategory;
  title: string;
  description: string;
  instructions: ExerciseStep[];
  durationSeconds: number;
  difficulty: number; // 1-5
  tags: string[];
  sortOrder: number;
}

export type ExerciseCategory = 'warmup' | 'breathing' | 'articulation' | 'speech';

export interface ExerciseStep {
  step: number;
  text: string;
  durationSeconds: number;
}

export interface ExerciseCompletion {
  id: number;
  exerciseId: string;
  completedAt: number;
  rating: number | null; // 1-5
}

export interface ExerciseFavorite {
  exerciseId: string;
  addedAt: number;
}

export interface Streak {
  id: number;
  date: string; // YYYY-MM-DD
  exercisesDone: number;
  sessionsDone: number;
  totalSpeechMs: number;
}

export interface VoiceSample {
  id: number;
  recordedAt: number;
  filePath: string;
  durationMs: number;
  confirmed: boolean;
}

export interface AppNotification {
  id: number;
  type: 'alert' | 'summary' | 'battery' | 'streak' | 'coaching';
  title: string;
  body: string;
  sentAt: number;
  read: boolean;
}
