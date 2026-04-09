import { useTranscriptStore } from '../transcriptStore';
import type { TranscriptSegment } from '../../types';

beforeEach(() => {
  useTranscriptStore.getState().reset();
});

describe('transcriptStore', () => {
  test('initial state is idle with empty segments', () => {
    const state = useTranscriptStore.getState();
    expect(state.status).toBe('idle');
    expect(state.segments).toEqual([]);
    expect(state.interimText).toBe('');
    expect(state.streamError).toBeNull();
  });

  test('setStatus updates status', () => {
    useTranscriptStore.getState().setStatus('streaming');
    expect(useTranscriptStore.getState().status).toBe('streaming');
  });

  test('addFinalSegment appends to segments', () => {
    const seg: TranscriptSegment = {
      text: 'Hello world',
      start: 100,
      end: 1200,
      isFinal: true,
      speaker: null,
    };
    useTranscriptStore.getState().addFinalSegment(seg);
    expect(useTranscriptStore.getState().segments).toEqual([seg]);
  });

  test('addFinalSegment clears interimText', () => {
    useTranscriptStore.getState().setInterim('Hello wor');
    const seg: TranscriptSegment = {
      text: 'Hello world',
      start: 100,
      end: 1200,
      isFinal: true,
      speaker: null,
    };
    useTranscriptStore.getState().addFinalSegment(seg);
    expect(useTranscriptStore.getState().interimText).toBe('');
  });

  test('setInterim updates interimText', () => {
    useTranscriptStore.getState().setInterim('Hello wor');
    expect(useTranscriptStore.getState().interimText).toBe('Hello wor');
  });

  test('setError sets error and status to failed', () => {
    useTranscriptStore.getState().setError('Connection refused');
    const state = useTranscriptStore.getState();
    expect(state.streamError).toBe('Connection refused');
    expect(state.status).toBe('failed');
  });

  test('reset clears all state', () => {
    useTranscriptStore.getState().setStatus('streaming');
    useTranscriptStore.getState().addFinalSegment({
      text: 'test', start: 0, end: 100, isFinal: true, speaker: null,
    });
    useTranscriptStore.getState().setInterim('partial');
    useTranscriptStore.getState().reset();

    const state = useTranscriptStore.getState();
    expect(state.status).toBe('idle');
    expect(state.segments).toEqual([]);
    expect(state.interimText).toBe('');
    expect(state.streamError).toBeNull();
  });
});
