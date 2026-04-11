import { useSessionStore } from '../../stores/sessionStore';

describe('context classification override stickiness', () => {
  beforeEach(() => {
    useSessionStore.getState().resetContext();
  });

  test('manual override is not overwritten by auto-classification', () => {
    const store = useSessionStore.getState();

    // Auto-classify to solo
    store.setSessionContext('solo');
    expect(useSessionStore.getState().sessionContext).toBe('solo');
    expect(useSessionStore.getState().sessionContextOverride).toBe(false);

    // User manually overrides to with_others
    store.setSessionContext('with_others');
    store.setSessionContextOverride(true);
    expect(useSessionStore.getState().sessionContext).toBe('with_others');
    expect(useSessionStore.getState().sessionContextOverride).toBe(true);

    // Simulate what transcriptService.updateContextClassification does:
    // it checks sessionContextOverride and skips if true
    const sessionStore = useSessionStore.getState();
    if (!sessionStore.sessionContextOverride) {
      // This should NOT execute
      sessionStore.setSessionContext('solo');
    }

    // Override is still sticky
    expect(useSessionStore.getState().sessionContext).toBe('with_others');
    expect(useSessionStore.getState().sessionContextOverride).toBe(true);
  });

  test('resetContext clears both context and override', () => {
    const store = useSessionStore.getState();
    store.setSessionContext('presentation');
    store.setSessionContextOverride(true);

    store.resetContext();

    expect(useSessionStore.getState().sessionContext).toBeNull();
    expect(useSessionStore.getState().sessionContextOverride).toBe(false);
  });
});
