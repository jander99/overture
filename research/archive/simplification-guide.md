# Simplification Guide: Removing Team/Enterprise Features

## Overview

This document identifies all team/enterprise-specific features to remove from Overture's design. The core principle: **git repositories already handle sharing and collaboration**.

**Date**: 2025-10-19
**Rationale**: If users want to share configurations, they simply push to git and others clone. No special "team" features needed in the tool itself.

---

## What Gets Removed

### ❌ Enterprise Features
- Enterprise managed settings
- Managed policy configurations
- Enterprise-level precedence
- Organization-wide enforcement
- Enterprise licensing/business models

### ❌ Team-Specific Features
- Team coordination workflows
- Team lead personas
- Team sharing mechanisms (beyond basic git)
- Team member management
- Team-wide settings propagation
- Team caching (Nx Cloud for teams)
- Collaborative plugin development
- Real-time collaboration features

### ❌ Multi-User Concepts
- User vs team vs enterprise scopes
- Precedence hierarchies beyond user/project
- Team standards vs personal preferences
- Organization policies

---

## What Stays

### ✅ Individual User Features
- Personal configuration (`~/.overture/`)
- Project-level configuration (`.overture/` in project)
- User preferences and defaults
- Personal plugin development

### ✅ Git-Based Sharing (Natural)
- Version control (already exists via git)
- Repository cloning (standard git workflow)
- Collaborative editing (via git PRs/branches)
- History and rollback (git provides this)

### ✅ Project-Level Settings
- Project-specific plugins
- Project-specific conventions
- CLAUDE.md in project root (shared via git)

---

## Simplified Configuration Hierarchy

### Before (Complex - 4 Levels)
```
❌ Enterprise Managed Settings (highest precedence)
    ↓
❌ Team Settings
    ↓
✅ Project Settings (.overture/ in project)
    ↓
✅ User Settings (~/.overture/)
```

### After (Simple - 2 Levels)
```
✅ Project Settings (.overture/ in project)
    ↓
✅ User Settings (~/.overture/)
```

**How it works**:
- User has personal preferences in `~/.overture/`
- Project has specific config in `.overture/` (committed to git)
- Project settings override user settings (when in that project)
- If someone wants to share: push to git, others clone
- No special "team" mechanisms needed

---

## Document-Specific Removals

### 1. implementation-plan.md

#### Remove These Sections:
```markdown
❌ "Nx Cloud for team caching"
❌ "Share cache across team"
❌ "Team members download cached builds"
❌ "Enterprise features"
❌ "Team-Friendly: Nx Cloud for distributed caching"
❌ Challenge about "teams/power users"
❌ "Mode 2: Workspace (for teams/power users)"
```

#### Simplify:
```markdown
# Before
**Mode 1: Simple** (for beginners)
**Mode 2: Workspace** (for teams/power users)

# After
**Mode 1: Simple** (quick start, single plugin)
**Mode 2: Workspace** (multiple plugins, dependency management)
```

### 2. user-experience.md

#### Remove These Sections:
```markdown
❌ "Team Lead" persona
❌ "Journey 2: Team Lead Setting Up Standards"
❌ "Workflow 4: Team Sharing"
❌ "Team sharing via git repositories"
❌ "Team clones and uses"
```

#### Keep Only:
```markdown
✅ "Plugin Developer" persona
✅ "Individual Developer" persona
✅ Journey 1: New user creating first plugin
✅ Journey 3: Multi-project developer
```

#### Simplify Workflow 4:
```markdown
# Before: "Team Sharing"
# Team lead creates, team members clone...

# After: "Sharing Your Config"
# 1. Push your config to git
# 2. Anyone can clone and use
# 3. That's it - git handles the rest
```

### 3. architecture-recommendations.md

#### Remove:
```markdown
❌ "Enterprise-Level" configuration sections
❌ "Managed Settings Locations" for macOS/Linux
❌ "Use Cases" with "organizational hooks"
❌ "Enforce security policies"
❌ "Configure enterprise MCP servers"
❌ "Team-wide standards"
❌ "Organization policies"
```

