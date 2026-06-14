// Deep import from `zod/v3` (the ESM subpath) instead of the package
// root. The package root re-exports through a UMD `index.cjs` that
// uses relative `require()` calls, which break once esbuild inlines
// the package into the CJS bundle at `apps/cli/dist/main.js`. Mirrors
// the jsonc-parser deep-import pattern in the repo's AGENTS.md.
import { z } from 'zod/v3';

/**
 * Source coordinate for an installed skill, matching the `npx skills add`
 * CLI grammar: `owner/repo`. We deliberately disallow full URLs and local
 * paths here because overture's first-class skill install flow is the
 * `npx skills add` shim; URL/path installs are out of scope for v1.
 */
const OwnerRepo = z
  .string()
  .regex(
    /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/,
    "source must be in 'owner/repo' form (e.g. 'vercel-labs/agent-skills')",
  );

/**
 * A single MCP server entry. The discriminator is `type`:
 * - `stdio` requires `command`
 * - `remote` requires `url`
 *
 * The union narrows correctly so the per-agent write layer can rely on the
 * type system to enforce which fields are present.
 */
const StdioMcpServer = z
  .object({
    type: z.literal('stdio'),
    command: z.string().min(1),
    args: z.array(z.string()).optional(),
    env: z.record(z.string(), z.string()).optional(),
  })
  .strict();

const RemoteMcpServer = z
  .object({
    type: z.literal('remote'),
    url: z.string().url(),
    headers: z.record(z.string(), z.string()).optional(),
  })
  .strict();

const McpServer = z.discriminatedUnion('type', [
  StdioMcpServer,
  RemoteMcpServer,
]);

const McpServerMap = z.record(z.string(), McpServer);

const SyncConfig = z
  .object({
    /**
     * Target platform ids to sync the global MCP server set to. Strings
     * here are intentionally NOT validated against the agent registry — the
     * registry may grow and we want the config to be forward-compatible.
     */
    targets: z.array(z.string().min(1)),
    /**
     * Per-profile, per-target exclusions are out of scope for v1 (we
     * dropped the per-agent override section during design). This field
     * remains a flat list of server names to skip everywhere.
     */
    disabledServers: z.array(z.string().min(1)).default([]),
  })
  .strict();

const SkillInstallEntry = z
  .object({
    source: OwnerRepo,
    /**
     * Explicit list of skills to install from the source. Required and
     * non-empty: the skills CLI's "install everything" mode is too broad
     * to be a stable configuration target.
     */
    include: z.array(z.string().min(1)).min(1),
  })
  .strict();

const Profile = z
  .object({
    mcpServers: McpServerMap,
    sync: SyncConfig,
    skills: z.array(SkillInstallEntry).default([]),
  })
  .strict();

const Settings = z
  .object({
    defaultProfile: z.string().min(1).default('default'),
    dryRunByDefault: z.boolean().default(true),
    backupBeforeWrite: z.boolean().default(true),
    conflictPolicy: z.enum(['refuse', 'prompt', 'overwrite']).default('refuse'),
  })
  .strict()
  .partial()
  .default({});

/**
 * Top-level Zod schema for the `overture.jsonc` config file. All fields
 * are validated; unknown keys are rejected. Future schema versions should
 * live in `OvertureConfigV2Schema` etc. and be dispatched on `version`.
 */
export const OvertureConfigSchema = z
  .object({
    $schema: z.string().optional(),
    version: z.literal(1),
    settings: Settings,
    profiles: z
      .object({
        default: Profile,
      })
      .catchall(Profile)
      .refine(
        (profiles) => Object.keys(profiles).length > 0,
        'at least one profile is required',
      ),
  })
  .strict();

/** Static TypeScript type derived from the Zod schema. */
export type OvertureConfig = z.infer<typeof OvertureConfigSchema>;

/** Single profile shape, derived. */
export type OvertureProfile = z.infer<typeof Profile>;

/** Settings block shape, derived. */
export type OvertureSettings = z.infer<typeof Settings>;

/** Sync block shape, derived. */
export type OvertureSyncConfig = z.infer<typeof SyncConfig>;

/** Single MCP server entry (the union), derived. */
export type OvertureMcpServer = z.infer<typeof McpServer>;

/** Skills install entry, derived. */
export type OvertureSkillInstall = z.infer<typeof SkillInstallEntry>;

/**
 * Parse-and-throw variant. Use only when you know the input shape comes
 * from a trusted local file. For external/untrusted input, prefer
 * `OvertureConfigSchema.safeParse`.
 */
export function parseOvertureConfig(input: unknown): OvertureConfig {
  const result = OvertureConfigSchema.safeParse(input);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid overture config:\n${issues}`);
  }
  return result.data;
}
