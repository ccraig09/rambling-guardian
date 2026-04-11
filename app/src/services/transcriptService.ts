/**
 * Transcript Service — orchestrates mic capture → Deepgram → store → persistence.
 *
 * Watches sessionStore.activeSessionId (set by sessionTracker).
 * Starts phone mic capture + Deepgram WebSocket when session goes active.
 * Persists finalized transcript on session end.
 *
 * transcriptService is a consumer of the session lifecycle — it never
 * creates its own parallel session identity. sessionTracker owns that.
 */
import LiveAudioStream from 'react-native-live-audio-stream';
import { Buffer } from 'buffer';
import { useSessionStore } from '../stores/sessionStore';
import { useTranscriptStore } from '../stores/transcriptStore';
import { createDeepgramConnection, type DeepgramConnection } from './deepgramClient';
import { DEEPGRAM_API_KEY } from '../config/deepgram';
import { updateTranscript, updateRetention, updateSessionContext } from '../db/sessions';
import { RetentionTier } from '../types';
import type { TranscriptSegment } from '../types';
import { speakerService } from './speakerService';
import { speakerLibraryService } from './speakerLibraryService';
import { useSpeakerStore } from '../stores/speakerStore';
import { classifyContext } from './contextClassificationService';

class TranscriptService {
  private unsubscribeStore: (() => void) | null = null;
  private connection: DeepgramConnection | null = null;
  private activeSessionId: string | null = null;
  private micInitialized = false;
  private firstTranscriptLogged = false;

  start() {
    if (this.unsubscribeStore) return; // already started

    this.unsubscribeStore = useSessionStore.subscribe((state) => {
      const sessionId = state.activeSessionId;

      // Session became active — start transcription
      if (sessionId && sessionId !== this.activeSessionId) {
        this.activeSessionId = sessionId;
        this.startTranscription(sessionId);
      }

      // Session ended — stop and persist
      if (!sessionId && this.activeSessionId) {
        this.stopTranscription();
      }
    });
  }

  stop() {
    this.stopTranscription();
    this.unsubscribeStore?.();
    this.unsubscribeStore = null;
  }

  private async startTranscription(sessionId: string) {
    const store = useTranscriptStore.getState();
    store.reset();
    speakerService.reset();
    useSessionStore.getState().resetContext();
    store.setStatus('starting');
    console.log(`[TranscriptService] Session became active: ${sessionId}`);

    // Check API key
    if (!DEEPGRAM_API_KEY) {
      console.warn('[TranscriptService] No Deepgram API key — aborting');
      store.setError('Deepgram API key not configured');
      return;
    }

    try {
      // Initialize mic capture (once)
      if (!this.micInitialized) {
        await LiveAudioStream.init({
          sampleRate: 16000,
          channels: 1,
          bitsPerSample: 16,
          audioSource: 6, // VOICE_RECOGNITION (Android)
          bufferSize: 4096,
          wavFile: '', // Required by types; streaming to Deepgram, no WAV needed
        });
        this.micInitialized = true;
        console.log('[TranscriptService] Mic initialized');
      }

      // Remove stale listeners from any previous session
      try { LiveAudioStream.stop(); } catch { /* ignore if not started */ }
      (LiveAudioStream as any).removeAllListeners?.('data');

      // Open Deepgram connection
      console.log('[TranscriptService] Opening Deepgram WebSocket...');
      this.connection = createDeepgramConnection(DEEPGRAM_API_KEY);

      let chunkCount = 0;

      // Wire transcript events to store
      this.connection.onTranscript((segment: TranscriptSegment) => {
        if (chunkCount > 0 && !this.firstTranscriptLogged) {
          console.log(`[TranscriptService] First transcript received: "${segment.text.substring(0, 40)}..." (final=${segment.isFinal}, speaker=${segment.speaker})`);
          this.firstTranscriptLogged = true;
        }

        // Notify speaker service of new speakers
        if (segment.speaker) {
          speakerService.handleNewSpeaker(segment.speaker);
        }

        if (segment.isFinal) {
          useTranscriptStore.getState().addFinalSegment(segment);
          // D.4: live context classification on each final segment
          this.updateContextClassification();
        } else {
          useTranscriptStore.getState().setInterim(segment.text);
        }
      });

      this.connection.onError((error: string) => {
        console.warn('[TranscriptService] Deepgram error:', error);
        // Intentional v1 simplification: stop capture on disconnect.
        // Future phases may attempt reconnection or local buffering.
        useTranscriptStore.getState().setStatus('interrupted');
        try { LiveAudioStream.stop(); } catch { /* ignore */ }
      });

      this.connection.onClose((code?: number, reason?: string) => {
        console.log(`[TranscriptService] WebSocket closed: code=${code}, reason=${reason ?? 'none'}, chunks sent=${chunkCount}`);
        const currentStatus = useTranscriptStore.getState().status;
        // Only mark interrupted if we didn't initiate the close
        if (currentStatus === 'streaming') {
          useTranscriptStore.getState().setStatus('interrupted');
          try { LiveAudioStream.stop(); } catch { /* ignore */ }
        }
      });

      // Wait for WebSocket to open, then start mic
      this.connection.onOpen(() => {
        console.log('[TranscriptService] WebSocket open — starting mic');
        useTranscriptStore.getState().setStatus('streaming');

        // Pipe mic audio to Deepgram
        LiveAudioStream.on('data', (base64: string) => {
          if (this.connection?.isOpen()) {
            const chunk = Buffer.from(base64, 'base64');
            // Slice to get only decoded bytes — Buffer.buffer returns the
            // entire backing ArrayBuffer from the pool, not just our data.
            const audio = chunk.buffer.slice(
              chunk.byteOffset,
              chunk.byteOffset + chunk.byteLength,
            );
            this.connection.sendAudio(audio);
            chunkCount++;
            if (chunkCount === 1) {
              console.log(`[TranscriptService] First audio chunk: ${chunk.byteLength} bytes sent to Deepgram`);
            }
          }
        });

        LiveAudioStream.start();
        console.log('[TranscriptService] Mic started');
      });
    } catch (error) {
      console.warn('[TranscriptService] startTranscription error:', error);
      const msg = error instanceof Error ? error.message : 'Failed to start transcription';
      useTranscriptStore.getState().setError(msg);
    }
  }

