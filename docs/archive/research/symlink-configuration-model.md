# Symlink-Based Configuration Model

> Research findings on using symlinks to decouple Overture configuration from target projects

## Key Insight

Instead of storing configuration inside each project (`.overture/` directory), use a **symlink** (`.overture`) that points to a configuration repository elsewhere on the filesystem. This provides:

- **Separation**: Config repo is separate from target projects
- **Reusability**: One config repo can serve multiple projects
- **Convenience**: Run `overture` from project directory
- **Visibility**: Symlink makes the config source explicit
- **Team sharing**: Config repo is version controlled, shared via git

## Directory Structure

```
~/projects/my-app/                    # Target project
  .overture -> ~/overture-configs/    # Symlink to config
  .claude/                            # Generated output (gitignored)
  .gitignore                          # Contains .claude/
  src/

~/overture-configs/                   # Config repository (git)
  config.yaml
  mcp-servers.yaml
  hooks.yaml
  commands/
  agents/
  skills/
  templates/
  scripts/
```

## User Workflow

### Initial Setup

```bash
# Developer has or creates an Overture config repo
git clone git@github.com:myuser/overture-configs.git ~/overture-configs

# Navigate to project
cd ~/projects/my-app

# Initialize Overture (creates symlink, generates .claude/)
overture init

# Work with Claude Code (uses generated .claude/)
claude
```

### Daily Usage

```bash
# Make changes to config
cd ~/overture-configs
vim commands/review.md
git add . && git commit -m "Update review command"

# Regenerate in project
cd ~/projects/my-app
overture generate  # Follows symlink, regenerates .claude/
```

### Team Member Onboarding

```bash
# Clone team's config repo
git clone git@github.com:company/team-overture.git ~/work/team-config

# Clone project
git clone git@github.com:company/project.git ~/work/project
cd ~/work/project

# Initialize with team config
overture init
# Wizard prompts for config location: ~/work/team-config
# Creates .overture symlink
# Generates .claude/ (not in git)

# Ready to work
claude
```

## Configuration Discovery Algorithm

When `overture generate` is executed:

```
1. Check: Does .overture exist?
   ├─ NO  → Run initialization wizard
   └─ YES → Is it a symlink?
          ├─ NO  → ERROR: ".overture must be a symlink"
          │        Suggest: "Run 'overture init' to fix"
          └─ YES → Does symlink target exist?
                 ├─ NO  → ERROR: "Broken symlink"
                 │        Suggest: "Run 'overture init' to recreate"
                 └─ YES → Is target a git repository?
                        ├─ NO  → WARNING: "Config not version controlled"
                        │        (Continue anyway)
                        └─ YES → Is it a valid Overture config?
                               ├─ NO  → ERROR: "Invalid config (missing config.yaml)"
                               │        Suggest: "Run 'overture init' to reset"
                               └─ YES → ✓ Proceed with generation
```

## Initialization Wizard

### Command

```bash
overture init
```

### Flow

```
┌──────────────────────────────────────────────────────────┐
│ Overture Configuration Setup                             │
└──────────────────────────────────────────────────────────┘

⚙️  No .overture configuration found

Where should Overture read config from?

  1. 📁 Use existing local directory
  2. 🌐 Clone from GitHub repository
  3. ✨ Create new config (default: ~/.overture-configs)

Choice [1-3]: 1

📂 Enter path to Overture config directory: ~/my-configs

🔍 Validating configuration...
   ✓ Directory exists
   ✓ Contains valid config.yaml
   ✓ Git repository detected (main branch, clean)

🔗 Creating symlink: .overture -> /home/jeff/my-configs

📦 Where should Claude Code configuration be generated?

  • Global (~/.claude)        Available in ALL projects
  • Local  (./.claude)        Only THIS project (team-shared)

Choice [global/local]: local

📝 Generating configuration...
   ✓ Generated .claude/settings.json
   ✓ Generated .claude/.mcp.json
   ✓ Copied 5 commands
   ✓ Copied 3 agents
   ✓ Copied 2 skills

🎯 Adding .claude/ to .gitignore

✅ Done! Your project is configured.

Run 'overture generate' anytime to regenerate.
Run 'overture validate' to check your config.
```

### Wizard Options Explained

**Option 1: Use existing local directory**

- User already has an Overture config repo
- Prompts for path
- Validates it's a proper Overture config
- Creates symlink

**Option 2: Clone from GitHub repository**

- Prompts for GitHub URL
- Clones to default location (e.g., `~/.overture-configs/{repo-name}`)
- Creates symlink
- Useful for team configs

