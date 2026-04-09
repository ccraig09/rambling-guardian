/**
 * Deepgram Client — raw WebSocket wrapper for live streaming STT.
 *
 * Uses Deepgram's WebSocket API directly (no SDK) to avoid
 * Node.js compatibility issues in React Native.
 *
 * Auth: Uses Authorization header (not query param). Validated on
 * iOS with RN 0.81 — token query param does NOT work with Deepgram.
 */
import { DEEPGRAM_DEFAULTS } from '../config/deepgram';
import type { TranscriptSegment, TranscriptWord } from '../types';

export interface DeepgramConnection {
  sendAudio(chunk: ArrayBuffer): void;
  onTranscript(cb: (segment: TranscriptSegment) => void): () => void;
  onError(cb: (error: string) => void): () => void;
  onOpen(cb: () => void): () => void;
  onClose(cb: () => void): () => void;
  close(): void;
  isOpen(): boolean;
}

export function createDeepgramConnection(
  apiKey: string,
  sessionStartMs: number = 0,
): DeepgramConnection {
  const transcriptListeners: Array<(seg: TranscriptSegment) => void> = [];
  const errorListeners: Array<(error: string) => void> = [];
  const openListeners: Array<() => void> = [];
  const closeListeners: Array<() => void> = [];

  const params = new URLSearchParams(DEEPGRAM_DEFAULTS);
  const url = `wss://api.deepgram.com/v1/listen?${params.toString()}`;

  // Authorization header — validated on iOS RN 0.81. Do NOT use token query param.
  // Cast through unknown to bypass the 2-arg WebSocket constructor TS overload;
  // React Native 0.81 on iOS accepts a 3rd options object with headers.
  const WSCtor = WebSocket as unknown as new (
    url: string,
    protocols?: string | string[],
    options?: { headers?: Record<string, string> },
  ) => WebSocket;
  const ws = new WSCtor(url, undefined, {
    headers: { Authorization: `Token ${apiKey}` },
  });

  // Keepalive — Deepgram closes connection after ~10s of silence
  let keepaliveInterval: ReturnType<typeof setInterval> | null = null;

  ws.onopen = () => {
    keepaliveInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(new ArrayBuffer(0));
      }
    }, 8000);
    openListeners.forEach((cb) => cb());
  };

  ws.onmessage = (event: MessageEvent) => {
    try {
      const data = JSON.parse(typeof event.data === 'string' ? event.data : '');
      if (data.type !== 'Results') return;

      const alt = data.channel?.alternatives?.[0];
      if (!alt?.transcript) return; // skip empty

      const startMs = Math.round((data.start ?? 0) * 1000) + sessionStartMs;
      const endMs = startMs + Math.round((data.duration ?? 0) * 1000);

      const words: TranscriptWord[] | undefined = alt.words?.length
        ? alt.words.map((w: any) => ({
            word: w.word,
            start: Math.round(w.start * 1000) + sessionStartMs,
            end: Math.round(w.end * 1000) + sessionStartMs,
            confidence: w.confidence,
          }))
        : undefined;

      const segment: TranscriptSegment = {
        text: alt.transcript,
        start: startMs,
        end: endMs,
        isFinal: data.is_final === true,
        speaker: null, // D.2 adds speaker attribution
        words,
      };

      transcriptListeners.forEach((cb) => cb(segment));
    } catch {
      // Ignore malformed messages
    }
  };

  ws.onerror = (event: any) => {
    const msg = event?.message || 'WebSocket error';
    errorListeners.forEach((cb) => cb(msg));
  };

  ws.onclose = () => {
    if (keepaliveInterval) clearInterval(keepaliveInterval);
    closeListeners.forEach((cb) => cb());
  };

  function addListener<T>(list: T[], cb: T): () => void {
    list.push(cb);
    return () => {
      const i = list.indexOf(cb);
      if (i >= 0) list.splice(i, 1);
    };
  }

  return {
    sendAudio(chunk: ArrayBuffer) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(chunk);
      }
    },
    onTranscript: (cb) => addListener(transcriptListeners, cb),
    onError: (cb) => addListener(errorListeners, cb),
    onOpen: (cb) => addListener(openListeners, cb),
    onClose: (cb) => addListener(closeListeners, cb),
    close() {
      if (keepaliveInterval) clearInterval(keepaliveInterval);
      ws.close();
    },
    isOpen() {
      return ws.readyState === WebSocket.OPEN;
    },
  };
}
