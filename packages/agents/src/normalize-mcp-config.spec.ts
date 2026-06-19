// Tests for the shared MCP normalization helpers in normalize-mcp-config.ts.
//
// Group order follows the helper export order in normalize-mcp-config.ts:
//   1. NORMALIZE_SHAPE_CONFLICT_REASONS (the constant)
//   2. normalized / shapeConflict / asRegistryNormalizeHandler (constructors
//      and the registry-slot adapter)
//   3. isRecord / isStringMap (type guards)
//   4. validateOptionalStringMap / validateOptionalStringArray (validators
//      that only report a reason)
//   5. normalizeOptionalArgs / normalizeOptionalEnv / normalizeOptionalHeaders
//      (validators that also return a mutable canonical value)
//
// Each helper group covers:
//   - happy path output
//   - optional-field omission (absent value → undefined)
//   - optional-field preservation (explicit empty `[]` / `{}` is kept as
//     `[]` / `{}`, not collapsed to undefined — B1 equality contract)
//   - readonly native input handling (the return is a fresh mutable copy)
//   - invalid value outcomes (the canonical reason string)
import { describe, expect, it } from 'vitest';
import type { OvertureMcpServer } from '@overture/config';
import type {
  AgentMcpNormalizeHandler,
  AgentMcpNormalizeReason,
} from './types.js';
import {
  NORMALIZE_SHAPE_CONFLICT_REASONS,
  asRegistryNormalizeHandler,
  isRecord,
  isStringMap,
  normalized,
  normalizeOptionalArgs,
  normalizeOptionalEnv,
  normalizeOptionalHeaders,
  shapeConflict,
  validateOptionalStringArray,
  validateOptionalStringMap,
} from './normalize-mcp-config.js';

describe('NORMALIZE_SHAPE_CONFLICT_REASONS', () => {
  it('contains exactly nine canonical reason strings', () => {
    expect(NORMALIZE_SHAPE_CONFLICT_REASONS.size).toBe(9);
  });

  it.each([
    'Expected server entry to be an object.',
    'Stdio command is missing or empty.',
    'Remote url is missing or empty.',
    'Server declares both stdio command and remote url.',
    'Server declares neither stdio command nor remote url.',
    'Expected string array for args.',
    'Expected string map for env.',
    'Expected string map for headers.',
    'Unsupported MCP server transport type.',
  ] as const)('contains %s', (reason) => {
    expect(
      NORMALIZE_SHAPE_CONFLICT_REASONS.has(reason as AgentMcpNormalizeReason),
    ).toBe(true);
  });
});

describe('normalized()', () => {
  it('wraps a stdio server as a success result', () => {
    const server: OvertureMcpServer = { type: 'stdio', command: 'npx' };
    expect(normalized(server)).toEqual({ state: 'normalized', server });
  });

  it('wraps a remote server as a success result', () => {
    const server: OvertureMcpServer = {
      type: 'remote',
      url: 'https://mcp.example.com',
    };
    expect(normalized(server)).toEqual({ state: 'normalized', server });
  });
});

describe('shapeConflict()', () => {
  it('wraps a reason string in the shape-conflict arm', () => {
    expect(shapeConflict('Expected server entry to be an object.')).toEqual({
      state: 'shape-conflict',
      reason: 'Expected server entry to be an object.',
    });
  });
});