**Option 3: Create new config**

- Creates new Overture config at `~/.overture-configs`
- Initializes with templates
- Optionally runs `git init`
- Creates symlink

## Git Integration

### Pre-Generation Checks

Before generating, Overture performs git checks on the config repo:

```bash
check_git_status() {
    local config_path=$(readlink .overture)

    cd "$config_path" || return 1

    # Check if git repo
    if ! git rev-parse --git-dir > /dev/null 2>&1; then
        echo "⚠️  Warning: Overture config is not version controlled"
        return 0
    fi

    # Get repo info
    local branch=$(git branch --show-current)
    local remote=$(git remote get-url origin 2>/dev/null)

    echo "📍 Config: $config_path"
    echo "🌿 Branch: $branch"
    if [[ -n "$remote" ]]; then
        echo "🔗 Remote: $remote"
    fi

    # Check for uncommitted changes
    if [[ -n $(git status --porcelain) ]]; then
        echo "⚠️  Warning: Uncommitted changes in config"
        echo ""
        git status --short
        echo ""
        read -p "Continue anyway? [y/N]: " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi

    # Check if behind remote
    git fetch origin --quiet
    local behind=$(git rev-list HEAD..origin/$branch --count 2>/dev/null)
    if [[ $behind -gt 0 ]]; then
        echo "⚠️  Warning: Config is $behind commits behind origin"
        read -p "Pull latest changes? [Y/n]: " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Nn]$ ]]; then
            git pull origin $branch
        fi
    fi
}
```

### Output Example

```
$ overture generate

📍 Config: /home/jeff/overture-configs
🌿 Branch: main
🔗 Remote: git@github.com:myuser/overture-configs.git
✓ Config is up to date

📝 Generating configuration...
   ✓ Generated .claude/settings.json
   ✓ Generated .claude/.mcp.json
   ✓ Copied 5 commands
   ✓ Copied 3 agents
   ✓ Copied 2 skills

✅ Done!
```

## Global vs Local Installation

### Decision Point

During `overture init`, user chooses where Claude Code configuration is generated:

**Global Installation** (`~/.claude/`)

- Configuration available in **all projects**
- Good for personal preferences, MCP servers
- Not shared with team
- Single source for all your work

**Local Installation** (`./.claude/`)

- Configuration specific to **this project only**
- Can be version controlled (if desired)
- Team members can share configuration
- Project-specific commands, agents, hooks

### Recommendation: Start with One or the Other

**Phase 1 Implementation**: Support only one scope per project

- Avoids deduplication complexity
- Simpler mental model
- Clearer ownership

**Potential issues with both global and local:**

1. Duplicate commands - Overridden (probably fine)
2. Duplicate hooks - Might execute twice! 🚨
3. Duplicate MCP servers - Unclear merge behavior
4. CLAUDE.md - Both loaded, could have conflicting instructions

**Phase 2 (Future)**: Smart merging with explicit control

```yaml
# config.yaml
target:
  scope: local

  # Explicitly control what goes where
  global:
    - mcp-servers.filesystem # Personal filesystem access
    - commands.personal.* # Personal commands

  local:
    - commands.team.* # Team commands
    - hooks.* # All hooks (project-specific)
    - agents.* # All agents
```

## Version Control Strategy

### Should .claude/ be gitignored?

Two approaches:

**Approach A: .claude/ is gitignored (recommended)**

- Generated artifact, not source
- Team shares the Overture config repo instead
- Each developer runs `overture generate` locally
- Cleaner git history
- Requires Overture to be installed

**Approach B: .claude/ is committed**

- Team doesn't need Overture installed
- Works immediately after clone
- Generated files in version control
- Risk of drift from source

### Wizard Prompt

```
Should .claude/ be version controlled?

  • No (recommended) - Generated locally by each developer
                       Requires: Team shares Overture config

  • Yes              - Committed to git, works immediately
                       Warning: Generated files in version control

Choice [no/yes]: no
```

### Auto-updating .gitignore

If user chooses not to version control `.claude/`:

```bash
# Overture automatically updates .gitignore
if ! grep -q "^\.claude/$" .gitignore 2>/dev/null; then
    echo ".claude/" >> .gitignore
    git add .gitignore
    echo "✓ Added .claude/ to .gitignore"
fi
```

## CLI Commands

### overture init

Initialize Overture in current directory.

**Options:**

- `--config <path>`: Use specific config directory
- `--clone <url>`: Clone config from GitHub
- `--create`: Create new config
- `--scope <global|local>`: Target scope (default: prompts)

**Examples:**

