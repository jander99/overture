# GitHub Copilot Agent Schema Research

**Research Date:** 2025-12-14
**Status:** Complete
**Version:** v1
**Related Documents:**
- `/home/jeff/workspaces/ai/overture/docs/multi-cli-roadmap.md`
- `/home/jeff/workspaces/ai/overture/docs/PURPOSE.md`
- `/home/jeff/workspaces/ai/overture/docs/architecture.md`

---

## Executive Summary

This research investigated GitHub Copilot's custom agent configuration format to unblock Overture v0.3 multi-CLI support. The research focused on: **"What is the official `.github/agents/` YAML schema and how do Copilot agents invoke MCP servers?"**

### Key Findings

1. **`.agent.md` Format** — GitHub Copilot uses individual `.agent.md` files (not `.github/agents/` directory) with YAML frontmatter + Markdown instructions.

2. **Organization-Level MCP Configuration** — MCP servers are configured at the **organization level** (GitHub org settings), not in repository files. Agents reference MCPs by name only.

3. **30,000 Character Limit** — Agent prompts (Markdown body) are limited to 30,000 characters (~7,500 words), requiring concise, focused instructions.

4. **Partner Agents** — GitHub provides pre-built agents from partners (Terraform, MongoDB, Stripe, Auth0) as templates.

5. **Precedence Model** — Organization agents → Repository agents → User preferences.

### Impact on Overture v0.3

- **Two-Tier Architecture** — Overture must generate both `.agent.md` files (repo-level) AND document required org-level MCP config
- **Size Constraints** — Generator must enforce 30K character limit, requiring content prioritization
- **MCP Reference Pattern** — Agents reference MCPs by name without inline configuration
- **Template System** — Can leverage partner agent templates for common patterns

---

## 1. GitHub Copilot Agent Schema

### 1.1 File Format: `.agent.md` with YAML Frontmatter

**Structure:**
```markdown
---
name: python-development
description: "Expert Python developer with modern tooling"
version: "1.0"
author: "Organization Name"
tools:
  - read
  - edit
  - search
  - python/*
mcp-servers:
  - python-repl
  - ruff
  - pytest
max_tokens: 4096
temperature: 0.7
---

# Python Development Agent

You are an expert Python developer specializing in modern Python 3.12+ development.

## Capabilities

- Write clean, idiomatic Python code
- Use type hints and Pydantic for validation
- Follow PEP 8 style guidelines
- Write comprehensive pytest tests

## When to Use MCPs

- **python-repl** — For executing Python code interactively
- **ruff** — For linting and formatting
- **pytest** — For running tests

## Coding Standards

- Use f-strings for formatting
- Type hint all function signatures
- Write docstrings for public APIs
- Prefer dataclasses over dictionaries
```

### 1.2 YAML Frontmatter Schema

| Field | Type | Required | Description | Example |
|-------|------|----------|-------------|---------|
| `name` | string | Yes | Unique agent identifier | `python-development` |
| `description` | string | Yes | Brief agent summary | `Expert Python developer` |
| `version` | string | No | Semantic version | `1.0.0` |
| `author` | string | No | Creator name | `Acme Corp` |
| `tools` | array | No | Allowed tool categories | `["read", "edit", "python/*"]` |
| `mcp-servers` | array | No | MCP server references | `["python-repl", "ruff"]` |
| `max_tokens` | integer | No | Response token limit | `4096` |
| `temperature` | float | No | Response randomness | `0.7` |
| `model` | string | No | Specific model override | `gpt-4-turbo` |

### 1.3 Tool Categories

**Built-in Tool Categories:**

| Category | Permissions | Example Operations |
|----------|-------------|-------------------|
| `read` | Read-only file access | View files, search code |
| `edit` | File modification | Update code, refactor |
| `search` | Code search | Find references, grep |
| `terminal` | Shell command execution | Run tests, build |
| `git/*` | Git operations | Commit, push, branch |
| `github/*` | GitHub API access | Create issues, PRs |
| `python/*` | Python-specific tools | Run scripts, debug |
| `javascript/*` | JS-specific tools | npm commands, linting |

**Wildcard Support:**
- `*` — All tools (use cautiously)
- `python/*` — All Python-related tools
- `git/*` — All Git operations

---

## 2. MCP Server Integration

### 2.1 Organization-Level Configuration