#### Simplify Configuration Scope:
```markdown
# Before
1. Enterprise Managed Settings (cannot be overridden)
2. User Settings
3. Project Settings
4. Local Project Settings

# After
1. User Settings (~/.overture/settings.yaml)
2. Project Settings (.overture/settings.yaml)

That's it. Simple.
```

### 4. configuration-files.md

#### Remove:
```markdown
❌ "Enterprise Configuration" section
❌ "Managed settings always take precedence"
❌ "Enforce organizational policies"
❌ "Team coordination" sections
❌ "Team shares same conventions"
```

#### Simplify:
```markdown
# Configuration Locations (Simplified)

**User-Level**: ~/.overture/
- Personal preferences
- Your plugins

**Project-Level**: .overture/ (in project root)
- Project-specific settings
- Committed to git for sharing

That's it. Two levels.
```

### 5. VISION.md

#### Remove Entire Sections:
```markdown
❌ Section: "Plugin Certification Program" (implies organization)
❌ Section: "Plugin Development Grants" (implies funding body)
❌ Section: "Annual Overture Conference" (team/community focus)
❌ "Team collaboration" features
❌ "Collaborative plugin development"
❌ "Team chat integration"
❌ "Enterprise features"
❌ "Enterprise licensing"
❌ "Organization governance"
```

#### Keep Individual-Focused Features:
```markdown
✅ GitHub template repository
✅ Template library
✅ Interactive configuration builder
✅ Plugin marketplace (for discovery)
✅ Web UI (individual use)
✅ AI-assisted creation
✅ IDE integration
```

### 6. claude-md-coordination.md

#### Remove:
```markdown
❌ "Team shares same conventions"
❌ "Team coordination" patterns
❌ "Checked into git, shared with team"
❌ "Team benefits as well"
```

#### Simplify:
```markdown
# Before
"CLAUDE.md checked into git, shared with team"

# After
"CLAUDE.md committed to git repository"

(Natural consequence: anyone cloning the repo gets it)
```

---

## Simplified User Personas

### Before (3 Personas)
1. Plugin Developer
2. ❌ Team Lead (REMOVE)
3. Individual Developer

### After (2 Personas)
1. **Plugin Developer**
   - Creates plugins for personal use or public sharing
   - Manages configuration
   - May publish to marketplace

2. **Individual Developer**
   - Uses Overture for personal workflow
   - May create personal plugins
   - May clone others' configs from git

---

## Simplified Installation & Workflow

### Installation (Unchanged - Already Simple)
```bash
brew install overture
# or
apt install overture
```

### Personal Use
```bash
# Initialize your config
overture init ~/my-overture-config

# Create plugins
overture new plugin python-dev

# Build and use
overture build python-dev
overture sync --claude --copilot
```

### Sharing Your Config (No Special Features Needed)
```bash
# In your config directory
git add .
git commit -m "Update python dev plugin"
git push

# Done. Anyone can now:
git clone <your-repo-url> ~/.overture
overture build --all
overture sync --all
```

**That's it.** Git provides:
- ✅ Version control
- ✅ Sharing
- ✅ Collaboration (PRs)
- ✅ History
- ✅ Branching/merging
- ✅ Conflict resolution

No need to build any of this into Overture.

---

## Simplified Configuration Schema

### overture.yaml (User Config)

```yaml
# ~/.overture/config.yaml - SIMPLIFIED
version: "1.0"

# Just user preferences
user:
  name: "username"
  email: "user@example.com"

# Default settings for new plugins
defaults:
  plugin:
    author: "username"
    license: "MIT"
    version: "1.0.0"
  template: "basic"

# Tool integration
integrations:
  claude_code:
    enabled: true
    install_path: "~/.claude/plugins"
  copilot:
    enabled: true
    instructions_path: ".github/copilot-instructions.md"

# Build settings
build:
  output_dir: "./dist"
  optimize_tokens: true

# Removed:
# ❌ profiles (over-engineering for "teams")
# ❌ enterprise settings
# ❌ managed policy paths
# ❌ team coordination
```

### project.yaml (Project Config)

```yaml
# .overture/config.yaml in project - SIMPLIFIED
version: "1.0"

# Project-specific settings
project:
  name: "my-project"

# Plugins for this project
plugins:
  - python-dev
  - web-dev

# Project conventions
conventions:
  commit_style: "conventional"
  branch_format: "type/description"

# Removed:
# ❌ Team settings
# ❌ Team member lists
# ❌ Organizational policies
```

