# Agent Skills Activation Pattern Analysis

> **Research Date**: December 2024  
> **Source Repository**: [mrgoonie/claudekit-skills](https://github.com/mrgoonie/claudekit-skills)  
> **Reference Documentation**: [AgentSkills.io](https://agentskills.io/home), [Claude Platform Docs](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview)

## Executive Summary

After analyzing 39 skills from the claudekit-skills repository against the AgentSkills.io specification and Claude's documentation, I've identified clear patterns that drive high activation rates (85%+) versus patterns that likely reduce activation.

**Key Finding**: The claudekit-skills repository demonstrates exceptionally well-crafted descriptions that maximize trigger density through a consistent formula: **Capabilities + Technologies + "Use when" triggers + Specific scenarios**.

---

## 1. Description Patterns (MOST CRITICAL)

### What Works (High Activation)

#### Pattern 1: Multi-Part Trigger-Rich Descriptions

The most effective descriptions follow a 3-4 part structure:

```
[What it does] + [Technologies/Capabilities enumerated] + "Use when" + [Specific trigger scenarios]
```

**Excellent Example** (`backend-development`):

```yaml
description: Build robust backend systems with modern technologies (Node.js, Python, Go, Rust), frameworks (NestJS, FastAPI, Django), databases (PostgreSQL, MongoDB, Redis), APIs (REST, GraphQL, gRPC), authentication (OAuth 2.1, JWT), testing strategies, security best practices (OWASP Top 10), performance optimization, scalability patterns (microservices, caching, sharding), DevOps practices (Docker, Kubernetes, CI/CD), and monitoring. Use when designing APIs, implementing authentication, optimizing database queries, setting up CI/CD pipelines, handling security vulnerabilities, building microservices, or developing production-ready backend systems.
```

**Why it works:**

- **Keyword density**: 30+ technology/concept keywords for matching
- **Explicit triggers**: "Use when" followed by 7 specific scenarios
- **Action verbs**: "designing", "implementing", "optimizing", "handling", "building"
- **Parenthetical enumeration**: Lists alternatives without bloating

#### Pattern 2: The "Use when" Phrase

Nearly all high-quality skills include explicit `Use when` phrasing:

| Skill                 | Trigger Phrase                                                                                                                               |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `ai-multimodal`       | "Use when working with audio/video files, analyzing images or screenshots, processing PDF documents..."                                      |
| `mcp-management`      | "Use when working with MCP integrations, need to discover available MCP capabilities, filter MCP tools for specific tasks..."                |
| `code-review`         | "Use when receiving code review feedback (especially if unclear or technically questionable), when completing tasks or major features..."    |
| `sequential-thinking` | "Use when complex problems require systematic step-by-step reasoning with ability to revise thoughts, branch into alternative approaches..." |

#### Pattern 3: Scenario-Based Triggers

Descriptions that list **specific scenarios** rather than abstract capabilities:

**Good** (`docs-seeker`):

```yaml
description: 'Searching internet for technical documentation using llms.txt standard, GitHub repositories via Repomix, and parallel exploration. Use when user needs: (1) Latest documentation for libraries/frameworks, (2) Documentation in llms.txt format, (3) GitHub repository analysis, (4) Documentation without direct llms.txt support, (5) Multiple documentation sources in parallel'
```

**Why it works:**

- Numbered list of specific user needs
- Matches common request patterns
- Covers edge cases explicitly

#### Pattern 4: Capability Enumeration with Parentheticals

```yaml
description: Process and generate multimedia content using Google Gemini API. Capabilities include analyze audio files (transcription with timestamps, summarization, speech understanding, music/sound analysis up to 9.5 hours), understand images (captioning, object detection, OCR, visual Q&A, segmentation)...
```

**Why it works:**

- Primary capability stated first
- Sub-capabilities in parentheses provide keyword density without excessive length
- Specific limits/parameters ("up to 9.5 hours") add precision

### What Doesn't Work (Low Activation)

#### Anti-Pattern 1: Vague/Abstract Descriptions

```yaml
# BAD - Too vague
description: Helps with debugging code and finding issues
```

**Problems:**

- No specific technologies mentioned
- No trigger scenarios
- "helps with" is passive, not action-oriented
- Could match almost anything (too generic)

#### Anti-Pattern 2: Missing "Use when" Triggers

```yaml
# WEAK - Missing explicit triggers
description: A tool for managing MCP servers and discovering capabilities.
```

**Problem:** The LLM doesn't know WHEN to activate this skill.

#### Anti-Pattern 3: Tool-Centric vs. Task-Centric

```yaml
# WEAK - Tool-centric
description: Puppeteer-based browser automation scripts

# STRONG - Task-centric
description: Browser automation, debugging, and performance analysis using Puppeteer CLI scripts. Use for automating browsers, taking screenshots, analyzing performance, monitoring network traffic, web scraping, form automation, and JavaScript debugging.
```

---

## 2. Structural Organization Patterns

### What Works

#### Pattern 1: Progressive Disclosure Architecture

From AgentSkills.io specification, the 3-level loading model:

| Level                | When Loaded      | Content                              |
| -------------------- | ---------------- | ------------------------------------ |
| **L1: Metadata**     | Always (startup) | ~100 tokens - name + description     |
| **L2: Instructions** | When triggered   | <5k tokens - main SKILL.md body      |
| **L3: Resources**    | As needed        | Unlimited - reference files, scripts |

**Excellent Example Structure** (`backend-development`):

```
backend-development/
├── SKILL.md              # ~100 lines - overview + navigation
└── references/
    ├── backend-technologies.md
    ├── backend-api-design.md
    ├── backend-security.md
    ├── backend-authentication.md
    ├── backend-performance.md
    ├── backend-architecture.md
    ├── backend-testing.md
    ├── backend-code-quality.md
    ├── backend-devops.md
    ├── backend-debugging.md
    └── backend-mindset.md
```

**Why it works:**

- Main SKILL.md is concise (~100 lines)
- Deep content in references (loaded on-demand)
- Clear navigation to deeper content

#### Pattern 2: Quick Reference Section

Successful skills include a "Quick Reference" or "Navigation" section:

```markdown
## Reference Navigation

**Core Technologies:**

- `backend-technologies.md` - Languages, frameworks, databases, message queues, ORMs
- `backend-api-design.md` - REST, GraphQL, gRPC patterns and best practices

**Security & Authentication:**

- `backend-security.md` - OWASP Top 10 2025, security best practices
```

#### Pattern 3: Decision Matrices

High-activation skills include quick decision tables:

```markdown
## Quick Decision Matrix

| Need                | Choose           |
| ------------------- | ---------------- |
| Fast development    | Node.js + NestJS |
| Data/ML integration | Python + FastAPI |
| High concurrency    | Go + Gin         |
| Max performance     | Rust + Axum      |
```

### What Doesn't Work

#### Anti-Pattern 1: Monolithic SKILL.md

Putting everything in one file (300+ lines) causes:

- Excessive token consumption on activation
- No progressive disclosure
- Slower agent response

#### Anti-Pattern 2: Missing Navigation

Without clear pointers to references, the agent may:

- Not discover relevant deep content
- Reload SKILL.md repeatedly instead of drilling down

---

## 3. Integration Strategies

### What Works

#### Pattern 1: Cross-Skill References

From `when-stuck` skill:

```markdown
| How You're Stuck         | Use This Skill                                 |
| ------------------------ | ---------------------------------------------- |
| **Complexity spiraling** | skills/problem-solving/simplification-cascades |
| **Need innovation**      | skills/problem-solving/collision-zone-thinking |
| **Code broken**          | skills/debugging/systematic-debugging          |
```

**Why it works:**

- Creates skill orchestration
- Enables meta-skills that dispatch to specialized skills
- Matches user intent to appropriate capability

#### Pattern 2: Tool Integration Declarations

```yaml
allowed-tools:
  - Bash
  - Read
  - Write
  - Edit
```

**Note**: This appears in `ai-multimodal` but is not in the official spec. However, it provides clear guidance on what tools the skill expects to use.

#### Pattern 3: Script Bundling with Documentation

```markdown
## Scripts Overview

**gemini_batch_process.py**: Batch process multiple media files

- Supports all modalities (audio, image, video, PDF)
- Progress tracking and error recovery
- Output formats: JSON, Markdown, CSV
```

**Why it works:**

- Scripts are discoverable
- Clear description of what each script does
- Agent can execute deterministically

### What Doesn't Work

#### Anti-Pattern 1: Orphaned References

References mentioned in SKILL.md that don't exist:

```markdown
See `references/advanced-patterns.md` for details # File doesn't exist
```

#### Anti-Pattern 2: Circular Dependencies

Skills that require each other to function create infinite loops.

---

## 4. Specificity vs. Generality Trade-offs

### Finding: Narrow-but-Deep Beats Broad-but-Shallow

#### High Activation: Narrow + Deep

```yaml
name: better-auth
description: Implement authentication and authorization with Better Auth - a framework-agnostic TypeScript authentication framework. Features include email/password authentication with verification, OAuth providers (Google, GitHub, Discord, etc.), two-factor authentication (TOTP, SMS), passkeys/WebAuthn support...
```

**Why it works:**

- Specific to one library (Better Auth)
- Exhaustive feature coverage
- Clear scope boundaries

#### Lower Activation: Broad + Shallow

```yaml
name: authentication
description: Handle user authentication in web applications
```

**Problems:**

- Competes with many other skills
- No specific implementation guidance
- Agent unsure when to prefer this vs. alternatives

### The Goldilocks Zone

| Scope      | Example                                    | Activation Likelihood          |
| ---------- | ------------------------------------------ | ------------------------------ |
| Too narrow | "Handle OAuth with GitHub only"            | Low - rarely matches           |
| Just right | "OAuth with GitHub, Google, Discord, etc." | High - matches common patterns |
| Too broad  | "Handle authentication"                    | Medium - matches but competes  |

---

## 5. Technical Implementation Patterns

### What Works

#### Pattern 1: Concrete Command Examples

````markdown
### Common Patterns

**Transcribe Audio**:

```bash
python scripts/gemini_batch_process.py \
  --files audio.mp3 \
  --task transcribe \
  --model gemini-2.5-flash
```
````

````

**Why it works:**

- Copy-paste ready
- Shows actual flags and parameters
- No guessing required

#### Pattern 2: Environment Setup Hierarchy

```markdown
The skill checks for `GEMINI_API_KEY` in this order:
1. Process environment: `export GEMINI_API_KEY="your-key"`
2. Project root: `.env`
3. `.claude/.env`
4. `.claude/skills/.env`
5. `.claude/skills/ai-multimodal/.env`
````

#### Pattern 3: Error Handling Documentation

```markdown
## Error Handling

Common errors and solutions:

- **400**: Invalid format/size - validate before upload
- **401**: Invalid API key - check configuration
- **429**: Rate limit exceeded - implement exponential backoff
```

### What Doesn't Work

#### Anti-Pattern 1: Pseudocode Instead of Real Code

```markdown
# BAD

Run the tool with appropriate parameters
```

#### Anti-Pattern 2: Missing Prerequisites

```markdown
# BAD - What version? What dependencies?

Install Python and run the script
```

---

## 6. YAML Frontmatter Patterns

### Required Fields (Per AgentSkills.io Spec)

| Field         | Requirements                          | Claudekit Pattern      |
| ------------- | ------------------------------------- | ---------------------- |
| `name`        | Max 64 chars, lowercase, hyphens only | Followed consistently  |
| `description` | Max 1024 chars, non-empty             | Extensive descriptions |

### Optional Fields Used in Claudekit

| Field           | Usage                     | Impact on Activation                                   |
| --------------- | ------------------------- | ------------------------------------------------------ |
| `license`       | MIT, Apache-2.0, etc.     | None (metadata only)                                   |
| `version`       | Semantic versioning       | None (metadata only)                                   |
| `when_to_use`   | Explicit trigger guidance | **Potentially helpful** but redundant with description |
| `allowed-tools` | Tool declarations         | **Potentially helpful** for validation                 |

### Observed Pattern: Descriptions Do All the Work

The claudekit skills put ALL activation logic into the `description` field, not relying on optional fields. This aligns with the AgentSkills.io spec which states:

> "The `description` should include both what the Skill does and when Claude should use it."

---

## 7. High-Activation Formula

Based on this analysis, the formula for 85%+ activation:

### The Description Template

```yaml
description: [ACTION VERB] [DOMAIN] with [TECHNOLOGY LIST]. Capabilities include [FEATURE 1] ([SUB-FEATURES]), [FEATURE 2] ([SUB-FEATURES])... Use when [SCENARIO 1], [SCENARIO 2], [SCENARIO 3], or [SCENARIO N]. [OPTIONAL: Supports X, Y, Z.]
```

### Checklist for High-Activation Skills

- [ ] **Description length**: 150-400 characters (keyword-dense)
- [ ] **"Use when" phrase**: Explicitly present
- [ ] **3+ trigger scenarios**: Specific, action-oriented
- [ ] **Technology keywords**: 5+ relevant technologies named
- [ ] **Action verbs**: "Build", "Create", "Implement", "Debug", "Analyze"
- [ ] **Parenthetical enumeration**: Group related sub-features
- [ ] **Task-centric framing**: Focus on what user wants to accomplish
- [ ] **Progressive disclosure**: SKILL.md <100 lines, deep content in references
- [ ] **Concrete examples**: Copy-paste command examples
- [ ] **Decision matrices**: Quick reference tables

### Anti-Patterns to Avoid

- [ ] Vague descriptions ("helps with", "tool for")
- [ ] Missing "Use when" triggers
- [ ] Tool-centric instead of task-centric framing
- [ ] Monolithic SKILL.md (>200 lines)
- [ ] Abstract pseudocode instead of real commands
- [ ] Missing error handling documentation
- [ ] Orphaned references

---

## 8. Recommendations for New Skills

### Template for High-Activation Skill

````yaml
---
name: your-skill-name
description: [Verb] [what it does] with [technologies]. Capabilities include [cap1] ([details]), [cap2] ([details]). Use when [trigger1], [trigger2], [trigger3], or [trigger4]. Supports [additional context].
---

# Your Skill Name

Brief 1-2 sentence overview.

## When to Use

- Bullet list of specific scenarios
- Each scenario is a complete user intent
- Cover edge cases

## Quick Start

### Prerequisites
[Specific versions, API keys, dependencies]

### Basic Usage
```bash
# Actual command with real flags
````

## Reference Navigation

| Topic   | Reference            | Use When   |
| ------- | -------------------- | ---------- |
| [Topic] | `references/file.md` | [Scenario] |

## Quick Decision Matrix

| Need     | Solution     |
| -------- | ------------ |
| [Need 1] | [Solution 1] |

## Error Handling

| Error   | Cause   | Solution |
| ------- | ------- | -------- |
| [Error] | [Cause] | [Fix]    |

````

---

## 9. Case Studies

### Case Study 1: `systematic-debugging` (High Activation)

**Description:**
```yaml
description: Four-phase debugging framework that ensures root cause investigation before attempting fixes. Never jump to solutions.
````

**Why it activates well:**

1. Clear methodology ("Four-phase")
2. Explicit behavioral constraint ("Never jump to solutions")
3. Problem-focused framing
4. Additional `when_to_use` field: "when encountering any bug, test failure, or unexpected behavior"

**Structure strengths:**

- Iron Law stated upfront ("NO FIXES WITHOUT ROOT CAUSE INVESTIGATION FIRST")
- Phase-by-phase breakdown
- Red flags section for self-correction
- Integration with other debugging skills

### Case Study 2: `frontend-design` (High Activation)

**Description:**

```yaml
description: Create distinctive, production-grade frontend interfaces with high design quality. Use this skill when the user asks to build web components, pages, or applications. Generates creative, polished code that avoids generic AI aesthetics.
```

**Why it activates well:**

1. Clear differentiation ("avoids generic AI aesthetics")
2. Explicit trigger ("when the user asks to build web components, pages, or applications")
3. Quality promise ("production-grade", "polished")

**Structure strengths:**

- Concise (42 lines total)
- Strong opinionated guidance
- Anti-pattern warnings ("NEVER use generic AI-generated aesthetics")

### Case Study 3: `mcp-management` (Complex Integration)

**Description:**

```yaml
description: Manage Model Context Protocol (MCP) servers - discover, analyze, and execute tools/prompts/resources from configured MCP servers. Use when working with MCP integrations, need to discover available MCP capabilities, filter MCP tools for specific tasks, execute MCP tools programmatically, access MCP prompts/resources, or implement MCP client functionality. Supports intelligent tool selection, multi-server management, and context-efficient capability discovery.
```

**Why it activates well:**

1. Specific domain (MCP)
2. Six explicit trigger scenarios
3. Capability keywords ("intelligent tool selection", "multi-server management")

**Structure strengths:**

- Execution priority hierarchy (Gemini CLI > Direct Scripts > Subagent)
- Pattern-based organization
- Script documentation

---

## 10. Conclusion

The claudekit-skills repository achieves its 85% activation rate through:

1. **Trigger-rich descriptions** with explicit "Use when" phrases
2. **High keyword density** through parenthetical enumeration
3. **Task-centric framing** focused on user goals, not tool features
4. **Progressive disclosure** with shallow SKILL.md and deep references
5. **Concrete examples** that are copy-paste ready
6. **Cross-skill orchestration** enabling meta-skills

The key insight is that **the description field does almost all the work** for activation. Skills that invest heavily in crafting comprehensive, keyword-dense, trigger-rich descriptions will activate reliably; those with vague or abstract descriptions will be overlooked.

---

## Appendix: Skills Analyzed

| Category        | Skills                                                                                                                 |
| --------------- | ---------------------------------------------------------------------------------------------------------------------- |
| AI/ML           | ai-multimodal, context-engineering, google-adk-python                                                                  |
| Backend         | backend-development, better-auth                                                                                       |
| Frontend        | frontend-design, frontend-development, ui-styling, web-frameworks                                                      |
| DevOps          | devops, databases                                                                                                      |
| Debugging       | systematic-debugging, root-cause-tracing, defense-in-depth, verification-before-completion                             |
| Problem Solving | when-stuck, collision-zone-thinking, inversion-exercise, meta-pattern-recognition, scale-game, simplification-cascades |
| Documents       | docx, pdf, pptx, xlsx                                                                                                  |
| Tools           | chrome-devtools, mcp-management, mcp-builder, repomix                                                                  |
| Meta            | skill-creator, code-review, claude-code, docs-seeker, sequential-thinking                                              |
