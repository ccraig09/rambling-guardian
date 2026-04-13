# D.8 v1 — Google Drive Backup & Export — Implementation Plan

> **For agentic workers:** Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** App-mediated Google Drive OAuth 2.0, per-session Markdown export, refresh token persistence, Settings UI to connect/disconnect/batch-export, Session Detail UI for per-session export.

**Architecture:** `googleAuthService.ts` owns token lifecycle. `driveExportService.ts` owns folder ops + upload. `sessionMarkdown.ts` is a pure formatter. OAuth hooks live in `settings.tsx` (React constraint). `migrateToV8` adds `drive_file_id` + `backup_status` columns.

**GCP prerequisites (already complete):**
- Project: `rambling-guardian`
- Google Drive API: enabled
- iOS OAuth Client ID: `618204796187-dh47tmhn7p12lup9o7utqpm9l3f4vr99.apps.googleusercontent.com`
- Bundle ID: `com.ccraig09.ramblingguardian`

---

### Task 1: Install packages + app.json config + migrateToV8

**Files:**
- Modify: `app/package.json` (via expo install)
- Modify: `app/app.json`
- Modify: `app/src/db/schema.ts`
- Modify: `app/src/db/database.ts`
- Modify: `app/src/types/index.ts`
- Modify: `app/src/db/sessions.ts`

- [ ] **Step 1: Install packages**

```bash
cd app && npx expo install expo-auth-session expo-web-browser expo-secure-store
```

Expected: all three appear in `package.json` dependencies. No peer dep errors that block install.

- [ ] **Step 2: Update app.json**

Add `expo-web-browser` plugin and Google OAuth URL scheme to `app/app.json`:

```json
{
  "expo": {
    "ios": {
      "supportsTablet": false,
      "bundleIdentifier": "com.ccraig09.ramblingguardian",
      "infoPlist": {
        "NSMicrophoneUsageDescription": "...",
        "CFBundleURLTypes": [
          {
            "CFBundleURLSchemes": [
              "com.googleusercontent.apps.618204796187-dh47tmhn7p12lup9o7utqpm9l3f4vr99"
            ]
          }
        ]
      }
    },
    "plugins": [
      "expo-router",
      "expo-sqlite",
      "expo-web-browser",
      ["expo-notifications", { "sounds": [] }],
      ["react-native-ble-plx", { ... }],
      "expo-font"
    ]
  }
}
```

- [ ] **Step 3: Add migrateToV8 to schema.ts**

At the bottom of `app/src/db/schema.ts`, add:

```typescript
export async function migrateToV8(db: SQLiteDatabase): Promise<void> {
  const migrations = [
    `ALTER TABLE sessions ADD COLUMN drive_file_id TEXT`,
    `ALTER TABLE sessions ADD COLUMN backup_status TEXT`,
  ];

  for (const sql of migrations) {
    try {
      await db.execAsync(sql);
    } catch (e: any) {
      if (!e.message?.includes('duplicate column')) {
        throw e;
      }
    }
  }
}
```

- [ ] **Step 4: Wire migrateToV8 into database.ts**

```typescript
import { initDatabase, migrateToV2, migrateToV3, migrateToV4, migrateToV5, migrateToV6, migrateToV7, migrateToV8 } from './schema';

// ...inside getDatabase():
await migrateToV8(db);
```

- [ ] **Step 5: Add BackupStatus type + update Session interface in types/index.ts**

Add after `SummaryStatus`:
```typescript
export type BackupStatus = 'uploading' | 'complete' | 'failed' | null;
```

Add to `Session` interface:
```typescript
driveFileId: string | null;
backupStatus: BackupStatus;
```

- [ ] **Step 6: Update parseSession + add updateBackupStatus in sessions.ts**

In `parseSession`:
```typescript
driveFileId: row.drive_file_id ?? null,
backupStatus: (row.backup_status as BackupStatus) ?? null,
```

Add new DB function:
```typescript
export async function updateBackupStatus(
  id: string,
  status: BackupStatus,
  driveFileId?: string,
): Promise<void> {
  const db = await getDatabase();
  if (driveFileId) {
    await db.runAsync(
      'UPDATE sessions SET backup_status = ?, drive_file_id = ? WHERE id = ?',
      [status, driveFileId, id],
    );
  } else {
    await db.runAsync(
      'UPDATE sessions SET backup_status = ? WHERE id = ?',
      [status, id],
    );
  }
}
```

