import { describe, expect, it } from 'vitest';
import { agentRegistry } from '@overture/agents';
import { agentRegistry } from '@overture/agents';
import type { PlatformId } from '@overture/agents';

describe('agentRegistry', () => {
  const expectedIds: readonly PlatformId[] = [
    'claude-code',
    'claude-desktop',
    'opencode',
    'github-copilot-vscode',
    'github-copilot-cli',
    'github-copilot-cloud-agent',
    'cursor',
    'windsurf',
    'cline',
    'roo-code',
    'continue',
    'zed',
    'openai-codex',
    'aider',
  ];

  it('has exactly 14 entries', () => {
    expect(agentRegistry).toHaveLength(14);
  });

  it('has no duplicate IDs', () => {
    expect(new Set(agentRegistry.map((e) => e.id)).size).toBe(14);
  });

  it('contains the exact ordered set of IDs', () => {
    expect(agentRegistry.map((e) => e.id)).toEqual(expectedIds);
  });

  it('has a non-empty displayName for every entry', () => {
    for (const entry of agentRegistry) {
      expect(entry.displayName, `displayName for ${entry.id}`).toBeTruthy();
      expect(
        entry.displayName.trim().length,
        `displayName for ${entry.id}`,
      ).toBeGreaterThan(0);
    }
  });

  it('marks aider and github-copilot-cloud-agent as unsupported with a reason', () => {
    const aider = agentRegistry.find((e) => e.id === 'aider');
    expect(aider).toBeDefined();
    expect(aider!.defaultConfidence).toBe('unsupported');
    expect(aider!.reason).toBeTruthy();
    expect(aider!.reason!.trim().length).toBeGreaterThan(0);

    const cloudAgent = agentRegistry.find(
      (e) => e.id === 'github-copilot-cloud-agent',
    );
    expect(cloudAgent).toBeDefined();
    expect(cloudAgent!.defaultConfidence).toBe('unsupported');
    expect(cloudAgent!.reason).toBeTruthy();
    expect(cloudAgent!.reason!.trim().length).toBeGreaterThan(0);
  });

  it('gives claude-code at least one high-confidence install marker', () => {
    const entry = agentRegistry.find((e) => e.id === 'claude-code');
    expect(entry).toBeDefined();
    const highMarkers = entry!.installMarkers.filter(
      (m) => m.confidence === 'high',
    );
    expect(highMarkers.length).toBeGreaterThan(0);
  });

  it('gives opencode at least one high-confidence install marker', () => {
    const entry = agentRegistry.find((e) => e.id === 'opencode');
    expect(entry).toBeDefined();
    const highMarkers = entry!.installMarkers.filter(
      (m) => m.confidence === 'high',
    );
    expect(highMarkers.length).toBeGreaterThan(0);
  });

  it('gives cursor at least one high-confidence install marker', () => {
    const entry = agentRegistry.find((e) => e.id === 'cursor');
    expect(entry).toBeDefined();
    const highMarkers = entry!.installMarkers.filter(
      (m) => m.confidence === 'high',
    );
    expect(highMarkers.length).toBeGreaterThan(0);
  });

  it('windsurf has no install markers (binary-first only; mcp-only locations)', () => {
    const entry = agentRegistry.find((e) => e.id === 'windsurf');
    expect(entry).toBeDefined();
    expect(entry!.installMarkers).toHaveLength(0);
    // executableNames must include the canonical 'windsurf' binary name
    expect(entry!.executableNames).toContain('windsurf');
    // The mcpLocations still references the same path so stale configs
    // surface as orphan, not as install.
    expect(
      entry!.mcpLocations.some(
        (l) => l.relativePath === '.codeium/windsurf/mcp_config.json',
      ),
    ).toBe(true);
  });

  it('gives openai-codex at least one high-confidence install marker', () => {
    const entry = agentRegistry.find((e) => e.id === 'openai-codex');
    expect(entry).toBeDefined();
    const highMarkers = entry!.installMarkers.filter(
      (m) => m.confidence === 'high',
    );
    expect(highMarkers.length).toBeGreaterThan(0);
  });

  it('has unique installMarker IDs across the entire registry', () => {
    const markerIds: string[] = [];
    for (const entry of agentRegistry) {
      for (const marker of entry.installMarkers) {
        markerIds.push(marker.id);
      }
    }
    expect(new Set(markerIds).size).toBe(markerIds.length);
  });

  it('marker-only entries with supplementary executables (cursor, zed) list them', () => {
    const cursor = agentRegistry.find((e) => e.id === 'cursor');
    expect(cursor).toBeDefined();
    expect(cursor!.detectionStrategy).toBe('marker-only');
    expect(cursor!.executableNames).toContain('cursor');
    // Sanity: marker-only entries still have install markers
    expect(cursor!.installMarkers.length).toBeGreaterThan(0);

    const zed = agentRegistry.find((e) => e.id === 'zed');
    expect(zed).toBeDefined();
    expect(zed!.detectionStrategy).toBe('marker-only');
    expect(zed!.executableNames).toContain('zed');
    expect(zed!.installMarkers.length).toBeGreaterThan(0);
  });

  describe('agentRegistry aggregate (per-file agents)', () => {
    it('exposes a static aggregate with exactly 14 agents', () => {
      expect(agentRegistry).toBeDefined();
      expect(Array.isArray(agentRegistry)).toBe(true);
      expect(agentRegistry).toHaveLength(14);
    });

    it('preserves the exact 14-ID order from the legacy platformRegistry', () => {
      expect(agentRegistry.map((a) => a.id)).toEqual(expectedIds);
    });

    it('has no duplicate agent IDs', () => {
      const ids = agentRegistry.map((a) => a.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('keeps every legacy invariant for hand-migrated agents', () => {
      const aider = agentRegistry.find((a) => a.id === 'aider');
      expect(aider).toBeDefined();
      expect(aider!.defaultConfidence).toBe('unsupported');
      expect(aider!.reason).toBeTruthy();
      expect(aider!.reason!.trim().length).toBeGreaterThan(0);

      const cloudAgent = agentRegistry.find(
        (a) => a.id === 'github-copilot-cloud-agent',
      );
      expect(cloudAgent).toBeDefined();
      expect(cloudAgent!.defaultConfidence).toBe('unsupported');
      expect(cloudAgent!.reason).toBeTruthy();
      expect(cloudAgent!.reason!.trim().length).toBeGreaterThan(0);

      const windsurf = agentRegistry.find((a) => a.id === 'windsurf');
      expect(windsurf).toBeDefined();
      expect(windsurf!.installMarkers).toHaveLength(0);
      expect(windsurf!.executableNames).toContain('windsurf');
      expect(
        windsurf!.mcpLocations.some(
          (l) => l.relativePath === '.codeium/windsurf/mcp_config.json',
        ),
      ).toBe(true);

      const cursor = agentRegistry.find((a) => a.id === 'cursor');
      expect(cursor).toBeDefined();
      expect(cursor!.detectionStrategy).toBe('marker-only');
      expect(cursor!.executableNames).toContain('cursor');
      expect(cursor!.installMarkers.length).toBeGreaterThan(0);

      const zed = agentRegistry.find((a) => a.id === 'zed');
      expect(zed).toBeDefined();
      expect(zed!.detectionStrategy).toBe('marker-only');
      expect(zed!.executableNames).toContain('zed');
      expect(zed!.installMarkers.length).toBeGreaterThan(0);
    });

    it('keeps marker IDs unique across the entire aggregate', () => {
      const markerIds: string[] = [];
      for (const agent of agentRegistry) {
        for (const marker of agent.installMarkers) {
          markerIds.push(marker.id);
        }
      }
      expect(new Set(markerIds).size).toBe(markerIds.length);
    });

    it('keeps executableNames unique across the entire aggregate (no aliasing)', () => {
      const names: string[] = [];
      for (const agent of agentRegistry) {
        for (const name of agent.executableNames ?? []) {
          names.push(name);
        }
      }
      expect(new Set(names).size).toBe(names.length);
    });

    it('every agent satisfies the AgentDefinition contract (placeholder MCP handlers present)', async () => {
      const ctx = {
        homeDir: '/h',
        configDir: '/c',
        workspaceDir: '/w',
        platform: 'linux',
      } as const;
      for (const a of agentRegistry) {
        expect(a.id, `agent.id`).toBeTruthy();
        expect(
          a.displayName.trim().length,
          `displayName for ${a.id}`,
        ).toBeGreaterThan(0);
        expect(['binary-first', 'marker-only']).toContain(a.detectionStrategy);
        expect(['supported', 'unsupported', 'unknown']).toContain(a.mcpSupport);
        expect(typeof a.mcp.read, `mcp.read for ${a.id}`).toBe('function');
        expect(typeof a.mcp.write, `mcp.write for ${a.id}`).toBe('function');
        if (a.mcpSupport === 'unsupported') {
          await expect(a.mcp.read(ctx)).rejects.toThrow(/not implemented/i);
        } else {
          const result = await a.mcp.read(ctx);
          expect(result).toHaveProperty('config');
          expect(result).toHaveProperty('nonEmpty');
        }
      }
    });

    it('agentRegistry is a compat alias of agentRegistry (same reference)', () => {
      expect(agentRegistry).toBe(agentRegistry);
    });
  });
});