  /** Recompute session context from current segments. Respects manual override. */
  private updateContextClassification(): void {
    const sessionStore = useSessionStore.getState();
    if (sessionStore.sessionContextOverride) return; // user override is sticky

    const { segments } = useTranscriptStore.getState();
    const finalSegments = segments.filter((s) => s.isFinal);

    // Build speaker → segment count map
    const speakerCounts = new Map<string, number>();
    for (const seg of finalSegments) {
      const speaker = seg.speaker ?? 'unknown';
      speakerCounts.set(speaker, (speakerCounts.get(speaker) ?? 0) + 1);
    }

    const context = classifyContext(speakerCounts, finalSegments.length);
    if (context !== sessionStore.sessionContext) {
      sessionStore.setSessionContext(context);
    }
  }

  private async stopTranscription() {
    const sessionId = this.activeSessionId;
    this.activeSessionId = null;
    this.firstTranscriptLogged = false;

    // Stop mic and remove data listener to prevent accumulation
    try {
      LiveAudioStream.stop();
      (LiveAudioStream as any).removeAllListeners?.('data');
    } catch { /* ignore */ }

    // Close Deepgram and wait for final transcript flush before persisting.
    // closeAndDrain() waits for the WebSocket onclose event (up to 3s),
    // which fires after Deepgram delivers any buffered final result.
    if (this.connection) {
      await this.connection.closeAndDrain();
      this.connection = null;
    }

    // Persist transcript if we have segments
    const { segments, status } = useTranscriptStore.getState();
    if (sessionId && segments.length > 0) {
      useTranscriptStore.getState().setStatus('finalizing');
      try {
        const plainText = segments.map((s) => s.text).join(' ');
        const segmentsJson = JSON.stringify(segments);
        await updateTranscript(sessionId, plainText, segmentsJson);
        await updateRetention(sessionId, RetentionTier.TRANSCRIPT, null);
        await speakerService.persistToSession(sessionId);

        // D.3: sync confirmed speaker names to library (once per unique name per session)
        const { mappings } = useSpeakerStore.getState();
        const confirmedNames = new Set<string>();
        for (const m of Object.values(mappings)) {
          if (m.confidence === 'user_confirmed' && m.displayName !== 'Me') {
            confirmedNames.add(m.displayName);
          }
        }
        for (const name of confirmedNames) {
          await speakerLibraryService.markSeenInSession(name);
        }

        // D.4: persist session context classification
        const { sessionContext, sessionContextOverride } = useSessionStore.getState();
        await updateSessionContext(
          sessionId,
          sessionContext,
          sessionContext ? (sessionContextOverride ? 'manual' : 'auto') : null,
        );

        useTranscriptStore.getState().setStatus('complete');
      } catch (error) {
        console.warn('[TranscriptService] Failed to persist transcript:', error);
      }
    } else if (status !== 'idle') {
      // No segments captured — don't write empty transcript
      useTranscriptStore.getState().setStatus('complete');
    }
  }
}

export const transcriptService = new TranscriptService();
