# D.8 v1 — Google Drive Backup & Export — Design Spec

## Purpose

Give users a way to back up session data to Google Drive as Markdown files. Each session exports to a human-readable `.md` file: header metadata, transcript with speaker attribution, AI summary, and alert timeline.

This is the first cloud integration. App-mediated OAuth 2.0 with `drive.file` scope (least-privilege — app only sees files it creates). Refresh tokens persist via `expo-secure-store` so users don't re-authorize on every upload.

Builds on D.7 (session detail screen), D.6 (summaries), D.1–D.3 (transcript + speaker attribution).

---

## Scope

### In scope

- Google Drive OAuth 2.0 authorization flow (iOS only) using `expo-auth-session`
- Refresh token + access token persistence via `expo-secure-store`
- Auto-refresh of access token using stored refresh token (no re-auth needed unless refresh token is revoked)
- Per-session Markdown export: header metadata, transcript (speaker turns or flat text), AI summary, alert timeline
- Drive folder structure: `Rambling Guardian/Transcripts/YYYY/MM/`
- File naming: `YYYY-MM-DD_HH-MM_context.md` (e.g., `2026-04-13_09-30_with-others.md`)
- Idempotent folder creation (search before create — don't duplicate folders)
- `backup_status` + `drive_file_id` columns on sessions table (migrateToV8)
- Settings UI: Connect / Disconnect Google Drive, "Back Up All Sessions" button
- Session Detail screen: per-session "Export to Drive" button
- Graceful errors: show inline error text, don't crash

### Out of scope

- Audio file backup (no audio artifacts exist in D.8)
- Background upload while app is closed (foreground only in v1)
- Android OAuth (iOS only — bundle ID already registered in GCP)
- Auto-upload on session complete (manual trigger only in v1)
- Batch progress bar (success/failure count shown after completion)
- Re-upload / update an already-backed-up session

---

## New Packages

Three packages to install via `npx expo install`:

| Package | Purpose |
|---|---|
| `expo-auth-session` | Google OAuth 2.0 + PKCE code flow |
| `expo-web-browser` | In-app browser for OAuth flow + redirect handling |
| `expo-secure-store` | Encrypted storage for refresh + access tokens |

`expo-crypto` is already installed — used internally by `expo-auth-session` for PKCE.

---

## app.json Changes

Two additions required for Google OAuth on iOS:

**1. Add `expo-web-browser` plugin** (needed for redirect handling):
```json
"plugins": [
  "expo-web-browser",
  ...existing plugins...
]
```

**2. Register the Google OAuth reverse-client-ID URL scheme** so iOS handles the OAuth redirect:
```json
"ios": {
  "infoPlist": {
    "CFBundleURLTypes": [
      {
        "CFBundleURLSchemes": [
          "com.googleusercontent.apps.618204796187-dh47tmhn7p12lup9o7utqpm9l3f4vr99"
        ]
      }
    ]
  }
}
```

The client ID is: `618204796187-dh47tmhn7p12lup9o7utqpm9l3f4vr99.apps.googleusercontent.com`

---

## DB Migration — migrateToV8

Add two columns to the sessions table:

```sql
ALTER TABLE sessions ADD COLUMN drive_file_id TEXT;
ALTER TABLE sessions ADD COLUMN backup_status TEXT;
```

`backup_status` values: `NULL` (not backed up) | `'uploading'` | `'complete'` | `'failed'`

Pattern: same `try/catch` for duplicate column guard as all prior migrations.

**Required updates:**
- `app/src/db/schema.ts` — add `migrateToV8()`
- `app/src/db/database.ts` — call `migrateToV8(db)` after `migrateToV7`
- `app/src/types/index.ts` — add `driveFileId: string | null` and `backupStatus: BackupStatus` to `Session` interface
- `app/src/db/sessions.ts` — add `drive_file_id` and `backup_status` to `parseSession()`, add `updateBackupStatus()` function

```typescript
export type BackupStatus = 'uploading' | 'complete' | 'failed' | null;
```

---

## OAuth Flow

### Authorization (connect)

`expo-auth-session` hooks live in the Settings screen component (hooks are React-only).
`googleAuthService` handles all token I/O — the screen just calls it on success.

```
User taps "Connect Google Drive"
  → Google.useAuthRequest({ iosClientId, scopes: ['drive.file'] })
  → promptAsync() → opens in-app browser via expo-web-browser
  → User authenticates + grants consent on Google's page
  → Google redirects to reverse-client-ID URL scheme
  → expo-web-browser captures redirect, response.type = 'success'
  → response.params.code = auth code
  → request.codeVerifier = PKCE code verifier
  → googleAuthService.connect(code, codeVerifier, redirectUri)
  → POST https://oauth2.googleapis.com/token (exchange code for tokens)
  → Store access_token + expiry + refresh_token in expo-secure-store
  → isConnected = true
```

### Token exchange request body (no client_secret for iOS public clients)

```
POST https://oauth2.googleapis.com/token
Content-Type: application/x-www-form-urlencoded

code=AUTH_CODE
client_id=618204796187-dh47tmhn7p12lup9o7utqpm9l3f4vr99.apps.googleusercontent.com
redirect_uri=REDIRECT_URI
code_verifier=CODE_VERIFIER
grant_type=authorization_code
```

### Token refresh (auto, on demand)

```typescript
// getValidAccessToken() logic:
// 1. Load access_token + expiry from secure store
// 2. If expiry > now + 60s → return access_token (still valid)
// 3. Load refresh_token from secure store
// 4. POST https://oauth2.googleapis.com/token with grant_type=refresh_token
// 5. Store new access_token + expiry
// 6. Return new access_token
```

### Disconnection

```typescript
// disconnect(): delete all keys from expo-secure-store
// Keys: 'google_access_token', 'google_access_token_expiry', 'google_refresh_token'
```

---

## Services Architecture

### `app/src/services/googleAuthService.ts`

Single Responsibility: Token lifecycle (store, load, refresh, clear).

```typescript
export interface GoogleTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // unix ms
}

class GoogleAuthService {
  async connect(code: string, codeVerifier: string, redirectUri: string): Promise<void>
  async disconnect(): Promise<void>
  async getValidAccessToken(): Promise<string | null>  // refreshes if expired, null if no refresh token
  async isConnected(): Promise<boolean>                // true if refresh token exists in secure store
}

export const googleAuthService = new GoogleAuthService();
```

**Secure store keys:**
- `google_refresh_token`
- `google_access_token`
- `google_access_token_expiry` (string-encoded unix ms)

### `app/src/services/driveExportService.ts`

Single Responsibility: Find/create Drive folders, upload session Markdown, update session backup_status.

```typescript
class DriveExportService {
  async exportSession(sessionId: string): Promise<void>
  async exportAllSessions(): Promise<{ succeeded: number; failed: number }>
}

export const driveExportService = new DriveExportService();
```

**Internal steps for `exportSession`:**
1. Load session + alert events from DB
2. Call `googleAuthService.getValidAccessToken()` — throw if null
3. Format session as Markdown via `formatSessionAsMarkdown()`
4. Ensure folder path exists: `Rambling Guardian` → `Transcripts` → `YYYY` → `MM`
5. Upload file via Drive multipart upload
6. Update session row: `backup_status = 'complete'`, `drive_file_id = fileId`

**Drive API calls (raw fetch — no SDK needed):**

Search for folder:
```
GET https://www.googleapis.com/drive/v3/files
  ?q=name='NAME' and mimeType='application/vnd.google-apps.folder' and '{parentId}' in parents and trashed=false
  Authorization: Bearer ACCESS_TOKEN
```

Create folder:
```
POST https://www.googleapis.com/drive/v3/files
  Authorization: Bearer ACCESS_TOKEN
  Content-Type: application/json

  { "name": "NAME", "mimeType": "application/vnd.google-apps.folder", "parents": ["PARENT_ID"] }
```

Upload file (multipart, for small text files):
```
POST https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart
  Authorization: Bearer ACCESS_TOKEN
  Content-Type: multipart/related; boundary=BOUNDARY

  --BOUNDARY
  Content-Type: application/json
  { "name": "FILENAME", "parents": ["FOLDER_ID"] }
  --BOUNDARY
  Content-Type: text/markdown
  [markdown content]
  --BOUNDARY--
```

### `app/src/utils/sessionMarkdown.ts`

Pure function — no side effects, no DB calls, easily unit-testable.

```typescript
export function formatSessionAsMarkdown(
  session: Session,
  events: AlertEvent[],
): string
```

---

## Markdown Export Format

```markdown
# Session — April 13, 2026 · 9:30 AM

| Field | Value |
|---|---|
| Duration | 12 minutes 34 seconds |
| Context | With Others |
| Speakers | 2 |
| Alerts | 3 (max: Moderate) |

---

## Transcript

**Me** · 0:03
So I wanted to go over the Q3 numbers and talk through what we saw...

**Speaker 1** · 1:14
Yeah, that makes sense. What stood out to you?

---

## AI Summary

The session showed good conversational balance with moderate pacing issues in the first half. Three alerts fired between the one and three minute marks, suggesting a need for more deliberate pauses during complex explanations.

---

## Alert Timeline

| Time | Level | Duration |
|---|---|---|
| 0:45 | Gentle | 32s of speech |
| 1:58 | Moderate | 47s of speech |
| 3:22 | Urgent | 61s of speech |
```

**Fallbacks:**
- No transcript → omit Transcript section
- No summary → omit AI Summary section (or show "Not generated")
- No alerts → omit Alert Timeline section

**File name logic:**
- Format: `YYYY-MM-DD_HH-MM_context.md`
- Context: `solo`, `with-others`, `presentation`, or `session` (fallback)
- Example: `2026-04-13_09-30_with-others.md`

---

## UI Changes

### Settings screen — new "CLOUD BACKUP" section

Add below the existing "ABOUT" section:

```
─────────────────────────────────────
CLOUD BACKUP

When not connected:
  [ Connect Google Drive ]           ← primary button, indigo

When connected:
  Google Drive ✓ Connected
  [ Disconnect ]                     ← destructive text link
  [ Back Up All Sessions ]           ← secondary button
  "N sessions backed up  ·  Last: Apr 13"
  (or "No sessions backed up yet")
```

**Connect flow:**
- Tap "Connect Google Drive" → `promptAsync()` from `Google.useAuthRequest` hook
- On success → `googleAuthService.connect(...)` → re-check `isConnected`

**Back Up All:**
- Tap → show loading spinner on button → `driveExportService.exportAllSessions()`
- Show result: "Backed up N sessions" or "N succeeded, M failed"

### Session Detail screen — per-session export

Add a small "Export to Drive" row in the scrollable body, between Alert Timeline and bottom padding.
Only rendered when `googleAuthService.isConnected()` is true and `session.backupStatus !== 'complete'`.

```
[ ↑ Export to Drive ]                ← secondary text button

(after success:)
✓ Saved to Google Drive
```

---

## File Structure

### New files

| File | Purpose |
|---|---|
| `app/src/services/googleAuthService.ts` | Token lifecycle |
| `app/src/services/driveExportService.ts` | Drive folder/file ops |
| `app/src/utils/sessionMarkdown.ts` | Pure Markdown formatter |
| `app/src/services/__tests__/googleAuthService.test.ts` | Unit tests |
| `app/src/utils/__tests__/sessionMarkdown.test.ts` | Unit tests |

### Modified files

| File | Change |
|---|---|
| `app/package.json` | +3 new packages |
| `app/app.json` | `expo-web-browser` plugin + Google URL scheme |
| `app/src/db/schema.ts` | `migrateToV8()` |
| `app/src/db/database.ts` | Call `migrateToV8` |
| `app/src/types/index.ts` | `BackupStatus` type, `driveFileId` + `backupStatus` on `Session` |
| `app/src/db/sessions.ts` | `parseSession` additions, `updateBackupStatus()` |
| `app/app/(tabs)/settings.tsx` | Google Drive section + `Google.useAuthRequest` hook |
| `app/app/session/[id].tsx` | "Export to Drive" row |

---

## Data Flow

```
Settings → Connect Google Drive
  └─ Google.useAuthRequest (hook in settings.tsx)
       └─ promptAsync() → OAuth browser
            └─ response.type = 'success'
                 └─ googleAuthService.connect(code, verifier, redirectUri)
                      └─ POST /token → store tokens in expo-secure-store

Settings → Back Up All Sessions
  └─ driveExportService.exportAllSessions()
       └─ getSessionById(id) × N
            └─ googleAuthService.getValidAccessToken()
                 └─ Drive API: find/create folders, upload file
                      └─ updateBackupStatus(id, 'complete', driveFileId)

Session Detail → Export to Drive
  └─ driveExportService.exportSession(session.id)
       └─ (same as above, for one session)
```

---

## Non-Negotiables

- OAuth hooks (`Google.useAuthRequest`) MUST live in React components — not in plain service classes
- `drive.file` scope only — never request broader Drive access
- Token exchange must use PKCE — never pass a client_secret (iOS public clients have none)
- `getValidAccessToken()` must auto-refresh transparently — callers never deal with expiry
- Folder creation must be idempotent — search before create, never duplicate
- `backup_status = 'uploading'` set BEFORE Drive call, `'complete'`/`'failed'` set AFTER
- All Drive API errors caught and surfaced as `'failed'` status — never crash the screen
- Session export is append-only — `drive_file_id` check prevents double-upload

---

## Open Questions (v1 decisions)

- **Re-export after editing transcript/summary?** Deferred — append-only in v1. Re-export as a separate action in a future ticket.
- **Shared Drive support?** Not needed — personal Google account only.
- **File naming collision?** If two sessions start at the same minute, `driveExportService` appends the session ID suffix: `2026-04-13_09-30_with-others_abc123.md`. Simple enough.