describe('asRegistryNormalizeHandler()', () => {
  it('adapts a typed normalizer to the unknown slot and forwards the input', () => {
    let received: unknown = null;
    const typed: AgentMcpNormalizeHandler<{ foo: string }> = (input) => {
      received = input;
      return {};
    };
    const adapted = asRegistryNormalizeHandler(typed);
    const input = { config: { foo: 'bar' }, nonEmpty: true };
    const result = adapted(input);
    expect(received).toEqual(input);
    expect(received).toBe(input);
    expect(result).toEqual({});
  });

  it('returns whatever the typed handler returns (success results)', () => {
    const server: OvertureMcpServer = { type: 'stdio', command: 'npx' };
    const typed: AgentMcpNormalizeHandler<unknown> = () => ({
      a: normalized(server),
    });
    const adapted = asRegistryNormalizeHandler(typed);
    expect(adapted({ config: null, nonEmpty: false })).toEqual({
      a: { state: 'normalized', server },
    });
  });

  it('returns whatever the typed handler returns (shape-conflict results)', () => {
    const typed: AgentMcpNormalizeHandler<unknown> = () => ({
      a: shapeConflict('Stdio command is missing or empty.'),
    });
    const adapted = asRegistryNormalizeHandler(typed);
    expect(adapted({ config: null, nonEmpty: false })).toEqual({
      a: {
        state: 'shape-conflict',
        reason: 'Stdio command is missing or empty.',
      },
    });
  });
});

describe('isRecord()', () => {
  it('returns true for plain objects (empty and populated)', () => {
    expect(isRecord({})).toBe(true);
    expect(isRecord({ a: 1 })).toBe(true);
    expect(isRecord({ a: 'b', c: 2 })).toBe(true);
  });

  it('returns false for null and undefined', () => {
    expect(isRecord(null)).toBe(false);
    expect(isRecord(undefined)).toBe(false);
  });

  it('returns false for primitives', () => {
    expect(isRecord('string')).toBe(false);
    expect(isRecord(42)).toBe(false);
    expect(isRecord(true)).toBe(false);
    expect(isRecord(false)).toBe(false);
  });

  it('returns false for arrays (empty and populated)', () => {
    expect(isRecord([])).toBe(false);
    expect(isRecord([1, 2, 3])).toBe(false);
  });
});

describe('isStringMap()', () => {
  it('returns true for empty objects', () => {
    expect(isStringMap({})).toBe(true);
  });

  it('returns true for objects whose every own value is a string', () => {
    expect(isStringMap({ a: 'b' })).toBe(true);
    expect(isStringMap({ a: 'b', c: 'd' })).toBe(true);
  });

  it('returns false when any own value is not a string', () => {
    expect(isStringMap({ a: 1 })).toBe(false);
    expect(isStringMap({ a: 'b', c: 2 })).toBe(false);
    expect(isStringMap({ a: null })).toBe(false);
    expect(isStringMap({ a: undefined })).toBe(false);
    expect(isStringMap({ a: { b: 'c' } })).toBe(false);
    expect(isStringMap({ a: ['b'] })).toBe(false);
  });

  it('returns false for non-object values', () => {
    expect(isStringMap(null)).toBe(false);
    expect(isStringMap(undefined)).toBe(false);
    expect(isStringMap([])).toBe(false);
    expect(isStringMap(['a', 'b'])).toBe(false);
    expect(isStringMap('foo')).toBe(false);
    expect(isStringMap(42)).toBe(false);
  });
});

