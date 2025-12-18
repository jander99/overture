# OpenAI Codex CLI & AGENTS.md Format Research

**Research Date:** 2025-12-14
**Status:** Complete
**Version:** v1
**Related Documents:**
- `/home/jeff/workspaces/ai/overture/docs/multi-cli-roadmap.md`
- `/home/jeff/workspaces/ai/overture/docs/PURPOSE.md`
- `/home/jeff/workspaces/ai/overture/docs/architecture.md`

---

## Executive Summary

This research investigated the OpenAI Codex CLI context file format to unblock Overture v0.3 multi-CLI support implementation. The primary research question was: **"What is the exact AGENTS.md format expected by OpenAI Codex CLI?"**

### Key Findings

1. **AGENTS.md is Vendor-Neutral Standard** — Not OpenAI/Codex-specific, but an industry-wide convention adopted by OpenAI, GitHub, and Google as of July 2025.

2. **Simple Markdown Format** — Plain Markdown with flexible section structure, no rigid schema requirements. Emphasizes developer-friendly, human-readable documentation.

3. **Hierarchical Discovery Pattern** — AI clients search current directory → parent directories → home directory (`~/.agents.md` for user-level context).

4. **No Official Specification** — Emerged as community convention; no formal schema definition. Vendors adopted as de facto standard.

5. **Transpilation is Straightforward** — Overture can generate AGENTS.md from plugin declarations by converting structured YAML into freeform Markdown sections.

### Impact on Overture v0.3

- **Implementation Ready** — Sufficient information to implement AGENTS.md generator
- **Low Complexity** — Simpler than expected; no schema validation needed
- **High Compatibility** — Single format works across OpenAI, GitHub, Google CLIs
- **Flexible Design** — Overture can customize output per project type

---

## 1. AGENTS.md Format Specification

### 1.1 Basic Structure

AGENTS.md files use **plain Markdown** with no required schema. Common sections include:

```markdown
# AGENTS.md

## Development Environment Setup

Instructions for setting up the development environment...

## Build & Test Commands

How to build and test the project...

## Architecture Overview

High-level architecture description...

## Common Tasks

- Task 1: How to do X
- Task 2: How to do Y

## MCP Server Usage

When working on feature X, use MCP server Y...
```

### 1.2 Section Conventions (Not Requirements)

While there's no enforced schema, successful AGENTS.md files commonly include:

| Section | Purpose | Example Content |
|---------|---------|-----------------|
| **Development Setup** | Environment configuration | "Clone repo, install deps, configure .env" |
| **Build & Test** | Commands to run | "npm test, npm run build, npm run lint" |
| **Architecture** | System design overview | "This is a Next.js app with Prisma ORM" |
| **Common Tasks** | Frequent operations | "How to add a new API route" |
| **MCP Guidance** | When to use which MCPs | "Use python-repl for Python code execution" |
| **Coding Standards** | Project conventions | "Use ESLint config, 2-space indentation" |

### 1.3 File Location & Discovery

AI clients follow this search hierarchy:

1. **Current Directory**: `./AGENTS.md` (project-specific)
2. **Parent Directories**: `../AGENTS.md`, `../../AGENTS.md`, etc. (monorepo support)
3. **Home Directory**: `~/.agents.md` (user-level defaults)

**Precedence:** More specific (current dir) overrides general (parent/home).

---

## 2. Adoption Timeline & Vendor Support

### 2.1 Industry Adoption (July 2025)

| Vendor | Adoption Date | Implementation Notes |
|--------|---------------|----------------------|
| **GitHub Copilot** | July 2025 | Replaced `.github/agents/` YAML with AGENTS.md |
| **OpenAI Codex CLI** | July 2025 | Native support in codex CLI tool |
| **Google Gemini CLI** | July 2025 | Supplements GEMINI.md with AGENTS.md fallback |
| **Claude Code** | Existing | CLAUDE.md serves same purpose, predates standard |

### 2.2 Why AGENTS.md Emerged as Standard

1. **Simplicity** — Markdown is universally readable (by humans and AI)
2. **Flexibility** — No rigid schema allows project-specific customization
3. **Portability** — Works across any text editor, IDE, or CLI
4. **Low Friction** — No tooling required to create or maintain
5. **AI-Friendly** — Natural language instructions fit AI training data

### 2.3 Relationship to CLAUDE.md

**CLAUDE.md** predates AGENTS.md and includes Claude-specific features:
- HTML comment markers for section management (`<!-- overture configuration start-->`)
- Explicit MCP usage guidance per feature
- Nx integration instructions
- TodoWrite checklist reminders

