import { describe, expect, it } from 'vitest';
import { agentRegistry } from '@overture/agents';
import type { PlatformId } from '@overture/agents';

describe('agentRegistry', () => {
  const expectedIds: readonly PlatformId[] = [
    'claude-code',
    'opencode',
    'github-copilot-cli',
    'openai-codex',
  ];

  it('has exactly 4 entries', () => {
    expect(agentRegistry).toHaveLength(4);
  });

  it('has no duplicate IDs', () => {
    expect(new Set(agentRegistry.map((e) => e.id)).size).toBe(4);
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

  describe('agentRegistry aggregate (per-file agents)', () => {
    it('exposes a static aggregate with exactly 4 agents', () => {
      expect(agentRegistry).toBeDefined();
      expect(Array.isArray(agentRegistry)).toBe(true);
      expect(agentRegistry).toHaveLength(4);
    });

    it('preserves the exact 4-ID order from the legacy platformRegistry', () => {
      expect(agentRegistry.map((a) => a.id)).toEqual(expectedIds);
    });

    it('has no duplicate agent IDs', () => {
      const ids = agentRegistry.map((a) => a.id);
      expect(new Set(ids).size).toBe(ids.length);
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
        const result = await a.mcp.read(ctx);
        expect(result).toHaveProperty('config');
        expect(result).toHaveProperty('nonEmpty');
      }
    });

    it('opencode.mcp.write is the real OpenCode writer (not the default not-implemented stub)', async () => {
      const entry = agentRegistry.find((e) => e.id === 'opencode');
      expect(entry).toBeDefined();
      expect(typeof entry!.mcp.write).toBe('function');
      // The real writer resolves with a result; the stub throws with the
      // 'not implemented yet' message. Calling with an empty servers list
      // is a no-change no-op that exercises the real writer path.
      const ctx = {
        homeDir: '',
        configDir: '',
        workspaceDir: '',
        platform: 'linux' as const,
      };
      await expect(entry!.mcp.write(ctx, { servers: [] })).resolves.not.toThrow(
        /not implemented yet/i,
      );
    });
  });
});
