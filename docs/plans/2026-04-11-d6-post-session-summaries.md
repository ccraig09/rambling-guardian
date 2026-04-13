# D.6 v1 Post-Session Summaries Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate one AI summary per session on demand using Claude Haiku, with context-aware prompts, persisted to SQLite, displayed in the expanded session card in history.

**Architecture:** Provider adapter (`anthropicClient.ts`) abstracts SDK vs raw fetch. `summaryService.ts` orchestrates prompt assembly, API call, and persistence. `summaryPrompts.ts` holds three context-aware system prompts. UI lives in the existing expanded history card — no new screens.

**Tech Stack:** TypeScript, Claude Haiku 4.5 via Anthropic Messages API, expo-sqlite, React Native, Zustand

---

### Task 1: Anthropic API key config + dependency

**Files:**
- Create: `app/src/config/anthropic.ts`
- Modify: `app/.env.example` (if exists — otherwise document in plan notes)
- Modify: `app/package.json` (via npm install)

- [ ] **Step 1: Install @anthropic-ai/sdk**

Run: `cd app && npm install @anthropic-ai/sdk`
Expected: `@anthropic-ai/sdk` appears in package.json dependencies. No peer dep warnings that block install.

If the SDK install fails or warns about React Native incompatibility, the provider adapter (Task 2) falls back to raw fetch automatically. Either way is fine at this stage.

- [ ] **Step 2: Create config file**

Create `app/src/config/anthropic.ts`:

```typescript
/**
 * Anthropic API configuration.
 *
 * API key is client-side for prototyping — same pattern as Deepgram.
 * Flag for backend migration before production.
 */
export const ANTHROPIC_API_KEY = process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY ?? '';

/** Model used for session summaries. Upgrade to Sonnet by changing this constant. */
export const SUMMARY_MODEL = 'claude-haiku-4-5-20251001';

/** Max input tokens before truncation kicks in (Section 3 of spec). */
export const MAX_INPUT_TOKENS = 8000;
```

- [ ] **Step 3: Type check**

Run: `cd app && node node_modules/typescript/bin/tsc --noEmit`
Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
git add app/src/config/anthropic.ts app/package.json app/package-lock.json
git commit -m "feat(D6): anthropic config + @anthropic-ai/sdk dependency"
```

---

### Task 2: Provider adapter (anthropicClient.ts)

**Files:**
- Create: `app/src/services/anthropicClient.ts`
- Create: `app/src/services/__tests__/anthropicClient.test.ts`

- [ ] **Step 1: Write failing tests**

Create `app/src/services/__tests__/anthropicClient.test.ts`:

```typescript
// Mock the SDK and fetch so we can verify the adapter's behavior
jest.mock('@anthropic-ai/sdk', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      messages: {
        create: jest.fn().mockResolvedValue({
          content: [{ type: 'text', text: 'SDK response text' }],
        }),
      },
    })),
  };
});

import { createMessage } from '../anthropicClient';