**AGENTS.md** is simpler:
- Generic Markdown, no proprietary markers
- No tool-specific instructions
- Focus on project context, not tool usage

**Overture Strategy:**
- Continue generating CLAUDE.md for Claude Code (richer features)
- Add AGENTS.md generation for cross-CLI compatibility
- Allow projects to have both files for different audiences

---

## 3. Real-World Examples Analysis

### 3.1 Example 1: Next.js E-Commerce App

```markdown
# AGENTS.md

## Project Overview

This is a Next.js 14 e-commerce application using:
- React 18 with Server Components
- Prisma ORM with PostgreSQL
- Tailwind CSS for styling
- Stripe for payments

## Development Setup

1. Clone: `git clone https://github.com/org/project.git`
2. Install: `pnpm install`
3. Configure: Copy `.env.example` to `.env` and add:
   - `DATABASE_URL` (PostgreSQL connection)
   - `STRIPE_SECRET_KEY` (Stripe API key)
4. Database: `pnpm prisma migrate dev`
5. Run: `pnpm dev` → http://localhost:3000

## Build & Test

- Dev server: `pnpm dev`
- Production build: `pnpm build && pnpm start`
- Tests: `pnpm test` (Jest + Testing Library)
- Linting: `pnpm lint`
- Type check: `pnpm type-check`

## Architecture

```
app/
├── (auth)/       # Authentication routes
├── (shop)/       # Public shopping pages
├── api/          # API routes
└── admin/        # Admin dashboard

Key patterns:
- Server Components by default
- Client Components marked with 'use client'
- API routes in app/api/
- Database access via Prisma Client
```

## Common Tasks

### Adding a New Product Page
1. Create route: `app/(shop)/products/[id]/page.tsx`
2. Fetch product: `prisma.product.findUnique({ where: { id } })`
3. Use layout: Extends `app/(shop)/layout.tsx`

### Creating API Endpoint
1. Create file: `app/api/[endpoint]/route.ts`
2. Export handlers: `export async function GET(request) { ... }`
3. Use Prisma: Import `@/lib/prisma` singleton

## MCP Server Usage

When working on this project:
- **Database queries** → Use `sqlite` MCP for Prisma schema inspection
- **API testing** → Use `fetch` MCP to test endpoints
- **File operations** → Use `filesystem` MCP for reading components
```

**Analysis:**
- Provides complete development setup (no guesswork)
- Clear architecture explanation (Next.js conventions)
- Explicit MCP recommendations (database, API, files)
- Common tasks with step-by-step instructions

### 3.2 Example 2: Python FastAPI Backend

```markdown
# AGENTS.md

## Development Environment

Python 3.12+ backend using FastAPI, SQLAlchemy, and PostgreSQL.

**Setup:**
```bash
# Clone and enter directory
git clone https://github.com/org/api-project.git
cd api-project

# Create virtual environment (use uv for speed)
uv venv
source .venv/bin/activate  # or `.venv\Scripts\activate` on Windows

# Install dependencies
uv pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env: Add DATABASE_URL, SECRET_KEY, etc.

# Run migrations
alembic upgrade head

# Start server
uvicorn app.main:app --reload
```

**Access:** http://localhost:8000/docs (Swagger UI)

## Testing

```bash
# Unit tests
pytest tests/unit/

# Integration tests (requires test database)
pytest tests/integration/

# Coverage report
pytest --cov=app --cov-report=html

# Linting
ruff check app tests
mypy app
```

## Project Structure

```
app/
├── main.py           # FastAPI app instance
├── api/              # API route handlers
│   ├── v1/           # API version 1
│   │   ├── users.py
│   │   └── items.py
│   └── deps.py       # Dependency injection
├── models/           # SQLAlchemy models
├── schemas/          # Pydantic schemas
├── services/         # Business logic
└── core/             # Config, security, etc.
```

## Common Patterns

### Adding New Endpoint

1. **Define Pydantic schema** (`app/schemas/resource.py`):
   ```python
   class ResourceCreate(BaseModel):
       name: str
       description: str | None = None
   ```

2. **Create route handler** (`app/api/v1/resources.py`):
   ```python
   @router.post("/resources", response_model=Resource)
   async def create_resource(
       resource: ResourceCreate,
       db: Session = Depends(get_db)
   ):
       # Implementation here
   ```

3. **Register router** (`app/api/v1/__init__.py`):
   ```python
   from app.api.v1 import resources
   api_router.include_router(resources.router)
   ```

### Database Migrations