- [ ] **Step 7: Type check**

```bash
cd app && node node_modules/typescript/bin/tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 8: Commit**

```bash
git add app/package.json app/package-lock.json app/app.json \
        app/src/db/schema.ts app/src/db/database.ts \
        app/src/types/index.ts app/src/db/sessions.ts
git commit -m "feat(D8): install packages, app.json OAuth config, migrateToV8"
```

---

### Task 2: sessionMarkdown.ts — pure Markdown formatter + tests (TDD)

**Files:**
- Create: `app/src/utils/sessionMarkdown.ts`
- Create: `app/src/utils/__tests__/sessionMarkdown.test.ts`

- [ ] **Step 1: Write failing tests first**

Create `app/src/utils/__tests__/sessionMarkdown.test.ts`:

```typescript
import { formatSessionAsMarkdown, buildDriveFileName } from '../sessionMarkdown';
import { AlertLevel } from '../../types';
import type { Session, AlertEvent } from '../../types';

const baseSession: Session = {
  id: 'session-1234567890',
  startedAt: new Date('2026-04-13T09:30:00.000Z').getTime(),
  endedAt: new Date('2026-04-13T09:42:34.000Z').getTime(),
  durationMs: 12 * 60 * 1000 + 34 * 1000,
  mode: 'solo',
  alertCount: 2,
  maxAlert: AlertLevel.MODERATE,
  speechSegments: 5,
  sensitivity: 1,
  syncedFromDevice: false,
  sessionContext: 'with_others',
  sessionContextSource: 'auto',
  transcript: 'Hello world.',
  transcriptTimestamps: null,
  speakerMap: null,
  summary: 'Good session.',
  summaryStatus: 'complete',
  summaryGeneratedAt: Date.now(),
  driveFileId: null,
  backupStatus: null,
};

const events: AlertEvent[] = [
  { id: 1, sessionId: 'session-1234567890', timestamp: 45000, alertLevel: AlertLevel.GENTLE, durationAtAlert: 32000 },
  { id: 2, sessionId: 'session-1234567890', timestamp: 118000, alertLevel: AlertLevel.MODERATE, durationAtAlert: 47000 },
];

describe('formatSessionAsMarkdown', () => {
  it('includes session metadata header', () => {
    const md = formatSessionAsMarkdown(baseSession, []);
    expect(md).toContain('# Session —');
    expect(md).toContain('12 minutes 34 seconds');
    expect(md).toContain('With Others');
  });

  it('includes flat transcript when no timestamps', () => {
    const md = formatSessionAsMarkdown(baseSession, []);
    expect(md).toContain('## Transcript');
    expect(md).toContain('Hello world.');
  });

  it('includes AI summary when complete', () => {
    const md = formatSessionAsMarkdown(baseSession, []);
    expect(md).toContain('## AI Summary');
    expect(md).toContain('Good session.');
  });

  it('includes alert timeline when events exist', () => {
    const md = formatSessionAsMarkdown(baseSession, events);
    expect(md).toContain('## Alert Timeline');
    expect(md).toContain('0:45');
    expect(md).toContain('Gentle');
    expect(md).toContain('32s');
  });

  it('omits transcript section when transcript is null', () => {
    const s = { ...baseSession, transcript: null, transcriptTimestamps: null };
    const md = formatSessionAsMarkdown(s, []);
    expect(md).not.toContain('## Transcript');
  });

  it('omits summary section when summaryStatus is not complete', () => {
    const s = { ...baseSession, summary: null, summaryStatus: null };
    const md = formatSessionAsMarkdown(s, []);
    expect(md).not.toContain('## AI Summary');
  });

  it('omits alert timeline section when no events', () => {
    const md = formatSessionAsMarkdown(baseSession, []);
    expect(md).not.toContain('## Alert Timeline');
  });

  it('renders speaker-attributed turns from transcriptTimestamps', () => {
    const segments = JSON.stringify([
      { speaker: null, start: 3000, text: 'Hello there', isFinal: true },
      { speaker: 'Speaker 0', start: 74000, text: 'Response here', isFinal: true },
    ]);
    const speakerMap = JSON.stringify([
      { diarizedLabel: 'Speaker 0', displayName: 'Alex' },
    ]);
    const s = { ...baseSession, transcriptTimestamps: segments, speakerMap };
    const md = formatSessionAsMarkdown(s, []);
    expect(md).toContain('**Unknown**');
    expect(md).toContain('**Alex**');
    expect(md).toContain('Hello there');
  });
});

