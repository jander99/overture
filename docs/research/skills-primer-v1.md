# Building auto-activating Agent Skills: A complete guide

Agent Skills rely on **pure LLM-based semantic matching** for automatic activation—there is no algorithmic routing, keyword matching, or intent classification at the code level. The description field is presented to the AI model in its system prompt, and the model decides when to invoke skills based solely on textual understanding. This means writing effective skills is fundamentally about communicating clearly with language models.

The Agent Skills specification, published by Anthropic on December 18, 2025, has been adopted by **GitHub Copilot, VS Code, OpenAI Codex, Cursor, OpenCode, Amp, goose, and Letta**. A single well-structured skill works across all conforming agents without modification.

## The specification defines a minimal, markdown-based format

Every skill is a directory containing a `SKILL.md` file with YAML frontmatter and markdown instructions. The format deliberately prioritizes simplicity—just folders with markdown files, no complex infrastructure required.

**Required frontmatter fields:**

| Field         | Constraints                                                                                                                   | Purpose                                    |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| `name`        | 1-64 chars; lowercase `a-z`, `0-9`, and hyphens only; cannot start/end with hyphen or contain `--`; must match directory name | Unique skill identifier                    |
| `description` | 1-1024 chars; no XML tags                                                                                                     | Primary activation signal for LLM matching |

**Optional frontmatter fields:**

| Field           | Purpose                                                 |
| --------------- | ------------------------------------------------------- |
| `license`       | License identifier (e.g., `Apache-2.0`, `MIT`)          |
| `compatibility` | Environment requirements (e.g., "Requires Python 3.8+") |
| `metadata`      | Custom key-value pairs for author, version, category    |
| `allowed-tools` | Experimental: pre-approved tools the skill may use      |

The naming regex pattern is `^[a-z][a-z0-9]*(-[a-z0-9]+)*$`. Invalid names like `PDF-Processing` (uppercase), `-pdf` (leading hyphen), or `pdf--tools` (consecutive hyphens) will fail validation.

**Directory structure:**

```
skill-name/
├── SKILL.md          # Required: frontmatter + instructions
├── scripts/          # Optional: executable code
├── references/       # Optional: detailed documentation
└── assets/           # Optional: templates, resources
```

Standard locations vary by platform: `.github/skills/<name>/` for GitHub Copilot/VS Code, `.claude/skills/` for Claude Code, and `.opencode/skill/` for OpenCode. Most implementations also scan `~/.claude/skills/` or similar home-directory paths for global skills.

## How semantic activation actually works

When an agent starts, it scans configured directories for `SKILL.md` files and extracts only the frontmatter metadata—specifically the `name` and `description` fields consuming roughly **50-100 tokens per skill**. This metadata gets injected into the agent's system prompt as an available skills list, typically in XML format:

```xml
<available_skills>
  <skill>
    <name>pdf-processing</name>
    <description>Extract text and tables from PDF files, fill forms, merge documents.</description>
  </skill>
</available_skills>
```

When a user sends a message, the agent uses its native language understanding to semantically match user intent against skill descriptions. If the model determines a skill is relevant, it invokes a Skill meta-tool which loads the full `SKILL.md` content into context. Referenced files in `scripts/` and `references/` are loaded only when specifically needed during execution.

This **progressive disclosure architecture** enables agents to have many skills available without overwhelming context windows. The trade-off is that activation success depends entirely on how well the description communicates relevance to the language model.

## Writing descriptions that reliably trigger activation

Since activation is pure semantic matching, there are no magic keywords—but certain patterns dramatically improve matching success. The optimal description structure follows a clear formula: **[Action verbs describing capability] + [When to use it] + [Key trigger terms users would mention]**.

**Effective description examples:**

```yaml
# Strong: Specific actions, explicit triggers, domain terms
description: "Extract text and tables from PDF files, fill forms, merge documents.
             Use when working with PDF files or when the user mentions PDFs,
             forms, or document extraction."

description: "Generate clear commit messages from git diffs. Use when writing
             commit messages or reviewing staged changes."

description: "Guide for creating effective skills. This skill should be used
             when users want to create a new skill (or update an existing skill)
             that extends Claude's capabilities."
```

**Weak descriptions that fail to activate:**

```yaml
# Too vague—model cannot match intent
description: "Helps with documents"
description: "For data analysis"
description: "Data tools"
```

High-impact action verbs that signal clear intent include: **Extract, Analyze, Generate, Create, Convert, Debug, Review, Validate, Process, and Build**. The description should read like a capability advertisement written for an AI reader, not a human marketing blurb.

The **"Use when..."** clause is particularly critical. Including explicit activation conditions like "Use when the user mentions PDFs" or "Use for sales reports, pipeline analysis, and revenue tracking" gives the model clear decision criteria. Without this, even well-described capabilities may not activate because the model lacks confidence about when the skill applies.

## Token efficiency determines skill architecture

The body of `SKILL.md` should stay under **5,000 tokens** (roughly 500 lines or 5,000 words). Content exceeding this should be split into referenced files that load on-demand. This constraint exists because the entire skill body gets injected into context upon activation.

**Effective token management pattern:**

```markdown
## Instructions

1. For basic extraction, use pdfplumber
2. For form filling, see [FORMS.md](references/FORMS.md)
3. Run: `python {baseDir}/scripts/extract.py`
```

Scripts execute without loading into context—only their output appears. Reference files load only when the agent explicitly reads them. Using `{baseDir}` for paths ensures portability across environments.

**Token budget breakdown:**

