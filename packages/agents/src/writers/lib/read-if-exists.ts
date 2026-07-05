import { readFile } from 'node:fs/promises';

/**
 * Codes for which `readIfExists` returns `null` instead of throwing.
 * Chosen to match the original per-writer behaviour: the missing file
 * is the primary case (ENOENT), plus the no-permission / not-a-file
 * cases (EACCES, EPERM, EISDIR) that effectively mean "the writer
 * cannot read this and should treat the location as not-targetable".
 *
 * Any other error (parse error, mid-read I/O error, etc.) is
 * propagated.
 */
const NOT_FOUND_CODES: ReadonlySet<string> = new Set([
  'ENOENT',
  'EACCES',
  'EPERM',
  'EISDIR',
]);

/**
 * Read a UTF-8 file at `path`, returning `null` when the file is
 * absent or unreadable (ENOENT/EACCES/EPERM/EISDIR). Other errors
 * propagate so callers can distinguish them from "no such file".
 *
 * Shared by `claude-code-write`, `github-copilot-cli-write`, and
 * `opencode-write`. The openai-codex writer deliberately uses a
 * different pattern — it surfaces ENOENT as `not-targetable` and
 * propagates every other error — and is not migrated to this helper.
 */
export async function readIfExists(path: string): Promise<string | null> {
  try {
    return await readFile(path, 'utf8');
  } catch (err: unknown) {
    if (
      typeof err === 'object' &&
      err !== null &&
      'code' in err &&
      typeof (err as { code: unknown }).code === 'string' &&
      NOT_FOUND_CODES.has((err as { code: string }).code)
    ) {
      return null;
    }
    throw err;
  }
}