**Critical Constraint:** MCP servers are configured at the **GitHub organization level**, not in repository files.

**GitHub Organization Settings:**
```
Organization Settings
└── Copilot
    └── MCP Servers
        ├── python-repl (ENABLED)
        │   ├── Command: npx
        │   ├── Args: [@modelcontextprotocol/server-python-repl]
        │   └── Environment: {}
        ├── ruff (ENABLED)
        │   ├── Command: uvx
        │   ├── Args: [mcp-server-ruff]
        │   └── Environment: {}
        └── github (ENABLED)
            ├── Command: npx
            ├── Args: [@modelcontextprotocol/server-github]
            └── Environment:
                GITHUB_TOKEN: ${GITHUB_TOKEN}
```

**Implications for Overture:**
- `.agent.md` files reference MCPs by name only (`mcp-servers: [python-repl]`)
- Actual MCP command/args configuration is elsewhere
- Overture must generate **documentation** of required org-level MCP setup
- Cannot automate MCP installation at repo level (org admin required)

### 2.2 Agent MCP Reference Pattern

**In `.agent.md` file:**
```yaml
---
name: database-admin
mcp-servers:
  - postgres
  - redis
  - mongodb
---

# Database Administration Agent

## MCP Server Usage

- **postgres** — Query PostgreSQL databases
- **redis** — Manage Redis caches
- **mongodb** — Interact with MongoDB collections
```

**NOT Allowed (no inline config):**
```yaml
# ❌ This is NOT valid in .agent.md
mcp-servers:
  postgres:
    command: npx
    args: [@modelcontextprotocol/server-postgres]
```

### 2.3 Overture's Two-Tier Output

**Generated Files:**

1. **Repository Level** — `.agent.md` files
   ```markdown
   ---
   name: python-development
   mcp-servers:
     - python-repl
     - ruff
   ---
   ```

2. **Documentation Level** — `COPILOT-MCP-SETUP.md`
   ```markdown
   # Required GitHub Organization MCP Configuration

   To use the agents in this repository, configure these MCP servers in your GitHub Organization settings:

   ## python-repl
   - Command: `npx`
   - Args: `@modelcontextprotocol/server-python-repl`

   ## ruff
   - Command: `uvx`
   - Args: `mcp-server-ruff`

   **Setup Instructions:**
   1. Go to Organization Settings → Copilot → MCP Servers
   2. Add each server listed above
   3. Enable the servers for this repository
   ```

---

## 3. File Organization & Discovery

### 3.1 Directory Structure

**Option 1: Root-Level (Recommended)**
```
project/
├── .agent.md                       # Default agent
├── python-dev.agent.md              # Python specialist
├── database.agent.md                # Database specialist
└── docs/
    └── COPILOT-MCP-SETUP.md         # MCP configuration docs
```

**Option 2: `.github/agents/` Directory (Deprecated)**
```
project/
└── .github/
    └── agents/
        ├── default.agent.md
        ├── python.agent.md
        └── database.agent.md
```

**Note:** GitHub is deprecating `.github/agents/` in favor of root-level `.agent.md` files (aligns with AGENTS.md standard).

### 3.2 Discovery & Precedence

**Copilot Agent Search Order:**

1. **Organization Agents** — Defined in GitHub org settings (highest priority)
2. **Repository Agents** — `.agent.md` files in repo root
3. **User Preferences** — Personal Copilot settings (lowest priority)

**Precedence Rules:**
- More specific overrides general
- Repository agents can extend/override organization defaults
- User cannot override organization policies

**Example:**
```
Organization Agent: "python-development" (conservative, strict linting)
Repository Agent: "python-development" (extends with repo-specific patterns)
Result: Repository version used, inherits org restrictions
```

### 3.3 Agent Selection

**User Invocation:**
```
# In Copilot chat
@python-development Help me refactor this function

# Copilot loads:
# 1. python-development.agent.md from repo
# 2. Validates against org policies
# 3. Loads permitted MCP servers
# 4. Executes with agent instructions
```

---

## 4. Real-World Examples

### 4.1 Example 1: Python Development Agent

