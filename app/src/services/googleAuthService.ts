/**
 * Google OAuth token lifecycle service — D.8 v1.
 *
 * Responsibilities:
 *   - Exchange authorization code for access + refresh tokens (PKCE, no client_secret)
 *   - Persist tokens in expo-secure-store
 *   - Auto-refresh access token when expired
 *   - Provide isConnected() check for UI gating
 *
 * OAuth hooks (useAuthRequest) MUST live in React components — not here.
 * This service is called AFTER the OAuth flow completes in settings.tsx.
 */
import * as SecureStore from 'expo-secure-store';

const KEYS = {
  REFRESH_TOKEN: 'google_refresh_token',
  ACCESS_TOKEN: 'google_access_token',
  ACCESS_TOKEN_EXPIRY: 'google_access_token_expiry',
} as const;

const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';

// Refresh 60 seconds before actual expiry to avoid edge-case failures
const EXPIRY_BUFFER_MS = 60 * 1000;

export class GoogleAuthService {
  constructor(private readonly clientId: string) {}

  async connect(code: string, codeVerifier: string, redirectUri: string): Promise<void> {
    const body = new URLSearchParams({
      code,
      client_id: this.clientId,
      redirect_uri: redirectUri,
      code_verifier: codeVerifier,
      grant_type: 'authorization_code',
    });

    const res = await fetch(TOKEN_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (!res.ok) {
      let errorCode: string = String(res.status);
      try { errorCode = (await res.json()).error ?? errorCode; } catch {}
      throw new Error(`[GoogleAuth] Token exchange failed: ${errorCode}`);
    }

    const data = await res.json();
    await this._storeTokens(data.access_token, data.refresh_token, data.expires_in);
  }

  async disconnect(): Promise<void> {
    await Promise.all([
      SecureStore.deleteItemAsync(KEYS.REFRESH_TOKEN),
      SecureStore.deleteItemAsync(KEYS.ACCESS_TOKEN),
      SecureStore.deleteItemAsync(KEYS.ACCESS_TOKEN_EXPIRY),
    ]);
  }

  async isConnected(): Promise<boolean> {
    const token = await SecureStore.getItemAsync(KEYS.REFRESH_TOKEN);
    return token !== null;
  }

  async getValidAccessToken(): Promise<string | null> {
    const refreshToken = await SecureStore.getItemAsync(KEYS.REFRESH_TOKEN);
    if (!refreshToken) return null;

    const accessToken = await SecureStore.getItemAsync(KEYS.ACCESS_TOKEN);
    const expiryStr = await SecureStore.getItemAsync(KEYS.ACCESS_TOKEN_EXPIRY);

    if (accessToken && expiryStr) {
      const expiry = parseInt(expiryStr, 10);
      if (expiry > Date.now() + EXPIRY_BUFFER_MS) {
        return accessToken;
      }
    }

    return this._refreshAccessToken(refreshToken);
  }

  private async _refreshAccessToken(refreshToken: string): Promise<string | null> {
    const body = new URLSearchParams({
      refresh_token: refreshToken,
      client_id: this.clientId,
      grant_type: 'refresh_token',
    });

    const res = await fetch(TOKEN_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (!res.ok) {
      console.warn('[GoogleAuth] Token refresh failed — refresh token may be revoked');
      await this.disconnect();
      return null;
    }

    const data = await res.json();
    await this._storeTokens(data.access_token, undefined, data.expires_in);
    return data.access_token;
  }

  private async _storeTokens(
    accessToken: string,
    refreshToken: string | undefined,
    expiresIn: number,
  ): Promise<void> {
    const expiresAt = Date.now() + expiresIn * 1000;
    await SecureStore.setItemAsync(KEYS.ACCESS_TOKEN, accessToken);
    await SecureStore.setItemAsync(KEYS.ACCESS_TOKEN_EXPIRY, String(expiresAt));
    if (refreshToken !== undefined) {
      await SecureStore.setItemAsync(KEYS.REFRESH_TOKEN, refreshToken);
    }
  }
}

export const googleAuthService = new GoogleAuthService(
  '618204796187-dh47tmhn7p12lup9o7utqpm9l3f4vr99.apps.googleusercontent.com',
);
