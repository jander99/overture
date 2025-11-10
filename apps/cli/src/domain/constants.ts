import * as path from 'path';
import * as os from 'os';

export const OVERTURE_DIR = '.overture';
export const CONFIG_FILE = 'config.yaml';
export const CONFIG_PATH = path.join(OVERTURE_DIR, CONFIG_FILE);

export const MCP_JSON_FILE = '.mcp.json';
export const CLAUDE_MD_FILE = 'CLAUDE.md';

export const GLOBAL_CONFIG_DIR = path.join(
  os.homedir(),
  '.config',
  'overture'
);

export const DEFAULT_CONFIG_VERSION = '1.0';

export const PROJECT_TYPES = [
  'python-backend',
  'typescript-frontend',
  'node-backend',
  'fullstack',
  'data-science',
  'kubernetes',
] as const;

// CLAUDE.md managed section markers (follows Nx MCP pattern)
export const CLAUDE_MD_START_MARKER = '<!-- overture configuration start-->';
export const CLAUDE_MD_END_MARKER = '<!-- overture configuration end-->';
export const CLAUDE_MD_USER_INSTRUCTION =
  '<!-- Leave the start & end comments to automatically receive updates. -->';
