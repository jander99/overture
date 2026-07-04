#!/usr/bin/env node
// verify-package.mjs
//
// Local npm-pack verification for the @jander99/overture CLI.
//
// Builds the CLI, packs the tarball with `npm pack`, asserts the tarball
// contents match the expected golden list (in `package-expected-files.txt`),
// then smoke-tests the package by running `npm install` in a clean temp
// directory (mirroring what `npx @jander99/overture` and `npm install -g
// @jander99/overture` do for real users) and exercising the installed CLI.
//
// Run from the repo root with `node apps/cli/scripts/verify-package.mjs`.
// Exits non-zero on any failure. Does NOT publish.

import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  statSync,
  chmodSync,
  writeFileSync,
} from 'node:fs';

import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..', '..', '..');
const cliDir = join(repoRoot, 'apps', 'cli');
const goldenListPath = join(__dirname, 'package-expected-files.txt');

function logStep(name) {
  console.log(`\n=== ${name} ===`);
}

function fail(msg) {
  console.error(`FAIL: ${msg}`);
  process.exit(1);
}

function run(cmd, args, opts = {}) {
  console.log(`$ ${cmd} ${args.join(' ')}`);
  const res = spawnSync(cmd, args, { stdio: 'inherit', ...opts });
  if (res.status !== 0) {
    fail(`${cmd} exited with status ${res.status}`);
  }
}

function spawnWithEnv(args, env, opts = {}) {
  return spawnSync(process.execPath, args, {
    encoding: 'utf8',
    env,
    ...opts,
  });
}

function resolvePathsForEnv(home, xdgConfigHome) {
  return {
    configFile: join(
      xdgConfigHome || join(home, '.config'),
      'overture',
      'overture.jsonc',
    ),
  };
}

logStep('Step 1 — Build');
rmSync(join(cliDir, 'dist'), { recursive: true, force: true });
run('yarn', ['nx', 'build', '@jander99/overture', '--skip-nx-cache'], {
  cwd: repoRoot,
});

const mainJs = join(cliDir, 'dist', 'main.js');
if (!statSync(mainJs, { throwIfNoEntry: false })) {
  fail(`expected dist/main.js after build, not found at ${mainJs}`);
}
console.log(`dist/main.js: ${statSync(mainJs).size} bytes`);

logStep('Step 2 — Pack');
const packTmp = mkdtempSync('/tmp/overture-verify-');
run('npm', ['pack', '--pack-destination', packTmp], { cwd: cliDir });
const { readdirSync } = await import('node:fs');
const builtTgz = readdirSync(packTmp).find((f) => f.endsWith('.tgz'));
if (!builtTgz) {
  fail('no .tgz produced by npm pack');
}
const tgz = join(packTmp, builtTgz);
console.log(`Tarball: ${tgz} (${statSync(tgz).size} bytes)`);

logStep('Step 3 — Verify golden file list');
const expected = readFileSync(goldenListPath, 'utf8')
  .split('\n')
  .map((l) => l.trim())
  .filter((l) => l && !l.startsWith('#'));
const actualRaw = execFileSync('tar', ['-tzf', tgz]).toString();
const actual = actualRaw.split('\n').filter(Boolean);

// MUST CONTAIN
const missing = expected.filter((e) => !actual.includes(e));
if (missing.length > 0) {
  fail(`tarball missing required entries:\n  ${missing.join('\n  ')}`);
}
console.log(`Required entries present (${expected.length}): PASS`);

// MUST NOT CONTAIN
const forbiddenPatterns = [
  /^package\/node_modules\//,
  /^package\/.mcp\.json$/,
  /^package\/.gitignore$/,
  /^package\/nx\.json$/,
  /^package\/tsconfig[^/]*\.json$/,
  /^package\/src\//,
  /(^|\/)[\w-]+\.spec\.ts$/,
  /(^|\/)[\w-]+\.test\.ts$/,
];
const forbidden = actual.filter((entry) =>
  forbiddenPatterns.some((re) => re.test(entry)),
);
if (forbidden.length > 0) {
  fail(
    `tarball contains forbidden entries:\n  ${forbidden.slice(0, 10).join('\n  ')}`,
  );
}
console.log(`No forbidden entries: PASS`);

logStep('Step 4 — Install + smoke from clean temp dir (simulates `npx`)');
const cleanTmp = mkdtempSync('/tmp/overture-verify-clean-');
// `npm install` puts the package and its runtime dependencies in
// `node_modules/@jander99/overture/`, which mirrors what `npx
// @jander99/overture` and `npm install -g @jander99/overture` do for
// real users. Without this, runtime deps like `smol-toml` (declared
// in `apps/cli/package.json` `dependencies`) would be missing.
run('npm', ['install', '--silent', '--no-audit', '--no-fund', tgz], {
  cwd: cleanTmp,
});

const distMain = join(
  cleanTmp,
  'node_modules',
  '@jander99',
  'overture',
  'dist',
  'main.js',
);
run('node', [distMain, '--help']);

// detect --json smoke: extract JSON via pipe
const jsonResult = spawnSync('node', [distMain, 'detect', '--json'], {
  encoding: 'utf8',
});
if (jsonResult.status !== 0) {
  fail(`detect --json exited ${jsonResult.status}: ${jsonResult.stderr}`);
}
try {
  const parsed = JSON.parse(jsonResult.stdout);
  // The full registry is always emitted; on a clean runner every
  // entry reports `installed: false`. Asserting `length > 0` would
  // fail in CI, which runs on a clean machine with no pre-installed
  // agents.
  if (!Array.isArray(parsed.platforms) || parsed.platforms.length !== 4) {
    fail(
      `detect --json produced ${parsed.platforms?.length ?? 0} platforms;
  expected 4`,
    );
  }
  for (const p of parsed.platforms) {
    if (p.parseError) {
      fail(`${p.id} has parseError: ${p.parseError}`);
    }
  }
  const installed = parsed.platforms.filter((p) => p.installed).length;
  console.log(
    `detect --json: ${parsed.platforms.length} platforms (${installed} installed on this host)`,
  );
} catch (err) {
  fail(`detect --json output is not valid JSON: ${err.message}`);
}

// scan --json smoke: assert the C1 envelope shape and a non-error exit
// code. C1 accepts exit codes 0 (clean scan) and 1 (blocking state —
// invalid-profile or hard-refuse). Exit code 2 is reserved for usage
// errors and pre-model orchestration failures; if we see 2 here, the
// installed package is broken.
const scanResult = spawnSync('node', [distMain, 'scan', '--json'], {
  encoding: 'utf8',
});
if (scanResult.status !== 0 && scanResult.status !== 1) {
  fail(
    `scan --json exited ${scanResult.status} (expected 0 or 1): ${scanResult.stderr}`,
  );
}
try {
  const scan = JSON.parse(scanResult.stdout);
  const topKeys = Object.keys(scan).sort();
  const expectedTopKeys = ['conflicts', 'matrix'];
  if (
    topKeys.length !== expectedTopKeys.length ||
    !expectedTopKeys.every((k) => topKeys.includes(k))
  ) {
    fail(
      `scan --json top-level keys are [${topKeys.join(', ')}]; expected exactly [${expectedTopKeys.join(', ')}]`,
    );
  }
  const matrixKeys = Object.keys(scan.matrix).sort();
  const expectedMatrixKeys = [
    'agents',
    'canonicalIntent',
    'canonicalProfileName',
    'canonicalState',
    'rows',
  ];
  if (
    matrixKeys.length !== expectedMatrixKeys.length ||
    !expectedMatrixKeys.every((k) => matrixKeys.includes(k))
  ) {
    fail(
      `scan --json matrix keys are [${matrixKeys.join(', ')}]; expected exactly [${expectedMatrixKeys.join(', ')}]`,
    );
  }
  const conflictsKeys = Object.keys(scan.conflicts).sort();
  const expectedConflictsKeys = ['hardRefuses', 'pickable'];
  if (
    conflictsKeys.length !== expectedConflictsKeys.length ||
    !expectedConflictsKeys.every((k) => conflictsKeys.includes(k))
  ) {
    fail(
      `scan --json conflicts keys are [${conflictsKeys.join(', ')}]; expected exactly [${expectedConflictsKeys.join(', ')}]`,
    );
  }
  console.log(
    `scan --json: exit=${scanResult.status} matrix.agents=${scan.matrix.agents.length} pickable=${scan.conflicts.pickable.length} hardRefuses=${scan.conflicts.hardRefuses.length}: PASS`,
  );
} catch (err) {
  fail(`scan --json output is not valid JSON: ${err.message}`);
}

