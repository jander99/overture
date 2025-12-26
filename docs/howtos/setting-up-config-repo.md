---
title: Setting Up an Overture Configuration Repository
created: 2025-12-26T02:49:29Z
last_modified: 2025-12-26T02:49:29Z
author: Jeff Anderson
type: documentation
tags: [overture, configuration, setup, git, dotfiles, repository]
---

# Setting Up an Overture Configuration Repository

This guide walks you through creating a dedicated configuration repository for Overture, enabling you to version control your MCP servers, Agent Skills, and AI client configurations.

## Why Use a Config Repository?

An Overture config repository provides:

- **Version Control** - Track changes to your MCP configurations and Agent Skills
- **Portability** - Clone your setup to new machines in seconds
- **Backup** - Never lose your carefully crafted configurations
- **Collaboration** - Share skills and MCP setups with team members
- **Dotfiles Integration** - Manage alongside your other development environment configs

## Repository Structure

A typical Overture config repository contains:

```
.config/overture/              # or just overture-config/
├── config.yaml                # Main Overture configuration
├── skills/                    # Agent Skills directory
│   ├── markdown-editor/       # Example skill
│   │   └── SKILL.md
│   └── skill-helper/          # Another example skill
│       └── SKILL.md
├── .gitignore                 # Git ignore patterns
└── README.md                  # Documentation
```

## Step 1: Choose Your Repository Location

You have two main options for organizing your config repository:

### Option A: Standalone Repository

Create a dedicated repository (recommended for sharing/collaboration):

```bash
# Create repository
mkdir -p ~/overture-config
cd ~/overture-config
git init
```

Later, you'll symlink or configure Overture to use this location.

### Option B: Dotfiles Integration

If you already have a dotfiles repository, add Overture configuration to it:

```bash
cd ~/dotfiles
mkdir -p .config/overture
```

## Step 2: Initialize Configuration

Create your base `config.yaml`:

```bash
cat > config.yaml << 'EOF'
version: '1.0'

# MCP Server Configurations
mcp:
  # File system access for AI clients
  filesystem:
    command: npx
    args:
      - '-y'
      - '@modelcontextprotocol/server-filesystem'
      - /home  # Adjust path as needed
    transport: stdio

  # Persistent memory across sessions
  memory:
    command: npx
    args:
      - '-y'
      - '@modelcontextprotocol/server-memory'
    transport: stdio

# Client Configuration
clients:
  claude-code:
    enabled: true
  opencode:
    enabled: true
  copilot-cli:
    enabled: true

# Sync Settings
sync:
  backup: true
  backupDir: ~/.config/overture/backups
  backupRetention: 10
  mergeStrategy: append
  autoDetectClients: true
EOF
```

## Step 3: Add Agent Skills

Create a skills directory structure:

```bash
# Create skills directory
mkdir -p skills

# Example: Add a markdown-editor skill
mkdir -p skills/markdown-editor
cat > skills/markdown-editor/SKILL.md << 'EOF'
---
name: markdown-editor
description: Create, write, edit, and manage markdown files with proper formatting
license: MIT
compatibility: opencode
---

## What I do

- Create and write new markdown files (.md)
- Edit and update existing markdown documentation
- Format markdown with consistent YAML frontmatter
- Organize documentation by type

## When to use me

Use this skill when creating or editing markdown documentation files.

## How to use me

Simply ask to create or edit a markdown file, and I'll handle:
- Proper YAML frontmatter structure
- Appropriate file location
- Consistent formatting conventions
- Directory creation if needed
EOF
```

## Step 4: Configure Git Ignore

Create a `.gitignore` to exclude temporary files:

```bash
cat > .gitignore << 'EOF'
# Overture backups (these are machine-specific)
backups/

# OS-specific files
.DS_Store
Thumbs.db

# Editor files
*.swp
*.swo
*~
.vscode/
.idea/

# Sensitive environment files (if you create local overrides)
*.local.yaml
.env
EOF
```

## Step 5: Create Documentation

Add a `README.md` to document your configuration:

````bash
cat > README.md << 'EOF'
# My Overture Configuration

This repository contains my personal Overture configuration for managing AI coding assistants.

## What's Configured

### MCP Servers
- **filesystem** - File system access for AI clients
- **memory** - Persistent context across sessions

### AI Clients
- Claude Code
- OpenCode
- GitHub Copilot CLI

### Agent Skills
- **markdown-editor** - Markdown file management

## Quick Start

### On a New Machine

1. Clone this repository:
   ```bash
   git clone <your-repo-url> ~/.config/overture
````

2. Install Overture:

   ```bash
   npm install -g overture
   ```

3. Sync configurations:
   ```bash
   cd ~/.config/overture
   overture sync
   ```

### Updating Configuration

After modifying `config.yaml` or adding skills:

```bash
cd ~/.config/overture
git add .
git commit -m "Update configuration"
git push
overture sync
```

## Learn More

- [Overture Documentation](https://github.com/jander99/overture)
- [Configuration Schema](https://github.com/jander99/overture/blob/main/docs/overture-schema.md)
  EOF

````

## Step 6: Commit Initial Configuration

```bash
git add .
git commit -m "Initial Overture configuration"
````

## Step 7: Push to Remote (Optional)

### GitHub (Public or Private)

```bash
# Create a new repository on GitHub, then:
git remote add origin https://github.com/yourusername/overture-config.git
git branch -M main
git push -u origin main
```

