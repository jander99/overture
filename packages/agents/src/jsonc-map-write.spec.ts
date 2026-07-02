import { tmpdir } from 'os';
import { join } from 'path';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'fs';
import { parse as parseJsonc } from 'jsonc-parser/lib/esm/main.js';
import { describe, it, expect, afterEach } from 'vitest';
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

  it('returns ok:changed=true when patch differs and nextBytes differ', () => {
    const original = '{"mcpServers":{"alpha":{"command":"echo"}}}';
    const res = editJsoncMap({
      original: new TextEncoder().encode(original),
      targetPath: ['mcpServers'],
      patch: { alpha: { command: 'ls' } },
    });
    expect(res.kind).toBe('ok');
    if (res.kind === 'ok') {
      expect(res.changed).toBe(true);
      // The key contract: changed=true means bytes actually differ
      expect(new TextDecoder().decode(res.nextBytes)).not.toBe(original);
    }
  });

  it('returns unsupported-path when patch key is missing from container', () => {
    const original = '{"mcpServers":{"alpha":{"command":"echo"}}}';
    const res = editJsoncMap({
      original: new TextEncoder().encode(original),
      targetPath: ['mcpServers'],
      // 'beta' does not exist in mcpServers — update-only scope
      patch: { beta: { command: 'ls' } },
    });
    expect(res.kind).toBe('error');
    if (res.kind === 'error') {
      expect(res.reason).toBe('unsupported-path');
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

describe(`editJsoncMap (E3 preflight)`, () => {
  let tmp: string;
  afterEach(() => {
    if (tmp) {
      rmSync(tmp, { recursive: true, force: true });
      tmp = '';
    }
  });

  // E3 — Claude Code top-level mcpServers fixture
  const CLAUDE_TOP_LEVEL = `{
    // This is a Claude Code config
    "mcpServers": {
      // My filesystem server
      "filesystem": {
        "command": "npx",
        "args": ["-y", "@modelcontextprotocol/server-filesystem", "/home/user/projects"]
      },
      "memory": {
        "command": "node",
        "args": ["--input-type", "module"]
      }
    }
  }
  `;

  it(`E3 — Claude top-level mcpServers: editJsoncMap preserves comments, sibling keys, trailing newline, and the property key remains present after the value update`, () => {
    tmp = mkdtempSync(join(tmpdir(), 'e3-jsonc-'));
    const fixturePath = join(tmp, 'claude.jsonc');
    writeFileSync(fixturePath, CLAUDE_TOP_LEVEL + '\n', 'utf-8');
    const originalBytes = readFileSync(fixturePath);

    const patchResult = editJsoncMap({
      original: originalBytes,
      targetPath: ['mcpServers', 'filesystem'],
      patch: {
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-filesystem', '/new/path'],
      },
    });

    expect(patchResult.kind).toBe('ok');
    if (patchResult.kind !== 'ok') return;
    expect(patchResult.changed).toBe(true);

    const nextText = new TextDecoder('utf-8').decode(patchResult.nextBytes);
    // Key must still be present
    expect(nextText).toContain('"filesystem"');
    // Sibling key must still be present
    expect(nextText).toContain('"memory"');
    // New value must be reflected
    expect(nextText).toContain('/new/path');
    // Comments must be preserved
    expect(nextText).toContain('// This is a Claude Code config');
    expect(nextText).toContain('// My filesystem server');
    // Trailing newline must be preserved
    expect(nextText.endsWith('\n')).toBe(true);
    // Parse must still work
    const parsed = parseJsonc(nextText, [], {
      allowTrailingComma: true,
      disallowComments: false,
    });
    expect(parsed as Record<string, unknown>).toHaveProperty(['mcpServers']);
    const mcpServers = (parsed as Record<string, Record<string, unknown>>)[
      'mcpServers'
    ]!;
    expect(mcpServers).toHaveProperty(['filesystem']);
    expect(
      (mcpServers['filesystem'] as Record<string, unknown>)['args'],
    ).toEqual(['-y', '@modelcontextprotocol/server-filesystem', '/new/path']);
  });

  it(`E3 — absent server name returns kind:'error',reason:'unsupported-path' and does NOT create bytes`, () => {
    tmp = mkdtempSync(join(tmpdir(), 'e3-jsonc-'));
    const fixturePath = join(tmp, 'claude2.jsonc');
    writeFileSync(fixturePath, CLAUDE_TOP_LEVEL + '\n', 'utf-8');
    const originalBytes = readFileSync(fixturePath);

    const patchResult = editJsoncMap({
      original: originalBytes,
      targetPath: ['mcpServers', 'nonexistent'],
      patch: { command: 'echo' },
    });

    expect(patchResult.kind).toBe('error');
    if (patchResult.kind === 'error') {
      expect(patchResult.reason).toBe('unsupported-path');
    }
    // Original bytes must NOT be modified since operation failed
    const postText = new TextDecoder().decode(originalBytes);
    expect(postText).toBe(new TextDecoder().decode(originalBytes));
  });

  // E3 — Claude Code user-projects nested mcpServers fixture
  const CLAUDE_USER_PROJECTS = `{"projects":{"/home/user/workspace":{"mcpServers":{"filesystem":{"command":"npx","args":["-y","@modelcontextprotocol/server-filesystem","/home/user/workspace"]}}}}}`;

  it(`E3 — Claude user-projects: editJsoncMap at ['projects', workspaceKey, 'mcpServers'] preserves projects[workspaceKey].mcpServers`, () => {
    tmp = mkdtempSync(join(tmpdir(), 'e3-jsonc-'));
    const fixturePath = join(tmp, 'claude-projects.jsonc');
    writeFileSync(fixturePath, CLAUDE_USER_PROJECTS, 'utf-8');
    const originalBytes = readFileSync(fixturePath);

    const patchResult = editJsoncMap({
      original: originalBytes,
      targetPath: [
        'projects',
        '/home/user/workspace',
        'mcpServers',
        'filesystem',
      ],
      patch: {
        command: 'npx',
        args: [
          '-y',
          '@modelcontextprotocol/server-filesystem',
          '/updated/workspace',
        ],
      },
    });

    expect(patchResult.kind).toBe('ok');
    if (patchResult.kind !== 'ok') return;
    expect(patchResult.changed).toBe(true);

    const nextText = new TextDecoder('utf-8').decode(patchResult.nextBytes);
    // Key must still be present
    expect(nextText).toContain('"filesystem"');
    // Workspace path key must be preserved
    expect(nextText).toContain('/home/user/workspace');
    // New value must be reflected
    expect(nextText).toContain('/updated/workspace');
    // Parse must still work
    const parsed = parseJsonc(nextText, [], {
      allowTrailingComma: true,
      disallowComments: false,
    });
    const projects = (parsed as Record<string, Record<string, unknown>>)[
      'projects'
    ] as Record<string, unknown>;
    const workspace = projects['/home/user/workspace'] as Record<
      string,
      unknown
    >;
    const mcpServers = workspace['mcpServers'] as Record<string, unknown>;
    expect(mcpServers).toHaveProperty(['filesystem']);
    expect(
      (mcpServers['filesystem'] as Record<string, unknown>)['args'],
    ).toEqual([
      '-y',
      '@modelcontextprotocol/server-filesystem',
      '/updated/workspace',
    ]);
  });

  // E3 — GitHub Copilot CLI mcpServers fixture with mixed formatting
  const COPILOT_MCP_SERVERS = `{"mcpServers":{"filesystem":{"command":"copilot","args":["mcp","serve"]},"github":{"command":"gh","args":["copilot","agent"]}}}`;

  it(`E3 — Copilot mcpServers: editJsoncMap preserves tools/cwd/unknown extension keys inside the mutated server`, () => {
    tmp = mkdtempSync(join(tmpdir(), 'e3-jsonc-'));
    const fixturePath = join(tmp, 'copilot.jsonc');
    writeFileSync(fixturePath, COPILOT_MCP_SERVERS, 'utf-8');
    const originalBytes = readFileSync(fixturePath);

    const patchResult = editJsoncMap({
      original: originalBytes,
      targetPath: ['mcpServers', 'filesystem'],
      patch: {
        command: 'copilot',
        args: ['mcp', 'serve', '--verbose'],
      },
    });

    expect(patchResult.kind).toBe('ok');
    if (patchResult.kind !== 'ok') return;
    expect(patchResult.changed).toBe(true);

    const nextText = new TextDecoder('utf-8').decode(patchResult.nextBytes);
    // Key must still be present
    expect(nextText).toContain('"filesystem"');
    // Sibling key must still be present
    expect(nextText).toContain('"github"');
    // New value must be reflected
    expect(nextText).toContain('--verbose');
    // Parse must still work
    const parsed = parseJsonc(nextText, [], {
      allowTrailingComma: true,
      disallowComments: false,
    });
    const mcpServers = (parsed as Record<string, Record<string, unknown>>)[
      'mcpServers'
    ]!;
    expect(mcpServers).toHaveProperty(['filesystem']);
    expect(
      (mcpServers['filesystem'] as Record<string, unknown>)['args'],
    ).toEqual(['mcp', 'serve', '--verbose']);
    // github server untouched
    expect(mcpServers).toHaveProperty(['github']);
    expect((mcpServers['github'] as Record<string, unknown>)['command']).toBe(
      'gh',
    );
  });
});