// scan smoke: assert the human C2 report is present in the installed
// package, accepts the blocking exit code, and does not leak JSON-only
// fragments. Exit code 2 still means the installed package is broken.
const scanHumanResult = spawnSync('node', [distMain, 'scan'], {
  encoding: 'utf8',
});
if (scanHumanResult.status !== 0 && scanHumanResult.status !== 1) {
  fail(
    `scan exited ${scanHumanResult.status} (expected 0 or 1): ${scanHumanResult.stderr}`,
  );
}
const humanHeadings = [
  'Agents',
  'Aligned servers',
  'Missing from agents',
  'Agent-only servers',
  'Pickable conflicts',
  'Hard refuses',
  'Parse errors',
];
const missingHeadings = humanHeadings.filter(
  (heading) => !scanHumanResult.stdout.includes(heading),
);
if (missingHeadings.length > 0) {
  fail(
    `scan output missing headings: ${missingHeadings.join(', ')}
stdout:
${scanHumanResult.stdout}`,
  );
}
const forbiddenFragments = ['"matrix"', '"canonicalServer"', '"agentServer"'];
const leakedFragments = forbiddenFragments.filter((fragment) =>
  scanHumanResult.stdout.includes(fragment),
);
if (leakedFragments.length > 0) {
  fail(
    `scan output contains JSON fragments: ${leakedFragments.join(', ')}
stdout:
${scanHumanResult.stdout}`,
  );
}
console.log(
  `scan: exit=${scanHumanResult.status} sections=${humanHeadings.length} jsonFragments=0: PASS`,
);

logStep('Bootstrap smoke tests');
const bootstrapHome = mkdtempSync('/tmp/overture-verify-bootstrap-home-');
const bootstrapXdg = mkdtempSync('/tmp/overture-verify-bootstrap-xdg-');
const bootstrapPath = mkdtempSync('/tmp/overture-verify-bootstrap-path-');
const bootstrapEnv = {
  ...process.env,
  HOME: bootstrapHome,
  XDG_CONFIG_HOME: bootstrapXdg,
  PATH: bootstrapPath,
};
const bootstrapPaths = resolvePathsForEnv(bootstrapHome, bootstrapXdg);
const bootstrapAgentDir = join(bootstrapXdg, 'opencode');
const bootstrapAgentConfig = join(bootstrapAgentDir, 'opencode.jsonc');
mkdirSync(bootstrapAgentDir, { recursive: true });
const bootstrapAgentConfigBefore = `{
  // package smoke fixture
  "mcp": {
    "filesystem": {
      "type": "local",
      "command": ["npx", "-y", "@modelcontextprotocol/server-filesystem", "/home"],
      "environment": { "NODE_ENV": "production" }
    }
  }
}`;
writeFileSync(bootstrapAgentConfig, bootstrapAgentConfigBefore);
const bootstrapAgentBeforeStat = statSync(bootstrapAgentConfig);
// Seed a fake opencode binary on the bootstrap PATH so the CLI marks
// the opencode agent as installed and can read its config (otherwise
// the plan is blocked by 'no-readable-agents').
const bootstrapOpencodeBin = join(bootstrapPath, 'opencode');
writeFileSync(bootstrapOpencodeBin, '#!/bin/sh\nexit 0\n');
chmodSync(bootstrapOpencodeBin, 0o755);

const bootstrapBin = [distMain];

const bootstrapJsonResult = spawnWithEnv(
  [...bootstrapBin, 'bootstrap', '--dry-run', '--json'],
  bootstrapEnv,
);
if (bootstrapJsonResult.status !== 0 && bootstrapJsonResult.status !== 1) {
  fail(
    `bootstrap --dry-run --json exited ${bootstrapJsonResult.status} (expected 0 or 1): ${bootstrapJsonResult.stderr}`,
  );
}
try {
  const parsed = JSON.parse(bootstrapJsonResult.stdout);
  const topKeys = Object.keys(parsed).sort();
  const expectedTopKeys = ['blockers', 'conflicts', 'proposal'];
  if (
    topKeys.length !== expectedTopKeys.length ||
    !expectedTopKeys.every((k) => topKeys.includes(k))
  ) {
    fail(
      `bootstrap --dry-run --json top-level keys are [${topKeys.join(', ')}]; expected exactly [${expectedTopKeys.join(', ')}]\nstdout:\n${bootstrapJsonResult.stdout}\nstderr:\n${bootstrapJsonResult.stderr}`,
    );
  }
  if (
    typeof parsed.proposal?.configPath !== 'string' ||
    parsed.proposal.configPath.length === 0
  ) {
    fail(
      `bootstrap --dry-run --json missing configPath\nstdout:\n${bootstrapJsonResult.stdout}\nstderr:\n${bootstrapJsonResult.stderr}`,
    );
  }
  if (statSync(bootstrapPaths.configFile, { throwIfNoEntry: false })) {
    fail(
      `bootstrap --dry-run --json unexpectedly created ${bootstrapPaths.configFile}`,
    );
  }
  const bootstrapAgentAfterStat = statSync(bootstrapAgentConfig);
  if (
    bootstrapAgentAfterStat.size !== bootstrapAgentBeforeStat.size ||
    bootstrapAgentAfterStat.mtimeMs !== bootstrapAgentBeforeStat.mtimeMs
  ) {
    fail(
      `bootstrap --dry-run --json modified seeded agent config\nbefore: size=${bootstrapAgentBeforeStat.size} mtime=${bootstrapAgentBeforeStat.mtimeMs}\nafter: size=${bootstrapAgentAfterStat.size} mtime=${bootstrapAgentAfterStat.mtimeMs}`,
    );
  }
  console.log(
    `bootstrap --dry-run --json: exit=${bootstrapJsonResult.status} keys=${topKeys.join(', ')} noWrite=PASS`,
  );
} catch (err) {
  fail(
    `bootstrap --dry-run --json output is not valid JSON: ${err.message}\nstdout:\n${bootstrapJsonResult.stdout}\nstderr:\n${bootstrapJsonResult.stderr}`,
  );
}

