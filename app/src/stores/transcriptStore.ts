import { create } from 'zustand';
import type { TranscriptSegment, TranscriptStatus } from '../types';

interface TranscriptStore {
  status: TranscriptStatus;
  segments: TranscriptSegment[];
  interimText: string;
  streamError: string | null;

  setStatus: (status: TranscriptStatus) => void;
  addFinalSegment: (segment: TranscriptSegment) => void;
  setInterim: (text: string) => void;
  setError: (error: string) => void;
  reset: () => void;
}

export const useTranscriptStore = create<TranscriptStore>((set) => ({
  status: 'idle',
  segments: [],
  interimText: '',
  streamError: null,

  setStatus: (status) => set({ status }),

  addFinalSegment: (segment) =>
    set((state) => ({
      segments: [...state.segments, segment],
      interimText: '', // clear interim when final arrives
    })),

  setInterim: (text) => set({ interimText: text }),

  setError: (error) => set({ streamError: error, status: 'failed' }),

  reset: () =>
    set({
      status: 'idle',
      segments: [],
      interimText: '',
      streamError: null,
    }),
}));
