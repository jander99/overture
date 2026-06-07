import { stat } from 'node:fs/promises';
import type { InstallMarker, PathResolutionContext } from './types.js';

export function resolveMarkerPath(
  marker: InstallMarker,
  ctx: PathResolutionContext,
): string {
  switch (marker.base) {
    case 'home':
      return `${ctx.homeDir}/${marker.relativePath}`;
    case 'config':
      return `${ctx.configDir}/${marker.relativePath}`;
    case 'workspace':
      return `${ctx.workspaceDir}/${marker.relativePath}`;
    case 'absolute':
      return marker.relativePath;
    default: {
      const _exhaustive: never = marker.base;
      throw new Error(`Unsupported path base: ${_exhaustive}`);
    }
  }
}

export async function markerExists(
  marker: InstallMarker,
  ctx: PathResolutionContext,
): Promise<boolean> {
  const resolved = resolveMarkerPath(marker, ctx);

  try {
    const s = await stat(resolved);

    switch (marker.kind) {
      case 'file':
        return s.isFile();
      case 'directory':
        return s.isDirectory();
      case 'file-or-directory':
        return s.isFile() || s.isDirectory();
      default: {
        const _exhaustive: never = marker.kind;
        throw new Error(`Unsupported marker kind: ${_exhaustive}`);
      }
    }
  } catch (err) {
    if (
      err instanceof Error &&
      'code' in err &&
      (err.code === 'ENOENT' ||
        err.code === 'EACCES' ||
        err.code === 'EPERM' ||
        err.code === 'ELOOP' ||
        err.code === 'ENOTDIR')
    ) {
      return false;
    }
    throw err;
  }
}