const bootstrapHumanResult = spawnWithEnv(
  [...bootstrapBin, 'bootstrap', '--dry-run'],
  bootstrapEnv,
);
if (bootstrapHumanResult.status !== 0 && bootstrapHumanResult.status !== 1) {
  fail(
    `bootstrap --dry-run exited ${bootstrapHumanResult.status} (expected 0 or 1): ${bootstrapHumanResult.stderr}`,
  );
}
const bootstrapHumanHeadings = [
  'Bootstrap proposal (dry-run)',
  'Config path:',
  'Proposal status:',
  'Target agents:',
  'Adopted servers:',
  'Pickable conflicts:',
  'Hard refuses:',
  'Blockers:',
  'No files were written.',
  'Run "overture bootstrap --dry-run --json" for machine-readable details.',
];
const missingBootstrapHeadings = bootstrapHumanHeadings.filter(
  (heading) => !bootstrapHumanResult.stdout.includes(heading),
);
if (missingBootstrapHeadings.length > 0) {
  fail(
    `bootstrap --dry-run missing headings: ${missingBootstrapHeadings.join(', ')}\nstdout:\n${bootstrapHumanResult.stdout}\nstderr:\n${bootstrapHumanResult.stderr}`,
  );
}
const forbiddenBootstrapFragments = [
  '"matrix"',
  '"canonicalServer"',
  '"agentServer"',
  '"$schema"',
];
const leakedBootstrapFragments = forbiddenBootstrapFragments.filter(
  (fragment) => bootstrapHumanResult.stdout.includes(fragment),
);
if (leakedBootstrapFragments.length > 0) {
  fail(
    `bootstrap --dry-run contains forbidden fragments: ${leakedBootstrapFragments.join(', ')}\nstdout:\n${bootstrapHumanResult.stdout}`,
  );
}
if (/\x1b\[[0-9;]*m/.test(bootstrapHumanResult.stdout)) {
  fail(
    `bootstrap --dry-run emitted ANSI escape codes\nstdout:\n${bootstrapHumanResult.stdout}`,
  );
}
if (statSync(bootstrapPaths.configFile, { throwIfNoEntry: false })) {
  fail(`bootstrap --dry-run unexpectedly created ${bootstrapPaths.configFile}`);
}
console.log(
  `bootstrap --dry-run: exit=${bootstrapHumanResult.status} headings=${bootstrapHumanHeadings.length} noWrite=PASS`,
);
const bootstrapInteractiveResult = spawnWithEnv(
  [...bootstrapBin, 'bootstrap'],
  bootstrapEnv,
);
if (bootstrapInteractiveResult.status !== 0) {
  fail(
    `bootstrap (no flags) exited ${bootstrapInteractiveResult.status} (expected 0): stderr:\n${bootstrapInteractiveResult.stderr}\nstdout:\n${bootstrapInteractiveResult.stdout}`,
  );
}
if (!bootstrapInteractiveResult.stdout.includes('Bootstrap proposal')) {
  fail(
    `bootstrap (no flags) stdout missing "Bootstrap proposal" heading\nstdout:\n${bootstrapInteractiveResult.stdout}`,
  );
}
const bootstrapWroteFragment = `Wrote config: ${bootstrapPaths.configFile}`;
if (!bootstrapInteractiveResult.stdout.includes(bootstrapWroteFragment)) {
  fail(
    `bootstrap (no flags) stdout missing "${bootstrapWroteFragment}"\nstdout:\n${bootstrapInteractiveResult.stdout}`,
  );
}
if (!statSync(bootstrapPaths.configFile, { throwIfNoEntry: false })) {
  fail(
    `bootstrap (no flags) expected to write ${bootstrapPaths.configFile}, but it was not created`,
  );
}
// The writer emits JSONC with `//` comments. Use the CJS jsonc-parser
// via createRequire (the ESM build has broken relative imports).
import { createRequire } from 'node:module';
const requireVerify = createRequire(import.meta.url);
const { parse: parseJsoncVerify } = requireVerify('jsonc-parser');
const bootstrapWrittenConfig = parseJsoncVerify(
  readFileSync(bootstrapPaths.configFile, 'utf8'),
  [],
  { allowTrailingComma: true, disallowComments: false },
);

if (
  typeof bootstrapWrittenConfig.version !== 'number' ||
  typeof bootstrapWrittenConfig.settings !== 'object' ||
  bootstrapWrittenConfig.settings === null ||
  typeof bootstrapWrittenConfig.profiles !== 'object' ||
  bootstrapWrittenConfig.profiles === null ||
  typeof bootstrapWrittenConfig.profiles.default !== 'object' ||
  bootstrapWrittenConfig.profiles.default === null ||
  typeof bootstrapWrittenConfig.profiles.default.mcpServers !== 'object' ||
  bootstrapWrittenConfig.profiles.default.mcpServers === null
) {
  fail(
    `bootstrap (no flags) wrote config missing required keys (version, settings, profiles.default.mcpServers)\nconfig:\n${JSON.stringify(bootstrapWrittenConfig, null, 2)}`,
  );
}
const reservedStderrFragments = [
  'BOOTSTRAP_RESERVED_MESSAGE',
  'Bootstrap writes are not implemented yet',
];
const leakedReservedStderrFragments = reservedStderrFragments.filter(
  (fragment) => bootstrapInteractiveResult.stderr.includes(fragment),
);
if (leakedReservedStderrFragments.length > 0) {
  fail(
    `bootstrap (no flags) stderr contains reserved fragments: ${leakedReservedStderrFragments.join(', ')}\nstderr:\n${bootstrapInteractiveResult.stderr}`,
  );
}
const forbiddenStdoutFragments = [
  'api_key=',
  'Bearer ',
  '$schema',
  'matrix',
  'agentServer',
  'canonicalServer',
];
const leakedStdoutFragments = forbiddenStdoutFragments.filter((fragment) =>
  bootstrapInteractiveResult.stdout.includes(fragment),
);
if (leakedStdoutFragments.length > 0) {
  fail(
    `bootstrap (no flags) stdout contains forbidden fragments: ${leakedStdoutFragments.join(', ')}\nstdout:\n${bootstrapInteractiveResult.stdout}`,
  );
}
const bootstrapAgentAfterStat = statSync(bootstrapAgentConfig);
if (
  bootstrapAgentAfterStat.size !== bootstrapAgentBeforeStat.size ||
  bootstrapAgentAfterStat.mtimeMs !== bootstrapAgentBeforeStat.mtimeMs
) {
  fail(
    `bootstrap (no flags) modified seeded agent config\nbefore: size=${bootstrapAgentBeforeStat.size} mtime=${bootstrapAgentBeforeStat.mtimeMs}\nafter: size=${bootstrapAgentAfterStat.size} mtime=${bootstrapAgentAfterStat.mtimeMs}`,
  );
}
console.log(
  `bootstrap (no flags): exit=${bootstrapInteractiveResult.status} proposalHeading=PASS wroteConfig=PASS noReserved=PASS noLeak=PASS agentUntouched=PASS`,
);

const bootstrapHelpResult = spawnWithEnv(
  [...bootstrapBin, 'bootstrap', '--help'],
  bootstrapEnv,
);
if (bootstrapHelpResult.status !== 0) {
  fail(
    `bootstrap --help exited ${bootstrapHelpResult.status} (expected 0): ${bootstrapHelpResult.stderr}`,
  );
}
if (
  !bootstrapHelpResult.stdout.includes(
    'Usage: overture bootstrap --dry-run [--json]',
  )
) {
  fail(
    `bootstrap --help stdout missing usage\nstdout:\n${bootstrapHelpResult.stdout}`,
  );
}
console.log('bootstrap --help: exit=0 usage=PASS');

logStep('Apply no-change smoke (F2)');
// Seed a tmpdir with `overture.jsonc` + a Claude Code config that is
// already aligned with canonical intent, run `overture apply` (no
// flag), and assert the orchestrator exits 0 with no backup created
// and the target byte-identical to the seed. End-to-end guard for
// the F2 two-pass (dryRun → no-change) short-circuit — the F3-era
// equivalent of the original F2 happy path: under F3 the writer
// refuses every divergent seed, so the only writable scenario is
// "no-change" (existing is F3-equal to canonical). The real-write
// happy path (divergent seed → write + backup) is locked by the F2
// unit-spec at apps/cli/src/apply-command.spec.ts and the
// per-writer byte-fidelity specs in
// packages/agents/src/{claude-code,opencode,...}.write.spec.ts; the
// smoke harness now exercises the binary's exit-code + no-write
// contract on the only path F3 leaves available.
//
// Claude Code is the chosen target because it is the simplest single-
// target writer (one file per call), making the F2 surface easy to
// verify end-to-end.
const applyHome = mkdtempSync('/tmp/overture-verify-apply-home-');
const applyXdg = mkdtempSync('/tmp/overture-verify-apply-xdg-');
const applyPath = mkdtempSync('/tmp/overture-verify-apply-path-');
const applyWorkspace = mkdtempSync('/tmp/overture-verify-apply-ws-');
const applyEnv = {
  ...process.env,
  HOME: applyHome,
  XDG_CONFIG_HOME: applyXdg,
  PATH: applyPath,
};
const applyClaudeConfig = join(applyHome, '.claude.json');
const applyClaudeBefore = JSON.stringify(
  {
    mcpServers: {
      filesystem: { type: 'stdio', command: 'node' },
    },
  },
  null,
  2,
);
writeFileSync(applyClaudeConfig, applyClaudeBefore);
const applyClaudeBeforeBytes = readFileSync(applyClaudeConfig);

// Seed a fake claude binary on the apply PATH so the claude-code agent
// passes binary-first detection.
const applyClaudeBin = join(applyPath, 'claude');
writeFileSync(applyClaudeBin, '#!/bin/sh\nexit 0\n');
chmodSync(applyClaudeBin, 0o755);

// Seed the canonical config so apply has a real target to evaluate.
const applyOvertureConfigDir = join(applyXdg, 'overture');
mkdirSync(applyOvertureConfigDir, { recursive: true });
const applyOvertureConfig = join(applyOvertureConfigDir, 'overture.jsonc');
writeFileSync(
  applyOvertureConfig,
  JSON.stringify(
    {
      version: 1,
      settings: {
        defaultProfile: 'default',
        backupBeforeWrite: true,
      },
      profiles: {
        default: {
          mcpServers: {
            filesystem: { type: 'stdio', command: 'node' },
          },
          sync: {
            targets: ['claude-code'],
            disabledServers: [],
          },
          skills: [],
        },
      },
    },
    null,
    2,
  ),
);

const applyResult = spawnWithEnv([distMain, 'apply'], applyEnv, {
  cwd: applyWorkspace,
});
if (applyResult.status !== 0) {
  fail(
    `apply (no flag, no-change) exited ${applyResult.status} (expected 0)\nstdout:\n${applyResult.stdout}\nstderr:\n${applyResult.stderr}`,
  );
}

// Target was NOT modified.
const applyClaudeAfterBytes = readFileSync(applyClaudeConfig);
if (!applyClaudeAfterBytes.equals(applyClaudeBeforeBytes)) {
  fail(
    `apply (no flag, no-change) modified the seeded claude config\nbefore: ${applyClaudeBeforeBytes.length} bytes\nafter:  ${applyClaudeAfterBytes.length} bytes`,
  );
}

// No backup file created (Pass 2 never ran — Pass 1 short-circuited on no-change).
const applyHomeDir = dirname(applyClaudeConfig);
const applyBackups = readdirSync(applyHomeDir).filter((entry) =>
  entry.startsWith('.claude.json.bak.'),
);
if (applyBackups.length !== 0) {
  fail(
    `apply (no flag, no-change) unexpectedly created backup file(s)\ndir: ${applyHomeDir}\nbackups: ${applyBackups.join(', ')}`,
  );
}

// Human report must surface the no-change heading + no-change status.
if (!applyResult.stdout.includes('Apply (no changes written)')) {
  fail(
    `apply (no flag, no-change) stdout missing "Apply (no changes written)" heading\nstdout:\n${applyResult.stdout}`,
  );
}
if (!applyResult.stdout.includes('status:    no-change')) {
  fail(
    `apply (no flag, no-change) stdout missing "status:    no-change" line\nstdout:\n${applyResult.stdout}`,
  );
}
// F3 refusal block must NOT appear on a no-change path.
if (applyResult.stdout.includes('Conflicts:')) {
  fail(
    `apply (no flag, no-change) unexpectedly rendered a Conflicts: block\nstdout:\n${applyResult.stdout}`,
  );
}

console.log(
  `apply (no flag, no-change): exit=${applyResult.status} targetUntouched=PASS noBackup=PASS noChangeHeading=PASS`,
);

// Cleanup apply tmpdirs.
rmSync(applyHome, { recursive: true, force: true });
rmSync(applyXdg, { recursive: true, force: true });
rmSync(applyPath, { recursive: true, force: true });
rmSync(applyWorkspace, { recursive: true, force: true });

logStep('Apply state-file smoke (G1)');
// G1 state-file smoke. Drives `overture apply` (no flag) against a
// tmpdir seeded with an OpenCode config whose existing `unrelated`
// server does NOT conflict with canonical intent (the canonical
// `filesystem` server is absent from existing, so the B3 detector
// has nothing to refuse on). The orchestrator must:
//   1. Create a backup at `<target>.bak.<YYYYMMDD-HHmmssSSS>`
//      (Pass 1 plans an update).
//   2. Write the real config (Pass 2 adds `filesystem`).
//   3. Write the state file at `<stateDir>/apply/<runId>.json` and
//      update `<stateDir>/apply/last.json`. End-to-end guard for the
//      G1 contract: per-run record, schemaVersion=1, agentId matches
//      the seed target, pointer file names the same runId.
const stateHome = mkdtempSync('/tmp/overture-verify-state-home-');
const stateXdg = mkdtempSync('/tmp/overture-verify-state-xdg-');
const statePathDir = mkdtempSync('/tmp/overture-verify-state-path-');
const stateWorkspace = mkdtempSync('/tmp/overture-verify-state-ws-');
const stateHomeStateDir = join(stateHome, '.local', 'state');
// XDG_STATE_HOME must be explicitly set: a parent's XDG_STATE_HOME leak
// (common in dev shells) would otherwise hijack the state dir and write
// records to the real home instead of the smoke's tmpdir. The F2 smoke
// never trips on this because the F2 path is no-change (no state file
// is written); the G1 path always writes, so we have to pin the env.
const stateEnv = {
  ...process.env,
  HOME: stateHome,
  XDG_CONFIG_HOME: stateXdg,
  XDG_STATE_HOME: stateHomeStateDir,
  PATH: statePathDir,
};
// Seed the canonical config — target OpenCode with a single canonical
// `filesystem` server. `backupBeforeWrite: true` exercises the F2
// backup path so the G1 smoke also asserts a backup exists.
const stateOvertureConfigDir = join(stateXdg, 'overture');
mkdirSync(stateOvertureConfigDir, { recursive: true });
const stateOvertureConfig = join(stateOvertureConfigDir, 'overture.jsonc');
writeFileSync(
  stateOvertureConfig,
  JSON.stringify(
    {
      version: 1,
      settings: {
        defaultProfile: 'default',
        backupBeforeWrite: true,
      },
      profiles: {
        default: {
          mcpServers: {
            filesystem: { type: 'stdio', command: 'node' },
          },
          sync: {
            targets: ['opencode'],
            disabledServers: [],
          },
          skills: [],
        },
      },
    },
    null,
    2,
  ),
);
// Seed an existing OpenCode config with an UNRELATED server so the
// F3 conflict detector sees no divergence (canonical `filesystem`
// is absent from existing → no conflict), the writer's Pass 1 plans
// an update (add `filesystem`), and Pass 2 actually writes.
const stateOpencodeDir = join(stateXdg, 'opencode');
mkdirSync(stateOpencodeDir, { recursive: true });
const stateOpencodeConfig = join(stateOpencodeDir, 'opencode.json');
const stateOpencodeBefore = JSON.stringify(
  {
    mcp: {
      unrelated: { type: 'local', command: ['stay'] },
    },
  },
  null,
  2,
);
writeFileSync(stateOpencodeConfig, stateOpencodeBefore);
const stateOpencodeBeforeBytes = readFileSync(stateOpencodeConfig);

// Seed a fake opencode binary on PATH so the opencode agent passes
// binary-first detection.
const stateOpencodeBin = join(statePathDir, 'opencode');
writeFileSync(stateOpencodeBin, '#!/bin/sh\nexit 0\n');
chmodSync(stateOpencodeBin, 0o755);

const stateApplyResult = spawnWithEnv([distMain, 'apply'], stateEnv, {
  cwd: stateWorkspace,
});
if (stateApplyResult.status !== 0) {
  fail(
    `apply (no flag, state-file) exited ${stateApplyResult.status} (expected 0)\nstdout:\n${stateApplyResult.stdout}\nstderr:\n${stateApplyResult.stderr}`,
  );
}

// Target file must have been modified (Pass 2 ran).
const stateOpencodeAfterBytes = readFileSync(stateOpencodeConfig);
if (stateOpencodeAfterBytes.equals(stateOpencodeBeforeBytes)) {
  fail(
    `apply (no flag, state-file) did NOT modify the seeded opencode config (Pass 2 skipped)`,
  );
}

// Backup file must exist at `<target>.bak.<ts>`.
const stateOpencodeHomeDir = dirname(stateOpencodeConfig);
const stateBackupFiles = readdirSync(stateOpencodeHomeDir).filter((entry) =>
  entry.startsWith('opencode.json.bak.'),
);
if (stateBackupFiles.length === 0) {
  fail(
    `apply (no flag, state-file) did NOT create a backup file\ndir: ${stateOpencodeHomeDir}\nexpected: opencode.json.bak.<YYYYMMDD-HHmmssSSS>`,
  );
}

// State file: `<stateDir>/apply/<runId>.json`. With XDG_STATE_HOME pinned
// to `$stateHome/.local/state`, `defaultOverturePaths()` resolves
// `stateDir` to `$stateHome/.local/state/overture` and
// `defaultApplyStateDir` adds the trailing `apply` segment.
const stateApplyDir = join(stateHome, '.local', 'state', 'overture', 'apply');
if (!statSync(stateApplyDir, { throwIfNoEntry: false })) {
  fail(
    `apply (no flag, state-file) state dir missing: ${stateApplyDir}\nstdout:\n${stateApplyResult.stdout}\nstderr:\n${stateApplyResult.stderr}`,
  );
}
const statePerRunFiles = readdirSync(stateApplyDir).filter(
  (entry) => entry.endsWith('.json') && entry !== 'last.json',
);
if (statePerRunFiles.length !== 1) {
  fail(
    `apply (no flag, state-file) expected exactly 1 per-run state file under ${stateApplyDir}, found ${statePerRunFiles.length}: ${statePerRunFiles.join(', ')}`,
  );
}
const stateRecordPath = join(stateApplyDir, statePerRunFiles[0]);
let stateRecord;
try {
  stateRecord = JSON.parse(readFileSync(stateRecordPath, 'utf8'));
} catch (err) {
  fail(
    `apply (no flag, state-file) state record at ${stateRecordPath} is not valid JSON: ${err.message}`,
  );
}
if (stateRecord.schemaVersion !== 1) {
  fail(
    `apply (no flag, state-file) state record schemaVersion=${stateRecord.schemaVersion} (expected 1)\nrecord: ${JSON.stringify(stateRecord)}`,
  );
}
if (!Array.isArray(stateRecord.agents) || stateRecord.agents.length === 0) {
  fail(
    `apply (no flag, state-file) state record agents must be a non-empty array\nrecord: ${JSON.stringify(stateRecord)}`,
  );
}
const stateOpencodeAgent = stateRecord.agents.find(
  (a) => a && a.agentId === 'opencode',
);
if (stateOpencodeAgent === undefined) {
  fail(
    `apply (no flag, state-file) state record agents[] missing an entry with agentId === 'opencode'\nrecord: ${JSON.stringify(stateRecord)}`,
  );
}

// Pointer file: `<stateDir>/apply/last.json` names the same runId.
const statePointerPath = join(stateApplyDir, 'last.json');
let statePointer;
try {
  statePointer = JSON.parse(readFileSync(statePointerPath, 'utf8'));
} catch (err) {
  fail(
    `apply (no flag, state-file) pointer at ${statePointerPath} is not valid JSON: ${err.message}`,
  );
}
const stateExpectedRunId = statePerRunFiles[0].replace(/\.json$/, '');
if (statePointer.runId !== stateExpectedRunId) {
  fail(
    `apply (no flag, state-file) pointer runId=${statePointer.runId} (expected ${stateExpectedRunId})`,
  );
}

console.log(
  `apply (no flag, state-file): exit=${stateApplyResult.status} targetModified=PASS backupExists=PASS recordSchemaVersion=1 recordHasOpencode=PASS pointerMatches=PASS`,
);

// Cleanup state tmpdirs.
rmSync(stateHome, { recursive: true, force: true });
rmSync(stateXdg, { recursive: true, force: true });
rmSync(statePathDir, { recursive: true, force: true });
rmSync(stateWorkspace, { recursive: true, force: true });

logStep('Apply refused-apply smoke (F3)');
// F3 refused-apply smoke. Drives `overture apply` (no flag) against a
// tmpdir seeded with a Claude Code config whose `filesystem` server
// has different settings than canonical intent (existing `command:
// 'old'` vs canonical `command: 'node'`). The writer's Pass 1
// `dryRun` must surface a single `ServerConflict` (B3 detector),
// the orchestrator must short-circuit before backup + Pass 2 (the
// 'would-update'-exclusive gate), and the human report must list
// the conflict under a `Conflicts:` block. End-to-end guard for the
// F3 refusal contract as exercised by the installed binary.
const refuseHome = mkdtempSync('/tmp/overture-verify-refuse-home-');
const refuseXdg = mkdtempSync('/tmp/overture-verify-refuse-xdg-');
const refusePath = mkdtempSync('/tmp/overture-verify-refuse-path-');
const refuseWorkspace = mkdtempSync('/tmp/overture-verify-refuse-ws-');
const refuseEnv = {
  ...process.env,
  HOME: refuseHome,
  XDG_CONFIG_HOME: refuseXdg,
  PATH: refusePath,
};
const refuseClaudeConfig = join(refuseHome, '.claude.json');
const refuseClaudeBefore = JSON.stringify(
  {
    mcpServers: {
      filesystem: { type: 'stdio', command: 'old' },
    },
  },
  null,
  2,
);
writeFileSync(refuseClaudeConfig, refuseClaudeBefore);
const refuseClaudeBeforeBytes = readFileSync(refuseClaudeConfig);

// Seed a fake claude binary so the claude-code agent passes
// binary-first detection.
const refuseClaudeBin = join(refusePath, 'claude');
writeFileSync(refuseClaudeBin, '#!/bin/sh\nexit 0\n');
chmodSync(refuseClaudeBin, 0o755);

// Seed the canonical config. The filesystem server uses `command:
// 'node'` — divergent from the existing `command: 'old'` — so the
// B3 detector emits exactly one `ServerConflict` on the writer's
// Pass 1 dryRun.
const refuseOvertureConfigDir = join(refuseXdg, 'overture');
mkdirSync(refuseOvertureConfigDir, { recursive: true });
const refuseOvertureConfig = join(refuseOvertureConfigDir, 'overture.jsonc');
writeFileSync(
  refuseOvertureConfig,
  JSON.stringify(
    {
      version: 1,
      settings: {
        defaultProfile: 'default',
        backupBeforeWrite: true,
      },
      profiles: {
        default: {
          mcpServers: {
            filesystem: { type: 'stdio', command: 'node' },
          },
          sync: {
            targets: ['claude-code'],
            disabledServers: [],
          },
          skills: [],
        },
      },
    },
    null,
    2,
  ),
);

const refuseResult = spawnWithEnv([distMain, 'apply'], refuseEnv, {
  cwd: refuseWorkspace,
});

// Exit must be non-zero (refusal).
if (refuseResult.status === 0) {
  fail(
    `apply (no flag, conflict) exited 0 (expected non-zero refusal)\nstdout:\n${refuseResult.stdout}\nstderr:\n${refuseResult.stderr}`,
  );
}
// Exit must be exactly 1 (F3 refusal is the only blocking status in
// this scenario; 2 would mean a usage error or pipeline failure).
if (refuseResult.status !== 1) {
  fail(
    `apply (no flag, conflict) exited ${refuseResult.status} (expected 1)\nstdout:\n${refuseResult.stdout}\nstderr:\n${refuseResult.stderr}`,
  );
}

// Target config file bytes must be unchanged — Pass 2 never ran.
const refuseClaudeAfterBytes = readFileSync(refuseClaudeConfig);
if (!refuseClaudeAfterBytes.equals(refuseClaudeBeforeBytes)) {
  fail(
    `apply (no flag, conflict) modified the seeded claude config\nbefore: ${refuseClaudeBeforeBytes.length} bytes\nafter:  ${refuseClaudeAfterBytes.length} bytes`,
  );
}

// No backup file created — the orchestrator short-circuited before
// backup + Pass 2 on the conflict path.
const refuseHomeDir = dirname(refuseClaudeConfig);
const refuseBackups = readdirSync(refuseHomeDir).filter((entry) =>
  entry.startsWith('.claude.json.bak.'),
);
if (refuseBackups.length !== 0) {
  fail(
    `apply (no flag, conflict) unexpectedly created backup file(s)\ndir: ${refuseHomeDir}\nbackups: ${refuseBackups.join(', ')}`,
  );
}

// Human report must render the `Conflicts:` block listing the
// refused server name.
if (!refuseResult.stdout.includes('Conflicts:')) {
  fail(
    `apply (no flag, conflict) stdout missing "Conflicts:" block\nstdout:\n${refuseResult.stdout}`,
  );
}
if (!refuseResult.stdout.includes('filesystem')) {
  fail(
    `apply (no flag, conflict) stdout missing conflicted server name "filesystem"\nstdout:\n${refuseResult.stdout}`,
  );
}
if (!refuseResult.stdout.includes('status:    conflict')) {
  fail(
    `apply (no flag, conflict) stdout missing "status:    conflict" line\nstdout:\n${refuseResult.stdout}`,
  );
}

console.log(
  `apply (no flag, conflict): exit=${refuseResult.status} targetUntouched=PASS noBackup=PASS conflictsBlock=PASS refusedServerListed=PASS`,
);

// Cleanup refuse tmpdirs.
rmSync(refuseHome, { recursive: true, force: true });
rmSync(refuseXdg, { recursive: true, force: true });
rmSync(refusePath, { recursive: true, force: true });
rmSync(refuseWorkspace, { recursive: true, force: true });

logStep('Apply log-file smoke (G2)');
// G2 log-file smoke. Drives `overture apply` (no flag) against a tmpdir
// seeded identically to the G1 smoke (OpenCode with an `unrelated` server
// on disk + canonical `filesystem` server), then asserts the per-run
// `<stateDir>/apply/<runId>.log` written alongside the G1 state JSON
// has the full 5-section plain-text rendering. End-to-end guard for the
// G2 contract: header separator, `Overture apply log` marker,
// `DO NOT source this file` warning, per-agent `backup:` / `target:`
// tag lines, single-quoted `mv -v` recovery snippet, and the
// `Roll-back all` footer.
const logHome = mkdtempSync('/tmp/overture-verify-log-home-');
const logXdg = mkdtempSync('/tmp/overture-verify-log-xdg-');
const logPathDir = mkdtempSync('/tmp/overture-verify-log-path-');
const logWorkspace = mkdtempSync('/tmp/overture-verify-log-ws-');
const logHomeStateDir = join(logHome, '.local', 'state');
const logEnv = {
  ...process.env,
  HOME: logHome,
  XDG_CONFIG_HOME: logXdg,
  XDG_STATE_HOME: logHomeStateDir,
  PATH: logPathDir,
};
// Canonical config matches the G1 smoke: single `filesystem` server,
// `backupBeforeWrite: true`, target opencode.
const logOvertureConfigDir = join(logXdg, 'overture');
mkdirSync(logOvertureConfigDir, { recursive: true });
const logOvertureConfig = join(logOvertureConfigDir, 'overture.jsonc');
writeFileSync(
  logOvertureConfig,
  JSON.stringify(
    {
      version: 1,
      settings: {
        defaultProfile: 'default',
        backupBeforeWrite: true,
      },
      profiles: {
        default: {
          mcpServers: {
            filesystem: { type: 'stdio', command: 'node' },
          },
          sync: {
            targets: ['opencode'],
            disabledServers: [],
          },
          skills: [],
        },
      },
    },
    null,
    2,
  ),
);
// Existing OpenCode config seeded with the same `unrelated` server the
// G1 smoke uses — the B3 detector sees no divergence, the writer's
// Pass 1 plans an update, Pass 2 writes, and a backup is created so
// the per-agent block has a `(backup, target)` pair to render.
const logOpencodeDir = join(logXdg, 'opencode');
mkdirSync(logOpencodeDir, { recursive: true });
const logOpencodeConfig = join(logOpencodeDir, 'opencode.json');
writeFileSync(
  logOpencodeConfig,
  JSON.stringify(
    {
      mcp: {
        unrelated: { type: 'local', command: ['stay'] },
      },
    },
    null,
    2,
  ),
);
// Fake opencode binary on PATH so the opencode agent passes
// binary-first detection.
const logOpencodeBin = join(logPathDir, 'opencode');
writeFileSync(logOpencodeBin, '#!/bin/sh\nexit 0\n');
chmodSync(logOpencodeBin, 0o755);

const logApplyResult = spawnWithEnv([distMain, 'apply'], logEnv, {
  cwd: logWorkspace,
});
if (logApplyResult.status !== 0) {
  fail(
    `apply (no flag, log-file) exited ${logApplyResult.status} (expected 0)\nstdout:\n${logApplyResult.stdout}\nstderr:\n${logApplyResult.stderr}`,
  );
}

// State dir mirrors the G1 smoke: `$XDG_STATE_HOME/overture/apply`.
const logApplyDir = join(logHome, '.local', 'state', 'overture', 'apply');
if (!statSync(logApplyDir, { throwIfNoEntry: false })) {
  fail(
    `apply (no flag, log-file) state dir missing: ${logApplyDir}\nstdout:\n${logApplyResult.stdout}\nstderr:\n${logApplyResult.stderr}`,
  );
}
const logPerRunFiles = readdirSync(logApplyDir).filter(
  (entry) => entry.endsWith('.log') && entry !== 'last.log',
);
if (logPerRunFiles.length !== 1) {
  fail(
    `apply (no flag, log-file) expected exactly 1 per-run .log under ${logApplyDir}, found ${logPerRunFiles.length}: ${logPerRunFiles.join(', ')}`,
  );
}
const logPath = join(logApplyDir, logPerRunFiles[0]);
const logRunId = logPerRunFiles[0].replace(/\.log$/, '');
// Pointer file (written by G1) names the same runId — the .json and
// .log files are siblings paired by runId basename.
const logPointerPath = join(logApplyDir, 'last.json');
let logPointer;
try {
  logPointer = JSON.parse(readFileSync(logPointerPath, 'utf8'));
} catch (err) {
  fail(
    `apply (no flag, log-file) pointer at ${logPointerPath} is not valid JSON: ${err.message}`,
  );
}
if (logPointer.runId !== logRunId) {
  fail(
    `apply (no flag, log-file) pointer runId=${logPointer.runId} (expected ${logRunId})`,
  );
}

const logText = readFileSync(logPath, 'utf8');

// Header — 80-char `=` separator followed by `Overture apply log`.
if (!logText.startsWith('='.repeat(80))) {
  fail(
    `apply (no flag, log-file) log does not start with 80-char '=' separator\nfirst 80 chars: ${JSON.stringify(logText.slice(0, 80))}`,
  );
}
if (!logText.includes('Overture apply log')) {
  fail(
    `apply (no flag, log-file) log missing "Overture apply log" header marker\nlogPath: ${logPath}`,
  );
}
// Warning section — the rendered "DO NOT source this file" banner.
if (
  !logText.includes(
    'DO NOT source this file — read it and run individual commands.',
  )
) {
  fail(
    `apply (no flag, log-file) log missing "DO NOT source this file" warning\nlogPath: ${logPath}`,
  );
}
// Per-agent restore block — `backup: '<path>'` tag line with a
// single-quoted path for the updated opencode agent. The tag-line
// shape is the G3-prep parse anchor (per gate G2-3).
if (!logText.includes(`[opencode]`)) {
  fail(
    `apply (no flag, log-file) log missing per-agent "[opencode]" header\nlogPath: ${logPath}`,
  );
}
const logBackupTagRegex = /^backup: '[^']*\.bak\.[0-9]+-[0-9]+'$/m;
if (!logBackupTagRegex.test(logText)) {
  fail(
    `apply (no flag, log-file) log missing single-quoted "backup: '<path>.bak.<ts>'" tag line\nlogPath: ${logPath}\nlog excerpt:\n${logText.split('\n').slice(0, 40).join('\n')}`,
  );
}
if (!/^target: '[^']+'$/m.test(logText)) {
  fail(
    `apply (no flag, log-file) log missing single-quoted "target: '<path>'" tag line\nlogPath: ${logPath}`,
  );
}
// `mv -v '<backup>' '<target>'` recovery snippet. Per gate G2-2,
// this is the load-bearing recovery line a user copies pastes.
if (!logText.includes(`mv -v '`)) {
  fail(
    `apply (no flag, log-file) log missing "mv -v '" recovery snippet\nlogPath: ${logPath}`,
  );
}
// Footer — the `Roll-back all` aggregate block header line.
if (!logText.includes('Roll-back all (read first, run after review)')) {
  fail(
    `apply (no flag, log-file) log missing "Roll-back all" footer block header\nlogPath: ${logPath}`,
  );
}

