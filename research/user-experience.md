# Overture User Experience Design

## Overview

This document defines the user experience for Overture, including installation, configuration management, initialization workflows, and the user's interaction model with the tool.

## User Personas

### Primary Users

1. **Plugin Developer**
   - Creates new plugins for distribution
   - Manages plugin configuration
   - Publishes to marketplaces

2. **Team Lead**
   - Sets up team development standards
   - Manages project-level plugin configuration
   - Coordinates Claude Code + Copilot settings

3. **Individual Developer**
   - Uses Overture to manage personal Claude Code/Copilot config
   - May create personal plugins
   - Syncs configurations across projects

## Installation Models

### 1. Package Manager Installation (Production)

Users install Overture via system package managers:

```bash
# macOS
brew install overture

# Linux (APT)
sudo apt install overture

# Linux (DNF)
sudo dnf install overture

# Generic (cargo)
cargo install overture
```

**Characteristics:**
- Binary installation (no source code)
- System-wide availability
- No git repository in user's filesystem
- User needs separate config repository

### 2. Source Installation (Development)

Developers working on Overture:

```bash
git clone https://github.com/overture-dev/overture
cd overture
cargo build --release
cargo install --path .
```

**Characteristics:**
- Source code available
- Can contribute to Overture
- Development workflow

## Configuration Architecture

### Global Configuration Directory: `~/.overture/`

```
~/.overture/
├── config.yaml                 # Global Overture settings
├── plugins/                    # User's plugin projects
│   ├── my-personal-plugin/
│   │   └── overture.yaml
│   └── team-standards-plugin/
│       └── overture.yaml
├── cache/                      # Build cache
├── templates/                  # Plugin templates
└── .overture_version           # Installed version
```

### User's Plugin Repository

Users maintain their plugin configurations in a git repository:

```
~/code/my-overture-config/      # User's chosen location
├── plugins/
│   ├── python-dev/
│   │   ├── overture.yaml
│   │   ├── agents/
│   │   ├── skills/
│   │   └── commands/
│   └── web-dev/
│       └── overture.yaml
└── README.md
```

## Initialization Workflow

### First-Time Setup

```bash
# 1. Install Overture
brew install overture

# 2. Initialize Overture configuration
overture init

# Interactive prompts:
# ? Where do you want to store your Overture configurations?
#   > ~/overture-config (default)
#   > Enter custom path...
#
# ? Do you want to initialize a git repository?
#   > Yes (recommended)
#   > No
#
# ? Link this directory to ~/.overture/?
#   > Yes (creates symlink)
#   > No

# Creates:
# ~/overture-config/
# ~/.overture/ -> ~/overture-config/
```

### Result of `overture init`

```
~/overture-config/
├── .git/                       # Initialized git repo
├── config.yaml                 # Global settings
├── plugins/                    # Plugin directory
│   └── .gitkeep
├── templates/                  # User templates
│   └── .gitkeep
├── .gitignore
└── README.md                   # Generated instructions
```

**README.md contents:**
```markdown
# My Overture Configuration

This repository contains my Overture plugin configurations.

## Setup

This directory is linked to `~/.overture/`.

## Creating Plugins

Create a new plugin:
```bash
cd plugins
overture new my-plugin
```

## Syncing to Tools

Build and sync your configurations:
```bash
overture build --all
overture sync --claude --copilot
```

## Version Control

Commit your changes to save configurations:
```bash
git add .
git commit -m "Update plugin configuration"
git push
```
```

## User Workflows

### Workflow 1: Creating a New Plugin

```bash
# Navigate to plugin directory
cd ~/.overture/plugins

# Create new plugin from template
overture new python-dev --template python

# Interactive prompts:
# ? Plugin name: python-dev
# ? Description: Python development workflow
# ? Author: username
# ? Version: 1.0.0
# ? Include subagents? Yes
# ? Include skills? Yes
# ? Include hooks? Yes

# Creates:
# python-dev/
# ├── overture.yaml (with template)
# ├── agents/.gitkeep
# ├── skills/.gitkeep
# ├── commands/.gitkeep
# └── README.md

# Edit configuration
cd python-dev
vim overture.yaml

# Add components
mkdir -p agents
vim agents/test-engineer.md

# Validate
overture validate

# Build
overture build

# Test locally
overture install --local

# When ready, commit
git add .
git commit -m "feat: add python-dev plugin"
```

