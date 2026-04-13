/**
 * googleAuthService tests — D.8
 *
 * Tests token exchange, refresh, disconnect, and isConnected.
 * Mocks expo-secure-store and global fetch.
 */

// Mock expo-secure-store
const secureStoreData: Record<string, string> = {};
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn((key: string) => Promise.resolve(secureStoreData[key] ?? null)),
  setItemAsync: jest.fn((key: string, value: string) => {
    secureStoreData[key] = value;
    return Promise.resolve();
  }),
  deleteItemAsync: jest.fn((key: string) => {
    delete secureStoreData[key];
    return Promise.resolve();
  }),
}));

import { GoogleAuthService } from '../googleAuthService';

const CLIENT_ID = '618204796187-dh47tmhn7p12lup9o7utqpm9l3f4vr99.apps.googleusercontent.com';

describe('GoogleAuthService', () => {
  let service: GoogleAuthService;
  let fetchMock: jest.SpyInstance;

  beforeEach(() => {
    service = new GoogleAuthService(CLIENT_ID);
    // Clear the in-memory store between tests
    Object.keys(secureStoreData).forEach((k) => delete secureStoreData[k]);
    fetchMock = jest.spyOn(global, 'fetch');
  });

  afterEach(() => {
    fetchMock.mockRestore();
  });

  describe('connect', () => {
    it('exchanges auth code for tokens and stores them', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'ACCESS',
          refresh_token: 'REFRESH',
          expires_in: 3600,
        }),
      } as any);

      await service.connect('CODE', 'VERIFIER', 'https://redirect.uri/');

      expect(secureStoreData['google_refresh_token']).toBe('REFRESH');
      expect(secureStoreData['google_access_token']).toBe('ACCESS');
    });

    it('throws when token exchange fails', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'invalid_grant' }),
      } as any);

      await expect(service.connect('BAD', 'V', 'https://r/')).rejects.toThrow();
    });
  });

  describe('isConnected', () => {
    it('returns false when no refresh token', async () => {
      expect(await service.isConnected()).toBe(false);
    });

    it('returns true when refresh token exists', async () => {
      secureStoreData['google_refresh_token'] = 'TOKEN';
      expect(await service.isConnected()).toBe(true);
    });
  });

  describe('getValidAccessToken', () => {
    it('returns null when no tokens stored', async () => {
      const token = await service.getValidAccessToken();
      expect(token).toBeNull();
    });

    it('returns stored access token when not expired', async () => {
      secureStoreData['google_refresh_token'] = 'REFRESH';
      secureStoreData['google_access_token'] = 'ACCESS';
      secureStoreData['google_access_token_expiry'] = String(Date.now() + 3600000);

      const token = await service.getValidAccessToken();
      expect(token).toBe('ACCESS');
    });

    it('refreshes access token when expired', async () => {
      secureStoreData['google_refresh_token'] = 'REFRESH';
      secureStoreData['google_access_token'] = 'OLD';
      secureStoreData['google_access_token_expiry'] = String(Date.now() - 1000); // expired

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'NEW_ACCESS', expires_in: 3600 }),
      } as any);

      const token = await service.getValidAccessToken();
      expect(token).toBe('NEW_ACCESS');
      expect(secureStoreData['google_access_token']).toBe('NEW_ACCESS');
    });
  });

  describe('disconnect', () => {
    it('clears all stored tokens', async () => {
      secureStoreData['google_refresh_token'] = 'REFRESH';
      secureStoreData['google_access_token'] = 'ACCESS';
      secureStoreData['google_access_token_expiry'] = '9999999999999';

      await service.disconnect();

      expect(secureStoreData['google_refresh_token']).toBeUndefined();
      expect(secureStoreData['google_access_token']).toBeUndefined();
      expect(await service.isConnected()).toBe(false);
    });
  });
});
