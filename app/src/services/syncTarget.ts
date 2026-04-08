/**
 * Future cloud sync adapter interface. Not implemented in D.0.
 *
 * Documents the shape so Firebase can slot in without reworking
 * the local sync/retention architecture. This file is imported
 * nowhere in D.0 — it exists purely as the future integration contract.
 *
 * Expected implementations:
 * - FirebaseSyncTarget (after transcript artifacts exist)
 */
import type { RetentionTier } from '../types';

export type SyncTarget = {
  /** Push session metadata to cloud store (e.g., Firestore). */
  pushSessionMetadata(session: {
    id: string;
    startedAt: number;
    endedAt: number;
    alertCount: number;
    maxAlert: number;
    speechSegments: number;
    triggerSource: string;
    retentionTier: RetentionTier;
  }): Promise<void>;

  /** Push an artifact (transcript, audio) to cloud storage. Returns remote ID. */
  pushArtifact(
    sessionId: string,
    tier: RetentionTier,
    data: { uri: string; mimeType: string; sizeBytes: number },
  ): Promise<string>;

  /** Delete an artifact from cloud storage. */
  deleteArtifact(remoteId: string): Promise<void>;

  /** Get the cloud-side sync watermark. */
  getCheckpoint(): Promise<string | null>;

  /** Set the cloud-side sync watermark. */
  setCheckpoint(watermark: string): Promise<void>;
};