describe('validateOptionalStringMap()', () => {
  it('returns undefined when the value is absent', () => {
    expect(validateOptionalStringMap(undefined, 'env')).toBeUndefined();
    expect(validateOptionalStringMap(undefined, 'headers')).toBeUndefined();
    expect(validateOptionalStringMap(undefined, 'environment')).toBeUndefined();
    expect(
      validateOptionalStringMap(undefined, 'http_headers'),
    ).toBeUndefined();
  });

  it('returns undefined for env-aliased valid string maps', () => {
    expect(validateOptionalStringMap({}, 'env')).toBeUndefined();
    expect(validateOptionalStringMap({ A: '1' }, 'env')).toBeUndefined();
    expect(
      validateOptionalStringMap({ A: '1' }, 'environment'),
    ).toBeUndefined();
  });

  it('returns the env reason for env-aliased invalid values', () => {
    expect(validateOptionalStringMap([], 'env')).toBe(
      'Expected string map for env.',
    );
    expect(validateOptionalStringMap('foo', 'env')).toBe(
      'Expected string map for env.',
    );
    expect(validateOptionalStringMap({ A: 1 }, 'env')).toBe(
      'Expected string map for env.',
    );
    expect(validateOptionalStringMap({ A: 1 }, 'environment')).toBe(
      'Expected string map for env.',
    );
  });

  it('returns undefined for headers-aliased valid string maps', () => {
    expect(validateOptionalStringMap({}, 'headers')).toBeUndefined();
    expect(validateOptionalStringMap({ A: '1' }, 'headers')).toBeUndefined();
    expect(
      validateOptionalStringMap({ A: '1' }, 'http_headers'),
    ).toBeUndefined();
  });

  it('returns the headers reason for headers-aliased invalid values', () => {
    expect(validateOptionalStringMap([], 'headers')).toBe(
      'Expected string map for headers.',
    );
    expect(validateOptionalStringMap({ A: 1 }, 'headers')).toBe(
      'Expected string map for headers.',
    );
    expect(validateOptionalStringMap({ A: 1 }, 'http_headers')).toBe(
      'Expected string map for headers.',
    );
  });

  it('returns undefined for unrecognized field names (the helper only knows env / headers)', () => {
    expect(validateOptionalStringMap([], 'somethingElse')).toBeUndefined();
    expect(validateOptionalStringMap({ A: 1 }, 'cwd')).toBeUndefined();
  });
});

describe('validateOptionalStringArray()', () => {
  it('returns undefined when the value is absent', () => {
    expect(validateOptionalStringArray(undefined)).toBeUndefined();
  });

  it('returns undefined for empty arrays (empty is valid)', () => {
    expect(validateOptionalStringArray([])).toBeUndefined();
  });

  it('returns undefined for populated string arrays', () => {
    expect(validateOptionalStringArray(['a'])).toBeUndefined();
    expect(validateOptionalStringArray(['a', 'b', 'c'])).toBeUndefined();
  });

  it('returns the args reason for non-array values', () => {
    expect(validateOptionalStringArray('foo')).toBe(
      'Expected string array for args.',
    );
    expect(validateOptionalStringArray({})).toBe(
      'Expected string array for args.',
    );
    expect(validateOptionalStringArray(null)).toBe(
      'Expected string array for args.',
    );
  });

  it('returns the args reason when any array entry is not a string', () => {
    expect(validateOptionalStringArray([1, 2])).toBe(
      'Expected string array for args.',
    );
    expect(validateOptionalStringArray(['a', 1])).toBe(
      'Expected string array for args.',
    );
    expect(validateOptionalStringArray(['a', null])).toBe(
      'Expected string array for args.',
    );
  });
});

describe('normalizeOptionalArgs()', () => {
  it('returns undefined when the value is absent', () => {
    expect(normalizeOptionalArgs(undefined)).toBeUndefined();
  });

  it('returns a fresh mutable string[] for valid string arrays', () => {
    const out = normalizeOptionalArgs(['-y', 'pkg']);
    expect(out).toEqual(['-y', 'pkg']);
    // The return is a real string[] (not a readonly tuple).
    expect(Array.isArray(out)).toBe(true);
    if (Array.isArray(out)) {
      out.push('extra');
      expect(out).toEqual(['-y', 'pkg', 'extra']);
    }
  });

  it('preserves empty arrays as [] (does not collapse to undefined)', () => {
    const out = normalizeOptionalArgs([]);
    expect(out).toEqual([]);
    expect(out).not.toBeUndefined();
  });

  it('returns a fresh copy, not the same reference (readonly input handling)', () => {
    const input: readonly string[] = ['-y', 'pkg'] as const;
    const out = normalizeOptionalArgs(input);
    expect(out).toEqual(['-y', 'pkg']);
    if (Array.isArray(out)) {
      out.push('extra');
      expect(input).toEqual(['-y', 'pkg']);
    }
  });

  it('does not trim whitespace-only strings (byte-exact equality, B1 contract)', () => {
    expect(normalizeOptionalArgs(['  '])).toEqual(['  ']);
    expect(normalizeOptionalArgs(['  ', 'a'])).toEqual(['  ', 'a']);
  });

  it('returns the args reason for non-array values', () => {
    expect(normalizeOptionalArgs('foo')).toBe(
      'Expected string array for args.',
    );
    expect(normalizeOptionalArgs({})).toBe('Expected string array for args.');
    expect(normalizeOptionalArgs(null)).toBe('Expected string array for args.');
  });

  it('returns the args reason when any array entry is not a string', () => {
    expect(normalizeOptionalArgs([1, 2])).toBe(
      'Expected string array for args.',
    );
    expect(normalizeOptionalArgs(['a', 1])).toBe(
      'Expected string array for args.',
    );
  });
});