### Workflow 2: Using Existing Plugin Configuration

```bash
# Clone someone else's configuration (or your own from another machine)
git clone https://github.com/username/overture-config ~/.overture

# Link (if not done automatically)
overture link ~/.overture

# Build all plugins
cd ~/.overture
overture build --all

# Sync to Claude Code and Copilot
overture sync --claude --copilot

# Verify installation
claude --version  # Should show plugins installed
```

### Workflow 3: Managing Multiple Environments

```bash
# Work environment
~/work/overture-config/
├── plugins/
│   ├── company-standards/
│   └── project-specific/

# Personal environment
~/personal/overture-config/
├── plugins/
│   └── my-personal-tools/

# Switch contexts
overture link ~/work/overture-config    # For work
overture link ~/personal/overture-config  # For personal projects

# Or use profiles
overture profile use work
overture profile use personal
```

### Workflow 4: Team Sharing

```bash
# Team lead creates team configuration
mkdir team-overture-config
cd team-overture-config
overture init --no-interactive

# Create team plugin
overture new team-standards

# Edit and commit
git add .
git commit -m "Initial team standards"
git remote add origin git@github.com:company/team-overture-config
git push -u origin main

# Team members clone and use
git clone git@github.com:company/team-overture-config ~/.overture
overture build --all
overture sync --all
```

## CLI Interface Design

### Core Commands

#### `overture init`

Initialize Overture configuration directory.

```bash
overture init [PATH]

Options:
  [PATH]              Path to create config directory (default: ~/overture-config)
  --no-git           Don't initialize git repository
  --no-link          Don't create ~/.overture symlink
  --no-interactive   Skip interactive prompts, use defaults
  --template <name>  Use specific template for initialization

Examples:
  overture init                     # Interactive setup in ~/overture-config
  overture init ~/my-config         # Setup in custom location
  overture init --no-interactive    # Quick setup with defaults
```

#### `overture new`

Create a new plugin from template.

```bash
overture new <name> [options]

Arguments:
  <name>              Plugin name

Options:
  --template <name>   Template to use (python, typescript, web, etc.)
  --path <path>       Where to create plugin (default: current dir)
  --author <name>     Plugin author
  --description <text> Plugin description
  --no-interactive    Skip prompts, use defaults

Examples:
  overture new python-dev                          # Interactive creation
  overture new web-dev --template react            # Use react template
  overture new my-plugin --no-interactive          # Quick creation
```

#### `overture validate`

Validate plugin configuration.

```bash
overture validate [path]

Arguments:
  [path]              Path to plugin (default: current directory)

Options:
  --check-duplication  Analyze for duplicated knowledge
  --strict            Treat warnings as errors
  --json              Output results as JSON

Examples:
  overture validate                       # Validate current directory
  overture validate plugins/python-dev    # Validate specific plugin
  overture validate --check-duplication   # Deep analysis
```

#### `overture build`

Build plugin(s) into distributable format.

```bash
overture build [path]

Arguments:
  [path]              Path to plugin or plugins directory

Options:
  --all               Build all plugins in current directory
  --output <path>     Output directory (default: ./build)
  --copilot           Also generate Copilot configuration
  --optimize-tokens   Optimize CLAUDE.md for token usage
  --dry-run          Show what would be built without building

Examples:
  overture build                          # Build current plugin
  overture build --all                    # Build all plugins
  overture build --copilot                # Include Copilot config
  overture build --optimize-tokens        # Optimize for tokens
```

#### `overture install`

Install plugin locally for testing.

```bash
overture install [path]

Arguments:
  [path]              Path to plugin or built plugin

Options:
  --local             Install to ~/.claude/plugins (for testing)
  --global            Install to system (requires sudo)
  --force             Overwrite existing installation

Examples:
  overture install                        # Install current plugin locally
  overture install --force                # Force reinstall
  overture install build/python-dev       # Install built plugin
```