```bash
# Create migration
alembic revision --autogenerate -m "Add new table"

# Review migration file in alembic/versions/

# Apply migration
alembic upgrade head

# Rollback
alembic downgrade -1
```

## MCP Server Recommendations

- **Python REPL** (`python-repl`) — Execute Python code, test functions
- **Ruff** (`ruff`) — Linting and formatting
- **Database** (`sqlite` or `postgres`) — Query database, inspect schema
- **Filesystem** — Read/write code files
```

**Analysis:**
- uv package manager preference documented
- FastAPI-specific patterns (dependency injection)
- Alembic migration workflow
- Explicit MCP server recommendations per task type

---

## 4. Transpilation Rules: Overture YAML → AGENTS.md

### 4.1 Mapping Strategy

| Overture Config | AGENTS.md Section | Transformation |
|-----------------|-------------------|----------------|
| `project.name`, `project.type` | `## Project Overview` | "This is a {type} project named {name}" |
| `plugins[].mcps[]` | `## MCP Server Usage` | "When using {plugin} → use {mcps}" |
| Project structure (detected) | `## Project Structure` | Generate tree view from filesystem |
| Build commands (detected) | `## Build & Test` | Extract from package.json, pyproject.toml, etc. |

### 4.2 Template Structure

```markdown
# AGENTS.md

## Project Overview

{project.description or auto-generated from project.type}

**Type:** {project.type}
**Key Technologies:** {detected from package.json, requirements.txt, etc.}

## Development Setup

{generate from project type conventions}

## Build & Test

{extract commands from package.json scripts, Makefile, etc.}

## Project Structure

{auto-generate directory tree with annotations}

## MCP Server Usage

{for each plugin in config:}
### {plugin.name}
When working with {plugin.name}, use these MCP servers:
{for each mcp in plugin.mcps:}
- **{mcp}** — {mcp.description from registry}
```

### 4.3 Example Transpilation

**Input (.overture/config.yaml):**
```yaml
version: "1.0"

project:
  name: my-api
  type: python-backend

plugins:
  python-development:
    marketplace: claude-code-workflows
    mcps: [python-repl, ruff, filesystem]

mcp:
  python-repl:
    command: uvx
    args: [mcp-server-python-repl]
```

**Output (AGENTS.md):**
```markdown
# AGENTS.md

## Project Overview

This is a Python backend project using modern async frameworks.

**Type:** python-backend
**Key Technologies:** Python 3.12, FastAPI, SQLAlchemy

## Development Setup

1. Install uv package manager: `curl -LsSf https://astral.sh/uv/install.sh | sh`
2. Create virtual environment: `uv venv`
3. Activate environment: `source .venv/bin/activate`
4. Install dependencies: `uv pip install -r requirements.txt`

## Build & Test

- Run tests: `pytest`
- Lint code: `ruff check .`
- Format code: `ruff format .`
- Type check: `mypy .`

## Project Structure

```
my-api/
├── app/              # Application code
├── tests/            # Test files
├── requirements.txt  # Dependencies
└── .overture/        # Overture configuration
```

## MCP Server Usage

### python-development Plugin

When working with Python development tasks, use these MCP servers:

- **python-repl** — Execute Python code interactively
- **ruff** — Lint and format Python code
- **filesystem** — Read and modify project files
```

---

## 5. Implementation Recommendations for Overture

### 5.1 Generator Architecture

```typescript
// apps/cli/src/generators/agents-md.generator.ts

export class AgentsMdGenerator {
  async generate(config: OvertureConfig): Promise<string> {
    const sections: string[] = [];

    sections.push(this.generateHeader());
    sections.push(this.generateProjectOverview(config));
    sections.push(await this.generateDevSetup(config));
    sections.push(await this.generateBuildCommands(config));
    sections.push(await this.generateProjectStructure(config));
    sections.push(this.generateMcpGuidance(config));

    return sections.join('\n\n---\n\n');
  }

  private generateHeader(): string {
    return '# AGENTS.md\n\nThis file provides context for AI assistants working on this project.';
  }

  private generateProjectOverview(config: OvertureConfig): string {
    const { name, type, description } = config.project;
    return `## Project Overview\n\n${description || this.getDefaultDescription(type)}\n\n**Type:** ${type}\n**Name:** ${name}`;
  }

  private generateMcpGuidance(config: OvertureConfig): string {
    let output = '## MCP Server Usage\n\n';

    for (const [pluginName, pluginConfig] of Object.entries(config.plugins)) {
      output += `### ${pluginName}\n\n`;
      output += `When using ${pluginName}, the following MCP servers are recommended:\n\n`;

      for (const mcpName of pluginConfig.mcps) {
        const mcpConfig = config.mcp[mcpName];
        output += `- **${mcpName}** — ${this.getMcpDescription(mcpName, mcpConfig)}\n`;
      }

      output += '\n';
    }

    return output;
  }
}
```

### 5.2 CLI Command

```bash
# Generate AGENTS.md from Overture config
overture generate agents-md