| Content                  | Token Target     | Loaded When         |
| ------------------------ | ---------------- | ------------------- |
| Frontmatter (all skills) | ~100 tokens each | Always at startup   |
| SKILL.md body            | <5,000 tokens    | On skill activation |
| Reference files          | As needed        | On explicit read    |
| Script output            | Varies           | After execution     |

## Scope and granularity: when to split skills

A skill should represent **one coherent capability** with instructions that share common context. Signs you need multiple skills include: different activation contexts, mutually exclusive use cases, separate permission requirements, or more than 5,000 tokens of distinct content.

**Good granularity:**

- `pdf-form-filler` (not generic "document-processor")
- `git-commit-helper` (not catch-all "git-tools")
- `excel-analysis` (not vague "data-tools")

When skills might overlap, use distinct trigger terms in descriptions to help the model differentiate:

```yaml
# Skill 1: Sales domain
description: "Analyze sales data in Excel files and CRM exports.
             Use for sales reports, pipeline analysis, revenue tracking."

# Skill 2: Operations domain
description: "Analyze log files and system metrics.
             Use for performance monitoring, debugging, system diagnostics."
```

## Agent Skills complement MCP rather than replacing it

The Model Context Protocol (MCP) and Agent Skills serve different layers. MCP provides **executable abilities**—tools for running commands, calling APIs, and taking actions. Agent Skills provide **knowledge and process**—teaching agents how to use those abilities effectively.

As the goose team noted: "Saying skills killed MCP is about as accurate as saying GitHub Actions killed Bash."

| Aspect           | Agent Skills                        | MCP                          |
| ---------------- | ----------------------------------- | ---------------------------- |
| Layer            | Instructions/knowledge              | Integration/capability       |
| Provides         | Process, workflow, domain expertise | Executable tools, API access |
| Format           | Markdown files                      | JSON-RPC 2.0 protocol        |
| Security surface | Minimal (prompt-based)              | Requires auth and scoping    |

Skills can orchestrate MCP server calls, and MCP servers can provide the underlying tools that skills reference. A pdf-processing skill might contain instructions that call MCP tools for file operations while adding domain expertise about handling scanned documents, form fields, and edge cases.

## The specification compliance checklist

A skill is 100% spec-compliant when it passes these validations:

**Frontmatter requirements:**

- [ ] `name` field present and non-empty
- [ ] `name` is 1-64 characters, lowercase alphanumeric with hyphens only
- [ ] `name` does not start or end with hyphen
- [ ] `name` contains no consecutive hyphens
- [ ] `name` matches parent directory name exactly
- [ ] `description` field present and non-empty
- [ ] `description` is 1-1024 characters
- [ ] Neither field contains XML tags

**File structure requirements:**

- [ ] `SKILL.md` file exists in skill directory
- [ ] YAML frontmatter uses `---` delimiters (not tabs)
- [ ] Markdown body follows frontmatter
- [ ] File references use relative paths from skill root

**Activation optimization:**

- [ ] Description starts with action verbs
- [ ] Description includes "Use when..." clause
- [ ] Description contains domain-specific trigger terms
- [ ] Description is under 500 characters (recommended)
- [ ] Body content under 5,000 tokens

Validate skills programmatically using the official reference library:

```bash
pip install skills-ref
skills-ref validate ./my-skill
```

## Complete skill template for reliable auto-activation

```yaml
---
name: skill-name
description: "[Action verbs] [specific capabilities]. Use when [condition 1],
             [condition 2], or when the user mentions [key terms]."
license: Apache-2.0
---

# Skill Name

## When to use this skill
- [Scenario 1 with specific trigger]
- [Scenario 2 with specific trigger]
- [Scenario 3 with specific trigger]

## Instructions

### Step 1: [Initial action]
[Imperative instructions—"Run...", "Extract...", not "You should..."]

### Step 2: [Processing action]
[Clear steps with expected outputs]

### Step 3: [Final action]
[How to deliver results]

## Examples

### Input
[Concrete example of user request]

### Output
[Expected result format]

## Edge cases
- [Known limitation and workaround]
- [Error condition and recovery]

## Resources
See [REFERENCE.md](references/REFERENCE.md) for detailed patterns.
Run `{baseDir}/scripts/helper.py` for automation.
```

## Common mistakes that prevent activation

**Description problems:** Vague language ("helps with documents"), missing "when to use" conditions, generic keywords instead of domain-specific terms, descriptions over 500 characters that bury trigger terms.

**Structural errors:** Name not matching directory name, uppercase characters in name, YAML tabs instead of spaces, hardcoded paths instead of `{baseDir}`, deeply nested file references.

**Content issues:** Second-person voice ("You should...") instead of imperative ("Run..."), explaining concepts the model already knows, loading everything into `SKILL.md` instead of using progressive disclosure.

If a properly-structured skill fails to activate, the fault lies with the client implementation—spec-compliant skills should work across all conforming agents. Test by restarting the agent, asking questions containing your description's trigger terms, and verifying the skill appears in the agent's available skills list.

## Conclusion

Building auto-activating Agent Skills requires understanding that **the description field is the entire activation mechanism**—language models read it and decide based on semantic understanding, not algorithms. Write descriptions that clearly communicate capability and activation conditions using specific action verbs and explicit "Use when..." clauses.

Keep skills focused on single capabilities under 5,000 tokens, use progressive disclosure for detailed content, and structure directories following the spec exactly. The format's simplicity—just markdown files in folders—enables portability across GitHub Copilot, OpenCode, Cursor, and other conforming agents.

For a skill-helper meta-skill specifically, the description should include terms like "create skill," "write SKILL.md," "agent skills specification," "validate skill," and explicit conditions like "Use when building, validating, or improving Agent Skills." This ensures activation whenever users work on skill authoring tasks.