describe('normalizeOptionalEnv()', () => {
  it('returns undefined when the value is absent', () => {
    expect(normalizeOptionalEnv(undefined)).toBeUndefined();
  });

  it('returns a fresh mutable map for valid string maps', () => {
    const out = normalizeOptionalEnv({ A: '1' });
    expect(out).toEqual({ A: '1' });
    if (out && typeof out === 'object') {
      out['B'] = '2';
      expect(out).toEqual({ A: '1', B: '2' });
    }
  });

  it('preserves empty maps as {} (does not collapse to undefined)', () => {
    const out = normalizeOptionalEnv({});
    expect(out).toEqual({});
    expect(out).not.toBeUndefined();
  });

  it('returns a fresh copy, not the same reference', () => {
    const input = { A: '1' };
    const out = normalizeOptionalEnv(input);
    expect(out).not.toBe(input);
    expect(out).toEqual(input);
  });

  it('does not trim whitespace-only string values (byte-exact equality)', () => {
    expect(normalizeOptionalEnv({ K: '  ' })).toEqual({ K: '  ' });
  });

  it('returns the env reason for non-map values', () => {
    expect(normalizeOptionalEnv([])).toBe('Expected string map for env.');
    expect(normalizeOptionalEnv('foo')).toBe('Expected string map for env.');
    expect(normalizeOptionalEnv(null)).toBe('Expected string map for env.');
  });

  it('returns the env reason when any value is not a string', () => {
    expect(normalizeOptionalEnv({ A: 1 })).toBe('Expected string map for env.');
    expect(normalizeOptionalEnv({ A: '1', B: 2 })).toBe(
      'Expected string map for env.',
    );
  });
});

describe('normalizeOptionalHeaders()', () => {
  it('returns undefined when the value is absent', () => {
    expect(normalizeOptionalHeaders(undefined)).toBeUndefined();
  });

  it('returns a fresh mutable map for valid string maps', () => {
    const out = normalizeOptionalHeaders({ Authorization: 'token' });
    expect(out).toEqual({ Authorization: 'token' });
  });

  it('preserves empty maps as {} (does not collapse to undefined)', () => {
    const out = normalizeOptionalHeaders({});
    expect(out).toEqual({});
    expect(out).not.toBeUndefined();
  });

  it('returns a fresh copy, not the same reference', () => {
    const input = { Authorization: 'token' };
    const out = normalizeOptionalHeaders(input);
    expect(out).not.toBe(input);
    expect(out).toEqual(input);
  });

  it('does not trim whitespace-only string values (byte-exact equality)', () => {
    expect(normalizeOptionalHeaders({ K: '  ' })).toEqual({ K: '  ' });
  });

  it('returns the headers reason for non-map values', () => {
    expect(normalizeOptionalHeaders([])).toBe(
      'Expected string map for headers.',
    );
    expect(normalizeOptionalHeaders('foo')).toBe(
      'Expected string map for headers.',
    );
    expect(normalizeOptionalHeaders(null)).toBe(
      'Expected string map for headers.',
    );
  });

  it('returns the headers reason when any value is not a string', () => {
    expect(normalizeOptionalHeaders({ A: 1 })).toBe(
      'Expected string map for headers.',
    );
  });
});