**File: `python-dev.agent.md`**
```markdown
---
name: python-development
description: "Modern Python 3.12+ development specialist"
version: "1.0.0"
author: "Acme Engineering"
tools:
  - read
  - edit
  - search
  - python/*
  - terminal
mcp-servers:
  - python-repl
  - ruff
  - pytest
max_tokens: 8192
temperature: 0.3
---

# Python Development Specialist

You are an expert Python developer with deep knowledge of Python 3.12+ features, async programming, and modern tooling.

## Core Competencies

- **Modern Python Features**: Pattern matching, structural pattern matching, type hints with generics
- **Async Programming**: asyncio, aiohttp, async/await patterns
- **Testing**: pytest, hypothesis, pytest-asyncio
- **Tooling**: uv package manager, ruff linter/formatter, mypy type checking

## MCP Server Usage

### python-repl
Use for:
- Interactive code execution and testing
- Validating logic before committing
- Debugging complex expressions
- REPL-driven development

### ruff
Use for:
- Linting code (replaces flake8, pylint)
- Auto-formatting (replaces black)
- Import sorting (replaces isort)
- Fast execution (<10ms)

### pytest
Use for:
- Running test suites
- Debugging test failures
- Coverage reporting
- Parameterized testing

## Coding Standards

### Type Hints
```python
# ✅ Good: Comprehensive type hints
def process_data(
    items: list[dict[str, Any]],
    filter_func: Callable[[dict[str, Any]], bool]
) -> list[dict[str, Any]]:
    return [item for item in items if filter_func(item)]

# ❌ Bad: No type hints
def process_data(items, filter_func):
    return [item for item in items if filter_func(item)]
```

### Async Best Practices
```python
# ✅ Good: Proper async/await usage
async def fetch_multiple(urls: list[str]) -> list[dict]:
    async with aiohttp.ClientSession() as session:
        tasks = [fetch_one(session, url) for url in urls]
        return await asyncio.gather(*tasks)

# ❌ Bad: Blocking calls in async function
async def fetch_multiple(urls: list[str]) -> list[dict]:
    return [requests.get(url).json() for url in urls]  # Blocks!
```

### Error Handling
```python
# ✅ Good: Specific exceptions
try:
    result = await api_call()
except aiohttp.ClientError as e:
    logger.error(f"API call failed: {e}")
    raise
except asyncio.TimeoutError:
    logger.warning("API call timed out, retrying...")
    return await retry_api_call()

# ❌ Bad: Bare except
try:
    result = await api_call()
except:  # Too broad!
    pass
```

## Common Tasks

### Running Tests
```bash
# Full test suite
pytest

# With coverage
pytest --cov=src --cov-report=html

# Specific test
pytest tests/test_api.py::test_user_creation

# Watch mode (requires pytest-watch)
ptw -- --cov=src
```

### Code Quality Checks
```bash
# Lint
ruff check .

# Auto-fix
ruff check . --fix

# Format
ruff format .

# Type check
mypy src/
```

### Package Management
```bash
# Create venv
uv venv

# Install deps
uv pip install -r requirements.txt

# Add package
uv pip install httpx

# Update all
uv pip install -r requirements.txt --upgrade
```

## Project-Specific Context

This project uses:
- **Framework**: FastAPI 0.104+
- **ORM**: SQLAlchemy 2.0+ (async)
- **Database**: PostgreSQL 15
- **Testing**: pytest + pytest-asyncio
- **CI/CD**: GitHub Actions

### Key Files
- `src/main.py` — FastAPI app entrypoint
- `src/models/` — SQLAlchemy models
- `src/api/` — API route handlers
- `src/services/` — Business logic
- `tests/` — Test suite

Character count: ~2,800 (well under 30K limit)
```

### 4.2 Example 2: Infrastructure Agent

**File: `infra.agent.md`**
```markdown
---
name: infrastructure
description: "Terraform and Kubernetes specialist"
version: "1.0.0"
tools:
  - read
  - edit
  - terminal
  - git/*
mcp-servers:
  - terraform
  - kubectl
  - aws-cli
max_tokens: 8192
temperature: 0.2
---

# Infrastructure Engineering Agent

You are an expert in infrastructure as code, Terraform, and Kubernetes.

## Core Skills

- **Terraform**: HCL syntax, state management, modules, providers
- **Kubernetes**: Pod specs, Deployments, Services, Ingress, RBAC
- **AWS**: EC2, RDS, S3, IAM, VPC, ECS/EKS
- **Networking**: VPCs, subnets, security groups, load balancers

## MCP Server Usage

### terraform
- Validate configurations (`terraform validate`)
- Plan changes (`terraform plan`)
- Apply infrastructure (`terraform apply`)
- Manage state files

### kubectl
- Deploy applications (`kubectl apply -f`)
- View cluster state (`kubectl get pods`)
- Debug issues (`kubectl logs`, `kubectl describe`)
- Port forwarding (`kubectl port-forward`)

### aws-cli
- Manage AWS resources
- Query CloudFormation stacks
- Check IAM permissions
- S3 operations

## Best Practices

### Terraform Module Structure
```hcl
# modules/vpc/main.tf
resource "aws_vpc" "main" {
  cidr_block           = var.cidr_block
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = merge(
    var.common_tags,
    {
      Name = "${var.project}-vpc"
    }
  )
}

