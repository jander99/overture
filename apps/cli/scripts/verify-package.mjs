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

function spawnWithEnv(args, env) {
  return spawnSync(process.execPath, args, {
    encoding: 'utf8',
    env,
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

logStep('Cleanup');
rmSync(packTmp, { recursive: true, force: true });
rmSync(cleanTmp, { recursive: true, force: true });
rmSync(bootstrapHome, { recursive: true, force: true });
rmSync(bootstrapXdg, { recursive: true, force: true });
rmSync(bootstrapPath, { recursive: true, force: true });

logStep('PASS');
console.log(
  'All verifications passed. The tarball is ready to publish, including bootstrap smoke checks.',
);
