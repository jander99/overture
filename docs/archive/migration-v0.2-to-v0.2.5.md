# Migration Guide: v0.2 to v0.2.5

This guide helps you upgrade from Overture v0.2 to v0.2.5, which introduces intelligent client detection and system diagnostics.

## What's New in v0.2.5

### 1. Intelligent Binary Detection

Overture now automatically detects which AI development clients are installed on your system:

- **CLI Binaries**: Detects command-line tools in PATH (e.g., `claude`, `cursor`, etc.)
- **GUI Applications**: Detects application bundles (e.g., `/Applications/Claude.app` on macOS)
- **Version Information**: Extracts version numbers from `--version` flags
- **Config Validation**: Checks if existing config files are valid JSON

### 2. Doctor Command

New `overture doctor` command provides comprehensive system diagnostics:

```bash
# Check installed clients
overture doctor

# Output as JSON
overture doctor --json

# Show detailed warnings
overture doctor --verbose
```

**Example output:**
```
Checking client installations...

✓ claude-code (v2.1.0) - /usr/local/bin/claude
  Config: /home/user/.config/claude/mcp.json (valid)

✗ claude-desktop - not installed
  → Install Claude Desktop: https://claude.com/download

✓ vscode - /usr/bin/code
  Config: /home/user/.config/Code/User/globalStorage/claude/mcp.json (valid)

Checking MCP servers...

✓ github - gh (found)
✓ python-repl - uvx (found)
⚠ custom-server - custom-cmd (not found)
  → Ensure custom-cmd is installed and available in PATH

Summary:
  Clients detected: 2 / 7
  Clients missing:  5
  Configs valid:    2
  MCP commands available: 2 / 3
  MCP commands missing:   1
```

### 3. Enhanced Sync Output

The `overture sync` command now shows binary detection results:

```bash
overture sync

Syncing MCP configurations...

Client sync results:
  ✓ claude-code:
      Detected (v2.1.0): /usr/local/bin/claude
      Config: /home/user/.config/claude/mcp.json (valid)
      Backup: /home/user/.config/overture/backups/claude-code/mcp.json.20250115-123456

  ✗ claude-desktop:
      Not detected (config will still be generated)
      Config: /home/user/.config/claude-desktop/mcp.json
```

### 4. "Warn But Allow" Approach

Overture now generates configs **even if a client is not detected**. This allows you to:

- Set up configs before installing clients
- Prepare configs for team members who will install clients later
- Version control configs without requiring all clients to be installed

## Breaking Changes

**None.** v0.2.5 is fully backward compatible with v0.2 configurations.

## Upgrade Steps

### 1. Update Overture

```bash
# If installed globally
npm update -g @overture/cli

# If installed in project
npm update @overture/cli
```

### 2. Verify Installation

```bash
# Check version
overture --version
# Should show v0.2.5 or higher

# Run diagnostics
overture doctor
```

### 3. Test Sync (Optional)

```bash
# Dry-run to preview changes
overture sync --dry-run

# Actual sync
overture sync
```

## New Configuration Options

### skipBinaryDetection (Config-Level)

You can now disable binary detection for specific configurations:

```yaml
# .overture/config.yaml
version: "1.0"

# Disable binary detection (configs generated for all clients)
skipBinaryDetection: true

mcp:
  github:
    command: gh
    args: [mcp]
```

**When to use:**
- CI/CD environments where clients may not be installed
- Docker containers building config files
- Generating configs for remote machines

## Migration Examples

### Example 1: Existing Setup (No Changes Required)

**Before (v0.2):**
```bash
cd my-project
overture sync
# Synced to all clients listed in config
```

**After (v0.2.5):**
```bash
cd my-project
overture sync
# Now shows which clients were detected
# Still syncs to all clients (even if not detected)
```

**No config changes needed!**

### Example 2: Using Doctor for Troubleshooting

**Scenario:** Sync isn't working for Claude Desktop

**Before (v0.2):**
- Manually check if Claude Desktop is installed
- Manually verify config path
- Manually check config JSON validity