console.log(
  `apply (no flag, log-file): exit=${logApplyResult.status} logFileExists=PASS headerSeparator=PASS applyLogMarker=PASS doNotSourceWarning=PASS backupTag=PASS targetTag=PASS mvSnippet=PASS rollBackFooter=PASS pointerMatches=PASS`,
);

// Cleanup log tmpdirs.
rmSync(logHome, { recursive: true, force: true });
rmSync(logXdg, { recursive: true, force: true });
rmSync(logPathDir, { recursive: true, force: true });
rmSync(logWorkspace, { recursive: true, force: true });

logStep('Restore-last --dry-run smoke (G3)');
// G3 restore-last --dry-run smoke. Skip `overture apply` entirely — G1
// already proved the JSON / log writers; here we need to prove that the
// DISPATCHER path `overture restore-last --dry-run` reads a G1 record,
// renders the plan, and (most importantly) does NOT actually mv any
// backup. The dry-run branch in `runRestore` short-circuits before the
// `spawn mv -v` loop (matches the gate G3-6 guard). End-to-end guard for
// the G3 contract as exercised by the installed binary: `--dry-run`
// exits 0, renders the seeded pair's `mv -v '…' '…'` line, and leaves
// both the target and the backup file untouched on disk.
//
// Layout:
//   <ws>/mcp-target.json                 ← current on-disk target
//   <ws>/mcp-target.json.bak.<ts>        ← the G1 backup
//   <xdg>/overture/apply/last.json       ← pointer
//   <xdg>/overture/apply/<runId>.json    ← G1 record (canonical source)
//   <xdg>/overture/apply/<runId>.log     ← G2 log (seeding for parity;
//                                          dry-run reads the JSON, not
//                                          the log, so this file is
//                                          here only to assert the
//                                          apply dir carries both).
const restoreHome = mkdtempSync('/tmp/overture-verify-restore-home-');
const restoreXdg = mkdtempSync('/tmp/overture-verify-restore-xdg-');
const restorePathDir = mkdtempSync('/tmp/overture-verify-restore-path-');
const restoreWorkspace = mkdtempSync('/tmp/overture-verify-restore-ws-');
// Same XDG_STATE_HOME discipline as the G1 smoke — a parent's leak
// would otherwise hijack the recorded state dir.
const restoreHomeStateDir = join(restoreHome, '.local', 'state');
const restoreEnv = {
  ...process.env,
  HOME: restoreHome,
  XDG_CONFIG_HOME: restoreXdg,
  XDG_STATE_HOME: restoreHomeStateDir,
  PATH: restorePathDir,
};