```bash
# Interactive wizard
overture init

# Use existing config
overture init --config ~/my-configs

# Clone from GitHub
overture init --clone git@github.com:company/team-config.git

# Create new config, install globally
overture init --create --scope global
```

### overture generate

Generate `.claude/` configuration from config repo.

**Behavior:**

1. Follows `.overture` symlink
2. Validates config
3. Checks git status (if repo)
4. Generates Claude Code files
5. Updates .gitignore if needed

**Options:**

- `--force`: Skip git checks and prompts
- `--dry-run`: Show what would be generated
- `--verbose`: Detailed output

**Examples:**

```bash
# Normal generation
overture generate

# Skip git checks
overture generate --force

# Preview without writing
overture generate --dry-run
```

### overture validate

Validate configuration without generating.

**Checks:**

- YAML syntax
- Schema validation
- File references exist
- Hook scripts are executable
- MCP server commands available
- No circular dependencies

**Example:**

```bash
$ overture validate

🔍 Validating configuration...
   ✓ config.yaml syntax valid
   ✓ mcp-servers.yaml schema valid
   ✓ hooks.yaml schema valid
   ✓ 5 commands validated
   ✓ 3 agents validated
   ✓ 2 skills validated
   ⚠ Warning: Hook script missing execute permission: scripts/format-code.sh

Run 'chmod +x scripts/format-code.sh' to fix

✅ Configuration is valid (1 warning)
```

### overture info

Show configuration information.

**Example:**

```bash
$ overture info

📍 Configuration
   Path: /home/jeff/overture-configs
   Git:  main branch (clean)
   URL:  git@github.com:myuser/overture-configs.git

🎯 Target
   Path:  /home/jeff/projects/my-app
   Scope: local (./.claude)

📦 Contents
   Commands: 5
   Agents:   3
   Skills:   2
   Hooks:    4
   MCP:      3 servers
```

### overture watch

Watch config repo for changes and auto-regenerate.

**Behavior:**

- Monitors config repo for file changes
- Automatically runs `overture generate`
- Useful during development

**Example:**

```bash
$ overture watch

👀 Watching for changes in /home/jeff/overture-configs...
   Press Ctrl+C to stop

📝 Change detected: commands/review.md
   Regenerating...
   ✓ Done

📝 Change detected: hooks.yaml
   Regenerating...
   ✓ Done
```

### overture link

Update `.overture` symlink to different config.

**Example:**

```bash
# Switch to different config
overture link ~/different-config

# Output:
# 🔗 Updating .overture symlink
#    Old: /home/jeff/overture-configs
#    New: /home/jeff/different-config
# ✓ Symlink updated
#
# Run 'overture generate' to apply new configuration
```

## Team Collaboration Workflows

### Scenario 1: Team Lead Sets Up Shared Config

````bash
# Create team config repo
mkdir ~/team-overture-config
cd ~/team-overture-config

# Initialize with Overture templates
overture init --create-here

# Customize for team
vim config.yaml
vim hooks.yaml
mkdir -p commands
vim commands/review.md
vim commands/test.md

# Version control
git init
git add .
git commit -m "Initial team Overture config"
git remote add origin git@github.com:company/overture-config.git
git push -u origin main

# Document in README
cat > README.md << 'EOF'
# Team Overture Configuration

Shared Claude Code configuration for our team.

## Setup

```bash
git clone git@github.com:company/overture-config.git ~/work/team-config
cd ~/work/your-project
overture init --config ~/work/team-config
````

## Usage

After making changes:

```bash
cd ~/work/team-config
git pull
cd ~/work/your-project
overture generate
```

EOF

git add README.md
git commit -m "Add setup instructions"
git push

````

### Scenario 2: Team Member Uses Shared Config

```bash
# Clone team's config repo
git clone git@github.com:company/overture-config.git ~/work/team-config

# Clone a project
git clone git@github.com:company/project.git ~/work/project
cd ~/work/project

# Initialize Overture with team config
overture init --config ~/work/team-config --scope local

# .overture symlink created
# .claude/ generated (gitignored)

# Ready to work
claude
````

### Scenario 3: Team Member Updates Config

```bash
# Make improvement to shared config
cd ~/work/team-config
vim commands/deploy.md

# Test locally
cd ~/work/project
overture generate --dry-run  # Preview changes
overture generate            # Apply changes

# Share with team
cd ~/work/team-config
git add commands/deploy.md
git commit -m "Add deployment command with safety checks"
git push

# Other team members update
# (In their project directory)
overture generate
# Detects config is behind origin
# Prompts to pull latest
# Regenerates .claude/
```