---

## Simplified CLI Commands

### Remove These Commands:
```bash
❌ overture team init
❌ overture team add-member
❌ overture team sync
❌ overture enterprise configure
❌ overture profile use work|personal  # Over-engineered
```

### Keep These Commands (Simplified):
```bash
✅ overture init [path]              # Initialize config
✅ overture new <type> <name>        # Create component
✅ overture validate [path]          # Validate config
✅ overture build [component]        # Build
✅ overture install [path]           # Install locally
✅ overture sync [--claude|--copilot] # Sync to tools
✅ overture link <path>              # Link config directory
✅ overture extract [options]        # Extract to CLAUDE.md
✅ overture publish [options]        # Publish to marketplace
```

**Removed complexity**:
- No profile management (just use different directories)
- No team commands (use git)
- No enterprise commands (not needed)

---

## Simplified Workflows

### Workflow 1: Personal Use (Primary)
```bash
# 1. Install
brew install overture

# 2. Initialize
overture init

# 3. Create plugins
overture new plugin my-tools

# 4. Build and use
overture build my-tools
overture sync --claude --copilot

# 5. Iterate
vim plugins/my-tools/plugin.yaml
overture build my-tools
```

### Workflow 2: Using Someone Else's Config
```bash
# 1. Clone their repo
git clone https://github.com/username/overture-config ~/.overture

# 2. Build
cd ~/.overture
overture build --all

# 3. Sync
overture sync --all

# 4. Done - you're using their exact setup
```

### Workflow 3: Contributing to Shared Config
```bash
# 1. Clone
git clone https://github.com/company/overture-config ~/.overture

# 2. Make changes
cd ~/.overture
overture new agent custom-agent
vim agents/custom-agent/agent.md

# 3. Test locally
overture build --all
overture sync --all

# 4. Propose changes (standard git workflow)
git checkout -b feat/add-custom-agent
git add .
git commit -m "feat: add custom agent"
git push origin feat/add-custom-agent

# 5. Open PR on GitHub
# Others review, approve, merge
# Standard git workflow - no special "team" features
```

### Workflow 4: Multiple Contexts (Simplified)
```bash
# Work projects
~/work-config/ → My work plugins

# Personal projects
~/personal-config/ → My personal plugins

# Switch contexts (no special commands)
overture link ~/work-config      # For work
overture link ~/personal-config  # For personal

# Or just use different directories
cd ~/work-config && overture build --all
cd ~/personal-config && overture build --all
```

No "profiles" needed. Just different directories.

---

## Benefits of Simplification

### 1. Reduced Complexity ✅
- 2 config levels instead of 4
- No enterprise concepts
- No team management
- No profile switching

### 2. Leverages Existing Tools ✅
- Git for version control
- Git for sharing
- Git for collaboration
- GitHub/GitLab for team coordination
- Git for history/rollback

### 3. Clearer Mental Model ✅
- User has personal preferences
- Projects have project settings
- Want to share? Push to git.
- Want someone else's setup? Clone their repo.

### 4. Less Code to Maintain ✅
- No team management logic
- No enterprise policy enforcement
- No complex precedence rules
- No profile management
- No team syncing

### 5. Better Unix Philosophy ✅
- Do one thing well (manage plugin configs)
- Compose with other tools (git for sharing)
- Don't reinvent wheels (git does sharing perfectly)

---

## What "Sharing" Actually Means

### The Git Way (Simple & Powerful)

**Sharing is just:**
1. Your config is in a git repo (already recommended)
2. Push to GitHub/GitLab (standard practice)
3. Others clone (standard git)
4. Others build locally (overture build)

**Collaboration is just:**
1. Fork or branch (standard git)
2. Make changes (standard git)
3. Open PR (standard GitHub)
4. Review and merge (standard GitHub)

**No special features needed in Overture.**

### What Overture Actually Provides

Overture's job is to:
1. ✅ Generate plugin structures
2. ✅ Validate configurations
3. ✅ Build plugins from configs
4. ✅ Sync to Claude Code / Copilot
5. ✅ Detect duplication
6. ✅ Optimize CLAUDE.md

