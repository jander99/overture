# Configuration Path Audit

## Issue Summary

There are **inconsistent and incorrect configuration paths** throughout the codebase and documentation.

## Correct Configuration Paths (from actual code)

### Claude Code
- **User (Global):** `~/.claude.json` ✅
- **Project (Repo):** `./.mcp.json` ✅

Source: `libs/adapters/client-adapters/src/lib/adapters/claude-code.adapter.ts:137`
Source: `libs/core/config/src/lib/path-resolver.ts:161`

### Claude Desktop
- **User (Global):**
  - macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
  - Linux: `~/.config/Claude/claude_desktop_config.json`
  - Windows: `%APPDATA%\Claude\claude_desktop_config.json`

Source: `libs/core/config/src/lib/path-resolver.ts:186-199`

### GitHub Copilot CLI
- **User (Global):**
  - Linux/macOS: `~/.copilot/mcp-config.json` (or `$XDG_CONFIG_HOME/.copilot/mcp-config.json` if XDG_CONFIG_HOME is set)
  - Windows: `%USERPROFILE%\.copilot\mcp-config.json`

Source: `libs/core/config/src/lib/path-resolver.ts:304-315`

### OpenCode
- **User (Global):** `~/.config/opencode/opencode.json` (or `$XDG_CONFIG_HOME/opencode/opencode.json`)
- **Project (Repo):** `./opencode.json`

Source: `libs/adapters/client-adapters/src/lib/adapters/opencode.adapter.ts:193`

### Overture Configuration
- **User (Global):**
  - Linux: `$XDG_CONFIG_HOME/overture.yml` (or `~/.config/overture/config.yml` if XDG_CONFIG_HOME not set)
  - macOS/Windows: `~/.config/overture/config.yml`
- **Project (Repo):** `./.overture/config.yaml`

Source: `libs/core/config/src/lib/path-resolver.ts:127-146`

---

## Incorrect References Found

### ❌ WRONG: `~/.config/claude/mcp.json`

**This path appears in many places but is INCORRECT for Claude Code.**

Claude Code actually uses `~/.claude.json` (flat in home directory, not under `.config/`).

#### Locations with incorrect path:

1. **Documentation:**
   - `AGENTS.md:222`
   - `docs/archive/v0.2.5-implementation-plan.md:348`
   - `docs/archive/SESSION-2025-11-11.md:25`
   - `docs/archive/opencode-integration-research-2025-12-18.md:504`
   - `docs/archive/opencode-integration-research-2025-12-18.md:787`
   - `docs/archive/opencode-integration-research-2025-12-18.md:1024`
   - `docs/archive/migration-v0.1-to-v0.2.md` (multiple references)
   - `docs/archive/migration-v0.2-to-v0.2.5.md` (multiple references)
   - `docs/user-guide.md` (multiple references)
   - `docs/PURPOSE.md:11`
   - `docs/architecture.md:240`
   - `docs/overture-schema.md:16, 21, 118`
   - `docs/examples.md:93, 475, 561`
   - `docs/QUICKSTART.md:36, 131, 155, 216`
   - `README.md:19`

2. **Code Comments:**
   - `libs/adapters/client-adapters/src/lib/adapters/claude-code.adapter.ts:8` ❌ **Comment is wrong**

3. **Test Fixtures:**
   - Multiple test files use `/home/user/.config/claude/mcp.json` in mocks
   - These should use `~/.claude.json` instead

4. **Template:**
   - `apps/cli/src/assets/templates/claude-md.hbs:46`

---

## Recommended Fix Strategy

### 1. Update Code Comment (High Priority)
File: `libs/adapters/client-adapters/src/lib/adapters/claude-code.adapter.ts`
Line 8:
```typescript
// ❌ WRONG:
* - User: ~/.config/claude/mcp.json (Linux/macOS), %APPDATA%/Claude/mcp.json (Windows)

// ✅ CORRECT:
* - User: ~/.claude.json (all platforms)
```

### 2. Update Documentation (High Priority)
Replace all instances of `~/.config/claude/mcp.json` with `~/.claude.json` in:
- `AGENTS.md`
- `docs/user-guide.md`
- `docs/PURPOSE.md`
- `docs/architecture.md`
- `docs/overture-schema.md`
- `docs/examples.md`
- `docs/QUICKSTART.md`
- `README.md`

### 3. Update Templates (High Priority)
File: `apps/cli/src/assets/templates/claude-md.hbs`
Line 46: Update configuration path reference

### 4. Update Tests (Medium Priority)
Update test mocks to use correct path `~/.claude.json` instead of `~/.config/claude/mcp.json`:
- `apps/cli/src/cli/commands/backup.spec.ts`
- `apps/cli/src/cli/commands/audit.spec.ts`
- `apps/cli/src/cli/commands/sync.spec.ts`
- `apps/cli/src/test-utils/app-dependencies.mock.ts`
- `libs/core/config/src/lib/path-resolver.spec.ts`
- `libs/core/discovery/src/lib/binary-detector.spec.ts`
- `libs/core/sync/src/lib/sync-engine.spec.ts`

### 5. Archive Documentation (Low Priority)
Files in `docs/archive/` can be marked with a notice at the top indicating they contain outdated path references.

---

## Verification Script

To verify all paths are correct after fixes:

```bash
# Should find NO results for incorrect path:
grep -r "\.config/claude/mcp\.json" . \
  --exclude-dir=node_modules \
  --exclude-dir=dist \
  --exclude-dir=.nx \
  --exclude="CONFIG-PATH-AUDIT.md"

# Should find MANY results for correct path:
grep -r "\.claude\.json" . \
  --exclude-dir=node_modules \
  --exclude-dir=dist \
  --exclude-dir=.nx
```

---

## Additional Findings

### Other Clients are Correct
- ✅ **Claude Desktop**: Uses `~/.config/Claude/` on Linux (capital C) - this is correct
- ✅ **OpenCode**: Uses `~/.config/opencode/opencode.json` - this is correct
- ✅ **Copilot CLI**: Uses `~/.copilot/mcp-config.json` - this is correct
- ✅ **Overture**: Uses `~/.config/overture/config.yml` - this is correct

### Note on Platform Differences
- **Claude Desktop** uses different paths per platform (Library/Application Support on macOS, .config on Linux, AppData on Windows)
- **Claude Code** uses the SAME path on all platforms: `~/.claude.json`
- This is documented in the code comments and should be preserved

---

## Summary Table

| Client | Type | Documented Path (WRONG) | Actual Path (CORRECT) |
|--------|------|------------------------|----------------------|
| Claude Code | User | `~/.config/claude/mcp.json` ❌ | `~/.claude.json` ✅ |
| Claude Code | Project | `.mcp.json` ✅ | `.mcp.json` ✅ |
| Claude Desktop | User (Linux) | — | `~/.config/Claude/claude_desktop_config.json` ✅ |
| Claude Desktop | User (macOS) | — | `~/Library/Application Support/Claude/claude_desktop_config.json` ✅ |
| Claude Desktop | User (Windows) | — | `%APPDATA%\Claude\claude_desktop_config.json` ✅ |
| OpenCode | User | — | `~/.config/opencode/opencode.json` ✅ |
| OpenCode | Project | — | `./opencode.json` ✅ |
| Copilot CLI | User | — | `~/.copilot/mcp-config.json` ✅ |
| Overture | User | — | `~/.config/overture/config.yml` ✅ |
| Overture | Project | — | `./.overture/config.yaml` ✅ |

---

**Status:** Ready for systematic fix across codebase
**Priority:** High - affects user-facing documentation and onboarding experience
**Estimated Impact:** ~50+ file references need updating
