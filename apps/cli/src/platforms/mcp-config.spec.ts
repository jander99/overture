import { describe, it, expect } from 'vitest';
import { parseMcpConfig } from './mcp-config.js';

describe('parseMcpConfig', () => {
  it('JSON: configured true when mcpServers is non-empty object', () => {
    const result = parseMcpConfig({
      contents: '{ "mcpServers": { "x": { "command": "y" } } }',
      format: 'json',
      topLevelKey: 'mcpServers',
    });
    expect(result.configured).toBe(true);
    expect(result.parsed).toBe(true);
  });

  it('JSON: configured false when mcpServers is empty object', () => {
    const result = parseMcpConfig({
      contents: '{ "mcpServers": {} }',
      format: 'json',
      topLevelKey: 'mcpServers',
    });
    expect(result.configured).toBe(false);
    expect(result.parsed).toBe(true);
  });

  it('JSONC: tolerates comments and trailing commas', () => {
    const result = parseMcpConfig({
      contents: '{ /* c */ "mcpServers": { "x": {}, }, }',
      format: 'jsonc',
      topLevelKey: 'mcpServers',
    });
    expect(result.configured).toBe(true);
    expect(result.parsed).toBe(true);
  });

  it('JSON: missing key returns configured false, parsed true', () => {
    const result = parseMcpConfig({
      contents: '{}',
      format: 'json',
      topLevelKey: 'nonexistent',
    });
    expect(result.configured).toBe(false);
    expect(result.parsed).toBe(true);
  });

  it('JSON: invalid syntax returns configured false, parsed false, parseError set', () => {
    const result = parseMcpConfig({
      contents: '{ "mcpServers": ',
      format: 'json',
      topLevelKey: 'mcpServers',
    });
    expect(result.configured).toBe(false);
    expect(result.parsed).toBe(false);
    expect(result.parseError).toBeTruthy();
  });

  it('JSON: BOM-prefixed content parses', () => {
    const result = parseMcpConfig({
      contents: '\uFEFF{ "mcp": { "a": {} } }',
      format: 'json',
      topLevelKey: 'mcp',
    });
    expect(result.configured).toBe(true);
    expect(result.parsed).toBe(true);
  });

  it('TOML: configured true when mcp_servers table is non-empty', () => {
    const result = parseMcpConfig({
      contents: '[mcp_servers.x]\ncommand = "y"',
      format: 'toml',
      topLevelKey: 'mcp_servers',
    });
    expect(result.configured).toBe(true);
    expect(result.parsed).toBe(true);
  });

  it('TOML: configured false when mcp_servers table is empty', () => {
    const result = parseMcpConfig({
      contents: '[mcp_servers]\n',
      format: 'toml',
      topLevelKey: 'mcp_servers',
    });
    expect(result.configured).toBe(false);
    expect(result.parsed).toBe(true);
  });

  it('TOML: missing key returns configured false, parsed true', () => {
    const result = parseMcpConfig({
      contents: '',
      format: 'toml',
      topLevelKey: 'mcp_servers',
    });
    expect(result.configured).toBe(false);
    expect(result.parsed).toBe(true);
  });

  it('TOML: invalid syntax returns configured false, parsed false, parseError set', () => {
    const result = parseMcpConfig({
      contents: '[[[',
      format: 'toml',
      topLevelKey: 'mcp_servers',
    });
    expect(result.configured).toBe(false);
    expect(result.parsed).toBe(false);
    expect(result.parseError).toBeTruthy();
  });

  it('TOML: BOM-prefixed content parses', () => {
    const result = parseMcpConfig({
      contents: '\uFEFF[mcp_servers.x]\ncommand = "y"',
      format: 'toml',
      topLevelKey: 'mcp_servers',
    });
    expect(result.configured).toBe(true);
    expect(result.parsed).toBe(true);
  });

  it('Empty contents returns configured false, parsed true', () => {
    const result = parseMcpConfig({
      contents: '',
      format: 'json',
      topLevelKey: 'mcpServers',
    });
    expect(result.configured).toBe(false);
    expect(result.parsed).toBe(true);
  });

  it('Unsupported format returns parsed false, parseError set', () => {
    const result = parseMcpConfig({
      contents: 'anything',
      format: 'yaml',
      topLevelKey: 'mcpServers',
    });
    expect(result.parsed).toBe(false);
    expect(result.parseError).toBe('unsupported format');
  });
});
