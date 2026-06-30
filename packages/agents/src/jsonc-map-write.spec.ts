import { describe, it, expect } from 'vitest';
import { editJsoncMap } from './jsonc-map-write.js';

describe('editJsoncMap', () => {
  it('returns parse-error on malformed JSONC', () => {
    const res = editJsoncMap({
      original: new TextEncoder().encode('{ "mcpServers": {'),
      targetPath: ['mcpServers'],
      patch: { foo: { command: 'echo' } },
    });
    expect(res.kind).toBe('error');
    if (res.kind === 'error') expect(res.reason).toBe('parse-error');
  });

  it('returns unsupported-shape on empty root', () => {
    const res = editJsoncMap({
      original: new TextEncoder().encode(''),
      targetPath: ['mcpServers'],
      patch: {},
    });
    expect(res.kind).toBe('error');
  });

  it('returns unsupported-path on missing target', () => {
    const res = editJsoncMap({
      original: new TextEncoder().encode('{"other":{}}'),
      targetPath: ['mcpServers'],
      patch: { foo: { command: 'echo' } },
    });
    expect(res.kind).toBe('error');
    if (res.kind === 'error') expect(res.reason).toBe('unsupported-path');
  });

  it('returns ok:changed=false when patch is no-op', () => {
    const original = '{"mcpServers":{"alpha":{"command":"echo"}}}';
    const res = editJsoncMap({
      original: new TextEncoder().encode(original),
      targetPath: ['mcpServers'],
      patch: { alpha: { command: 'echo' } },
    });
    expect(res.kind).toBe('ok');
    if (res.kind === 'ok') {
      expect(res.changed).toBe(false);
      expect(new TextDecoder().decode(res.nextBytes)).toBe(original);
    }
  });

  it('returns ok:changed=true when patch differs', () => {
    const original = '{"mcpServers":{"alpha":{"command":"echo"}}}';
    const res = editJsoncMap({
      original: new TextEncoder().encode(original),
      targetPath: ['mcpServers'],
      patch: { alpha: { command: 'ls' } },
    });
    expect(res.kind).toBe('ok');
    if (res.kind === 'ok') {
      expect(res.changed).toBe(true);
    }
  });

  it('walks multi-segment nested target paths', () => {
    const original = JSON.stringify({
      projects: {
        '/some/ws': { mcpServers: { alpha: { command: 'echo' } } },
      },
    });
    const res = editJsoncMap({
      original: new TextEncoder().encode(original),
      targetPath: ['projects', '/some/ws', 'mcpServers'],
      patch: { alpha: { command: 'ls' } },
    });
    expect(res.kind).toBe('ok');
  });
});
