import { transcriptService } from '../transcriptService';
import { useTranscriptStore } from '../../stores/transcriptStore';
import { useSessionStore } from '../../stores/sessionStore';

// Mock dependencies
jest.mock('../deepgramClient', () => ({
  createDeepgramConnection: jest.fn(() => ({
    sendAudio: jest.fn(),
    onTranscript: jest.fn(() => () => {}),
    onError: jest.fn(() => () => {}),
    onOpen: jest.fn((cb: () => void) => { cb(); return () => {}; }),
    onClose: jest.fn(() => () => {}),
    close: jest.fn(),
    isOpen: jest.fn(() => true),
  })),
}));

jest.mock('react-native-live-audio-stream', () => ({
  init: jest.fn(() => Promise.resolve()),
  start: jest.fn(),
  stop: jest.fn(),
  on: jest.fn(),
}));

jest.mock('../../config/deepgram', () => ({
  DEEPGRAM_API_KEY: 'test-key',
  DEEPGRAM_DEFAULTS: {},
}));

jest.mock('../../db/sessions', () => ({
  updateTranscript: jest.fn(async () => {}),
  updateRetention: jest.fn(async () => {}),
}));

jest.mock('../../db/settings', () => ({
  saveSetting: jest.fn(async () => {}),
  loadAllSettings: jest.fn(async () => new Map()),
}));

jest.mock('../speakerService', () => ({
  speakerService: {
    reset: jest.fn(),
    handleNewSpeaker: jest.fn(),
    persistToSession: jest.fn(async () => {}),
  },
}));

jest.mock('../speakerLibraryService', () => ({
  speakerLibraryService: {
    markSeenInSession: jest.fn(async () => {}),
  },
}));

beforeEach(() => {
  useTranscriptStore.getState().reset();
  useSessionStore.setState({ activeSessionId: null });
  transcriptService.stop();
  jest.clearAllMocks();
});

describe('transcriptService', () => {
  test('start subscribes to sessionStore without crashing', () => {
    transcriptService.start();
    transcriptService.stop();
  });

  test('does not start transcription without activeSessionId', () => {
    transcriptService.start();
    expect(useTranscriptStore.getState().status).toBe('idle');
    transcriptService.stop();
  });

  test('sets status to starting/streaming when activeSessionId appears', async () => {
    transcriptService.start();
    useSessionStore.setState({ activeSessionId: 'session-123' });
    // Give subscription time to fire
    await new Promise((r) => setTimeout(r, 50));
    const status = useTranscriptStore.getState().status;
    expect(['starting', 'streaming']).toContain(status);
    transcriptService.stop();
  });
});