#### `overture sync`

Sync configurations to Claude Code and/or Copilot.

```bash
overture sync [options]

Options:
  --claude            Sync to Claude Code
  --copilot           Sync to GitHub Copilot
  --all               Sync to all tools (default)
  --project <path>    Sync specific project
  --dry-run          Show what would be synced

Examples:
  overture sync                           # Sync to all tools
  overture sync --claude                  # Only Claude Code
  overture sync --copilot                 # Only Copilot
  overture sync --project ~/myproject     # Sync specific project
```

#### `overture link`

Link Overture config directory.

```bash
overture link <path>

Arguments:
  <path>              Path to config directory

Options:
  --force             Overwrite existing link

Examples:
  overture link ~/work/overture-config    # Link work config
  overture link ~/personal-config         # Switch to personal config
```

#### `overture profile`

Manage configuration profiles.

```bash
overture profile <command>

Commands:
  list                List available profiles
  use <name>          Switch to profile
  create <name>       Create new profile
  delete <name>       Delete profile

Examples:
  overture profile list                   # Show all profiles
  overture profile use work               # Switch to work profile
  overture profile create personal        # Create personal profile
```

#### `overture extract`

Extract duplicated knowledge to CLAUDE.md.

```bash
overture extract [options]

Options:
  --from <component>  Extract from (agents, skills, commands, all)
  --to <target>       Extract to (claude-md, skill, separate-file)
  --auto             Automatically extract detected duplicates
  --preview          Show what would be extracted without doing it

Examples:
  overture extract --from agents          # Analyze agents for extraction
  overture extract --auto                 # Auto-extract duplicates
  overture extract --preview              # Preview extraction
```

#### `overture publish`

Publish plugin to marketplace.

```bash
overture publish [options]

Options:
  --marketplace <url> Marketplace repository
  --version <ver>     Version to publish
  --tag               Create git tag
  --dry-run          Preview publication

Examples:
  overture publish --marketplace gh:username/marketplace
  overture publish --version 1.0.0 --tag
```

### Utility Commands

```bash
overture --version          # Show Overture version
overture --help            # Show help
overture config show       # Display current configuration
overture config edit       # Edit global config in $EDITOR
overture templates list    # List available templates
overture templates add     # Add custom template
```

## Configuration Files

### Global Config: `~/.overture/config.yaml`

```yaml
# Overture global configuration
version: "1.0"

# User preferences
user:
  name: "username"
  email: "user@example.com"

# Default settings for new plugins
defaults:
  plugin:
    author: "username"
    license: "MIT"
    version: "1.0.0"

  template: "basic"  # Default template for 'overture new'

# Tool integration settings
integrations:
  claude_code:
    enabled: true
    install_path: "~/.claude/plugins"

  copilot:
    enabled: true
    instructions_path: ".github/copilot-instructions.md"

# Profiles
profiles:
  work:
    path: "~/work/overture-config"
    integrations:
      claude_code: true
      copilot: true

  personal:
    path: "~/personal/overture-config"
    integrations:
      claude_code: true
      copilot: false

  active: "work"  # Currently active profile

# Build settings
build:
  output_dir: "./build"
  optimize_tokens: true
  include_source: false  # Include overture.yaml in built plugin

# Sync settings
sync:
  auto_sync: false  # Auto-sync after build
  backup_existing: true  # Backup before overwriting

# Templates
templates:
  search_paths:
    - "~/.overture/templates"
    - "/usr/local/share/overture/templates"

# Cache
cache:
  enabled: true
  path: "~/.overture/cache"
  max_size: "500MB"
```

### Project Config: `overture.yaml`

See `architecture-recommendations.md` for complete schema.

## GitHub Repository Template (Future)

### Repository Structure

```
overture-config-template/
├── .github/
│   └── workflows/
│       ├── validate.yml      # Validate on PR
│       └── sync.yml          # Auto-sync on merge
├── plugins/
│   └── example/
│       ├── overture.yaml
│       └── README.md
├── config.yaml               # Template global config
├── .gitignore
├── README.md
└── docs/
    ├── getting-started.md
    └── creating-plugins.md
```

### Using the Template