describe('anthropicClient', () => {
  const ORIGINAL_ENV = process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY;

  beforeEach(() => {
    process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY = 'test-key';
  });

  afterAll(() => {
    process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY = ORIGINAL_ENV;
  });

  test('returns text content from Anthropic API', async () => {
    const result = await createMessage('You are a helper.', 'Hello');
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  test('throws when API key is missing', async () => {
    process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY = '';
    await expect(createMessage('sys', 'msg')).rejects.toThrow(/API key/i);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd app && npx jest anthropicClient`
Expected: FAIL — module not found

- [ ] **Step 3: Implement the provider adapter**

Create `app/src/services/anthropicClient.ts`:

```typescript
/**
 * Anthropic provider adapter — D.6 v1.
 *
 * Abstracts whether we use the @anthropic-ai/sdk or raw fetch to the
 * Messages API. summaryService never touches this decision — it just
 * calls createMessage().
 *
 * SDK is tried first. If the SDK import throws (React Native compat
 * issues), we fall back to raw fetch.
 */
import { ANTHROPIC_API_KEY, SUMMARY_MODEL } from '../config/anthropic';

const MESSAGES_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
const MAX_OUTPUT_TOKENS = 512;

interface MessagesResponse {
  content: Array<{ type: string; text?: string }>;
}

async function createMessageViaFetch(
  systemPrompt: string,
  userMessage: string,
): Promise<string> {
  const res = await fetch(MESSAGES_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': ANTHROPIC_VERSION,
    },
    body: JSON.stringify({
      model: SUMMARY_MODEL,
      max_tokens: MAX_OUTPUT_TOKENS,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Anthropic API ${res.status}: ${body.slice(0, 200)}`);
  }

  const data = (await res.json()) as MessagesResponse;
  const textBlock = data.content.find((b) => b.type === 'text');
  if (!textBlock?.text) throw new Error('Anthropic API returned no text');
  return textBlock.text;
}

async function createMessageViaSdk(
  systemPrompt: string,
  userMessage: string,
): Promise<string> {
  // Dynamic import — if SDK fails to load in RN, we fall back to fetch.
  const mod = await import('@anthropic-ai/sdk');
  const AnthropicCtor = (mod as any).default ?? mod;
  const client = new AnthropicCtor({ apiKey: ANTHROPIC_API_KEY });
  const response = await client.messages.create({
    model: SUMMARY_MODEL,
    max_tokens: MAX_OUTPUT_TOKENS,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }],
  });
  const textBlock = response.content.find((b: any) => b.type === 'text');
  if (!textBlock?.text) throw new Error('Anthropic SDK returned no text');
  return textBlock.text;
}

/**
 * Send a system + user message to Claude and return the text response.
 *
 * Tries SDK first, falls back to raw fetch on SDK load failure.
 */
export async function createMessage(
  systemPrompt: string,
  userMessage: string,
): Promise<string> {
  if (!ANTHROPIC_API_KEY) {
    throw new Error('Anthropic API key not configured');
  }

  try {
    return await createMessageViaSdk(systemPrompt, userMessage);
  } catch (e: unknown) {
    // If SDK fails for reasons other than RN incompat (e.g. network),
    // we still try fetch. Fetch will surface the real error.
    const msg = e instanceof Error ? e.message : String(e);
    console.warn('[Anthropic] SDK path failed, falling back to fetch:', msg);
    return createMessageViaFetch(systemPrompt, userMessage);
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd app && npx jest anthropicClient`
Expected: 2 tests PASS

- [ ] **Step 5: Type check**

Run: `cd app && node node_modules/typescript/bin/tsc --noEmit`
Expected: 0 errors

- [ ] **Step 6: Commit**

```bash
git add app/src/services/anthropicClient.ts app/src/services/__tests__/anthropicClient.test.ts
git commit -m "feat(D6): anthropicClient provider adapter (SDK + fetch fallback)"
```

---

### Task 3: Prompt templates (summaryPrompts.ts) + tests

**Files:**
- Create: `app/src/services/summaryPrompts.ts`
- Create: `app/src/services/__tests__/summaryPrompts.test.ts`

- [ ] **Step 1: Write failing tests**

Create `app/src/services/__tests__/summaryPrompts.test.ts`:

```typescript
import {
  getSummarySystemPrompt,
  buildSummaryUserMessage,
  truncateTranscript,
} from '../summaryPrompts';
import type { AlertEvent } from '../../types';
import { AlertLevel } from '../../types';

describe('getSummarySystemPrompt', () => {
  test('solo prompt mentions self-coaching', () => {
    const prompt = getSummarySystemPrompt('solo');
    expect(prompt.toLowerCase()).toMatch(/solo|self|you/);
  });

  test('with_others prompt mentions conversation', () => {
    const prompt = getSummarySystemPrompt('with_others');
    expect(prompt.toLowerCase()).toMatch(/conversation|others|speaker/);
  });

  test('presentation prompt mentions presentation', () => {
    const prompt = getSummarySystemPrompt('presentation');
    expect(prompt.toLowerCase()).toMatch(/present|audience|talk/);
  });

  test('null context falls back to solo', () => {
    const nullPrompt = getSummarySystemPrompt(null);
    const soloPrompt = getSummarySystemPrompt('solo');
    expect(nullPrompt).toBe(soloPrompt);
  });

  test('all prompts request 3-5 sentences', () => {
    for (const ctx of ['solo', 'with_others', 'presentation'] as const) {
      expect(getSummarySystemPrompt(ctx)).toMatch(/3-5 sentences|3 to 5 sentences/i);
    }
  });

  test('all prompts request plain text', () => {
    for (const ctx of ['solo', 'with_others', 'presentation'] as const) {
      expect(getSummarySystemPrompt(ctx).toLowerCase()).toMatch(/plain text|no markdown/);
    }
  });
});

describe('buildSummaryUserMessage', () => {
  const baseInput = {
    sessionContext: 'with_others' as const,
    durationMs: 12 * 60 * 1000 + 34 * 1000,
    alertCount: 4,
    maxAlertLevel: AlertLevel.MODERATE,
    speakerCount: 3,
    transcriptText: 'Hello, this is the transcript.',
    alertEvents: [
      { id: 1, sessionId: 's1', timestamp: 135000, alertLevel: AlertLevel.GENTLE, durationAtAlert: 7000 } as AlertEvent,
      { id: 2, sessionId: 's1', timestamp: 242000, alertLevel: AlertLevel.MODERATE, durationAtAlert: 15000 } as AlertEvent,
    ],
  };

  test('includes session context', () => {
    const msg = buildSummaryUserMessage(baseInput);
    expect(msg).toMatch(/with_others/);
  });

  test('includes duration in minutes and seconds', () => {
    const msg = buildSummaryUserMessage(baseInput);
    expect(msg).toMatch(/12 minutes/);
    expect(msg).toMatch(/34 seconds/);
  });

  test('includes alert count and max level', () => {
    const msg = buildSummaryUserMessage(baseInput);
    expect(msg).toMatch(/4 alerts/);
    expect(msg).toMatch(/moderate/i);
  });

  test('includes speaker count', () => {
    const msg = buildSummaryUserMessage(baseInput);
    expect(msg).toMatch(/3 speakers|Speakers: 3/i);
  });

  test('includes formatted alert timeline', () => {
    const msg = buildSummaryUserMessage(baseInput);
    expect(msg).toMatch(/2:15/); // 135000ms = 2:15
    expect(msg).toMatch(/Gentle/i);
  });

  test('includes transcript text', () => {
    const msg = buildSummaryUserMessage(baseInput);
    expect(msg).toMatch(/Hello, this is the transcript/);
  });

  test('handles null session context as unknown', () => {
    const msg = buildSummaryUserMessage({ ...baseInput, sessionContext: null });
    expect(msg.toLowerCase()).toMatch(/unknown|unclassified/);
  });

  test('handles empty alert events', () => {
    const msg = buildSummaryUserMessage({ ...baseInput, alertEvents: [], alertCount: 0 });
    expect(msg).toMatch(/no alerts|0 alerts/i);
  });
});

describe('truncateTranscript', () => {
  test('returns transcript unchanged when under limit', () => {
    const short = 'This is a short transcript.';
    expect(truncateTranscript(short, 100)).toBe(short);
  });

  test('keeps only the last N characters when over limit', () => {
    const long = 'a'.repeat(1000) + 'b'.repeat(500);
    const result = truncateTranscript(long, 500);
    expect(result.length).toBeLessThanOrEqual(500 + 50); // allow for prefix marker
    expect(result.endsWith('b'.repeat(500))).toBe(true);
  });

  test('prepends a truncation marker when truncated', () => {
    const long = 'x'.repeat(1000);
    const result = truncateTranscript(long, 500);
    expect(result).toMatch(/\[truncated/i);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd app && npx jest summaryPrompts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement the prompts**

Create `app/src/services/summaryPrompts.ts`:

```typescript
/**
 * Summary prompt templates — D.6 v1.
 *
 * Three context-aware system prompts + one user message assembler.
 * All pure functions. No side effects, no store access.
 */
import type { SessionContext, AlertEvent } from '../types';
import { AlertLevel } from '../types';

// ============================================
// System prompts
// ============================================

const SOLO_PROMPT = `You are a supportive speech coach reviewing a solo speaking session.
The user was speaking alone (rehearsing, journaling, or self-coaching).
Give a 3-5 sentence recap focused on their pacing, rambling patterns, and what to work on.
Reference specific moments from the transcript when relevant.
If no alerts fired, acknowledge it as a clean session.
Output plain text. No markdown formatting. No bullet lists.`;

const WITH_OTHERS_PROMPT = `You are a meeting debrief coach reviewing a multi-speaker conversation.
The user was in a conversation with other speakers.
Give a 3-5 sentence recap focused on the user's talk-time share, conversational balance, and key topics.
Note whether the user dominated or balanced well, and reference specific moments when relevant.
Output plain text. No markdown formatting. No bullet lists.`;

const PRESENTATION_PROMPT = `You are a presentation coach reviewing a talk.
The user was presenting to an audience (one dominant speaker with listeners).
Give a 3-5 sentence recap focused on the user's pacing, whether alerts suggest they needed to pause more,
and any audience engagement signals (questions from others).
Output plain text. No markdown formatting. No bullet lists.`;

/**
 * Return the system prompt for a given session context.
 *
 * Null context falls back to the Solo template — it's the safe default
 * when classification never reached the floor.
 */
export function getSummarySystemPrompt(context: SessionContext | null): string {
  switch (context) {
    case 'with_others':
      return WITH_OTHERS_PROMPT;
    case 'presentation':
      return PRESENTATION_PROMPT;
    case 'solo':
    case null:
    default:
      return SOLO_PROMPT;
  }
}

// ============================================
// User message assembly
// ============================================

const ALERT_LEVEL_NAMES: Record<number, string> = {
  [AlertLevel.NONE]: 'none',
  [AlertLevel.GENTLE]: 'gentle',
  [AlertLevel.MODERATE]: 'moderate',
  [AlertLevel.URGENT]: 'urgent',
  [AlertLevel.CRITICAL]: 'critical',
};

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes} minutes ${seconds} seconds`;
}

function formatOffset(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export interface SummaryInput {
  sessionContext: SessionContext | null;
  durationMs: number;
  alertCount: number;
  maxAlertLevel: AlertLevel;
  speakerCount: number;
  transcriptText: string;
  alertEvents: AlertEvent[];
}

/**
 * Build the structured user message sent alongside the system prompt.
 *
 * Format: labeled plain-text sections. No JSON.
 */
export function buildSummaryUserMessage(input: SummaryInput): string {
  const contextLabel = input.sessionContext ?? 'unknown';
  const maxAlertName = ALERT_LEVEL_NAMES[input.maxAlertLevel] ?? 'none';

  const lines: string[] = [
    `Session context: ${contextLabel}`,
    `Duration: ${formatDuration(input.durationMs)}`,
    `Speakers: ${input.speakerCount}`,
    `Alerts: ${input.alertCount} (max level: ${maxAlertName})`,
    '',
  ];

  if (input.alertEvents.length > 0) {
    lines.push('Alert timeline:');
    for (const e of input.alertEvents) {
      const levelName = ALERT_LEVEL_NAMES[e.alertLevel] ?? 'unknown';
      const durationSecs = Math.round(e.durationAtAlert / 1000);
      lines.push(
        `- ${formatOffset(e.timestamp)} — ${levelName} alert (${durationSecs}s of continuous speech)`,
      );
    }
  } else {
    lines.push('Alert timeline: no alerts fired.');
  }

  lines.push('', 'Transcript:', input.transcriptText);
  return lines.join('\n');
}

// ============================================
// Truncation (deterministic fallback)
// ============================================

/**
 * Truncate the transcript if it exceeds the given character budget.
 *
 * Deterministic strategy: keep only the most recent N characters of the
 * transcript. The metadata + alerts are always preserved in full
 * (they're assembled separately in buildSummaryUserMessage).
 *
 * A truncation marker is prepended so the model knows context is missing.
 */
export function truncateTranscript(transcript: string, maxChars: number): string {
  if (transcript.length <= maxChars) return transcript;
  const tail = transcript.slice(transcript.length - maxChars);
  return `[truncated — showing last ${maxChars} characters]\n${tail}`;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd app && npx jest summaryPrompts`
Expected: All tests PASS

- [ ] **Step 5: Type check**

Run: `cd app && node node_modules/typescript/bin/tsc --noEmit`
Expected: 0 errors

- [ ] **Step 6: Commit**

```bash
git add app/src/services/summaryPrompts.ts app/src/services/__tests__/summaryPrompts.test.ts
git commit -m "feat(D6): summaryPrompts with 3 context-aware templates + truncation"
```

---

### Task 4: Schema migration + DB functions

**Files:**
- Modify: `app/src/db/schema.ts`
- Modify: `app/src/db/database.ts`
- Modify: `app/src/db/sessions.ts`
- Modify: `app/src/types/index.ts`

- [ ] **Step 1: Add migrateToV7**

In `app/src/db/schema.ts`, add after `migrateToV6`:

```typescript
export async function migrateToV7(db: SQLiteDatabase): Promise<void> {
  const migrations = [
    `ALTER TABLE sessions ADD COLUMN summary TEXT`,
    `ALTER TABLE sessions ADD COLUMN summary_status TEXT`,
    `ALTER TABLE sessions ADD COLUMN summary_generated_at INTEGER`,
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

- [ ] **Step 2: Wire migrateToV7 into database.ts**

Update `app/src/db/database.ts` imports:

```typescript
import { initDatabase, migrateToV2, migrateToV3, migrateToV4, migrateToV5, migrateToV6, migrateToV7 } from './schema';
```

Add after `await migrateToV6(db);`:

```typescript
    await migrateToV7(db);
```

- [ ] **Step 3: Add SummaryStatus type and extend Session interface**

In `app/src/types/index.ts`, add near the SessionContext types:

```typescript
/** Summary generation status. Null = never attempted. */
export type SummaryStatus = 'generating' | 'complete' | 'failed' | null;
```

Add to the `Session` interface:

```typescript
  summary: string | null;
  summaryStatus: SummaryStatus;
  summaryGeneratedAt: number | null;
```

- [ ] **Step 4: Add updateSummary + updateSummaryStatus to sessions.ts**

In `app/src/db/sessions.ts`, add:

```typescript
/** Update summary text and mark as complete. */
export async function updateSummary(
  sessionId: string,
  summary: string,
  generatedAt: number,
): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    'UPDATE sessions SET summary = ?, summary_status = ?, summary_generated_at = ? WHERE id = ?',
    [summary, 'complete', generatedAt, sessionId],
  );
}

/** Update summary status without touching the summary text. */
export async function updateSummaryStatus(
  sessionId: string,
  status: 'generating' | 'failed',
): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    'UPDATE sessions SET summary_status = ? WHERE id = ?',
    [status, sessionId],
  );
}
```

Update `parseSession` to include the new columns. Add these fields to the returned object:

```typescript
summary: r.summary as string | null,
summaryStatus: r.summary_status as SummaryStatus,
summaryGeneratedAt: r.summary_generated_at as number | null,
```

Ensure `SummaryStatus` is added to the import from `../types`.

- [ ] **Step 5: Type check**

Run: `cd app && node node_modules/typescript/bin/tsc --noEmit`
Expected: 0 errors

- [ ] **Step 6: Commit**

```bash
git add app/src/db/schema.ts app/src/db/database.ts app/src/db/sessions.ts app/src/types/index.ts
git commit -m "feat(D6): migrateToV7 + updateSummary + Session interface update"
```

---

### Task 5: Summary orchestration service

**Files:**
- Create: `app/src/services/summaryService.ts`
- Create: `app/src/services/__tests__/summaryService.test.ts`

- [ ] **Step 1: Write failing tests**

Create `app/src/services/__tests__/summaryService.test.ts`:

```typescript
jest.mock('../../db/settings', () => ({
  loadAllSettings: jest.fn().mockResolvedValue(new Map()),
  saveSetting: jest.fn().mockResolvedValue(undefined),
  saveSettings: jest.fn().mockResolvedValue(undefined),
}));

const mockCreateMessage = jest.fn();
jest.mock('../anthropicClient', () => ({
  createMessage: (...args: unknown[]) => mockCreateMessage(...args),
}));

const mockUpdateSummary = jest.fn().mockResolvedValue(undefined);
const mockUpdateSummaryStatus = jest.fn().mockResolvedValue(undefined);
const mockGetAlertEvents = jest.fn().mockResolvedValue([]);
const mockGetSessionById = jest.fn();

jest.mock('../../db/sessions', () => ({
  updateSummary: (...args: unknown[]) => mockUpdateSummary(...args),
  updateSummaryStatus: (...args: unknown[]) => mockUpdateSummaryStatus(...args),
  getAlertEvents: (...args: unknown[]) => mockGetAlertEvents(...args),
  getSessionById: (...args: unknown[]) => mockGetSessionById(...args),
}));

import { generateSummary, SHORT_SESSION_MIN_MS } from '../summaryService';
import { AlertLevel } from '../../types';

const baseSession = {
  id: 's1',
  startedAt: 0,
  endedAt: 0,
  durationMs: 5 * 60 * 1000,
  mode: 'solo' as const,
  alertCount: 0,
  maxAlert: AlertLevel.NONE,
  speechSegments: 10,
  sensitivity: 1,
  syncedFromDevice: false,
  transcript: 'Hello world, this is a transcript.',
  transcriptTimestamps: null,
  retentionTier: null,
  audioRetention: null,
  bootId: null,
  deviceSequence: null,
  speakerMap: null,
  sessionContext: 'solo' as const,
  sessionContextSource: 'auto' as const,
  summary: null,
  summaryStatus: null,
  summaryGeneratedAt: null,
};

describe('generateSummary', () => {
  beforeEach(() => {
    mockCreateMessage.mockReset().mockResolvedValue('Generated summary text.');
    mockUpdateSummary.mockClear();
    mockUpdateSummaryStatus.mockClear();
    mockGetAlertEvents.mockReset().mockResolvedValue([]);
    mockGetSessionById.mockReset().mockResolvedValue(baseSession);
  });

  test('successful generation updates summary with complete status', async () => {
    await generateSummary('s1');
    expect(mockUpdateSummaryStatus).toHaveBeenCalledWith('s1', 'generating');
    expect(mockCreateMessage).toHaveBeenCalledTimes(1);
    expect(mockUpdateSummary).toHaveBeenCalledWith(
      's1',
      'Generated summary text.',
      expect.any(Number),
    );
  });

  test('failed API call marks status as failed and does not update summary', async () => {
    mockCreateMessage.mockRejectedValueOnce(new Error('API error'));
    await expect(generateSummary('s1')).rejects.toThrow('API error');
    expect(mockUpdateSummaryStatus).toHaveBeenCalledWith('s1', 'generating');
    expect(mockUpdateSummaryStatus).toHaveBeenCalledWith('s1', 'failed');
    expect(mockUpdateSummary).not.toHaveBeenCalled();
  });

  test('refuses to generate when already generating (in-flight protection)', async () => {
    mockGetSessionById.mockResolvedValueOnce({
      ...baseSession,
      summaryStatus: 'generating',
    });
    await expect(generateSummary('s1')).rejects.toThrow(/already|in progress/i);
    expect(mockCreateMessage).not.toHaveBeenCalled();
  });

  test('refuses to generate when summary already complete', async () => {
    mockGetSessionById.mockResolvedValueOnce({
      ...baseSession,
      summary: 'Existing summary.',
      summaryStatus: 'complete',
    });
    await expect(generateSummary('s1')).rejects.toThrow(/already|exists/i);
    expect(mockCreateMessage).not.toHaveBeenCalled();
  });

  test('refuses to generate when session has no transcript', async () => {
    mockGetSessionById.mockResolvedValueOnce({
      ...baseSession,
      transcript: null,
    });
    await expect(generateSummary('s1')).rejects.toThrow(/transcript/i);
    expect(mockCreateMessage).not.toHaveBeenCalled();
  });

  test('refuses to generate when session is too short', async () => {
    mockGetSessionById.mockResolvedValueOnce({
      ...baseSession,
      durationMs: SHORT_SESSION_MIN_MS - 1,
    });
    await expect(generateSummary('s1')).rejects.toThrow(/short/i);
    expect(mockCreateMessage).not.toHaveBeenCalled();
  });

  test('retry after failure succeeds and updates to complete', async () => {
    mockGetSessionById.mockResolvedValueOnce({
      ...baseSession,
      summaryStatus: 'failed',
    });
    await generateSummary('s1');
    expect(mockUpdateSummary).toHaveBeenCalledWith(
      's1',
      'Generated summary text.',
      expect.any(Number),
    );
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd app && npx jest summaryService`
Expected: FAIL — module not found

- [ ] **Step 3: Implement the service**

Create `app/src/services/summaryService.ts`:

```typescript
/**
 * Summary Service — D.6 v1.
 *
 * Orchestrates summary generation:
 *   1. Load session + alert events from DB
 *   2. Guard against duplicate/invalid generation
 *   3. Mark as generating (in-flight protection)
 *   4. Assemble prompt + user message
 *   5. Call Anthropic via the provider adapter
 *   6. Persist result (complete) or mark failed
 */
import { createMessage } from './anthropicClient';
import { MAX_INPUT_TOKENS } from '../config/anthropic';
import {
  getSessionById,
  getAlertEvents,
  updateSummary,
  updateSummaryStatus,
} from '../db/sessions';
import {
  getSummarySystemPrompt,
  buildSummaryUserMessage,
  truncateTranscript,
} from './summaryPrompts';

/** Minimum session duration required to generate a summary. */
export const SHORT_SESSION_MIN_MS = 30_000;

/** Rough char-to-token ratio for truncation (1 token ≈ 4 chars). */
const CHARS_PER_TOKEN = 4;

/**
 * Check whether a summary can be generated for this session.
 * Returns null if eligible, or a string reason if not.
 */
export function summaryEligibilityReason(session: {
  durationMs: number;
  transcript: string | null;
  summary: string | null;
  summaryStatus: string | null;
}): string | null {
  if (session.summaryStatus === 'generating') {
    return 'Summary generation is already in progress.';
  }
  if (session.summary && session.summaryStatus === 'complete') {
    return 'Summary already exists for this session.';
  }
  if (!session.transcript || session.transcript.length === 0) {
    return 'No transcript available for this session.';
  }
  if (session.durationMs < SHORT_SESSION_MIN_MS) {
    return 'Session is too short for a summary.';
  }
  return null;
}

/**
 * Generate a summary for the given session.
 *
 * Throws if the session is ineligible (duplicate, missing transcript,
 * too short) or if the API call fails. On API failure, marks
 * summary_status = 'failed' before throwing.
 */
export async function generateSummary(sessionId: string): Promise<void> {
  const session = await getSessionById(sessionId);
  if (!session) throw new Error(`Session not found: ${sessionId}`);

  const ineligible = summaryEligibilityReason(session);
  if (ineligible) throw new Error(ineligible);

  // Mark as generating — in-flight protection across taps
  await updateSummaryStatus(sessionId, 'generating');

  try {
    const alertEvents = await getAlertEvents(sessionId);

    // Count distinct speakers from speaker_map if available, else 1 default
    let speakerCount = 1;
    if (session.speakerMap) {
      try {
        const map = JSON.parse(session.speakerMap) as Record<string, unknown>;
        speakerCount = Math.max(1, Object.keys(map).length);
      } catch {
        speakerCount = 1;
      }
    }

    // Deterministic truncation: preserve metadata + alerts, truncate
    // transcript tail only if the assembled char count would exceed budget
    const maxTranscriptChars = MAX_INPUT_TOKENS * CHARS_PER_TOKEN;
    const transcriptText = truncateTranscript(
      session.transcript ?? '',
      maxTranscriptChars,
    );

    const userMessage = buildSummaryUserMessage({
      sessionContext: session.sessionContext,
      durationMs: session.durationMs,
      alertCount: session.alertCount,
      maxAlertLevel: session.maxAlert,
      speakerCount,
      transcriptText,
      alertEvents,
    });

    const systemPrompt = getSummarySystemPrompt(session.sessionContext);
    const summaryText = await createMessage(systemPrompt, userMessage);

    await updateSummary(sessionId, summaryText, Date.now());
  } catch (e) {
    await updateSummaryStatus(sessionId, 'failed').catch(() => {
      /* best effort — original error is the real failure */
    });
    throw e;
  }
}
```

- [ ] **Step 4: Add getSessionById to sessions.ts (if not already present)**

Check `app/src/db/sessions.ts` — if `getSessionById` doesn't exist, add:

```typescript
/** Fetch a single session by id. Returns null if not found. */
export async function getSessionById(sessionId: string): Promise<Session | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<any>(
    'SELECT * FROM sessions WHERE id = ?',
    [sessionId],
  );
  return row ? parseSession(row) : null;
}
```

If it exists already, skip this step.

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd app && npx jest summaryService`
Expected: All tests PASS

- [ ] **Step 6: Type check**

Run: `cd app && node node_modules/typescript/bin/tsc --noEmit`
Expected: 0 errors

- [ ] **Step 7: Commit**

```bash
git add app/src/services/summaryService.ts app/src/services/__tests__/summaryService.test.ts app/src/db/sessions.ts
git commit -m "feat(D6): summaryService with in-flight protection + deterministic truncation"
```

---

### Task 6: History UI — summary section in expanded card

**Files:**
- Modify: `app/app/(tabs)/history.tsx`

- [ ] **Step 1: Add imports**

In `app/app/(tabs)/history.tsx`, add to the imports at the top:

```typescript
import { generateSummary, summaryEligibilityReason } from '../../src/services/summaryService';
import { ANTHROPIC_API_KEY } from '../../src/config/anthropic';
```

- [ ] **Step 2: Add summary state and handler to SessionCard**

Find the `SessionCard` function. After the existing `events`/`eventsLoaded` state, add:

```typescript
  const [localStatus, setLocalStatus] = useState<
    'generating' | 'complete' | 'failed' | null
  >(session.summaryStatus);
  const [localSummary, setLocalSummary] = useState<string | null>(session.summary);
  const [generating, setGenerating] = useState(false);

  async function handleGenerateSummary() {
    if (generating) return; // In-flight protection (local tap guard)
    setGenerating(true);
    setLocalStatus('generating');
    try {
      await generateSummary(session.id);
      // Re-read from DB would be ideal, but simpler: the service wrote
      // to DB, we update local state optimistically. On next history
      // reload, the freshly-loaded session will carry the same value.
      const updated = await import('../../src/db/sessions').then((m) =>
        m.getSessionById(session.id),
      );
      if (updated) {
        setLocalSummary(updated.summary);
        setLocalStatus(updated.summaryStatus);
      }
    } catch (e) {
      console.warn('[History] Summary generation failed:', e);
      setLocalStatus('failed');
    } finally {
      setGenerating(false);
    }
  }
```

- [ ] **Step 3: Render the summary section inside the expanded card**

Find the `{expanded && (` block that renders the Alert Timeline. After the timeline section, inside the same block, add:

```tsx
          {/* ── Expanded: AI Summary ── */}
          {ANTHROPIC_API_KEY && summaryEligibilityReason({
            durationMs: session.durationMs,
            transcript: session.transcript ?? null,
            summary: localSummary,
            summaryStatus: localStatus,
          }) === null && (
            <View style={{ marginTop: theme.spacing.md }}>
              <Pressable
                onPress={handleGenerateSummary}
                disabled={generating || localStatus === 'generating'}
                style={[
                  styles.summaryButton,
                  {
                    backgroundColor: theme.primary[500],
                    borderRadius: theme.radius.full,
                    opacity: generating || localStatus === 'generating' ? 0.6 : 1,
                  },
                ]}
              >
                <Text style={[theme.type.small, { color: '#fff', fontFamily: theme.fontFamily.semibold }]}>
                  {localStatus === 'generating' || generating
                    ? 'Generating summary…'
                    : 'Generate Summary'}
                </Text>
              </Pressable>
            </View>
          )}

          {localStatus === 'complete' && localSummary && (
            <View style={{ marginTop: theme.spacing.md }}>
              <Text style={[theme.type.small, { color: theme.text.tertiary, marginBottom: theme.spacing.xs, fontFamily: theme.fontFamily.semibold }]}>
                AI Summary
              </Text>
              <Text style={[theme.type.small, { color: theme.text.secondary, lineHeight: 20 }]}>
                {localSummary}
              </Text>
            </View>
          )}

          {localStatus === 'failed' && (
            <View style={{ marginTop: theme.spacing.md }}>
              <Pressable onPress={handleGenerateSummary} disabled={generating}>
                <Text style={[theme.type.small, { color: theme.alert.urgent }]}>
                  Summary failed. Tap to retry.
                </Text>
              </Pressable>
            </View>
          )}
```

- [ ] **Step 4: Add summaryButton style**

In the `StyleSheet.create` block at the bottom of the file, add:

```typescript
  summaryButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
```

- [ ] **Step 5: Type check**

Run: `cd app && node node_modules/typescript/bin/tsc --noEmit`
Expected: 0 errors

- [ ] **Step 6: Commit**

```bash
git add app/app/\(tabs\)/history.tsx
git commit -m "feat(D6): AI Summary section in expanded history card"
```

---

### Task 7: Docs + final verification

**Files:**
- Modify: `CLAUDE.md`
- Modify: `PHASE_PLAN.md`

- [ ] **Step 1: Update CLAUDE.md**

Find the "Coaching Profiles (Phase D.5 v1)" section. Add after it:

```markdown
### Post-Session Summaries (Phase D.6 v1)
`summaryService.ts` generates one AI summary per session on demand. `anthropicClient.ts` is a provider adapter that tries `@anthropic-ai/sdk` first and falls back to raw fetch on load failure. `summaryPrompts.ts` holds three context-aware system prompts (solo / with_others / presentation) plus the user-message assembler and deterministic truncation.
Eligibility rules: summary generates only when transcript exists, duration >= 30s, no summary already complete, and not currently generating. In-flight protection: `summary_status = 'generating'` blocks duplicate taps at both the service and UI level.
Model: Claude Haiku 4.5 via env var `EXPO_PUBLIC_ANTHROPIC_API_KEY`. Client-side for prototyping — flag before production. Upgrade to Sonnet is a single-constant change in `config/anthropic.ts`.
Truncation strategy: if transcript exceeds ~32K chars (~8K tokens), keep only the last 32K chars with a truncation marker. Metadata and alert events are always preserved in full.
`session_context_source` is preserved from D.4; summary prompts are selected by `session_context`.
`migrateToV7` adds `summary`, `summary_status`, `summary_generated_at` columns. Summary displays in the expanded session card in history with four states: button / generating / complete / failed (tap to retry).
```

- [ ] **Step 2: Update PHASE_PLAN.md**

Find the D.6 line (currently unchecked). Replace with:

```markdown
- [x] RG-D.6 v1: Post-session summaries — on-demand AI summary per session, context-aware prompts (solo/with_others/presentation), Claude Haiku via provider adapter, displayed in expanded history card, migrateToV7
```

- [ ] **Step 3: Full type check**

Run: `cd app && node node_modules/typescript/bin/tsc --noEmit`
Expected: 0 errors

- [ ] **Step 4: Full test run**

Run: `cd app && npx jest --no-coverage`
Expected: All tests pass. Report exact count. Expect ~162 existing + ~25 new = ~187 tests. Pre-existing theme.test.ts suite failure ignored.

- [ ] **Step 5: Commit**

```bash
git add CLAUDE.md PHASE_PLAN.md
git commit -m "docs: update CLAUDE.md + PHASE_PLAN.md for D.6 v1 summaries"
```
