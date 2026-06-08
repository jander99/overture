import { homedir } from 'node:os';
import { join } from 'node:path';
import { readFile } from 'node:fs/promises';
import { detectOS, type HostPlatform } from '@overture/os';
import { platformRegistry } from './registry.js';
import {
  findExecutablesInPath,
  markerExists,
  resolveMarkerPath,
} from './paths.js';
import { parseMcpConfig } from './mcp-config.js';
import type {
  DetectionConfidence,
  MatchedExecutable,
  MatchedMcpLocation,
  McpLocation,
  McpSupport,
  PathResolutionContext,
  PlatformDetectionResult,
  PlatformRegistryEntry,
  ReasonCode,
  DetectJsonOutput,
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
  const host = detectOS();
  const platform: HostPlatform = host.platform;

  return {
    homeDir,
    configDir,
    workspaceDir,
    platform,
  };
}

function resolveMcpLocationPath(
  loc: McpLocation,
  ctx: PathResolutionContext,
): string {
  switch (loc.base) {
    case 'home':
      return `${ctx.homeDir}/${loc.relativePath}`;
    case 'config':
      return `${ctx.configDir}/${loc.relativePath}`;
    case 'workspace':
      return `${ctx.workspaceDir}/${loc.relativePath}`;
    case 'absolute':
      return loc.relativePath;
    default: {
      const _exhaustive: never = loc.base;
      throw new Error(`Unsupported path base: ${_exhaustive}`);
    }
  }
}

function platformMatches(
  platforms: readonly string[] | undefined,
  platform: PathResolutionContext['platform'],
): boolean {
  return platforms === undefined || platforms.includes(platform);
}

function locationIsApplicable(
  loc: McpLocation,
  ctx: PathResolutionContext,
): boolean {
  return platformMatches(loc.platforms, ctx.platform);
}

interface McpLocationScan {
  matched: MatchedMcpLocation[];
  orphaned: MatchedMcpLocation[];
  hasNonEmptyConfigured: boolean;
  hasParseError: boolean;
}

async function scanMcpLocation(
  loc: McpLocation,
  index: number,
  entry: PlatformRegistryEntry,
  ctx: PathResolutionContext,
  installed: boolean,
  mcpSupport: McpSupport,
): Promise<McpLocationScan> {
  const id = `${entry.id}-${index}`;
  const resolvedPath = resolveMcpLocationPath(loc, ctx);
  const topLevelKey = loc.topLevelKey ?? '';

  const base: MatchedMcpLocation = {
    id,
    resolvedPath,
    format: loc.format,
    ...(topLevelKey === '' ? {} : { topLevelKey }),
    nonEmpty: false,
  };

  let contents: string;
  try {
    contents = await readFile(resolvedPath, 'utf8');
  } catch (err) {
    if (
      err instanceof Error &&
      'code' in err &&
      typeof err.code === 'string' &&
      err.code === 'ENOENT'
    ) {
      return {
        matched: [],
        orphaned: [],
        hasNonEmptyConfigured: false,
        hasParseError: false,
      };
    }
    return {
      matched: [
        {
          ...base,
          parseError: `read failed: ${err instanceof Error ? err.message : String(err)}`,
        },
      ],
      orphaned: [],
      hasNonEmptyConfigured: false,
      hasParseError: true,
    };
  }

  const parsed = parseMcpConfig({ contents, format: loc.format, topLevelKey });

  if (!parsed.parsed) {
    return {
      matched: [
        {
          ...base,
          parseError: parsed.parseError ?? 'parse error',
        },
      ],
      orphaned: [],
      hasNonEmptyConfigured: false,
      hasParseError: true,
    };
  }

  if (!parsed.configured) {
    return {
      matched: [{ ...base, nonEmpty: false }],
      orphaned: [],
      hasNonEmptyConfigured: false,
      hasParseError: false,
    };
  }

  const nonEmpty = true;
  if (!installed) {
    return {
      matched: [],
      orphaned: [{ ...base, nonEmpty }],
      hasNonEmptyConfigured: true,
      hasParseError: false,
    };
  }

  if (mcpSupport === 'supported') {
    return {
      matched: [{ ...base, nonEmpty }],
      orphaned: [],
      hasNonEmptyConfigured: true,
      hasParseError: false,
    };
  }

  return {
    matched: [{ ...base, nonEmpty: false }],
    orphaned: [],
    hasNonEmptyConfigured: true,
    hasParseError: false,
  };
}