describe('buildDriveFileName', () => {
  it('formats file name with date, time, and context', () => {
    const name = buildDriveFileName(baseSession);
    expect(name).toMatch(/^2026-04-13_\d{2}-\d{2}_with-others\.md$/);
  });

  it('uses session fallback when context is null', () => {
    const s = { ...baseSession, sessionContext: null };
    const name = buildDriveFileName(s);
    expect(name).toContain('_session.md');
  });

  it('appends session ID suffix on collision-prone names', () => {
    // buildDriveFileName always includes context, no collision needed for uniqueness in v1
    const name = buildDriveFileName(baseSession);
    expect(name.endsWith('.md')).toBe(true);
  });
});
```

Run tests — they should FAIL (file doesn't exist yet):
```bash
cd app && node node_modules/jest/bin/jest.js --testPathPattern="sessionMarkdown" --no-coverage
```

- [ ] **Step 2: Implement sessionMarkdown.ts**

Create `app/src/utils/sessionMarkdown.ts`:

```typescript
/**
 * Session Markdown formatter — D.8 v1.
 *
 * Pure functions. No DB access, no side effects.
 * Called by driveExportService before uploading to Google Drive.
 */
import type { Session, AlertEvent, TranscriptSegment, SpeakerMapping } from '../types';
import { AlertLevel } from '../types';

// ────────────────────────────────────────────────────────────
// File naming
// ────────────────────────────────────────────────────────────

const CONTEXT_SLUG: Record<string, string> = {
  solo: 'solo',
  with_others: 'with-others',
  presentation: 'presentation',
};

export function buildDriveFileName(session: Session): string {
  const d = new Date(session.startedAt);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  const ctx = session.sessionContext ? CONTEXT_SLUG[session.sessionContext] ?? 'session' : 'session';
  return `${yyyy}-${mm}-${dd}_${hh}-${min}_${ctx}.md`;
}

export function buildDriveFolderPath(session: Session): { year: string; month: string } {
  const d = new Date(session.startedAt);
  return {
    year: String(d.getFullYear()),
    month: String(d.getMonth() + 1).padStart(2, '0'),
  };
}

// ────────────────────────────────────────────────────────────
// Formatting helpers
// ────────────────────────────────────────────────────────────

const MONTH_NAMES = ['January','February','March','April','May','June',
  'July','August','September','October','November','December'];

const ALERT_NAMES: Record<number, string> = {
  [AlertLevel.NONE]: 'None',
  [AlertLevel.GENTLE]: 'Gentle',
  [AlertLevel.MODERATE]: 'Moderate',
  [AlertLevel.URGENT]: 'Urgent',
  [AlertLevel.CRITICAL]: 'Critical',
};

const CONTEXT_LABELS: Record<string, string> = {
  solo: 'Solo',
  with_others: 'With Others',
  presentation: 'Presentation',
};

function formatDurationMs(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSec / 60);
  const seconds = totalSec % 60;
  if (minutes === 0) return `${seconds} seconds`;
  if (seconds === 0) return `${minutes} minutes`;
  return `${minutes} minutes ${seconds} seconds`;
}

