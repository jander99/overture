# Development Mode Specification

## Overview

Development mode (`dev_mode`) is a safety feature in Overture that prevents accidental modification of production Claude Code configurations during development and testing.

## Configuration

### Setting Location

In `overture.yaml`:

```yaml
settings:
  dev_mode: true  # Enable development mode
```

### Default Value

`false` - Development mode is disabled by default to prevent confusion when users actually want to apply configurations.

## Behavior

### When `dev_mode: true`

Overture will:

1. **✅ Still Perform All Validations**
   - Validate configuration syntax
   - Check dependency directionality
   - Verify feature references
   - Detect circular dependencies
   - Validate plugin metadata

2. **✅ Dry-Run Mode**
   - Display what changes would be made
   - Show diffs between current and generated configurations
   - Output summary of features that would be installed
   - List files that would be created/modified/deleted

3. **✅ Alternative Output**
   - Accept `--output` flag to write to alternative directories
   - Default to `./overture-output/` if no `--output` specified
   - Never write to `~/.claude/` even if specified as output

4. **❌ Never Modify Production Files**
   - Block all writes to `~/.claude/config.json`
   - Block all writes to `~/.claude/mcp.json`
   - Block all writes to `~/.claude/commands/`
   - Block all writes to `~/.claude/settings.json`
   - Block all writes to `~/.claude/hooks/`
   - Block all writes to any path under `~/.claude/`

5. **⚠️ Display Warnings**
   - Show prominent warning that dev mode is enabled
   - Remind users to disable dev mode for production use
   - Warn if user attempts to write to `~/.claude/`

### When `dev_mode: false`

Overture behaves normally:
- Can write to `~/.claude/` when specified
- Applies configurations to production Claude Code setup
- No artificial restrictions on output paths

## Use Cases

### 1. Developing Overture Itself

```bash
# Safe testing while developing Overture
cd /path/to/overture
overture generate dev/sample-config
# Outputs to ./overture-output/ automatically
```

### 2. Testing Configuration Changes

```bash
# Test a new plugin configuration
overture validate
overture generate --output ./test-output/
# Review the generated files before applying
```

### 3. CI/CD Validation

```yaml
# In .github/workflows/validate.yml
- name: Validate Overture Configuration
  run: |
    overture validate
    # Dev mode prevents accidental writes in CI
```

### 4. Sharing Configurations

```bash
# Generate config for distribution
overture generate --output ./dist/
# Share ./dist/ with team members
```

## Implementation Requirements

### Configuration Parser

```python
class OvertureConfig:
    def __init__(self, config_path: str):
        self.config = self._load_config(config_path)
        self.dev_mode = self.config.get('settings', {}).get('dev_mode', False)

    def is_dev_mode(self) -> bool:
        return self.dev_mode
```

### Output Path Validation

```python
def validate_output_path(output_path: str, dev_mode: bool) -> str:
    """Validate and normalize output path."""
    claude_home = os.path.expanduser('~/.claude')
    normalized = os.path.normpath(os.path.expanduser(output_path))

    if dev_mode and normalized.startswith(claude_home):
        raise DevModeError(
            f"Cannot write to {output_path} in dev mode. "
            f"Set dev_mode: false or use a different output path."
        )

    return normalized
```

### Generator Logic

```python
class ConfigGenerator:
    def __init__(self, config: OvertureConfig):
        self.config = config
        self.dev_mode = config.is_dev_mode()

    def generate(self, output_path: str = None):
        if output_path is None:
            output_path = './overture-output/' if self.dev_mode else '~/.claude/'

        output_path = validate_output_path(output_path, self.dev_mode)

        if self.dev_mode:
            self._display_dev_mode_warning()

        # Generate configurations
        changes = self._generate_configs(output_path)

        if self.dev_mode:
            self._display_dry_run_summary(changes)
        else:
            self._apply_changes(changes)
```

### Warning Display

```python
def _display_dev_mode_warning(self):
    """Display prominent dev mode warning."""
    print("""
╔════════════════════════════════════════════════════════════════╗
║                    DEVELOPMENT MODE ENABLED                     ║
╟────────────────────────────────────────────────────────────────╢
║  Overture is running in development mode.                      ║
║  No changes will be made to ~/.claude/ files.                  ║
║                                                                 ║
║  To apply configurations to Claude Code:                       ║
║  1. Set 'dev_mode: false' in overture.yaml                     ║
║  2. Run 'overture generate --output ~/.claude/'                ║
╚════════════════════════════════════════════════════════════════╝
    """)
```

### Dry-Run Summary

```python
def _display_dry_run_summary(self, changes: ChangeSet):
    """Display what would change in dev mode."""
    print("\n📋 Changes that would be applied:\n")

    if changes.new_files:
        print("  New files:")
        for file in changes.new_files:
            print(f"    + {file}")

    if changes.modified_files:
        print("\n  Modified files:")
        for file in changes.modified_files:
            print(f"    ~ {file}")

    if changes.deleted_files:
        print("\n  Deleted files:")
        for file in changes.deleted_files:
            print(f"    - {file}")

    print(f"\n  Output directory: {changes.output_path}")
    print(f"\n✓ Dry-run complete. Review changes above.")
```

## Command-Line Interface

### Flag Override

Allow command-line override of dev mode:

