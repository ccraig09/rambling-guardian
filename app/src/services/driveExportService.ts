/**
 * Google Drive export service — D.8 v1.
 *
 * Responsibilities:
 *   - Build/find the Rambling Guardian folder tree on Drive
 *   - Format sessions as Markdown via sessionMarkdown util
 *   - Upload Markdown files via Drive multipart upload
 *   - Update backup_status on session rows
 *
 * Folder tree: My Drive / Rambling Guardian / Transcripts / YYYY / MM /
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
  // When no explicit parent, restrict to Drive root to avoid matching same-named
  // folders that live elsewhere (e.g. project docs folders).
  const parent = parentId ?? 'root';
  const q = encodeURIComponent(
    `name='${name}' and mimeType='${FOLDER_MIME}' and '${parent}' in parents and trashed=false`,
  );
  const data = await driveGet(`?q=${q}&fields=files(id,name)`, token);
  return data.files?.[0]?.id ?? null;
}

async function createFolder(name: string, parentId: string | null, token: string): Promise<string> {
  const body: Record<string, any> = { name, mimeType: FOLDER_MIME };
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

// Update the content of an existing Drive file. Does NOT rename or move it.
async function patchMarkdownFile(fileId: string, content: string, token: string): Promise<string> {
  const res = await fetch(
    `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`,
    {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'text/markdown; charset=UTF-8',
      },
      body: content,
    },
  );
  if (!res.ok) throw new Error(`[Drive] PATCH failed: ${res.status}`);
  const data = await res.json();
  return data.id;
}

// Search for a file by exact name inside a specific folder.
async function findFileInFolder(name: string, parentId: string, token: string): Promise<string | null> {
  const q = encodeURIComponent(
    `name='${name}' and '${parentId}' in parents and trashed=false`,
  );
  const data = await driveGet(`?q=${q}&fields=files(id,name)`, token);
  return data.files?.[0]?.id ?? null;
}

// Idempotent write: update existing file if we have its ID or can find it by name;
// create a new file only if nothing exists.
async function findOrUpsertMarkdownFile(
  name: string,
  content: string,
  parentId: string,
  token: string,
  existingFileId?: string,
): Promise<string> {
  // 1. Try patching the stored file ID — cheapest path, handles 99% of re-runs.
  if (existingFileId) {
    try {
      return await patchMarkdownFile(existingFileId, content, token);
    } catch (e: unknown) {
      // 404 = file was manually deleted from Drive; fall through and recreate.
      if (!String((e as Error)?.message).includes('404')) throw e;
    }
  }

  // 2. Find by filename in the target folder (handles: DB update failed after
  //    upload, or first backup left file but driveFileId was never stored).
  const foundId = await findFileInFolder(name, parentId, token);
  if (foundId) {
    return patchMarkdownFile(foundId, content, token);
  }

  // 3. No existing file — create one.
  return uploadMarkdownFile(name, content, parentId, token);
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

      const fileId = await findOrUpsertMarkdownFile(
        fileName, markdown, monthId, token, session.driveFileId ?? undefined,
      );
      await updateBackupStatus(sessionId, 'complete', fileId);
    } catch (e) {
      await updateBackupStatus(sessionId, 'failed');
      throw e;
    }
  }

  async exportAllSessions(
    onProgress?: (done: number, total: number) => void,
  ): Promise<{ succeeded: number; failed: number }> {
    const sessions = await getSessions(200); // 200-session cap for v1
    // No 'complete' filter — every run is idempotent: existing Drive files are
    // PATCHed (content updated), not duplicated. New sessions get new files.
    const total = sessions.length;

    let succeeded = 0;
    let failed = 0;
    let done = 0;

    for (const session of sessions) {
      try {
        await this.exportSession(session.id);
        succeeded++;
      } catch {
        failed++;
      }
      done++;
      onProgress?.(done, total);
    }

    return { succeeded, failed };
  }
}

export const driveExportService = new DriveExportService();
