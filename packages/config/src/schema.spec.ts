import { describe, expect, it } from 'vitest';
import {
  OvertureConfigSchema,
  parseOvertureConfig,
  type OvertureConfig,
} from './schema.js';

const validMinimal = {
  $schema: 'https://example/overture.config.schema.json',
  version: 1 as const,
  profiles: {
    default: {
      mcpServers: {},
      sync: { targets: [] },
      skills: [],
    },
  },
};

describe('OvertureConfigSchema', () => {
  it('accepts a minimal valid config', () => {
    const r = OvertureConfigSchema.safeParse(validMinimal);
    expect(r.success).toBe(true);
  });

  it('accepts a config with a profile that has mcpServers, sync, and skills', () => {
    const input = {
      $schema: 'https://example/x.json',
      version: 1,
      profiles: {
        default: {
          mcpServers: {
            filesystem: {
              type: 'stdio' as const,
              command: 'npx',
              args: ['-y', '@mcp/server-filesystem', '/home'],
            },
            context7: {
              type: 'stdio' as const,
              command: 'npx',
              args: ['-y', '@upstash/context7-mcp@latest'],
              env: { CONTEXT7_API_KEY: '${CONTEXT7_API_KEY}' },
            },
          },
          sync: {
            targets: ['claude-code', 'opencode'],
            disabledServers: ['filesystem'],
          },
          skills: [
            {
              source: 'vercel-labs/agent-skills',
              include: ['frontend-design', 'skill-creator'],
            },
          ],
        },
      },
    };
    const r = OvertureConfigSchema.safeParse(input);
    expect(r.success).toBe(true);
  });

  it('rejects unknown top-level keys', () => {
    const r = OvertureConfigSchema.safeParse({
      ...validMinimal,
      mystery: true,
    });
    expect(r.success).toBe(false);
  });

  it('rejects version != 1', () => {
    const r = OvertureConfigSchema.safeParse({
      ...validMinimal,
      version: 2,
    });
    expect(r.success).toBe(false);
  });

  it('rejects a profile whose name is not a string', () => {
    const r = OvertureConfigSchema.safeParse({
      ...validMinimal,
      profiles: { default: 42 },
    });
    expect(r.success).toBe(false);
  });

  it('rejects an mcp server with neither command nor url', () => {
    const r = OvertureConfigSchema.safeParse({
      ...validMinimal,
      profiles: {
        default: {
          mcpServers: { broken: { type: 'stdio' as const } },
          sync: { targets: [] },
          skills: [],
        },
      },
    });
    expect(r.success).toBe(false);
  });

  it('rejects a remote mcp server without url', () => {
    const r = OvertureConfigSchema.safeParse({
      ...validMinimal,
      profiles: {
        default: {
          mcpServers: {
            broken: { type: 'remote' as const, command: 'npx' },
          },
          sync: { targets: [] },
          skills: [],
        },
      },
    });
    expect(r.success).toBe(false);
  });

  it('rejects a skills entry without include (or with empty include)', () => {
    const r = OvertureConfigSchema.safeParse({
      ...validMinimal,
      profiles: {
        default: {
          mcpServers: {},
          sync: { targets: [] },
          skills: [{ source: 'foo/bar', include: [] }],
        },
      },
    });
    expect(r.success).toBe(false);
  });

  it('rejects a skills entry whose source is not owner/repo', () => {
    const r = OvertureConfigSchema.safeParse({
      ...validMinimal,
      profiles: {
        default: {
          mcpServers: {},
          sync: { targets: [] },
          skills: [{ source: 'not-a-coord', include: ['x'] }],
        },
      },
    });
    expect(r.success).toBe(false);
  });

  it('rejects a sync target that is not a string', () => {
    const r = OvertureConfigSchema.safeParse({
      ...validMinimal,
      profiles: {
        default: {
          mcpServers: {},
          sync: { targets: [42] },
          skills: [],
        },
      },
    });
    expect(r.success).toBe(false);
  });
});

describe('parseOvertureConfig', () => {
  it('returns the parsed config on success', () => {
    const cfg: OvertureConfig = parseOvertureConfig(validMinimal);
    expect(cfg.version).toBe(1);
    expect(cfg.profiles.default.sync.targets).toEqual([]);
  });

  it('throws with a useful message on failure', () => {
    expect(() => parseOvertureConfig({ version: 1 })).toThrow(/config/i);
  });
});