function computeReasonCode(args: {
  detectionStrategy: PlatformRegistryEntry['detectionStrategy'];
  installed: boolean;
  mcpSupport: McpSupport;
  hasNonEmptyMcp: boolean;
  hasParseError: boolean;
}): ReasonCode {
  const {
    detectionStrategy,
    installed,
    mcpSupport,
    hasNonEmptyMcp,
    hasParseError,
  } = args;

  if (hasNonEmptyMcp && !installed) {
    return 'orphaned-mcp-config';
  }
  if (installed && mcpSupport === 'supported' && hasNonEmptyMcp) {
    return 'mcp-configured';
  }
  if (installed && mcpSupport === 'unsupported') {
    return 'unsupported-no-mcp-client';
  }
  if (
    detectionStrategy === 'binary-first' &&
    installed &&
    mcpSupport !== 'unsupported'
  ) {
    return 'binary-found';
  }
  if (
    detectionStrategy === 'marker-only' &&
    installed &&
    mcpSupport !== 'unsupported'
  ) {
    return 'marker-found';
  }
  if (
    hasParseError &&
    !installed &&
    !hasNonEmptyMcp &&
    (mcpSupport === 'unsupported' || mcpSupport === 'unknown')
  ) {
    return 'unsupported-no-local-signal';
  }
  if (hasParseError && !installed && !hasNonEmptyMcp) {
    return 'parse-error';
  }
  if (
    (mcpSupport === 'unsupported' || mcpSupport === 'unknown') &&
    !installed
  ) {
    return 'unsupported-no-local-signal';
  }
  return 'not-detected';
}

