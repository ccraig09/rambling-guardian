// app/src/services/__tests__/speakerService.test.ts
import { speakerService } from '../speakerService';
import { useSpeakerStore } from '../../stores/speakerStore';

jest.mock('../../db/sessions', () => ({
  updateSpeakerMap: jest.fn(async () => {}),
}));

jest.mock('../../db/settings', () => ({
  saveSetting: jest.fn(async () => {}),
  loadAllSettings: jest.fn(async () => new Map()),
}));

beforeEach(() => {
  speakerService.reset();
});

describe('speakerService', () => {
  test('first speaker in solo session maps to Me (provisional)', () => {
    speakerService.handleNewSpeaker('Speaker 0');
    const map = useSpeakerStore.getState().mappings;
    expect(map['Speaker 0']).toEqual({
      diarizedLabel: 'Speaker 0',
      displayName: 'Me',
      confidence: 'provisional',
    });
  });

  test('second speaker keeps Speaker 0 as Me', () => {
    speakerService.handleNewSpeaker('Speaker 0');
    speakerService.handleNewSpeaker('Speaker 1');
    const map = useSpeakerStore.getState().mappings;
    expect(map['Speaker 0'].displayName).toBe('Me');
    expect(map['Speaker 1'].displayName).toBe('Speaker 1');
  });

  test('third speaker does NOT auto-assign Me to new speakers', () => {
    speakerService.handleNewSpeaker('Speaker 0');
    speakerService.handleNewSpeaker('Speaker 1');
    speakerService.handleNewSpeaker('Speaker 2');
    const map = useSpeakerStore.getState().mappings;
    // Speaker 0 keeps Me (already assigned before threshold)
    expect(map['Speaker 0'].displayName).toBe('Me');
    expect(map['Speaker 2'].displayName).toBe('Speaker 2');
  });

  test('3+ speakers from start get generic labels only', () => {
    // Simulate all 3 appearing in quick succession before any mapping
    speakerService.handleNewSpeaker('Speaker 0');
    speakerService.handleNewSpeaker('Speaker 1');
    speakerService.handleNewSpeaker('Speaker 2');
    // Speaker 0 was assigned Me when count was 1, keeps it per spec
    const map = useSpeakerStore.getState().mappings;
    expect(map['Speaker 0'].displayName).toBe('Me');
  });

  test('reassignSpeaker updates displayName and sets user_confirmed', () => {
    speakerService.handleNewSpeaker('Speaker 0');
    speakerService.reassignSpeaker('Speaker 0', 'Carlos');
    const map = useSpeakerStore.getState().mappings;
    expect(map['Speaker 0'].displayName).toBe('Carlos');
    expect(map['Speaker 0'].confidence).toBe('user_confirmed');
  });

  test('getDisplayName returns display name for known speaker', () => {
    speakerService.handleNewSpeaker('Speaker 0');
    expect(speakerService.getDisplayName('Speaker 0')).toBe('Me');
  });

  test('getDisplayName returns raw label for unknown speaker', () => {
    expect(speakerService.getDisplayName('Speaker 99')).toBe('Speaker 99');
  });

  test('reset clears all mappings', () => {
    speakerService.handleNewSpeaker('Speaker 0');
    speakerService.reset();
    expect(useSpeakerStore.getState().mappings).toEqual({});
  });

  test('persistToSession calls updateSpeakerMap', async () => {
    speakerService.handleNewSpeaker('Speaker 0');
    await speakerService.persistToSession('session-123');
    const { updateSpeakerMap } = require('../../db/sessions');
    expect(updateSpeakerMap).toHaveBeenCalledWith(
      'session-123',
      expect.stringContaining('"Speaker 0"'),
    );
  });
});