### Private Self-Hosted Git

```bash
git remote add origin git@your-server.com:overture-config.git
git push -u origin main
```

## Step 8: Link to Overture

Overture looks for configuration in `~/.config/overture/config.yaml` by default.

### If Using Standalone Repository

Create a symlink:

```bash
# From your home directory
ln -s ~/overture-config ~/.config/overture
```

### If Using Dotfiles Repository

Ensure your dotfiles setup creates the symlink:

```bash
# In your dotfiles installation script
ln -s ~/dotfiles/.config/overture ~/.config/overture
```

## Step 9: Sync and Verify

```bash
# Sync configuration to all enabled clients
overture sync

# Verify installation
overture doctor

# List configured MCP servers
overture mcp list
```

## Deploying to a New Machine

On a new development machine:

```bash
# 1. Install Overture
npm install -g overture

# 2. Clone your config repository
git clone <your-repo-url> ~/.config/overture

# 3. Sync configurations
cd ~/.config/overture
overture sync

# 4. Verify
overture doctor
```

## Managing Your Configuration

### Adding a New MCP Server

1. Edit `config.yaml`:

   ```yaml
   mcp:
     github:
       command: docker
       args:
         - run
         - --rm
         - -i
         - ghcr.io/github/github-mcp-server:latest
       env:
         GITHUB_TOOLSETS: 'context,issues,repos'
   ```

2. Commit and sync:
   ```bash
   git add config.yaml
   git commit -m "Add GitHub MCP server"
   overture sync
   ```

### Adding a New Agent Skill

1. Create skill directory and SKILL.md:

   ```bash
   mkdir -p skills/my-new-skill
   # Edit skills/my-new-skill/SKILL.md
   ```

2. Commit and sync:
   ```bash
   git add skills/my-new-skill
   git commit -m "Add my-new-skill"
   overture sync
   ```

### Removing Backups from Version Control

The `backupDir` in `config.yaml` defaults to `~/.config/overture/backups`. These are machine-specific and should not be committed:

```bash
# Already in .gitignore, but if committed:
git rm -r --cached backups/
git commit -m "Remove backups from version control"
```

## Environment Variables

If your MCP servers require API keys or tokens:

1. **Never commit secrets to git**
2. Use environment variable expansion in `config.yaml`:

   ```yaml
   mcp:
     github:
       env:
         GITHUB_TOKEN: '${GITHUB_TOKEN}'
   ```

3. Set environment variables on each machine:
   ```bash
   # In ~/.bashrc or ~/.zshrc
   export GITHUB_TOKEN="your-token-here"
   ```

## Sharing with Team Members

### Public Repository (Open Source Skills)

1. Create a public GitHub repository
2. Team members clone and symlink:
   ```bash
   git clone https://github.com/yourteam/overture-config.git ~/.config/overture
   overture sync
   ```

### Private Repository (Team/Company)

1. Create a private GitHub/GitLab repository
2. Team members authenticate and clone:
   ```bash
   git clone git@github.com:yourteam/overture-config.git ~/.config/overture
   overture sync
   ```

### Skill Marketplace (Coming Soon)

In future versions, Overture will support installing skills from a marketplace:

```bash
overture skill install markdown-editor
overture skill install from-repo https://github.com/user/skill-repo.git
```

## Best Practices

### Organize Skills by Category

```
skills/
├── documentation/
│   ├── markdown-editor/
│   └── api-doc-generator/
├── testing/
│   ├── test-helper/
│   └── coverage-analyzer/
└── development/
    ├── code-reviewer/
    └── refactor-assistant/
```

### Use Descriptive Commit Messages

```bash
git commit -m "feat: add GitHub MCP server with full toolsets"
git commit -m "fix: update filesystem MCP path for multi-user system"
git commit -m "docs: add usage examples for markdown-editor skill"
```

### Tag Stable Versions

```bash
git tag -a v1.0.0 -m "Stable configuration with core MCP servers"
git push origin v1.0.0
```

### Keep a CHANGELOG

Document significant changes:

```markdown
# Changelog

## [1.1.0] - 2025-01-15

### Added

- GitHub MCP server with issue tracking
- New skill: api-doc-generator

### Changed

- Updated memory MCP to use Docker container

### Removed

- Deprecated sqlite MCP server
```

## Troubleshooting

### Symlink Not Working

Verify symlink exists:

```bash
ls -la ~/.config/overture
```

Should show:

```
lrwxrwxrwx 1 user user 24 Dec 25 10:00 /home/user/.config/overture -> /home/user/overture-config
```

### Sync Not Picking Up Changes

```bash
# Verify Overture is reading from correct location
overture --debug sync

# Force re-sync
rm -rf ~/.claude.json ~/.github/mcp.json ~/opencode.json
overture sync
```

### Skills Not Appearing in Clients

Check skill file structure:

```bash
# Each skill MUST have a SKILL.md file
find skills/ -name "SKILL.md"
```

Verify frontmatter format:

```yaml
---
name: skill-name
description: Brief description
---
```

## Additional Resources

- [Overture Configuration Schema](../overture-schema.md)
- [Configuration Examples](../examples.md)
- [Importing Existing Configs](./importing-existing-configs.md)
- [Testing MCP Changes](./testing-mcp-changes.md)

## Example Repositories

- [jander99/overture-config](https://github.com/jander99/overture-config) - Reference implementation
- More examples coming soon!
