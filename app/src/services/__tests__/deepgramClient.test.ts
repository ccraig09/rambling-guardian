import {
  createDeepgramConnection,
  type DeepgramConnection,
} from '../deepgramClient';

// Mock WebSocket
class MockWebSocket {
  static instances: MockWebSocket[] = [];
  url: string;
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onerror: ((event: any) => void) | null = null;
  onclose: (() => void) | null = null;
  readyState = 0; // CONNECTING
  sentData: any[] = [];

  constructor(url: string, _protocols?: any, _options?: any) {
    this.url = url;
    MockWebSocket.instances.push(this);
  }

  send(data: any) { this.sentData.push(data); }
  close() { this.readyState = 3; this.onclose?.(); }

  // Test helpers
  simulateOpen() { this.readyState = 1; this.onopen?.(); }
  simulateMessage(data: string) { this.onmessage?.({ data }); }
  simulateError(msg: string) { this.onerror?.({ message: msg }); }

  static get OPEN() { return 1; }
  static get CLOSED() { return 3; }
}

(global as any).WebSocket = MockWebSocket;

jest.mock('../../config/deepgram', () => ({
  DEEPGRAM_DEFAULTS: {
    model: 'nova-3',
    language: 'en',
    smart_format: 'true',
    interim_results: 'true',
    utterance_end_ms: '1000',
    encoding: 'linear16',
    sample_rate: '16000',
    channels: '1',
  },
}));

beforeEach(() => {
  MockWebSocket.instances = [];
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('deepgramClient', () => {
  test('createDeepgramConnection opens WebSocket with correct URL', () => {
    createDeepgramConnection('test-key');
    expect(MockWebSocket.instances).toHaveLength(1);
    expect(MockWebSocket.instances[0].url).toContain('api.deepgram.com');
    expect(MockWebSocket.instances[0].url).toContain('model=nova-3');
  });

  test('onTranscript fires for final transcript events', () => {
    const conn = createDeepgramConnection('test-key');
    const transcripts: any[] = [];
    conn.onTranscript((seg) => transcripts.push(seg));

    const ws = MockWebSocket.instances[0];
    ws.simulateOpen();
    ws.simulateMessage(JSON.stringify({
      type: 'Results',
      is_final: true,
      channel: {
        alternatives: [{
          transcript: 'Hello world',
          confidence: 0.98,
          words: [
            { word: 'Hello', start: 0.1, end: 0.4, confidence: 0.99 },
            { word: 'world', start: 0.5, end: 0.9, confidence: 0.97 },
          ],
        }],
      },
      start: 0.1,
      duration: 0.8,
    }));

    expect(transcripts).toHaveLength(1);
    expect(transcripts[0].text).toBe('Hello world');
    expect(transcripts[0].isFinal).toBe(true);
    expect(transcripts[0].words).toHaveLength(2);
  });

  test('onTranscript fires for interim transcript events', () => {
    const conn = createDeepgramConnection('test-key');
    const transcripts: any[] = [];
    conn.onTranscript((seg) => transcripts.push(seg));

    const ws = MockWebSocket.instances[0];
    ws.simulateOpen();
    ws.simulateMessage(JSON.stringify({
      type: 'Results',
      is_final: false,
      channel: {
        alternatives: [{ transcript: 'Hello', confidence: 0.8, words: [] }],
      },
      start: 0.1,
      duration: 0.3,
    }));

    expect(transcripts).toHaveLength(1);
    expect(transcripts[0].isFinal).toBe(false);
  });

  test('empty transcripts are not emitted', () => {
    const conn = createDeepgramConnection('test-key');
    const transcripts: any[] = [];
    conn.onTranscript((seg) => transcripts.push(seg));

    const ws = MockWebSocket.instances[0];
    ws.simulateOpen();
    ws.simulateMessage(JSON.stringify({
      type: 'Results',
      is_final: true,
      channel: { alternatives: [{ transcript: '', confidence: 0, words: [] }] },
      start: 0, duration: 0,
    }));

    expect(transcripts).toHaveLength(0);
  });

  test('sendAudio sends data to WebSocket', () => {
    const conn = createDeepgramConnection('test-key');
    const ws = MockWebSocket.instances[0];
    ws.simulateOpen();

    const chunk = new ArrayBuffer(100);
    conn.sendAudio(chunk);
    expect(ws.sentData).toHaveLength(1);
  });

  test('close closes WebSocket', () => {
    const conn = createDeepgramConnection('test-key');
    const ws = MockWebSocket.instances[0];
    ws.simulateOpen();
    conn.close();
    expect(ws.readyState).toBe(3);
  });

  test('parses dominant speaker from word-level diarization', () => {
    const conn = createDeepgramConnection('test-key');
    const transcripts: any[] = [];
    conn.onTranscript((seg) => transcripts.push(seg));

    const ws = MockWebSocket.instances[0];
    ws.simulateOpen();
    ws.simulateMessage(JSON.stringify({
      type: 'Results',
      is_final: true,
      channel: {
        alternatives: [{
          transcript: 'Hello world',
          confidence: 0.98,
          words: [
            { word: 'Hello', start: 0.1, end: 0.4, confidence: 0.99, speaker: 0 },
            { word: 'world', start: 0.5, end: 0.9, confidence: 0.97, speaker: 0 },
          ],
        }],
      },
      start: 0.1,
      duration: 0.8,
    }));

    expect(transcripts[0].speaker).toBe('Speaker 0');
  });

  test('picks dominant speaker when words have mixed speakers', () => {
    const conn = createDeepgramConnection('test-key');
    const transcripts: any[] = [];
    conn.onTranscript((seg) => transcripts.push(seg));

    const ws = MockWebSocket.instances[0];
    ws.simulateOpen();
    ws.simulateMessage(JSON.stringify({
      type: 'Results',
      is_final: true,
      channel: {
        alternatives: [{
          transcript: 'Hello world test',
          confidence: 0.9,
          words: [
            { word: 'Hello', start: 0.1, end: 0.3, confidence: 0.9, speaker: 0 },
            { word: 'world', start: 0.4, end: 0.6, confidence: 0.9, speaker: 1 },
            { word: 'test', start: 0.7, end: 0.9, confidence: 0.9, speaker: 1 },
          ],
        }],
      },
      start: 0.1,
      duration: 0.8,
    }));

    expect(transcripts[0].speaker).toBe('Speaker 1'); // 2 words vs 1
  });

  test('speaker is null when diarization not present on words', () => {
    const conn = createDeepgramConnection('test-key');
    const transcripts: any[] = [];
    conn.onTranscript((seg) => transcripts.push(seg));

    const ws = MockWebSocket.instances[0];
    ws.simulateOpen();
    ws.simulateMessage(JSON.stringify({
      type: 'Results',
      is_final: true,
      channel: {
        alternatives: [{
          transcript: 'Hello',
          confidence: 0.9,
          words: [{ word: 'Hello', start: 0.1, end: 0.3, confidence: 0.9 }],
        }],
      },
      start: 0.1,
      duration: 0.2,
    }));

    expect(transcripts[0].speaker).toBeNull();
  });
});