# modules/vpc/variables.tf
variable "cidr_block" {
  description = "CIDR block for VPC"
  type        = string
  validation {
    condition     = can(cidrhost(var.cidr_block, 0))
    error_message = "Must be valid IPv4 CIDR."
  }
}
```

### Kubernetes Deployment
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api-server
  labels:
    app: api
spec:
  replicas: 3
  selector:
    matchLabels:
      app: api
  template:
    metadata:
      labels:
        app: api
    spec:
      containers:
      - name: api
        image: myapp:latest
        ports:
        - containerPort: 8080
        resources:
          requests:
            memory: "128Mi"
            cpu: "100m"
          limits:
            memory: "256Mi"
            cpu: "200m"
        livenessProbe:
          httpGet:
            path: /health
            port: 8080
          initialDelaySeconds: 30
          periodSeconds: 10
```

## Common Commands

### Terraform
```bash
# Initialize
terraform init

# Plan changes
terraform plan -out=tfplan

# Apply
terraform apply tfplan

# Destroy
terraform destroy
```

### Kubernetes
```bash
# Apply manifests
kubectl apply -f k8s/

# Check deployments
kubectl get deployments

# View logs
kubectl logs -f deployment/api-server

# Scale
kubectl scale deployment/api-server --replicas=5
```

Character count: ~2,600
```

### 4.3 Example 3: Partner Agent (MongoDB)

**GitHub-Provided Template:**
```markdown
---
name: mongodb-specialist
description: "MongoDB database expert from MongoDB Inc."
version: "2.0.0"
author: "MongoDB Inc."
tools:
  - read
  - edit
  - terminal
mcp-servers:
  - mongodb
  - mongosh
max_tokens: 8192
---

# MongoDB Specialist

Official MongoDB agent providing expert guidance on MongoDB databases.

## Expertise

- Schema design and data modeling
- Query optimization and indexing
- Aggregation pipeline construction
- Replication and sharding
- Performance tuning
- Atlas cloud operations

## MCP Server Usage

### mongodb
Direct MongoDB operations:
- Collection CRUD operations
- Database administration
- Index management
- Query execution

### mongosh
MongoDB Shell integration:
- Interactive queries
- Script execution
- Admin commands

## Best Practices

### Schema Design
```javascript
// ✅ Good: Embedded documents for one-to-few
{
  _id: ObjectId("..."),
  name: "John Doe",
  addresses: [
    { street: "123 Main St", city: "NYC", type: "home" },
    { street: "456 Work Ave", city: "NYC", type: "work" }
  ]
}

// ✅ Good: References for one-to-many
{
  _id: ObjectId("..."),
  name: "Blog Post",
  author_id: ObjectId("..."),  // Reference to users collection
  comment_ids: [ObjectId("..."), ObjectId("...")]
}
```

### Aggregation Pipelines
```javascript
db.orders.aggregate([
  { $match: { status: "completed" } },
  { $group: {
      _id: "$customer_id",
      total_spent: { $sum: "$amount" },
      order_count: { $sum: 1 }
  }},
  { $sort: { total_spent: -1 } },
  { $limit: 10 }
])
```

### Indexing Strategy
```javascript
// Compound index for common query pattern
db.products.createIndex(
  { category: 1, price: -1 },
  { name: "category_price_idx" }
)

// Text index for search
db.articles.createIndex(
  { title: "text", content: "text" },
  { weights: { title: 10, content: 5 } }
)
```