async function buildResultForEntry(
  entry: PlatformRegistryEntry,
  ctx: PathResolutionContext,
): Promise<PlatformDetectionResult> {
  const pathString = process.env.PATH ?? '';
  const wslWindowsPath = process.env.WSL_WINDOWS_PATH;

  const applicableMarkers = entry.installMarkers.filter((marker) =>
    platformMatches(marker.platforms, ctx.platform),
  );

  const applicableMcpLocations = entry.mcpLocations.filter((loc) =>
    locationIsApplicable(loc, ctx),
  );

  let matchedExecutables: readonly MatchedExecutable[] = [];
  let installed = false;
  let confidence: DetectionConfidence = entry.defaultConfidence;
  let reason: string | undefined = entry.reason;
  const matchedMarkerPaths: string[] = [];

  if (entry.detectionStrategy === 'binary-first') {
    matchedExecutables = await findExecutablesInPath(entry.executableNames, {
      pathString,
      platform: ctx.platform,
      ...(wslWindowsPath !== undefined ? { wslWindowsPath } : {}),
    });
    installed = matchedExecutables.length > 0;
    if (installed) {
      confidence = 'high';
      reason =
        `binary ${matchedExecutables[0]?.name ?? ''} found on PATH`.trim();
    }
  } else {
    const markerChecks = await Promise.all(
      applicableMarkers.map(async (marker) => ({
        marker,
        exists: await markerExists(marker, ctx),
        resolvedPath: resolveMarkerPath(marker, ctx),
      })),
    );
    const matched = markerChecks.filter((check) => check.exists);

    if (matched.length > 0) {
      const bestMatch = matched.reduce((best, current) =>
        confidenceRank[current.marker.confidence] >
        confidenceRank[best.marker.confidence]
          ? current
          : best,
      );
      installed = true;
      confidence = bestMatch.marker.confidence;
      reason = bestMatch.marker.reason;
      for (const m of matched) {
        matchedMarkerPaths.push(m.resolvedPath);
      }
    } else if (
      entry.executableNames.length > 0 &&
      entry.detectionStrategy === 'marker-only'
    ) {
      matchedExecutables = await findExecutablesInPath(entry.executableNames, {
        pathString,
        platform: ctx.platform,
        ...(wslWindowsPath !== undefined ? { wslWindowsPath } : {}),
      });
    }

    if (!installed && entry.installMarkers.length === 0) {
      confidence = 'unsupported';
    } else if (!installed && entry.defaultConfidence === 'unsupported') {
      confidence = 'unsupported';
    } else if (!installed) {
      confidence = entry.defaultConfidence;
    }

    if (!installed) {
      reason = reason ?? 'No install markers matched.';
    }
  }

  const mcpScans = await Promise.all(
    applicableMcpLocations.map((loc, index) =>
      scanMcpLocation(loc, index, entry, ctx, installed, entry.mcpSupport),
    ),
  );

  const matchedMcpLocations: MatchedMcpLocation[] = [];
  const orphanedMcpLocations: MatchedMcpLocation[] = [];
  let hasNonEmptyConfigured = false;
  let hasParseError = false;

  for (const scan of mcpScans) {
    for (const m of scan.matched) matchedMcpLocations.push(m);
    for (const o of scan.orphaned) orphanedMcpLocations.push(o);
    if (scan.hasNonEmptyConfigured) hasNonEmptyConfigured = true;
    if (scan.hasParseError) hasParseError = true;
  }

  const mcpConfigured =
    installed &&
    entry.mcpSupport === 'supported' &&
    matchedMcpLocations.some((m) => m.nonEmpty);

  const reasonCode = computeReasonCode({
    detectionStrategy: entry.detectionStrategy,
    installed,
    mcpSupport: entry.mcpSupport,
    hasNonEmptyMcp: hasNonEmptyConfigured,
    hasParseError,
  });

  const result: PlatformDetectionResult = {
    id: entry.id,
    displayName: entry.displayName,
    installed,
    confidence,
    matchedMarkers: matchedMarkerPaths,
    installMarkers: entry.installMarkers,
    mcpLocations: entry.mcpLocations,
    detectionStrategy: entry.detectionStrategy,
    mcpSupport: entry.mcpSupport,
    executableNames: entry.executableNames,
    matchedExecutables,
    mcpConfigured,
    matchedMcpLocations,
    orphanedMcpLocations,
    reasonCode,
    ...(reason !== undefined ? { reason } : {}),
  };

  return result;
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
    if (entry === undefined) {
      throw new Error(`Missing registry entry at index ${String(index)}`);
    }
    return buildFailedResult(entry, result.reason);
  });

  return { platforms };
}

function buildFailedResult(
  entry: PlatformRegistryEntry,
  failure: unknown,
): PlatformDetectionResult {
  const message = failure instanceof Error ? failure.message : String(failure);
  const result: PlatformDetectionResult = {
    id: entry.id,
    displayName: entry.displayName,
    installed: false,
    confidence: 'unsupported',
    matchedMarkers: [],
    installMarkers: entry.installMarkers,
    mcpLocations: entry.mcpLocations,
    detectionStrategy: entry.detectionStrategy,
    mcpSupport: entry.mcpSupport,
    executableNames: entry.executableNames,
    matchedExecutables: [],
    mcpConfigured: false,
    matchedMcpLocations: [],
    orphanedMcpLocations: [],
    reasonCode: 'not-detected',
    reason: message,
  };
  return result;
}

// PlatformId re-export for type-only consumers
export type { PlatformId } from './types.js';
