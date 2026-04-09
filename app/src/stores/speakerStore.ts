import { create } from 'zustand';
import type { SpeakerMapping } from '../types';

interface SpeakerStore {
  mappings: Record<string, SpeakerMapping>;
  setMapping: (label: string, mapping: SpeakerMapping) => void;
  setMappings: (mappings: Record<string, SpeakerMapping>) => void;
  reset: () => void;
}

export const useSpeakerStore = create<SpeakerStore>((set) => ({
  mappings: {},

  setMapping: (label, mapping) =>
    set((state) => ({
      mappings: { ...state.mappings, [label]: mapping },
    })),

  setMappings: (mappings) => set({ mappings }),

  reset: () => set({ mappings: {} }),
}));