```bash
# From GitHub UI: "Use this template" button
# Or via gh CLI:
gh repo create my-overture-config --template overture-dev/overture-config-template

# Clone and link
git clone git@github.com:username/my-overture-config ~/.overture
overture link ~/.overture
```

### Template Features

1. **Pre-configured CI/CD**: Validate plugins on push
2. **Example Plugin**: Functional example to learn from
3. **Documentation**: Getting started guide
4. **Issue Templates**: For tracking plugin ideas
5. **Wiki**: Community plugin patterns

## User Journey Examples

### Journey 1: New User, First Plugin

```
Day 1: Discovery
├─> Hears about Overture
├─> Reads documentation
└─> Decides to try it

Day 1: Installation
├─> brew install overture
├─> overture init
├─> Chooses ~/overture-config
└─> Git repository initialized

Day 1: First Plugin
├─> overture new python-tools --template python
├─> Edits overture.yaml
├─> Adds a simple skill
├─> overture validate  ✓
├─> overture build
└─> overture sync --claude

Day 1: Testing
├─> Opens Claude Code
├─> Sees new plugin available
├─> Tests functionality
└─> Iterates on configuration

Day 2: Refinement
├─> Adds subagent
├─> Creates custom command
├─> overture validate --check-duplication
├─> Extracts duplicates to CLAUDE.md
└─> Commits to git

Week 2: Sharing
├─> Pushes to GitHub
├─> Shares with team
└─> Team clones and uses
```

### Journey 2: Team Lead Setting Up Standards

```
Week 1: Planning
├─> Identifies team needs
├─> Documents coding standards
└─> Plans plugin structure

Week 1: Creation
├─> overture init ~/company-standards
├─> Creates multiple plugins:
│   ├─> code-review-standards
│   ├─> testing-requirements
│   └─> deployment-workflow
├─> Tests with pilot team
└─> Iterates based on feedback

Week 2: Rollout
├─> Publishes to company GitHub
├─> Documents for team
├─> Onboarding sessions
└─> Team adopts standards

Ongoing: Maintenance
├─> Team suggests improvements
├─> Standards updated in git
├─> Team pulls updates
└─> overture sync --all
```

### Journey 3: Multi-Project Developer

```
Setup: Multiple Contexts
├─> Work projects
├─> Personal projects
└─> Open source contributions

Configuration:
├─> ~/work/overture-config/
│   └─> Work-specific plugins
├─> ~/personal/overture-config/
│   └─> Personal plugins
└─> ~/.overture/config.yaml
    └─> Profiles configured

Daily Workflow:
Morning (Work):
├─> overture profile use work
├─> Projects use work standards
└─> Claude Code has work plugins

Evening (Personal):
├─> overture profile use personal
├─> Projects use personal configs
└─> Different plugin set active
```

## Success Metrics

### User Onboarding
- Time to first working plugin: < 15 minutes
- Successful installation rate: > 95%
- Documentation clarity rating: > 4/5

### Daily Usage
- Commands per day: 5-10 (build, validate, sync)
- Plugin update frequency: Weekly
- Error resolution time: < 5 minutes

### Ecosystem Growth
- Public plugins created: Growing steadily
- Template usage: High adoption
- Community contributions: Active

## Future Enhancements (See vision.md)

1. **Web UI**: Browser-based configuration editor
2. **Marketplace**: Official plugin discovery
3. **Auto-updates**: Plugin update notifications
4. **Analytics**: Usage insights and optimization
5. **IDE Integration**: VS Code extension

## Conclusion

The Overture user experience is designed to be:

✅ **Simple**: Easy to get started (`overture init`, `overture new`)
✅ **Flexible**: Multiple profiles, custom locations
✅ **Git-Native**: Version control built-in
✅ **Team-Friendly**: Easy sharing via git repositories
✅ **Production-Ready**: Package manager installation
✅ **Future-Proof**: Extensible with profiles and templates

The `~/.overture/` directory pattern provides a consistent, predictable location while allowing users flexibility in managing their actual configuration repositories.

---

**Document Version**: 1.0
**Date**: 2025-10-19
**Status**: User experience design complete