// Seed the current on-disk target and the backup with IDENTICAL bytes so
// `currentSha256 === preWriteSha256` → `integrityStatus: 'ok'`. A real
// `mv -v` would unlink the backup and overwrite the target; the dry-run
// short-circuit must leave both intact.
const restoreTarget = join(restoreWorkspace, 'mcp-target.json');
const restoreBackup = join(
  restoreWorkspace,
  'mcp-target.json.bak.20260704-183000123',
);
const restoreTargetBefore = '{"current":true}\n';
writeFileSync(restoreTarget, restoreTargetBefore);
writeFileSync(restoreBackup, restoreTargetBefore);
const restoreTargetBeforeBytes = readFileSync(restoreTarget);
const restoreBackupBeforeBytes = readFileSync(restoreBackup);
const restorePreSha = createHash('sha256')
  .update(restoreTargetBefore)
  .digest('hex');

const restoreRunId = '20260704-183000123-eeeeeeee';
const restoreApplyDir = join(restoreHomeStateDir, 'overture', 'apply');
mkdirSync(restoreApplyDir, { recursive: true });
const restoreRecord = {
  schemaVersion: 1,
  runId: restoreRunId,
  timestamp: '2026-07-04T18:30:00.123Z',
  mode: 'apply',
  profile: 'default',
  configPath: join(restoreXdg, 'overture', 'overture.jsonc'),
  backupBeforeWrite: true,
  agents: [
    {
      agentId: 'claude-code',
      displayName: 'Claude Code',
      status: 'updated',
      targetPaths: [restoreTarget],
      backupPaths: [restoreBackup],
      preWriteSha256: restorePreSha,
      postWriteSha256: null,
    },
  ],
};
writeFileSync(
  join(restoreApplyDir, `${restoreRunId}.json`),
  JSON.stringify(restoreRecord),
);
writeFileSync(
  join(restoreApplyDir, 'last.json'),
  JSON.stringify({ runId: restoreRunId }),
);
// Paired G2 log so the apply dir carries both .json + .log (mirrors the
// G2 smoke's pairing). Dry-run reads the G1 record, not the log, so
// this file is purely cosmetic for the dry-run pass.
const restoreLogPath = join(restoreApplyDir, `${restoreRunId}.log`);
writeFileSync(
  restoreLogPath,
  [
    '='.repeat(80),
    'Overture apply log',
    '='.repeat(80),
    `run id: ${restoreRunId}`,
    '',
    '[claude-code] Claude Code',
    'status: updated',
    `backup: '${restoreBackup}'`,
    `target: '${restoreTarget}'`,
    `mv -v '${restoreBackup}' '${restoreTarget}'`,
    '',
  ].join('\n'),
);

