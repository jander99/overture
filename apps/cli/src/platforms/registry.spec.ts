import { describe, expect, it } from 'vitest';
import { platformRegistry } from './registry.js';
import type { PlatformId } from './types.js';

describe('platformRegistry', () => {
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
    expect(platformRegistry).toHaveLength(14);
  });

  it('has no duplicate IDs', () => {
    expect(new Set(platformRegistry.map((e) => e.id)).size).toBe(14);
  });

  it('contains the exact ordered set of IDs', () => {
    expect(platformRegistry.map((e) => e.id)).toEqual(expectedIds);
  });

  it('has a non-empty displayName for every entry', () => {
    for (const entry of platformRegistry) {
      expect(entry.displayName, `displayName for ${entry.id}`).toBeTruthy();
      expect(
        entry.displayName.trim().length,
        `displayName for ${entry.id}`,
      ).toBeGreaterThan(0);
    }
  });

  it('marks aider and github-copilot-cloud-agent as unsupported with a reason', () => {
    const aider = platformRegistry.find((e) => e.id === 'aider');
    expect(aider).toBeDefined();
    expect(aider!.defaultConfidence).toBe('unsupported');
    expect(aider!.reason).toBeTruthy();
    expect(aider!.reason!.trim().length).toBeGreaterThan(0);

    const cloudAgent = platformRegistry.find(
      (e) => e.id === 'github-copilot-cloud-agent',
    );
    expect(cloudAgent).toBeDefined();
    expect(cloudAgent!.defaultConfidence).toBe('unsupported');
    expect(cloudAgent!.reason).toBeTruthy();
    expect(cloudAgent!.reason!.trim().length).toBeGreaterThan(0);
  });

  it('gives claude-code at least one high-confidence install marker', () => {
    const entry = platformRegistry.find((e) => e.id === 'claude-code');
    expect(entry).toBeDefined();
    const highMarkers = entry!.installMarkers.filter(
      (m) => m.confidence === 'high',
    );
    expect(highMarkers.length).toBeGreaterThan(0);
  });

  it('gives opencode at least one high-confidence install marker', () => {
    const entry = platformRegistry.find((e) => e.id === 'opencode');
    expect(entry).toBeDefined();
    const highMarkers = entry!.installMarkers.filter(
      (m) => m.confidence === 'high',
    );
    expect(highMarkers.length).toBeGreaterThan(0);
  });

  it('gives cursor at least one high-confidence install marker', () => {
    const entry = platformRegistry.find((e) => e.id === 'cursor');
    expect(entry).toBeDefined();
    const highMarkers = entry!.installMarkers.filter(
      (m) => m.confidence === 'high',
    );
    expect(highMarkers.length).toBeGreaterThan(0);
  });

  it('gives windsurf at least one high-confidence install marker', () => {
    const entry = platformRegistry.find((e) => e.id === 'windsurf');
    expect(entry).toBeDefined();
    const highMarkers = entry!.installMarkers.filter(
      (m) => m.confidence === 'high',
    );
    expect(highMarkers.length).toBeGreaterThan(0);
  });

  it('gives openai-codex at least one high-confidence install marker', () => {
    const entry = platformRegistry.find((e) => e.id === 'openai-codex');
    expect(entry).toBeDefined();
    const highMarkers = entry!.installMarkers.filter(
      (m) => m.confidence === 'high',
    );
    expect(highMarkers.length).toBeGreaterThan(0);
  });

  it('has unique installMarker IDs across the entire registry', () => {
    const markerIds: string[] = [];
    for (const entry of platformRegistry) {
      for (const marker of entry.installMarkers) {
        markerIds.push(marker.id);
      }
    }
    expect(new Set(markerIds).size).toBe(markerIds.length);
  });
});