### Scenario 4: Personal + Team Config

Some developers may want personal preferences alongside team config:

**Option A: Separate configs for different projects**

```bash
# Personal projects use personal config
cd ~/personal/side-project
overture init --config ~/.overture-configs

# Work projects use team config
cd ~/work/company-project
overture init --config ~/work/team-config
```

**Option B: Config inheritance (future feature)**

```yaml
# ~/work/team-config/config.yaml
version: '1.0'

# Team standards
hooks:
  - matcher:
      tool: Edit
      pattern: '**/*.ts'
    events:
      postToolUse:
        - command: npx prettier --write "${CLAUDE_FILE_PATH}"
```

```yaml
# ~/.overture-configs/config.yaml
version: '1.0'

# Extend team config
extends: ~/work/team-config/config.yaml

# Add personal MCP servers
mcp-servers:
  personal-filesystem:
    transport: stdio
    command: npx
    args:
      - '@modelcontextprotocol/server-filesystem'
      - '${env.HOME}/Documents'
```

## File Reference Resolution

With symlink-based configs, `@` file references work as follows:

### In Overture Source Files

```markdown
## <!-- ~/overture-configs/commands/review.md -->

## description: "Code review with team standards"

Please review following our checklist:
@templates/review-checklist.md
```

When referenced in **Overture source files**, paths are relative to **config repo root**:

- `@templates/foo.md` → `~/overture-configs/templates/foo.md`

### During Generation

Overture processes `@` references in two ways:

**Option 1: Copy and Rewrite**

Source:

```markdown
@templates/review-checklist.md
```

Generated (`.claude/commands/review.md`):

```markdown
@.claude/templates/review-checklist.md
```

Overture copies `templates/review-checklist.md` to `.claude/templates/review-checklist.md`

**Option 2: Inline**

Source:

```markdown
@templates/review-checklist.md
```

Generated (`.claude/commands/review.md`):

```markdown
## Review Checklist

- [ ] Code quality
- [ ] Security
- [ ] Performance
- [ ] Tests
```

Content is inlined directly.

### In Claude Code Runtime

When Claude Code executes commands, `@` references resolve relative to **project root** (where `.claude/` is):

```
User runs: /review

Claude Code expands:
@.claude/templates/review-checklist.md
→ /home/jeff/projects/my-app/.claude/templates/review-checklist.md
```

## Benefits of Symlink Approach

### 1. Clear Separation of Concerns

- Configuration source (Overture repo) is separate from projects
- Generated artifacts (`.claude/`) are clearly identified
- No confusion about what to edit vs what is generated

### 2. Reusability

- One Overture config can serve many projects
- Personal config for all your side projects
- Team config for all work projects
- No duplication of configuration across projects

### 3. Version Control Clarity

- Config repo has clear ownership and history
- Projects don't need to track generated files
- Team can review config changes through PRs

### 4. Discoverability

- `.overture` symlink is visible in directory listing
- `ls -la` shows where config comes from
- Easy to audit which config a project uses

### 5. Flexibility

- Easy to switch configs with `overture link`
- Can test config changes locally before sharing
- Support both personal and team workflows

### 6. Simplicity

- Run `overture` from any project directory
- No need to remember where config lives
- Symlink makes relationship explicit

## Open Questions & Future Considerations

### 1. Config Repository Templates

Should Overture provide starter templates?

```bash
overture init --template basic
overture init --template team
overture init --template fullstack
```

### 2. Multiple Config Profiles

Should one config repo support multiple profiles?

```
~/overture-configs/
  profiles/
    personal.yaml
    work.yaml
    client-a.yaml
```

```bash
overture generate --profile work
```

### 3. Config Registry

Should there be a registry of public Overture configs?

```bash
overture init --from overture-hub/react-team
overture init --from overture-hub/python-data-science
```

### 4. Automatic Updates

Should Overture watch the config repo and auto-regenerate?

```bash
# In project directory, runs in background
overture watch &

# Any change to ~/overture-configs triggers regeneration
```

### 5. Config Composition

Should configs support composition/inheritance?

```yaml
# Project-specific config
extends:
  - ~/work/team-base-config
  - ~/.overture-configs/personal

# Override specific items
hooks:
  - override: team-base-config.prettier-hook
    disabled: true # Don't use team's prettier hook
```

## Next Steps

1. Implement symlink discovery algorithm
2. Build initialization wizard with all 3 options
3. Add git integration checks
4. Design config validation schema
5. Implement generate command with file processing
6. Create starter templates for common setups
7. Write comprehensive CLI documentation
8. Build test suite for different config scenarios