Overture's job is NOT to:
1. ❌ Manage teams
2. ❌ Handle collaboration (git does this)
3. ❌ Enforce policies
4. ❌ Sync between users (git does this)
5. ❌ Manage permissions
6. ❌ Track team members

---

## Implementation Impact

### Removed Features = Less Work

**Don't need to build:**
- ❌ Enterprise settings system
- ❌ Team member management
- ❌ Profile switching logic
- ❌ Policy enforcement
- ❌ Team synchronization
- ❌ Nx Cloud integration for teams
- ❌ Collaborative editing
- ❌ Team caching

**Focus on core:**
- ✅ Component generation
- ✅ Dependency resolution
- ✅ Build system
- ✅ Validation
- ✅ Sync to tools

**Estimate: Saves 30-40% of implementation work**

---

## Updated Project Scope

### In Scope (Core Features)
1. Generate plugin components
2. Manage dependencies
3. Build plugins from configs
4. Validate configurations
5. Generate CLAUDE.md
6. Sync to Claude Code / Copilot
7. Detect duplication
8. Optimize for tokens
9. Provide templates
10. CLI for all the above

### Out of Scope (Git Handles This)
1. ~~Team management~~
2. ~~User collaboration~~ (git PRs)
3. ~~Sharing mechanisms~~ (git push/pull)
4. ~~Enterprise policies~~
5. ~~Team synchronization~~ (git sync)
6. ~~Profile management~~ (just use directories)
7. ~~Permission systems~~
8. ~~Team caching~~ (local caching is enough)

---

## Documentation Updates Required

### Files to Update

1. **implementation-plan.md**
   - Remove team caching sections
   - Simplify to 2-level config hierarchy
   - Remove enterprise sections
   - Remove "Mode 2: for teams"

2. **user-experience.md**
   - Remove "Team Lead" persona
   - Remove team sharing workflows
   - Simplify to individual workflows
   - Add simple "sharing = git push" section

3. **architecture-recommendations.md**
   - Remove enterprise configuration
   - Simplify config hierarchy to 2 levels
   - Remove team coordination features
   - Remove managed policy sections

4. **configuration-files.md**
   - Remove enterprise managed settings
   - Simplify precedence to project > user
   - Remove team standards sections

5. **VISION.md**
   - Remove enterprise features section
   - Remove team collaboration features
   - Remove certification program
   - Keep individual-focused features

6. **claude-md-coordination.md**
   - Remove team coordination language
   - Simplify to "commit to git" (not "share with team")

---

## Simplified Success Metrics

### Before (Complex)
```markdown
❌ Team adoption rate
❌ Team size per configuration
❌ Enterprise deployments
❌ Team collaboration events
❌ Cross-team plugin sharing
```

### After (Simple)
```markdown
✅ Individual installations
✅ Plugins created per user
✅ Public repositories shared
✅ Plugin marketplace listings
✅ User satisfaction (individual)
```

---

## Summary

### What We Learned
**Git repositories already provide everything needed for "team" use:**
- Version control
- Sharing (push/pull)
- Collaboration (PRs)
- History (git log)
- Branching/merging
- Conflict resolution

**Overture should focus on:**
- Managing plugin configurations
- Building plugin structures
- Syncing to AI tools

**Overture should NOT:**
- Try to be a collaboration tool
- Implement team management
- Build enterprise features
- Create sharing mechanisms

### The Simplified Model

```
User → Creates Config → Commits to Git → Optional: Push to GitHub
                                                    ↓
                                          Others can clone and use

No special "team" features needed.
Git does all of this already.
```

---

## Action Items

1. ✅ Create this simplification guide
2. ⏳ Update implementation-plan.md
3. ⏳ Update user-experience.md
4. ⏳ Update architecture-recommendations.md
5. ⏳ Update configuration-files.md
6. ⏳ Update VISION.md
7. ⏳ Update claude-md-coordination.md

---

**Document Version**: 1.0
**Date**: 2025-10-19
**Impact**: Removes 30-40% of planned features, focuses on core value
**Result**: Simpler, cleaner, more Unix-philosophy aligned tool
