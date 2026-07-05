import { mkdir, rename, rm, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { basename, dirname, join } from 'node:path';

/**
 * Write `contents` to `targetPath` atomically: ensure the parent
 * directory exists, write to a same-directory temp file whose name
 * is unique per process + random UUID, then rename over the target.
 * If anything in the write-or-rename pair fails, the temp file is
 * best-effort removed.
 *
 * Shared by every per-agent MCP writer
 * (`claude-code-write`, `openai-codex-write`, `opencode-write`,
 * `github-copilot-cli-write`) so the temp-file naming + cleanup
 * convention cannot drift across them.
 *
 * Not used by `apps/cli/src/apply-state.ts` or `apply-log.ts`:
 * those need the stronger `open + writeFile + fsync + close + rename`
 * pattern for state-file durability and intentionally do not go
 * through this helper.
 */
export async function atomicWrite(
  targetPath: string,
  contents: string,
): Promise<void> {
  await mkdir(dirname(targetPath), { recursive: true });
  const tempPath = join(
    dirname(targetPath),
    `.${basename(targetPath)}.${process.pid}.${randomUUID()}.tmp`,
  );
  try {
    await writeFile(tempPath, contents, 'utf8');
    await rename(tempPath, targetPath);
  } catch (err) {
    try {
      await rm(tempPath, { force: true });
    } catch {
      /* best-effort cleanup */
    }
    throw err;
  }
}