```bash
# Force dev mode regardless of config
overture generate --dev-mode

# Force production mode (dangerous!)
overture generate --no-dev-mode
```

### Implementation

```python
@click.command()
@click.option('--dev-mode', is_flag=True, default=None,
              help='Force development mode (safe testing)')
@click.option('--no-dev-mode', is_flag=True, default=None,
              help='Force production mode (override config)')
@click.option('--output', type=click.Path(),
              help='Output directory for generated files')
def generate(dev_mode, no_dev_mode, output):
    config = load_config()

    # CLI flags override config file
    if dev_mode and no_dev_mode:
        raise click.UsageError("Cannot use both --dev-mode and --no-dev-mode")

    if dev_mode:
        config.settings['dev_mode'] = True
    elif no_dev_mode:
        if not click.confirm('⚠️  Disable dev mode? This will allow writes to ~/.claude/'):
            return
        config.settings['dev_mode'] = False

    generator = ConfigGenerator(config)
    generator.generate(output)
```

## Error Messages

### Attempting to Write to ~/.claude/ in Dev Mode

```
Error: Cannot write to ~/.claude/ while in development mode

You attempted to write to:
  ~/.claude/commands/review.md

Development mode is enabled in your overture.yaml configuration.
This prevents accidental modification of your production Claude Code setup.

To fix this:

  1. For testing: Use a different output directory
     overture generate --output ./test-output/

  2. For production: Disable dev mode
     Edit overture.yaml and set:
       settings:
         dev_mode: false

     Then run:
       overture generate --output ~/.claude/
```

## Testing

### Unit Tests

```python
def test_dev_mode_blocks_claude_home():
    config = OvertureConfig({'settings': {'dev_mode': True}})

    with pytest.raises(DevModeError):
        validate_output_path('~/.claude/', dev_mode=True)

def test_dev_mode_allows_alternative_paths():
    config = OvertureConfig({'settings': {'dev_mode': True}})

    # Should not raise
    validate_output_path('./test-output/', dev_mode=True)
    validate_output_path('/tmp/overture/', dev_mode=True)

def test_production_mode_allows_claude_home():
    config = OvertureConfig({'settings': {'dev_mode': False}})

    # Should not raise
    validate_output_path('~/.claude/', dev_mode=False)
```

### Integration Tests

```python
def test_dev_mode_generates_to_alternative_dir(tmp_path):
    config_path = tmp_path / "overture.yaml"
    config_path.write_text("""
    settings:
      dev_mode: true
    enabled:
      commands:
        - test-command
    """)

    result = run_overture(['generate'], cwd=tmp_path)

    # Should generate to ./overture-output/ not ~/.claude/
    assert (tmp_path / 'overture-output').exists()
    assert not Path('~/.claude/commands/test-command.md').exists()
```

## Security Considerations

### Bypassing Dev Mode

Dev mode should not be easily bypassed:

1. **No Environment Variable Override**
   - Don't allow `OVERTURE_DEV_MODE=false` to override config
   - Only allow CLI flags with explicit confirmation

2. **Symlink Protection**
   - Check canonical paths, not just raw paths
   - Block writes to symlinks pointing to `~/.claude/`

```python
def validate_output_path(output_path: str, dev_mode: bool) -> str:
    # Resolve symlinks
    normalized = os.path.realpath(os.path.expanduser(output_path))
    claude_home = os.path.realpath(os.path.expanduser('~/.claude'))

    if dev_mode and normalized.startswith(claude_home):
        raise DevModeError(...)

    return normalized
```

3. **Parent Directory Protection**
   - Block `~/.claude/../.claude/`
   - Block `~/../../home/user/.claude/`

## Documentation

### Help Text

```bash
$ overture generate --help

Generate Claude Code configuration from Overture config.

Options:
  --output PATH       Output directory (default: ~/.claude/ in production,
                     ./overture-output/ in dev mode)
  --dev-mode         Force development mode (safe, no ~/.claude/ writes)
  --no-dev-mode      Disable dev mode (requires confirmation)
  --dry-run          Show changes without applying (implies --dev-mode)
  --help             Show this message and exit

Development Mode:
  When dev_mode is enabled in overture.yaml, Overture will never modify
  files in ~/.claude/. This is useful for testing configurations safely.

  Set 'dev_mode: true' in settings when:
    - Developing Overture itself
    - Testing new configurations
    - Running in CI/CD pipelines
    - Generating shareable configs
```

## Future Enhancements

### 1. Interactive Diff

```bash
overture generate --interactive
# Shows diffs and asks "Apply these changes? [y/N]"
```

### 2. Backup Before Apply

```bash
overture generate --backup
# Creates ~/.claude.backup/ before applying changes
```

### 3. Selective Application

```bash
overture generate --only commands
# Only generate commands, skip other features
```

### 4. Staged Rollout

```bash
overture generate --stage
# Generate to staging area, then 'overture apply' to production
```

## Summary

Development mode is a critical safety feature that:
- ✅ Prevents accidental modification of production configs
- ✅ Enables safe testing and development
- ✅ Works seamlessly in CI/CD pipelines
- ✅ Provides clear feedback about what would change
- ✅ Blocks writes to `~/.claude/` at multiple levels
- ✅ Requires explicit user action to disable

This makes Overture safer to develop and test while maintaining the ability to apply configurations when ready.
