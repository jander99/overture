# AGENTS.md — libs/shared/testing/src/lib

Test infrastructure: builders, fixtures, and mocks for the entire codebase.

## Structure

```
testing/src/lib/
├── builders/
│   └── config.builder.ts   # 441L — fluent builder for OvertureConfig test objects
├── fixtures/
│   └── *.fixture.ts        # Pre-built config/result objects for common test scenarios
└── mocks/
    ├── filesystem.mock.ts  # Mock FilesystemPort with in-memory FS
    ├── process.mock.ts     # Mock ProcessPort (env vars, cwd)
    └── output.mock.ts      # Mock OutputPort (captures info/error calls)
```

## Config Builder (config.builder.ts)

Primary factory for test config objects. Always use this — never construct `OvertureConfig` inline.

```typescript
import { buildConfig } from '@overture/testing';

// Minimal config:
const config = buildConfig();

// With customizations:
const config = buildConfig({
  mcp: {
    'my-server': buildMcpServer({ command: 'my-cmd', args: ['--port', '3000'] }),
  },
  sync: { backup: false },
});

// With agent:
const config = buildConfig({
  agents: [buildAgent({ name: 'assistant', model: 'claude-3-5-sonnet' })],
});
```

## Port Mocks

```typescript
import { createFilesystemMock, createProcessMock, createOutputMock } from '@overture/testing';

const fs = createFilesystemMock({
  '/path/to/config.yaml': 'version: "2.0"\n...',
});
const proc = createProcessMock({ HOME: '/home/user', cwd: '/project' });
const output = createOutputMock();

// After test:
expect(output.info).toHaveBeenCalledWith(expect.stringContaining('Sync complete'));
```

## Fixtures

Pre-built objects for common scenarios:

```typescript
import { 
  MINIMAL_CONFIG,        // bare minimum valid OvertureConfig
  FULL_CONFIG,           // config with all features enabled
  CLAUDE_CODE_CLIENT,    // DetectedClient for claude-code
  SYNC_SUCCESS_RESULT,   // SyncResult with all success statuses
} from '@overture/testing';
```

## Rules

- Always import from `@overture/testing` — never use relative paths to test helpers
- Extend builders rather than duplicating — add new builder methods to `config.builder.ts`
- Mocks must cover the full `FilesystemPort`/`ProcessPort`/`OutputPort` interface
- No real I/O in `testing/` package — everything is in-memory or mocked