const restoreResult = spawnWithEnv(
  [distMain, 'restore-last', '--dry-run'],
  restoreEnv,
  { cwd: restoreWorkspace },
);
if (restoreResult.status !== 0) {
  fail(
    `restore-last --dry-run exited ${restoreResult.status} (expected 0)\nstdout:\n${restoreResult.stdout}\nstderr:\n${restoreResult.stderr}`,
  );
}

// Plan header must name the seeded runId. The renderer emits
// `run id:        <runId>` (8 spaces) per `formatHumanRestorePlan`.
if (!restoreResult.stdout.includes(`run id:        ${restoreRunId}`)) {
  fail(
    `restore-last --dry-run stdout missing "run id:        ${restoreRunId}" header line\nstdout:\n${restoreResult.stdout}`,
  );
}
// Source must report `state-json` (the JSON path wins over the
// fallback log-tag-lines source).
if (!restoreResult.stdout.includes(`source:        state-json`)) {
  fail(
    `restore-last --dry-run stdout missing "source:        state-json" header line\nstdout:\n${restoreResult.stdout}`,
  );
}
// Integrity line for the seeded pair — `ok` because currentSha256 ===
// preWriteSha256 by construction above.
if (!restoreResult.stdout.includes('  status: ok')) {
  fail(
    `restore-last --dry-run stdout missing per-pair "  status: ok" line\nstdout:\n${restoreResult.stdout}`,
  );
}
// The load-bearing assertion: the seeded pair's `mv -v '<backup>'
// '<target>'` line appears in the dry-run plan. Two leading spaces
// reflect the `formatHumanRestorePlan` indent.
if (
  !restoreResult.stdout.includes(
    `  mv -v '${restoreBackup}' '${restoreTarget}'`,
  )
) {
  fail(
    `restore-last --dry-run stdout missing the seeded pair's "mv -v '<backup>' '<target>'" line\nstdout:\n${restoreResult.stdout}\nbackup=${restoreBackup}\ntarget=${restoreTarget}`,
  );
}