**After (v0.2.5):**
```bash
overture doctor

# Immediately see:
# - Is Claude Desktop installed?
# - What's the config path?
# - Is the config valid JSON?
```

### Example 3: CI/CD Setup

**Scenario:** Generate configs in CI without installing clients

**Before (v0.2):**
- Would fail if clients not installed

**After (v0.2.5):**

```yaml
# .github/workflows/generate-configs.yml
name: Generate MCP Configs

on: [push]

jobs:
  generate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Install Overture
        run: npm install -g @overture/cli

      - name: Generate configs
        run: |
          # Clients not installed, but configs still generated
          overture sync --dry-run

      - name: Upload configs
        uses: actions/upload-artifact@v3
        with:
          name: mcp-configs
          path: dist/
```

**Or explicitly skip detection:**

```yaml
# .overture/config.yaml (for CI)
skipBinaryDetection: true

mcp:
  github:
    command: gh
    args: [mcp]
```

## Troubleshooting

### Issue: Doctor shows client not detected, but it's installed

**Cause:** Client binary not in PATH

**Solution:**
1. Verify installation:
   ```bash
   which claude  # macOS/Linux
   where claude  # Windows
   ```

2. Add to PATH if needed:
   ```bash
   # macOS/Linux
   export PATH="$HOME/.local/bin:$PATH"

   # Windows
   # Add to System Environment Variables
   ```

3. Re-run doctor:
   ```bash
   overture doctor
   ```

### Issue: Config validation fails

**Cause:** Existing config file has invalid JSON

**Solution:**
1. Check the config file:
   ```bash
   # Location shown in doctor output
   cat ~/.config/claude/mcp.json | jq .
   ```

2. Fix JSON errors or remove file:
   ```bash
   # Backup first
   cp ~/.config/claude/mcp.json ~/.config/claude/mcp.json.backup

   # Fix or remove
   rm ~/.config/claude/mcp.json
   ```

3. Re-generate:
   ```bash
   overture sync
   ```

### Issue: Sync creates configs for clients I don't want

**Cause:** Default behavior generates for all configured clients

**Solution:**
1. Use `--client` flag:
   ```bash
   overture sync --client claude-code
   ```

2. Or remove from config:
   ```yaml
   # .overture/config.yaml
   # Remove clients you don't use
   ```

## Feature Comparison

| Feature | v0.2 | v0.2.5 |
|---------|------|--------|
| Multi-platform sync | ✅ | ✅ |
| Client detection | ❌ | ✅ |
| Version detection | ❌ | ✅ |
| Config validation | ❌ | ✅ |
| System diagnostics | ❌ | ✅ (`doctor` command) |
| Enhanced sync output | ❌ | ✅ |
| Warn but allow | ❌ | ✅ |
| Skip detection flag | ❌ | ✅ |

## FAQ

### Q: Do I need to change my configs?

**A:** No, v0.2 configs work as-is in v0.2.5.

### Q: What if a client isn't detected?

**A:** Overture will warn you but still generate the config. You can install the client later and the config will be ready.

### Q: Can I force-generate configs without detection?

**A:** Yes, use `skipBinaryDetection: true` in your config, or just let the warning happen (it's harmless).

### Q: Does detection slow down sync?

**A:** Minimal impact (~50-100ms per client). Detection has 5-second timeout per binary.

### Q: Can I disable detection for one client?

**A:** Not currently - it's all or nothing via `skipBinaryDetection`. This may be added in v0.3.

## Next Steps

After upgrading:

1. **Run diagnostics:** `overture doctor` to see what's installed
2. **Review output:** Check if any clients are missing
3. **Test sync:** `overture sync --dry-run` to preview
4. **Read v0.3 roadmap:** Enhanced documentation features coming soon

## Getting Help

- **GitHub Issues:** https://github.com/overture-stack/overture/issues
- **Documentation:** https://github.com/overture-stack/overture/tree/main/docs

## Changelog

See [CHANGELOG.md](../CHANGELOG.md) for detailed release notes.
