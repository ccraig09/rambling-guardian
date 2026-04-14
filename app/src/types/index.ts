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
  IDLE = 0,
  ACTIVE_SESSION = 1,
  MANUAL_NOTE = 2,
  DEEP_SLEEP = 3,
}

export enum AlertModality {
  LED_ONLY = 0,
  VIBRATION_ONLY = 1,
  BOTH = 2,
}

export enum AppSessionState {
  NO_SESSION = 'no_session',
  STARTING = 'starting',
  ACTIVE = 'active',
  STOPPING = 'stopping',
}

export enum TriggerSource {
  BUTTON = 0,
  BLE_COMMAND = 1,
  WATCH = 2,
  REMOTE = 3,
  AUTO_TIMEOUT = 4,
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
  sessionState: AppSessionState;
  triggerSource: TriggerSource | null;
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
  sessionContext: SessionContext | null;
  sessionContextSource: SessionContextSource | null;
  transcript: string | null;
  transcriptTimestamps: string | null;
  speakerMap: string | null;
  summary: string | null;
  summaryStatus: SummaryStatus;
  summaryGeneratedAt: number | null;
  driveFileId: string | null;
  backupStatus: BackupStatus;
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

// ============================================
// Sync Status + Retention Types (D.0)
// ============================================

/** Per-session sync pipeline position. NULL for local sessions. */
export type SyncStatus = 'pending' | 'received' | 'processed' | 'acked' | 'committed' | 'failed';

/** Retention tier — determines auto-prune behavior. */
export enum RetentionTier {
  /** Session metadata only — kept forever */
  METADATA = 1,
  /** Transcript + timestamps — kept indefinitely (manual delete only) */
  TRANSCRIPT = 2,
  /** Alert-moment audio clips — auto-pruned after configurable window (default 30 days) */
  ALERT_CLIPS = 3,
  /** Full session audio — auto-pruned after configurable window (default 7 days) */
  FULL_AUDIO = 4,
}

/** Sync info for a session — used by checkpoint service queries. */
export interface SessionSyncInfo {
  id: string;
  syncStatus: SyncStatus | null;
  receivedAt: number | null;
  processedAt: number | null;
  committedAt: number | null;
  bootId: number | null;
  deviceSequence: number | null;
}

// ============================================
// Transcript Types (D.1)
// ============================================

/** A finalized transcript segment from Deepgram. */
export interface TranscriptSegment {
  text: string;
  start: number;           // ms from session start
  end: number;             // ms from session start
  isFinal: boolean;
  speaker: string | null;  // null in D.1, populated by D.2
  words?: TranscriptWord[];
}

/** Word-level timing from Deepgram. */
export interface TranscriptWord {
  word: string;
  start: number;           // ms from session start
  end: number;             // ms from session start
  confidence: number;
}

/** Transcript pipeline status. */
export type TranscriptStatus =
  | 'idle'
  | 'starting'
  | 'streaming'
  | 'interrupted'
  | 'failed'
  | 'finalizing'
  | 'complete';

// ============================================
// Context Classification Types (D.4)
// ============================================

/** Detected conversation context for a session. */
export type SessionContext = 'solo' | 'with_others' | 'presentation';

/** Whether the context was auto-detected or manually overridden. */
export type SessionContextSource = 'auto' | 'manual';

/** Summary generation status. Null = never attempted. */
export type SummaryStatus = 'generating' | 'complete' | 'failed' | null;

/** Google Drive backup status. Null = never attempted. */
export type BackupStatus = 'uploading' | 'complete' | 'failed' | null;

// ============================================
// Speaker + Voice Profile Types (D.2)
// ============================================

/** Confidence level for a speaker identity mapping. */
export type SpeakerConfidence = 'provisional' | 'user_confirmed';

/** Maps a raw Deepgram diarized label to a display identity. */
export interface SpeakerMapping {
  diarizedLabel: string;         // "Speaker 0" — raw from Deepgram, immutable
  displayName: string;           // "Me", "Speaker 1", or user-assigned name
  confidence: SpeakerConfidence;
}

/** Voice profile status. */
export type VoiceProfileStatus = 'enrolled' | 'needs_embedding' | 'ready';

/** Voice profile — created from onboarding enrollment samples. */
export interface VoiceProfile {
  id: number;
  label: string;                  // "Me"
  status: VoiceProfileStatus;
  enrolledSampleIds: number[];    // voice_samples IDs
  embeddingData: null;            // NULL in D.2, populated by D.3
  embeddingModel: string | null;
  embeddingVersion: string | null;
  createdAt: number;
  updatedAt: number;
}

/** A named speaker in the persistent speaker library. */
export interface KnownSpeaker {
  id: number;
  name: string;
  createdAt: number;
  updatedAt: number;
  lastSeenAt: number | null;
  sessionCount: number;
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