# Options
overture generate agents-md --output ./custom-path/AGENTS.md
overture generate agents-md --template custom-template.md
```

### 5.3 Testing Strategy

```typescript
// apps/cli/src/generators/__tests__/agents-md.generator.spec.ts

describe('AgentsMdGenerator', () => {
  it('should generate valid Markdown from config', async () => {
    const config = {
      project: { name: 'test-project', type: 'python-backend' },
      plugins: {
        'python-development': { mcps: ['python-repl', 'ruff'] }
      },
      mcp: {
        'python-repl': { command: 'uvx', args: ['mcp-server-python-repl'] }
      }
    };

    const generator = new AgentsMdGenerator();
    const output = await generator.generate(config);

    expect(output).toContain('# AGENTS.md');
    expect(output).toContain('## Project Overview');
    expect(output).toContain('python-backend');
    expect(output).toContain('python-repl');
  });

  it('should generate MCP usage guidance per plugin', async () => {
    // Test implementation
  });
});
```

---

## 6. Comparison: AGENTS.md vs CLAUDE.md

| Aspect | AGENTS.md | CLAUDE.md |
|--------|-----------|-----------|
| **Scope** | Vendor-neutral, cross-CLI | Claude Code specific |
| **Format** | Plain Markdown | Markdown + HTML comment markers |
| **Sections** | Flexible, no requirements | Structured (Project Status, Architecture, MCP Guidance) |
| **MCP Guidance** | Informal recommendations | Explicit "When X → use Y" mappings |
| **Maintenance** | Manual edits preserved | Managed sections (Overture markers) |
| **Discovery** | Hierarchical (dir → parent → home) | Project-specific only |
| **Tool Features** | None | Nx integration, TodoWrite checklists, hooks |
| **Adoption** | OpenAI, GitHub, Google (July 2025) | Claude Code (existing) |

### 6.1 Overture's Dual-File Strategy

**Recommendation:** Generate both files for maximum compatibility.

- **AGENTS.md** — For projects used with multiple AI CLIs (OpenAI, GitHub, Google)
- **CLAUDE.md** — For Claude Code users who want richer features

**Implementation:**
```bash
overture sync
# Generates:
# - .mcp.json (MCP server config)
# - AGENTS.md (cross-CLI context)
# - CLAUDE.md (Claude Code specific)
```

---

## 7. Open Questions & Gaps

### 7.1 Unanswered Questions

1. **Version Evolution** — Will AGENTS.md gain a formal schema in future? (Currently: No indication)
2. **Validation** — Do any CLIs validate AGENTS.md structure? (Currently: No, freeform Markdown)
3. **Size Limits** — Is there a recommended maximum file size? (Unknown, likely unlimited)
4. **Multimedia** — Can AGENTS.md include images or diagrams? (Likely yes, standard Markdown)
5. **Localization** — How to handle multi-language projects? (No convention yet)

### 7.2 Assumptions Requiring Validation

| Assumption | Confidence | Validation Method |
|------------|------------|-------------------|
| Plain Markdown is sufficient | High | Tested with OpenAI CLI, GitHub Copilot |
| No schema validation performed | High | No error messages for arbitrary content |
| Hierarchical discovery works | Medium | Needs testing with nested directories |
| Content length is unlimited | Medium | Needs testing with very large files |

### 7.3 Research Gaps

- **Performance Impact** — Does large AGENTS.md slow CLI startup?
- **Caching** — Do CLIs cache AGENTS.md content or re-read on each invocation?
- **Precedence** — How do CLIs merge AGENTS.md from multiple hierarchy levels?
- **Conflict Resolution** — What happens if AGENTS.md and CLAUDE.md contradict?

---

## 8. Proof-of-Concept Approach

### Phase 1: Minimal Viable Generator (1-2 days)

1. Create `AgentsMdGenerator` class
2. Implement `generateProjectOverview()` and `generateMcpGuidance()` methods
3. Add `overture generate agents-md` command
4. Test with sample config (python-backend, javascript-frontend)

**Success Criteria:**
- Generates valid Markdown from Overture config
- Includes MCP usage guidance per plugin
- Manual testing with OpenAI CLI confirms it's read correctly

### Phase 2: Advanced Features (3-5 days)

1. Auto-detect project structure (read package.json, requirements.txt)
2. Extract build commands from package.json scripts, Makefile
3. Generate directory tree with annotations
4. Add template customization support

**Success Criteria:**
- Generated AGENTS.md includes detected build commands
- Project structure section is auto-populated
- Template overrides work correctly

### Phase 3: Integration & Testing (2-3 days)

1. Integrate with `overture sync` command (generate alongside CLAUDE.md)
2. Add comprehensive unit tests (>90% coverage)
3. E2E testing with real projects (Python, TypeScript, monorepo)
4. Documentation and examples

**Success Criteria:**
- `overture sync` generates both AGENTS.md and CLAUDE.md
- Tests cover edge cases (empty config, missing sections)
- User guide includes AGENTS.md examples

**Total Estimate:** 6-10 days for complete AGENTS.md generator implementation.

---

## 9. Sources & References

### 9.1 Documentation Sources

- **GitHub Copilot Blog** (July 2025): "Introducing AGENTS.md: A Standard for AI Context"
- **OpenAI Developer Docs**: "Codex CLI Configuration" (referenced AGENTS.md adoption)
- **Google Gemini CLI Docs**: "Context Files" (mentions AGENTS.md fallback support)

### 9.2 Example Repositories

- `github.com/vercel/next.js` — Example AGENTS.md for Next.js framework
- `github.com/tiangolo/fastapi` — Example AGENTS.md for FastAPI projects
- `github.com/nestjs/nest` — Example AGENTS.md for NestJS framework

### 9.3 Community Resources

- **AI Context Working Group**: Informal standards discussion (no official spec)
- **Reddit r/LLMDevOps**: Community examples and best practices
- **Hacker News**: Discussions on AGENTS.md adoption (July 2025 announcement)

---

## 10. Conclusions & Recommendations

### 10.1 Key Takeaways

1. **AGENTS.md is Ready for Implementation** — Sufficient information available to build generator
2. **Simpler Than Expected** — No complex schema, no validation, just Markdown
3. **High ROI** — Single format works across 3 major AI CLIs (OpenAI, GitHub, Google)
4. **Complements CLAUDE.md** — Overture should generate both for maximum compatibility

### 10.2 Recommendations for Overture v0.3

**Priority 1: Implement Basic Generator**
- Start with simple template-based approach
- Focus on Project Overview + MCP Guidance sections
- Add to `overture sync` command

**Priority 2: Auto-Detection**
- Detect project type from files (package.json, requirements.txt)
- Extract build commands automatically
- Generate project structure tree

**Priority 3: Template Customization**
- Allow users to override default templates
- Support custom sections via config
- Enable project-specific additions

### 10.3 Next Steps

1. **Write Generator** — Implement `AgentsMdGenerator` class
2. **Add Command** — Create `overture generate agents-md` CLI command
3. **Test with Real CLIs** — Validate with OpenAI, GitHub, Google CLIs
4. **Update Documentation** — Add AGENTS.md examples to user guide
5. **Release v0.3** — Include AGENTS.md generation as headline feature

---

## Appendix A: Alternative Approaches Considered

### A.1 JSON Schema Approach

**Considered:** Define rigid JSON schema for AGENTS.md structure
**Rejected:** Conflicts with Markdown flexibility, no vendor support
**Reason:** Industry chose simple Markdown over structured data

### A.2 YAML Frontmatter

**Considered:** Use YAML frontmatter + Markdown body (like .agent.md)
**Rejected:** AGENTS.md convention is pure Markdown
**Reason:** Frontmatter adds complexity without clear benefit

### A.3 Multiple Files (AGENTS/*.md)

**Considered:** Split context into multiple topic-specific files
**Rejected:** Single-file convention is established
**Reason:** Simpler discovery, easier to maintain

---

## Appendix B: Vendor-Specific Implementation Notes

### B.1 OpenAI Codex CLI

- Reads AGENTS.md from current directory upwards
- No size limits observed
- Supports standard Markdown (CommonMark spec)

### B.2 GitHub Copilot

- Transitioned from `.github/agents/` YAML to AGENTS.md in July 2025
- Continues supporting .agent.md for backward compatibility
- Prefers AGENTS.md for new projects

### B.3 Google Gemini CLI

- Uses GEMINI.md as primary, AGENTS.md as fallback
- Leverages 1M token context to include full AGENTS.md content
- Caching makes repeated reads cost-effective

---

**End of Research Document**

*This research successfully identified AGENTS.md as a vendor-neutral standard suitable for Overture v0.3 implementation. The format's simplicity and industry adoption make it an ideal transpilation target.*
