/**
 * Static aggregate of every MCP-capable agent supported by overture.
 *
 * New agents are added by creating `apps/cli/src/platforms/agents/<id>.ts`
 * and inserting the import + entry in the canonical order below. Detection
 * and output code consume only this aggregate; per-agent files are not
 * imported anywhere else.
 *
 * Order matters: the legacy `expectedIds` assertion in registry.spec.ts
 * pins the index of every entry. Reordering is a breaking change for any
 * consumer that depends on positional indices.
 */
import type { AgentDefinition } from './types.js';
export type { AgentDefinition } from './types.js';

import { claudeCode } from './claude-code.js';

import { claudeDesktop } from './claude-desktop.js';
import { opencode } from './opencode.js';
import { githubCopilotVscode } from './github-copilot-vscode.js';
import { githubCopilotCli } from './github-copilot-cli.js';
import { githubCopilotCloudAgent } from './github-copilot-cloud-agent.js';
import { cursor } from './cursor.js';
import { windsurf } from './windsurf.js';
import { cline } from './cline.js';
import { rooCode } from './roo-code.js';
// `continue` is a JS reserved keyword. The per-agent file exports
// `continueDef`; rename on import to keep the canonical id usable in
// the aggregate below.
import { continueDef as continueAgent } from './continue.js';
import { zed } from './zed.js';
import { openaiCodex } from './openai-codex.js';
import { aider } from './aider.js';

export const agentRegistry: readonly AgentDefinition[] = [
  claudeCode,
  claudeDesktop,
  opencode,
  githubCopilotVscode,
  githubCopilotCli,
  githubCopilotCloudAgent,
  cursor,
  windsurf,
  cline,
  rooCode,
  continueAgent,
  zed,
  openaiCodex,
  aider,
] as const;