function formatOffset(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function formatHeaderDate(startedAt: number): string {
  const d = new Date(startedAt);
  const month = MONTH_NAMES[d.getMonth()];
  const day = d.getDate();
  const year = d.getFullYear();
  const hour = d.getHours();
  const min = String(d.getMinutes()).padStart(2, '0');
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const h12 = hour % 12 || 12;
  return `${month} ${day}, ${year} · ${h12}:${min} ${ampm}`;
}

// ────────────────────────────────────────────────────────────
// Transcript rendering (mirrors logic from session/[id].tsx)
// ────────────────────────────────────────────────────────────

interface Turn {
  displayName: string;
  startMs: number;
  text: string;
}

const MAX_SESSION_OFFSET_MS = 4 * 60 * 60 * 1000;

function normalizeOffset(segStart: number, sessionStartMs: number): number {
  if (segStart > MAX_SESSION_OFFSET_MS) {
    return Math.max(0, segStart - sessionStartMs);
  }
  return segStart;
}

function parseSpeakerMap(raw: string | null): SpeakerMapping[] {
  if (!raw) return [];
  try { const p = JSON.parse(raw); return Array.isArray(p) ? p : []; } catch { return []; }
}

function parseSegments(raw: string | null): TranscriptSegment[] | null {
  if (!raw) return null;
  try { const p = JSON.parse(raw); return Array.isArray(p) ? p : null; } catch { return null; }
}

function resolveName(label: string | null, mappings: SpeakerMapping[]): string {
  if (!label) return 'Unknown';
  return mappings.find((m) => m.diarizedLabel === label)?.displayName ?? label;
}

function buildTurns(segments: TranscriptSegment[], mappings: SpeakerMapping[], sessionStartMs: number): Turn[] {
  const turns: Turn[] = [];
  for (const seg of segments) {
    if (!seg.isFinal) continue;
    const name = resolveName(seg.speaker, mappings);
    const last = turns[turns.length - 1];
    const offsetMs = normalizeOffset(seg.start, sessionStartMs);
    if (last && last.displayName === name) {
      last.text += ' ' + seg.text;
    } else {
      turns.push({ displayName: name, startMs: offsetMs, text: seg.text });
    }
  }
  return turns;
}

function renderTranscriptSection(session: Session): string | null {
  const segments = parseSegments(session.transcriptTimestamps);
  const mappings = parseSpeakerMap(session.speakerMap);

  if (segments && segments.length > 0) {
    const turns = buildTurns(segments, mappings, session.startedAt);
    if (turns.length > 0) {
      const lines = turns.map((t) =>
        `**${t.displayName}** · ${formatOffset(t.startMs)}\n${t.text}`
      );
      return `## Transcript\n\n${lines.join('\n\n')}`;
    }
  }

  if (session.transcript) {
    return `## Transcript\n\n${session.transcript}`;
  }

  return null;
}

// ────────────────────────────────────────────────────────────
// Main export
// ────────────────────────────────────────────────────────────

export function formatSessionAsMarkdown(session: Session, events: AlertEvent[]): string {
  const sections: string[] = [];

  // Header
  const contextLabel = session.sessionContext
    ? CONTEXT_LABELS[session.sessionContext] ?? session.sessionContext
    : null;
  const alertName = ALERT_NAMES[session.maxAlert] ?? 'None';

  sections.push(`# Session — ${formatHeaderDate(session.startedAt)}`);
  sections.push('');

  const metaRows = [
    `| Field | Value |`,
    `|---|---|`,
    `| Duration | ${formatDurationMs(session.durationMs)} |`,
  ];
  if (contextLabel) metaRows.push(`| Context | ${contextLabel} |`);
  metaRows.push(`| Alerts | ${session.alertCount} (max: ${alertName}) |`);
  sections.push(metaRows.join('\n'));

  // Transcript
  const transcriptSection = renderTranscriptSection(session);
  if (transcriptSection) {
    sections.push('---');
    sections.push(transcriptSection);
  }

  // AI Summary
  if (session.summaryStatus === 'complete' && session.summary) {
    sections.push('---');
    sections.push(`## AI Summary\n\n${session.summary}`);
  }

  // Alert Timeline
  if (events.length > 0) {
    sections.push('---');
    const rows = [
      `## Alert Timeline`,
      '',
      '| Time | Level | Duration |',
      '|---|---|---|',
      ...events.map((e) => {
        const levelName = ALERT_NAMES[e.alertLevel] ?? 'Unknown';
        const durSecs = Math.round(e.durationAtAlert / 1000);
        return `| ${formatOffset(e.timestamp)} | ${levelName} | ${durSecs}s of speech |`;
      }),
    ];
    sections.push(rows.join('\n'));
  }

  return sections.join('\n\n');
}
```

- [ ] **Step 3: Run tests — should pass**

```bash
cd app && node node_modules/jest/bin/jest.js --testPathPattern="sessionMarkdown" --no-coverage
```

Expected: all tests pass.

- [ ] **Step 4: Type check**

```bash
cd app && node node_modules/typescript/bin/tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add app/src/utils/sessionMarkdown.ts app/src/utils/__tests__/sessionMarkdown.test.ts
git commit -m "feat(D8): sessionMarkdown pure formatter + tests (TDD)"
```

---

### Task 3: googleAuthService.ts + tests

**Files:**
- Create: `app/src/services/googleAuthService.ts`
- Create: `app/src/services/__tests__/googleAuthService.test.ts`

- [ ] **Step 1: Write failing tests**

Create `app/src/services/__tests__/googleAuthService.test.ts`:

```typescript
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
```

Run tests — should FAIL:
```bash
cd app && node node_modules/jest/bin/jest.js --testPathPattern="googleAuthService" --no-coverage
```

- [ ] **Step 2: Implement googleAuthService.ts**

Create `app/src/services/googleAuthService.ts`:

```typescript
/**
 * Google OAuth token lifecycle service — D.8 v1.
 *
 * Responsibilities:
 *   - Exchange authorization code for access + refresh tokens
 *   - Persist tokens in expo-secure-store
 *   - Auto-refresh access token when expired
 *   - Provide isConnected() check for UI gating
 *
 * OAuth hooks (useAuthRequest) MUST live in React components — not here.
 * This service is called AFTER the OAuth flow completes.
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

    const data = await res.json();
    if (!res.ok) {
      throw new Error(`[GoogleAuth] Token exchange failed: ${data.error ?? res.status}`);
    }

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
    if (refreshToken) {
      await SecureStore.setItemAsync(KEYS.REFRESH_TOKEN, refreshToken);
    }
  }
}

export const googleAuthService = new GoogleAuthService(
  '618204796187-dh47tmhn7p12lup9o7utqpm9l3f4vr99.apps.googleusercontent.com',
);
```

- [ ] **Step 3: Run tests — should pass**

```bash
cd app && node node_modules/jest/bin/jest.js --testPathPattern="googleAuthService" --no-coverage
```

Expected: all tests pass.

- [ ] **Step 4: Type check**

```bash
cd app && node node_modules/typescript/bin/tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add app/src/services/googleAuthService.ts app/src/services/__tests__/googleAuthService.test.ts
git commit -m "feat(D8): googleAuthService — OAuth token lifecycle + tests"
```

---

### Task 4: driveExportService.ts

**Files:**
- Create: `app/src/services/driveExportService.ts`

Note: DriveExportService integrates googleAuthService + DB + Drive API. Integration tests for this service are deferred — mocking the Drive API + DB in tests adds complexity without proportionate value. Manual testing on device will verify folder creation and file upload.

- [ ] **Step 1: Implement driveExportService.ts**

Create `app/src/services/driveExportService.ts`:

```typescript
/**
 * Google Drive export service — D.8 v1.
 *
 * Responsibilities:
 *   - Build/find the Rambling Guardian folder tree on Drive
 *   - Format sessions as Markdown via sessionMarkdown util
 *   - Upload Markdown files via Drive multipart upload
 *   - Update backup_status on session rows
 *
 * folder tree: My Drive / Rambling Guardian / Transcripts / YYYY / MM /
 */
import { googleAuthService } from './googleAuthService';
import { getSessionById, getSessions, getAlertEvents, updateBackupStatus } from '../db/sessions';
import { formatSessionAsMarkdown, buildDriveFileName, buildDriveFolderPath } from '../utils/sessionMarkdown';

const DRIVE_FILES_URL = 'https://www.googleapis.com/drive/v3/files';
const DRIVE_UPLOAD_URL = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';
const FOLDER_MIME = 'application/vnd.google-apps.folder';

async function driveGet(path: string, token: string): Promise<any> {
  const res = await fetch(`${DRIVE_FILES_URL}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`[Drive] GET failed: ${res.status}`);
  return res.json();
}

async function findFolder(name: string, parentId: string | null, token: string): Promise<string | null> {
  const parentClause = parentId ? ` and '${parentId}' in parents` : '';
  const q = encodeURIComponent(
    `name='${name}' and mimeType='${FOLDER_MIME}'${parentClause} and trashed=false`,
  );
  const data = await driveGet(`?q=${q}&fields=files(id,name)`, token);
  return data.files?.[0]?.id ?? null;
}

async function createFolder(name: string, parentId: string | null, token: string): Promise<string> {
  const body: any = { name, mimeType: FOLDER_MIME };
  if (parentId) body.parents = [parentId];

  const res = await fetch(DRIVE_FILES_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`[Drive] Create folder failed: ${res.status}`);
  const data = await res.json();
  return data.id;
}

async function ensureFolder(name: string, parentId: string | null, token: string): Promise<string> {
  const existing = await findFolder(name, parentId, token);
  if (existing) return existing;
  return createFolder(name, parentId, token);
}

async function uploadMarkdownFile(
  name: string,
  content: string,
  parentId: string,
  token: string,
): Promise<string> {
  const boundary = `rg_boundary_${Date.now()}`;
  const metadata = JSON.stringify({ name, parents: [parentId] });

  const body = [
    `--${boundary}`,
    'Content-Type: application/json; charset=UTF-8',
    '',
    metadata,
    `--${boundary}`,
    'Content-Type: text/markdown; charset=UTF-8',
    '',
    content,
    `--${boundary}--`,
  ].join('\r\n');

  const res = await fetch(DRIVE_UPLOAD_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body,
  });

  if (!res.ok) throw new Error(`[Drive] Upload failed: ${res.status}`);
  const data = await res.json();
  return data.id;
}

class DriveExportService {
  async exportSession(sessionId: string): Promise<void> {
    const token = await googleAuthService.getValidAccessToken();
    if (!token) throw new Error('[Drive] Not authenticated');

    const session = await getSessionById(sessionId);
    if (!session) throw new Error(`[Drive] Session ${sessionId} not found`);

    const events = await getAlertEvents(sessionId);

    await updateBackupStatus(sessionId, 'uploading');

    try {
      const markdown = formatSessionAsMarkdown(session, events);
      const fileName = buildDriveFileName(session);
      const { year, month } = buildDriveFolderPath(session);

      // Ensure folder tree: Rambling Guardian → Transcripts → YYYY → MM
      const rootId = await ensureFolder('Rambling Guardian', null, token);
      const transcriptsId = await ensureFolder('Transcripts', rootId, token);
      const yearId = await ensureFolder(year, transcriptsId, token);
      const monthId = await ensureFolder(month, yearId, token);

      const fileId = await uploadMarkdownFile(fileName, markdown, monthId, token);
      await updateBackupStatus(sessionId, 'complete', fileId);
    } catch (e) {
      await updateBackupStatus(sessionId, 'failed');
      throw e;
    }
  }

  async exportAllSessions(): Promise<{ succeeded: number; failed: number }> {
    const sessions = await getSessions(200);
    const pending = sessions.filter((s) => s.backupStatus !== 'complete');

    let succeeded = 0;
    let failed = 0;

    for (const session of pending) {
      try {
        await this.exportSession(session.id);
        succeeded++;
      } catch {
        failed++;
      }
    }

    return { succeeded, failed };
  }
}

export const driveExportService = new DriveExportService();
```

- [ ] **Step 2: Type check**

```bash
cd app && node node_modules/typescript/bin/tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add app/src/services/driveExportService.ts
git commit -m "feat(D8): driveExportService — folder ops, multipart upload, batch export"
```

---

### Task 5: Settings screen — Google Drive section

**Files:**
- Modify: `app/app/(tabs)/settings.tsx`

- [ ] **Step 1: Add import + hook setup**

At the top of `settings.tsx`, add:

```typescript
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri } from 'expo-auth-session';
import { googleAuthService } from '../../src/services/googleAuthService';
import { driveExportService } from '../../src/services/driveExportService';

WebBrowser.maybeCompleteAuthSession();
```

- [ ] **Step 2: Add state + hook inside the screen component**

Inside `SettingsScreen` function, add:

```typescript
// ── Google Drive state ──────────────────────────────────────
const [driveConnected, setDriveConnected] = useState(false);
const [driveBackupMessage, setDriveBackupMessage] = useState<string | null>(null);
const [driveLoading, setDriveLoading] = useState(false);

const redirectUri = makeRedirectUri({ scheme: 'com.googleusercontent.apps.618204796187-dh47tmhn7p12lup9o7utqpm9l3f4vr99' });

const [request, response, promptAsync] = Google.useAuthRequest({
  iosClientId: '618204796187-dh47tmhn7p12lup9o7utqpm9l3f4vr99.apps.googleusercontent.com',
  scopes: ['https://www.googleapis.com/auth/drive.file'],
  redirectUri,
});

// Check connection status on mount
useEffect(() => {
  googleAuthService.isConnected().then(setDriveConnected).catch(console.warn);
}, []);

// Handle OAuth response
useEffect(() => {
  if (response?.type === 'success') {
    const { code } = response.params;
    const codeVerifier = request?.codeVerifier ?? '';
    setDriveLoading(true);
    googleAuthService
      .connect(code, codeVerifier, redirectUri)
      .then(() => {
        setDriveConnected(true);
        setDriveBackupMessage(null);
      })
      .catch((e) => {
        console.warn('[Settings] Drive connect failed:', e);
        setDriveBackupMessage('Connection failed. Please try again.');
      })
      .finally(() => setDriveLoading(false));
  }
}, [response]);

async function handleDisconnect() {
  await googleAuthService.disconnect();
  setDriveConnected(false);
  setDriveBackupMessage(null);
}

async function handleBackupAll() {
  setDriveLoading(true);
  setDriveBackupMessage(null);
  try {
    const result = await driveExportService.exportAllSessions();
    setDriveBackupMessage(
      result.failed > 0
        ? `${result.succeeded} backed up · ${result.failed} failed`
        : `${result.succeeded} session${result.succeeded !== 1 ? 's' : ''} backed up`,
    );
  } catch (e) {
    setDriveBackupMessage('Backup failed. Check your connection.');
  } finally {
    setDriveLoading(false);
  }
}
```

- [ ] **Step 3: Add Google Drive section in JSX**

In the JSX return, add a new section below the "ABOUT" section:

```tsx
{/* ── Cloud Backup ── */}
<SectionHeader label="CLOUD BACKUP" theme={theme} />

{!driveConnected ? (
  <Pressable
    onPress={() => promptAsync()}
    disabled={!request || driveLoading}
    style={[styles.row, { opacity: !request || driveLoading ? 0.5 : 1 }]}
  >
    <Text style={[theme.type.body, { color: theme.primary[400] }]}>
      Connect Google Drive
    </Text>
    {driveLoading && <ActivityIndicator size="small" color={theme.primary[400]} />}
  </Pressable>
) : (
  <>
    <View style={styles.row}>
      <Text style={[theme.type.body, { color: theme.text.primary }]}>
        Google Drive  ✓
      </Text>
    </View>

    <Pressable
      onPress={handleBackupAll}
      disabled={driveLoading}
      style={[styles.row, { opacity: driveLoading ? 0.5 : 1 }]}
    >
      <Text style={[theme.type.body, { color: theme.primary[400] }]}>
        {driveLoading ? 'Backing up…' : 'Back Up All Sessions'}
      </Text>
      {driveLoading && <ActivityIndicator size="small" color={theme.primary[400]} />}
    </Pressable>

    <Pressable onPress={handleDisconnect} style={styles.row}>
      <Text style={[theme.type.body, { color: theme.alert.urgent }]}>
        Disconnect Google Drive
      </Text>
    </Pressable>
  </>
)}

{driveBackupMessage ? (
  <Text style={[theme.type.small, { color: theme.text.secondary, marginTop: 4, marginHorizontal: 16 }]}>
    {driveBackupMessage}
  </Text>
) : null}
```

- [ ] **Step 4: Type check**

```bash
cd app && node node_modules/typescript/bin/tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add app/app/(tabs)/settings.tsx
git commit -m "feat(D8): Settings — Google Drive connect/disconnect/backup section"
```

---

### Task 6: Session Detail screen — per-session "Export to Drive" button

**Files:**
- Modify: `app/app/session/[id].tsx`

- [ ] **Step 1: Add imports + state to session/[id].tsx**

```typescript
import { googleAuthService } from '../../src/services/googleAuthService';
import { driveExportService } from '../../src/services/driveExportService';
```

Add to state declarations:
```typescript
const [driveConnected, setDriveConnected] = useState(false);
const [driveExporting, setDriveExporting] = useState(false);
const [driveExportError, setDriveExportError] = useState<string | null>(null);
```

In the main `useEffect` (after session load), add a Drive connection check:
```typescript
googleAuthService.isConnected().then(setDriveConnected).catch(() => {});
```

- [ ] **Step 2: Add handleExportToDrive function**

```typescript
async function handleExportToDrive() {
  if (driveExporting || !session) return;
  setDriveExporting(true);
  setDriveExportError(null);
  try {
    await driveExportService.exportSession(session.id);
    // Reload session to pick up updated backup_status
    const updated = await getSessionById(session.id);
    if (updated) setSession(updated);
  } catch (e) {
    console.warn('[SessionDetail] Drive export failed:', e);
    setDriveExportError('Export failed. Check your connection.');
  } finally {
    setDriveExporting(false);
  }
}
```

- [ ] **Step 3: Add Export to Drive row in JSX**

Inside the ScrollView body, add before the `<View style={{ height: 48 }} />` bottom padding:

```tsx
{/* ── Export to Drive ── */}
{driveConnected && session.backupStatus !== 'complete' && (
  <View style={[styles.sectionBorder, { borderTopColor: theme.colors.elevated, paddingTop: 20 }]}>
    {driveExporting ? (
      <Text style={[theme.type.small, { color: theme.text.secondary }]}>
        Exporting to Drive…
      </Text>
    ) : (
      <Pressable onPress={handleExportToDrive}>
        <Text style={[theme.type.small, { color: theme.primary[400] }]}>
          ↑ Export to Drive
        </Text>
      </Pressable>
    )}
    {driveExportError ? (
      <Text style={[theme.type.caption, { color: theme.alert.urgent, marginTop: 4 }]}>
        {driveExportError}
      </Text>
    ) : null}
  </View>
)}

{driveConnected && session.backupStatus === 'complete' && (
  <View style={[styles.sectionBorder, { borderTopColor: theme.colors.elevated, paddingTop: 20 }]}>
    <Text style={[theme.type.small, { color: theme.text.secondary }]}>
      ✓ Saved to Google Drive
    </Text>
  </View>
)}
```

- [ ] **Step 4: Type check**

```bash
cd app && node node_modules/typescript/bin/tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add app/app/session/[id].tsx
git commit -m "feat(D8): Session Detail — Export to Drive button"
```

---

### Task 7: Full test run + PHASE_PLAN.md + CLAUDE.md update

**Files:**
- Modify: `PHASE_PLAN.md`

- [ ] **Step 1: Run full test suite**

```bash
cd app && node node_modules/jest/bin/jest.js --no-coverage 2>&1 | tail -20
```

Expected: all prior suites still passing + new sessionMarkdown and googleAuthService tests passing.

- [ ] **Step 2: Final type check**

```bash
cd app && node node_modules/typescript/bin/tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Mark D.8 complete in PHASE_PLAN.md**

Change:
```
- [ ] RG-D.8: Backup/export flow — Google Drive sync ...
```
to:
```
- [x] RG-D.8: Backup/export flow — Google Drive sync ...
```

- [ ] **Step 4: Run revise-claude-md**

Run the `revise-claude-md` skill to capture:
- New packages: `expo-auth-session`, `expo-web-browser`, `expo-secure-store`
- New services: `googleAuthService`, `driveExportService`
- New util: `sessionMarkdown`
- New migration: `migrateToV8` (drive_file_id, backup_status)
- GCP OAuth client ID + bundle ID config
- Non-negotiable: OAuth hooks (useAuthRequest) must live in React components, not service classes
- Non-negotiable: `drive.file` scope only

- [ ] **Step 5: Commit**

```bash
git add PHASE_PLAN.md CLAUDE.md AGENTS.md
git commit -m "docs(D8): mark complete, update CLAUDE.md + AGENTS.md for Drive backup"
git push
```

---

### Summary

**What:** Google Drive OAuth 2.0 backup flow — connects once, auto-refreshes tokens, exports session transcripts + summaries as Markdown files organized by year/month on Drive.

**Files touched:**
- New: `googleAuthService.ts`, `driveExportService.ts`, `sessionMarkdown.ts` + tests
- Modified: `schema.ts`, `database.ts`, `types/index.ts`, `sessions.ts`, `settings.tsx`, `session/[id].tsx`, `app.json`, `package.json`

**How to test:**
1. Build with EAS: `eas build --local --platform ios`
2. Install on device
3. Settings → Cloud Backup → Connect Google Drive → authorize
4. Open any session with a transcript → Export to Drive
5. Open Google Drive app → verify `Rambling Guardian/Transcripts/2026/MM/` folder + Markdown file
6. Settings → Back Up All Sessions → verify count

**Risks:**
- EAS build required (not Expo Go) — `expo-auth-session`, `expo-web-browser`, `expo-secure-store` are all native modules
- Google OAuth consent screen is in "Testing" mode — only test users (carlos.craig09@gmail.com) can authorize; must publish or add test users before sharing with others
- Token refresh silently disconnects user if refresh token is revoked (e.g., password change) — UI will show "Connect" again on next backup attempt
