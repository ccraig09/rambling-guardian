/**
 * Speaker Library Service — cross-session speaker identity directory.
 *
 * Owns the persistent `known_speakers` table via in-memory cache.
 * Separate from speakerService (session-scoped) — this service survives
 * across sessions and is loaded once at app startup.
 *
 * Product rule: names are user-assigned. No voice matching or biometric claims.
 */
import {
  getKnownSpeakers,
  addKnownSpeaker,
  touchKnownSpeaker,
  renameKnownSpeaker,
  deleteKnownSpeaker,
} from '../db/knownSpeakers';
import type { KnownSpeaker } from '../types';

/** Normalize a raw display name for storage. Trims, collapses spaces, preserves casing. */
export function normalizeSpeakerName(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ');
}

class SpeakerLibraryService {
  private cache: KnownSpeaker[] = [];
  private loaded = false;

  /**
   * Load library from DB into cache. Best-effort — errors are logged, not thrown.
   * Must be called after DB initialization (after getDatabase() is ready).
   */
  async loadLibrary(): Promise<void> {
    try {
      this.cache = await getKnownSpeakers();
      this.loaded = true;
    } catch (error) {
      console.warn('[SpeakerLibrary] Failed to load:', error);
      // Leave cache empty — reads return [], writes still attempt DB
    }
  }

  /** Returns cached speaker names in recency order. Safe to call before loadLibrary. */
  getLibraryNames(): string[] {
    return this.cache.map((s) => s.name);
  }

  /**
   * Add a speaker to the library. Normalizes name. No-op if empty after normalization.
   * DB-first: cache updated only on DB success to prevent divergence.
   */
  async addSpeaker(rawName: string): Promise<void> {
    const name = normalizeSpeakerName(rawName);
    if (!name) return;
    // Skip if already in cache (avoid unnecessary DB round-trip)
    if (this.cache.some((s) => s.name === name)) return;
    try {
      await addKnownSpeaker(name);
      const now = Date.now();
      this.cache.push({
        id: -1, // placeholder — real ID assigned by DB
        name,
        createdAt: now,
        updatedAt: now,
        lastSeenAt: null,
        sessionCount: 0,
      });
    } catch (error) {
      console.warn('[SpeakerLibrary] Failed to add speaker:', error);
      // Cache stays unchanged on failure
    }
  }

  /**
   * Update last_seen_at and increment session_count.
   * Called once per confirmed speaker per session at finalization.
   */
  async markSeenInSession(rawName: string): Promise<void> {
    const name = normalizeSpeakerName(rawName);
    if (!name) return;
    try {
      await touchKnownSpeaker(name);
      const now = Date.now();
      const entry = this.cache.find((s) => s.name === name);
      if (entry) {
        entry.lastSeenAt = now;
        entry.sessionCount += 1;
        entry.updatedAt = now;
      }
    } catch (error) {
      console.warn('[SpeakerLibrary] Failed to mark seen:', error);
    }
  }

  /** Rename a speaker in library. DB-first. */
  async renameSpeaker(oldName: string, newRawName: string): Promise<void> {
    const newName = normalizeSpeakerName(newRawName);
    if (!newName) return;
    try {
      await renameKnownSpeaker(oldName, newName);
      const entry = this.cache.find((s) => s.name === oldName);
      if (entry) {
        entry.name = newName;
        entry.updatedAt = Date.now();
      }
    } catch (error) {
      console.warn('[SpeakerLibrary] Failed to rename speaker:', error);
    }
  }

  /** Remove a speaker from library. DB-first. */
  async removeSpeaker(name: string): Promise<void> {
    try {
      await deleteKnownSpeaker(name);
      this.cache = this.cache.filter((s) => s.name !== name);
    } catch (error) {
      console.warn('[SpeakerLibrary] Failed to remove speaker:', error);
    }
  }

  /** Clear cache — used in tests and between sessions if needed. */
  clearCache(): void {
    this.cache = [];
    this.loaded = false;
  }
}

export const speakerLibraryService = new SpeakerLibraryService();