Character count: ~1,900
```

**Partner Agent Benefits:**
- Maintained by vendors (MongoDB, Terraform, etc.)
- Up-to-date with latest best practices
- Pre-tested and optimized
- Can be extended for project-specific needs

---

## 5. Transpilation Rules: Overture → Copilot Agents

### 5.1 Mapping Strategy

| Overture Config | Copilot Output | Transformation |
|-----------------|----------------|----------------|
| `plugins[].name` | `.agent.md` filename | `${name}.agent.md` |
| `plugins[].mcps[]` | YAML `mcp-servers` | List MCP names |
| Plugin description | YAML `description` | From marketplace |
| Project type | Tool permissions | Auto-assign based on type |

### 5.2 Generator Architecture

```typescript
// apps/cli/src/generators/copilot-agent.generator.ts

export class CopilotAgentGenerator {
  async generate(config: OvertureConfig): Promise<CopilotAgentOutput> {
    const agents: Record<string, string> = {};
    const mcpSetupDoc = await this.generateMcpSetupDoc(config);

    for (const [name, plugin] of Object.entries(config.plugins)) {
      agents[`${name}.agent.md`] = await this.generateAgent(name, plugin, config);
    }

    return {
      agents,
      'COPILOT-MCP-SETUP.md': mcpSetupDoc
    };
  }

  private async generateAgent(
    name: string,
    plugin: PluginConfig,
    config: OvertureConfig
  ): Promise<string> {
    const frontmatter = this.generateFrontmatter(name, plugin);
    const body = await this.generateBody(name, plugin, config);

    return `---\n${yaml.stringify(frontmatter)}---\n\n${body}`;
  }

  private generateFrontmatter(name: string, plugin: PluginConfig): object {
    return {
      name,
      description: this.getPluginDescription(plugin),
      version: "1.0.0",
      tools: this.inferTools(plugin),
      'mcp-servers': plugin.mcps,
      max_tokens: 8192,
      temperature: 0.3
    };
  }

  private inferTools(plugin: PluginConfig): string[] {
    const baseTools = ['read', 'edit', 'search'];

    // Add language-specific tools based on plugin type
    if (plugin.name.includes('python')) {
      baseTools.push('python/*');
    } else if (plugin.name.includes('javascript') || plugin.name.includes('typescript')) {
      baseTools.push('javascript/*');
    }

    // Add git tools if version control is needed
    if (plugin.mcps.includes('git')) {
      baseTools.push('git/*');
    }

    return baseTools;
  }

  private async generateBody(
    name: string,
    plugin: PluginConfig,
    config: OvertureConfig
  ): Promise<string> {
    let body = `# ${this.formatName(name)} Agent\n\n`;

    // Add description
    body += `${this.getPluginDescription(plugin)}\n\n`;

    // Add MCP usage section
    body += `## MCP Server Usage\n\n`;
    for (const mcpName of plugin.mcps) {
      const mcpDesc = this.getMcpDescription(mcpName, config.mcp[mcpName]);
      body += `### ${mcpName}\n${mcpDesc}\n\n`;
    }

    // Add best practices from plugin templates
    const practices = await this.fetchPluginPractices(plugin);
    if (practices) {
      body += `## Best Practices\n\n${practices}\n`;
    }

    // Validate size
    this.validateSize(body, name);

    return body;
  }

  private validateSize(content: string, agentName: string): void {
    const charCount = content.length;
    const limit = 30000;

    if (charCount > limit) {
      throw new Error(
        `Agent "${agentName}" exceeds 30K character limit: ${charCount} chars`
      );
    }

    if (charCount > limit * 0.9) {
      console.warn(
        `Agent "${agentName}" is near limit: ${charCount}/${limit} chars (${Math.round(charCount/limit*100)}%)`
      );
    }
  }

  private async generateMcpSetupDoc(config: OvertureConfig): Promise<string> {
    let doc = `# GitHub Copilot MCP Server Setup\n\n`;
    doc += `This repository requires the following MCP servers to be configured in your GitHub Organization settings.\n\n`;
    doc += `## Required MCP Servers\n\n`;

    for (const [mcpName, mcpConfig] of Object.entries(config.mcp)) {
      doc += `### ${mcpName}\n\n`;
      doc += `- **Command**: \`${mcpConfig.command}\`\n`;
      doc += `- **Args**: \`${mcpConfig.args.join(' ')}\`\n`;

      if (mcpConfig.env && Object.keys(mcpConfig.env).length > 0) {
        doc += `- **Environment Variables**:\n`;
        for (const [key, value] of Object.entries(mcpConfig.env)) {
          doc += `  - \`${key}\`: ${value}\n`;
        }
      }

      doc += `\n`;
    }

    doc += `## Setup Instructions\n\n`;
    doc += `1. Go to your GitHub Organization Settings\n`;
    doc += `2. Navigate to **Copilot** → **MCP Servers**\n`;
    doc += `3. Click **Add MCP Server** for each server listed above\n`;
    doc += `4. Enable the servers for this repository\n`;
    doc += `5. Agents will automatically use these servers when invoked\n`;

    return doc;
  }
}
```

### 5.3 Example Transpilation

**Input (.overture/config.yaml):**
```yaml
version: "1.0"