// Dry-run guard 1 — the target file's bytes must match the seeded bytes.
// A real `mv -v` (gate G3-6 path) would replace the target contents with
// the backup's. The dry-run branch must leave them untouched.
const restoreTargetAfterBytes = readFileSync(restoreTarget);
if (!restoreTargetAfterBytes.equals(restoreTargetBeforeBytes)) {
  fail(
    `restore-last --dry-run modified the seeded target\nbefore: ${restoreTargetBeforeBytes.length} bytes\nafter:  ${restoreTargetAfterBytes.length} bytes`,
  );
}

// Dry-run guard 2 — the backup file must STILL exist on disk and its
// contents must be byte-identical to the seed. A real `mv -v` would
// unlink the backup; the dry-run short-circuit must not even reach the
// `spawn mv -v` loop, so the seed is preserved verbatim.
const restoreBackupAfterStat = statSync(restoreBackup, {
  throwIfNoEntry: false,
});
if (!restoreBackupAfterStat) {
  fail(
    `restore-last --dry-run unlinked the seeded backup at ${restoreBackup} (would be unlinked by a real mv)`,
  );
}
const restoreBackupAfterBytes = readFileSync(restoreBackup);
if (!restoreBackupAfterBytes.equals(restoreBackupBeforeBytes)) {
  fail(
    `restore-last --dry-run modified the seeded backup\nbefore: ${restoreBackupBeforeBytes.length} bytes\nafter:  ${restoreBackupAfterBytes.length} bytes`,
  );
}

console.log(
  `restore-last --dry-run: exit=${restoreResult.status} planRendered=PASS sourceStateJson=PASS integrityOk=PASS mvLineRendered=PASS targetUntouched=PASS backupUntouched=PASS`,
);

// Cleanup restore tmpdirs.
rmSync(restoreHome, { recursive: true, force: true });
rmSync(restoreXdg, { recursive: true, force: true });
rmSync(restorePathDir, { recursive: true, force: true });
rmSync(restoreWorkspace, { recursive: true, force: true });

logStep('Cleanup');
rmSync(packTmp, { recursive: true, force: true });
rmSync(cleanTmp, { recursive: true, force: true });
rmSync(bootstrapHome, { recursive: true, force: true });
rmSync(bootstrapXdg, { recursive: true, force: true });
rmSync(bootstrapPath, { recursive: true, force: true });

logStep('PASS');
console.log(
  'All verifications passed. The tarball is ready to publish, including bootstrap, apply (F2 no-change), apply (F3 refused-apply), and restore-last (G3 --dry-run) smoke checks.',
);
