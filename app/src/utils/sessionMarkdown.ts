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
  const ctx = session.sessionContext ? (CONTEXT_SLUG[session.sessionContext] ?? 'session') : 'session';
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

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

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
// Transcript rendering
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
  try {
    const p = JSON.parse(raw);
    return Array.isArray(p) ? p : [];
  } catch {
    return [];
  }
}

function parseSegments(raw: string | null): TranscriptSegment[] | null {
  if (!raw) return null;
  try {
    const p = JSON.parse(raw);
    return Array.isArray(p) ? p : null;
  } catch {
    return null;
  }
}

function resolveName(label: string | null, mappings: SpeakerMapping[]): string {
  if (!label) return 'Unknown';
  return mappings.find((m) => m.diarizedLabel === label)?.displayName ?? label;
}

function buildTurns(
  segments: TranscriptSegment[],
  mappings: SpeakerMapping[],
  sessionStartMs: number,
): Turn[] {
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
      const lines = turns.map(
        (t) => `**${t.displayName}** · ${formatOffset(t.startMs)}\n${t.text}`,
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

  // ── Header ──────────────────────────────────────────────
  const contextLabel = session.sessionContext
    ? (CONTEXT_LABELS[session.sessionContext] ?? session.sessionContext)
    : null;
  const alertName = ALERT_NAMES[session.maxAlert] ?? 'None';

  sections.push(`# Session — ${formatHeaderDate(session.startedAt)}`);
  sections.push('');

  const metaRows = [
    '| Field | Value |',
    '|---|---|',
    `| Duration | ${formatDurationMs(session.durationMs)} |`,
  ];
  if (contextLabel) metaRows.push(`| Context | ${contextLabel} |`);
  metaRows.push(`| Alerts | ${session.alertCount} (max: ${alertName}) |`);
  sections.push(metaRows.join('\n'));

  // ── Transcript ───────────────────────────────────────────
  const transcriptSection = renderTranscriptSection(session);
  if (transcriptSection) {
    sections.push('---');
    sections.push(transcriptSection);
  }

  // ── AI Summary ───────────────────────────────────────────
  if (session.summaryStatus === 'complete' && session.summary) {
    sections.push('---');
    sections.push(`## AI Summary\n\n${session.summary}`);
  }

  // ── Alert Timeline ───────────────────────────────────────
  if (events.length > 0) {
    sections.push('---');
    const rows = [
      '## Alert Timeline',
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