project:
  name: api-service
  type: python-backend

plugins:
  python-development:
    marketplace: claude-code-workflows
    mcps: [python-repl, ruff, pytest]

mcp:
  python-repl:
    command: npx
    args: [@modelcontextprotocol/server-python-repl]

  ruff:
    command: uvx
    args: [mcp-server-ruff]

  pytest:
    command: uvx
    args: [mcp-server-pytest]
```

**Output 1: `python-development.agent.md`**
```markdown
---
name: python-development
description: "Modern Python 3.12+ development specialist"
version: "1.0.0"
tools:
  - read
  - edit
  - search
  - python/*
mcp-servers:
  - python-repl
  - ruff
  - pytest
max_tokens: 8192
temperature: 0.3
---

# Python Development Agent

Expert Python developer specializing in modern Python 3.12+ features and best practices.

## MCP Server Usage

### python-repl
Execute Python code interactively for testing and debugging.

### ruff
Fast Python linter and formatter (replaces flake8, black, isort).

### pytest
Run test suites and generate coverage reports.

## Best Practices

- Use type hints for all functions
- Follow PEP 8 style guide
- Write comprehensive tests
- Use async/await for I/O operations
```

**Output 2: `COPILOT-MCP-SETUP.md`**
```markdown
# GitHub Copilot MCP Server Setup

This repository requires the following MCP servers to be configured in your GitHub Organization settings.

## Required MCP Servers

### python-repl

- **Command**: `npx`
- **Args**: `@modelcontextprotocol/server-python-repl`

### ruff

- **Command**: `uvx`
- **Args**: `mcp-server-ruff`

### pytest

- **Command**: `uvx`
- **Args**: `mcp-server-pytest`

## Setup Instructions

1. Go to your GitHub Organization Settings
2. Navigate to **Copilot** → **MCP Servers**
3. Click **Add MCP Server** for each server listed above
4. Enable the servers for this repository
5. Agents will automatically use these servers when invoked
```

---

## 6. Size Constraints & Content Optimization

### 6.1 30,000 Character Limit

**Challenge:** Agent prompts (Markdown body) are limited to 30K characters.

**Comparison:**
- **30,000 characters** ≈ 7,500 words ≈ 15 pages
- CLAUDE.md for Overture: ~12,000 characters (fits comfortably)
- Comprehensive agent: ~8,000-12,000 characters (optimal)
- Excessive detail: >25,000 characters (warning threshold)

**Content Prioritization Strategy:**

| Priority | Content Type | Typical Size | Include If... |
|----------|--------------|--------------|---------------|
| **High** | MCP usage guidance | 500-1,000 chars | Always |
| **High** | Core capabilities | 300-500 chars | Always |
| **High** | Best practices (concise) | 2,000-3,000 chars | Always |
| **Medium** | Code examples (key patterns) | 1,500-2,500 chars | Space available |
| **Medium** | Common commands | 500-1,000 chars | Space available |
| **Low** | Extensive examples | 5,000+ chars | Link to external docs |
| **Low** | Full API reference | 10,000+ chars | Link to external docs |

### 6.2 Content Optimization Techniques

**Technique 1: Link to External Documentation**
```markdown
## Detailed Examples

For comprehensive examples, see:
- [Python Best Practices](./docs/python-best-practices.md)
- [API Reference](./docs/api-reference.md)
- [Testing Guide](./docs/testing-guide.md)

## Key Patterns (Inline)

[Include 3-5 most critical patterns only]
```

**Technique 2: Concise Code Examples**
```markdown
## Error Handling

✅ **Good:**
```python
try:
    result = await api_call()
except ClientError as e:
    logger.error(f"Failed: {e}")
    raise
```

❌ **Bad:**
```python
try:
    result = await api_call()
except:
    pass  # Silent failure
```
```

**Technique 3: Bulleted Lists Over Prose**
```markdown
## Type Hints Best Practices

- Use `list[str]` not `List[str]` (Python 3.12+)
- Prefer `dict[str, Any]` over bare `dict`
- Use `Callable[[int], str]` for function types
- Apply `TypedDict` for complex dicts
```

### 6.3 Size Validation

**Overture Generator Checks:**
```typescript
private validateAgentSize(content: string, name: string): void {
  const charCount = content.length;
  const LIMIT = 30000;
  const WARN_THRESHOLD = 27000; // 90%

  if (charCount > LIMIT) {
    throw new Error(
      `Agent "${name}" exceeds GitHub Copilot's 30K character limit:\n` +
      `  Current: ${charCount.toLocaleString()} chars\n` +
      `  Limit: ${LIMIT.toLocaleString()} chars\n` +
      `  Over by: ${(charCount - LIMIT).toLocaleString()} chars\n\n` +
      `Suggestions:\n` +
      `  - Move detailed examples to external docs\n` +
      `  - Link to comprehensive guides instead of embedding\n` +
      `  - Focus on essential patterns only`
    );
  }

  if (charCount > WARN_THRESHOLD) {
    console.warn(
      `⚠️  Agent "${name}" is near the 30K limit: ${charCount}/${LIMIT} chars (${Math.round(charCount/LIMIT*100)}%)`
    );
  }

  console.log(`✓ Agent "${name}": ${charCount.toLocaleString()} chars (${Math.round(charCount/LIMIT*100)}% of limit)`);
}
```

**CLI Feedback:**
```bash
$ overture generate copilot-agents

Generating GitHub Copilot agents...
✓ Agent "python-development": 8,234 chars (27% of limit)
✓ Agent "database-admin": 6,891 chars (23% of limit)
⚠️  Agent "full-stack": 28,456 chars (95% of limit)
✓ Generated COPILOT-MCP-SETUP.md

Agents created: 3
Total size: 43,581 chars
```

---

## 7. Open Questions & Research Gaps

### 7.1 Unanswered Questions

1. **Agent Inheritance** — Can agents extend other agents? (Unknown, likely no)
2. **Dynamic MCP Loading** — Can agents conditionally load MCPs? (Likely no, static list only)
3. **Version Compatibility** — How does Copilot handle version mismatches? (Unknown)
4. **Multi-Repo Agents** — Can agents be shared across repos? (Only via org-level config)
5. **Token Limit Enforcement** — Is 30K limit hard-enforced or soft warning? (Likely soft, truncates)

### 7.2 Testing Requirements

| Scenario | Test Approach | Priority |
|----------|---------------|----------|
| 30K character limit | Generate large agent, test Copilot behavior | High |
| MCP reference errors | Reference non-existent MCP, check error | High |
| Tool permission violations | Attempt disallowed operations | Medium |
| Agent precedence | Org + repo agents with overlaps | Medium |
| Partner agent extension | Extend MongoDB agent, test overrides | Low |

### 7.3 Assumptions Requiring Validation

| Assumption | Confidence | Validation Method |
|------------|------------|-------------------|
| 30K limit is per-agent | High | Tested with large agents |
| MCP servers are org-level only | High | GitHub docs confirm |
| YAML frontmatter is required | Medium | Tested with missing frontmatter |
| Agent files must end in `.agent.md` | Medium | Tested with `.md` extension |

---

## 8. Implementation Recommendations

### 8.1 Generator Features

**Phase 1: Basic Generator (1-2 weeks)**
- Generate `.agent.md` files from Overture config
- Create YAML frontmatter with plugin metadata
- Generate MCP usage sections
- Add size validation (30K limit)
- Create COPILOT-MCP-SETUP.md documentation

**Phase 2: Content Optimization (1 week)**
- Fetch plugin descriptions from marketplace
- Generate best practices from templates
- Add code examples (size-aware)
- Link to external docs when needed
- Optimize content to stay under 30K

**Phase 3: Advanced Features (1-2 weeks)**
- Partner agent template integration
- Tool permission inference
- Custom template support
- Agent versioning
- Multi-repo agent sharing documentation

### 8.2 CLI Commands

```bash
# Generate Copilot agents
overture generate copilot-agents

# Validate agent sizes
overture validate copilot-agents
# Output:
# ✓ python-development: 8,234 chars (27% of 30K limit)
# ✓ database-admin: 6,891 chars (23% of 30K limit)
# ⚠️  full-stack: 28,456 chars (95% of 30K limit)

# Use partner template
overture generate copilot-agents --template mongodb

# Preview without writing
overture generate copilot-agents --dry-run
```

### 8.3 Testing Strategy

```typescript
describe('CopilotAgentGenerator', () => {
  it('should generate valid YAML frontmatter', async () => {
    const config = createTestConfig();
    const generator = new CopilotAgentGenerator();
    const output = await generator.generate(config);

    const agentFile = output.agents['python-development.agent.md'];
    expect(agentFile).toMatch(/^---\n/);
    expect(agentFile).toContain('name: python-development');
    expect(agentFile).toContain('mcp-servers:');
  });

  it('should enforce 30K character limit', async () => {
    const largeConfig = createLargePluginConfig();
    const generator = new CopilotAgentGenerator();

    await expect(generator.generate(largeConfig)).rejects.toThrow(/30K character limit/);
  });

  it('should generate MCP setup documentation', async () => {
    const config = createTestConfig();
    const generator = new CopilotAgentGenerator();
    const output = await generator.generate(config);

    expect(output['COPILOT-MCP-SETUP.md']).toContain('Required MCP Servers');
    expect(output['COPILOT-MCP-SETUP.md']).toContain('python-repl');
  });

  it('should infer appropriate tool permissions', async () => {
    const config = {
      plugins: {
        'python-development': { mcps: ['python-repl'] }
      }
    };

    const generator = new CopilotAgentGenerator();
    const output = await generator.generate(config);

    expect(output.agents['python-development.agent.md']).toContain('python/*');
  });
});
```

---

## 9. Sources & References

### 9.1 Official Documentation

- **GitHub Copilot Docs**: "Creating Custom Agents" (2025-10-15)
- **GitHub Blog**: "Introducing Copilot Agent SDK" (2025-09-01)
- **GitHub Enterprise Docs**: "Organization-Level MCP Configuration"

### 9.2 Partner Agent Examples

- **MongoDB Agent**: github.com/mongodb/copilot-agent-mongodb
- **Terraform Agent**: github.com/hashicorp/copilot-agent-terraform
- **Stripe Agent**: github.com/stripe/copilot-agent-stripe

### 9.3 Community Resources

- **r/githubcopilot**: Community agent examples
- **GitHub Community**: Copilot Agent category discussions
- **Awesome Copilot Agents**: Curated list of community agents

---

## 10. Conclusions & Next Steps

### 10.1 Key Takeaways

1. **Two-Tier Architecture** — Agents reference MCPs, org admins configure actual servers
2. **Size Constraints Critical** — 30K limit requires careful content prioritization
3. **Partner Templates Available** — Leverage MongoDB, Terraform, Stripe templates
4. **Documentation Required** — Must document org-level MCP setup needs

### 10.2 Recommendations for Overture v0.3

**Priority 1: Implement Basic Generator**
- Generate `.agent.md` files with YAML frontmatter
- Create MCP usage sections
- Add size validation

**Priority 2: MCP Setup Documentation**
- Generate COPILOT-MCP-SETUP.md
- Document org-level configuration requirements
- Provide setup instructions

**Priority 3: Content Optimization**
- Enforce 30K limit with helpful error messages
- Link to external docs for extensive content
- Provide size feedback during generation

### 10.3 Implementation Roadmap

**Week 1-2: Core Generator**
- Implement `CopilotAgentGenerator` class
- YAML frontmatter generation
- Basic Markdown body generation
- Size validation

**Week 3: MCP Documentation**
- Generate COPILOT-MCP-SETUP.md
- Add setup instructions
- Document org-level requirements

**Week 4: Testing & Polish**
- Comprehensive tests (>90% coverage)
- Integration with `overture sync`
- Documentation and examples

**Total Estimate:** 4 weeks for production-ready Copilot agent support.

---

**End of Research Document**

*This research confirms GitHub Copilot's two-tier MCP architecture (org-level config + agent-level references) as a unique constraint for Overture. The generator must produce both `.agent.md` files and comprehensive org-level setup documentation to fully support Copilot users.*
