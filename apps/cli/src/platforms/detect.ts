import { homedir } from 'node:os';
import { join } from 'node:path';
import { platformRegistry } from './registry.js';
import { markerExists, resolveMarkerPath } from './paths.js';
import type {
  PathResolutionContext,
  DetectJsonOutput,
  PlatformDetectionResult,
  DetectionConfidence,
  PlatformRegistryEntry,
} from './types.js';

const confidenceRank: Record<DetectionConfidence, number> = {
  high: 3,
  medium: 2,
  low: 1,
  unsupported: 0,
};

export function defaultPathResolutionContext(): PathResolutionContext {
  const homeDir = homedir();
  const configDir = process.env.XDG_CONFIG_HOME ?? join(homeDir, '.config');
  const workspaceDir = process.cwd();
  const platform = process.platform;

  if (platform !== 'linux' && platform !== 'darwin' && platform !== 'win32') {
    throw new Error(`Unsupported platform: ${platform}`);
  }

  return {
    homeDir,
    configDir,
    workspaceDir,
    platform,
  };
}

function buildResultForEntry(
  entry: PlatformRegistryEntry,
  ctx: PathResolutionContext,
): Promise<PlatformDetectionResult> {
  return (async () => {
    const applicableMarkers = entry.installMarkers.filter(
      (marker) =>
        marker.platforms === undefined ||
        marker.platforms.includes(ctx.platform),
    );

    const markerChecks = await Promise.all(
      applicableMarkers.map(async (marker) => ({
        marker,
        exists: await markerExists(marker, ctx),
        resolvedPath: resolveMarkerPath(marker, ctx),
      })),
    );

    const matched = markerChecks.filter((check) => check.exists);

    if (matched.length > 0) {
      const bestMatch = matched.reduce((best, current) => {
        return confidenceRank[current.marker.confidence] >
          confidenceRank[best.marker.confidence]
          ? current
          : best;
      });

      return {
        id: entry.id,
        displayName: entry.displayName,
        installed: true,
        confidence: bestMatch.marker.confidence,
        matchedMarkers: matched.map((m) => m.resolvedPath),
        installMarkers: entry.installMarkers,
        mcpLocations: entry.mcpLocations,
        reason: bestMatch.marker.reason,
      };
    }

    if (entry.installMarkers.length === 0) {
      return {
        id: entry.id,
        displayName: entry.displayName,
        installed: false,
        confidence: 'unsupported',
        matchedMarkers: [],
        installMarkers: entry.installMarkers,
        mcpLocations: entry.mcpLocations,
        reason: entry.reason,
      };
    }

    if (entry.defaultConfidence === 'unsupported') {
      return {
        id: entry.id,
        displayName: entry.displayName,
        installed: false,
        confidence: 'unsupported',
        matchedMarkers: [],
        installMarkers: entry.installMarkers,
        mcpLocations: entry.mcpLocations,
        reason: entry.reason,
      };
    }

    return {
      id: entry.id,
      displayName: entry.displayName,
      installed: false,
      confidence: entry.defaultConfidence,
      matchedMarkers: [],
      installMarkers: entry.installMarkers,
      mcpLocations: entry.mcpLocations,
      reason: entry.reason ?? 'No install markers matched.',
    };
  })();
}

export async function detectPlatforms(
  ctx: PathResolutionContext,
): Promise<DetectJsonOutput> {
  const settled = await Promise.allSettled(
    platformRegistry.map((entry) => buildResultForEntry(entry, ctx)),
  );

  const platforms = settled.map((result, index) => {
    if (result.status === 'fulfilled') {
      return result.value;
    }

    const entry = platformRegistry[index];
    return {
      id: entry.id,
      displayName: entry.displayName,
      installed: false,
      confidence: 'unsupported' as DetectionConfidence,
      matchedMarkers: [],
      installMarkers: entry.installMarkers,
      mcpLocations: entry.mcpLocations,
      reason:
        result.reason instanceof Error
          ? result.reason.message
          : String(result.reason),
    };
  });

  return { platforms };
}
