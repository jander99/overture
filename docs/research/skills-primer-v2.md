---
title: Building auto-activating Agent Skills - A complete guide (v2)
created: 2024-12-26T02:01:09Z
last_modified: 2024-12-26T02:01:09Z
author: Jeff Anderson
type: research
tags:
  [agent-skills, mcp, ai-agents, skill-development, documentation, anthropic]
---

# Building auto-activating Agent Skills: A complete guide (v2)

Agent Skills rely on **pure LLM-based semantic matching** for automatic activation—there is no algorithmic routing, keyword matching, or intent classification at the code level. The description field is presented to the AI model in its system prompt, and the model decides when to invoke skills based solely on textual understanding. This means writing effective skills is fundamentally about communicating clearly with language models.

The Agent Skills specification, published by Anthropic in December 2024, has been adopted by **GitHub Copilot, VS Code, OpenAI Codex, Cursor, OpenCode, Amp, goose, and Letta**. A single well-structured skill works across all conforming agents without modification.

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

**Standard locations by platform:**

| Platform                 | Project Skills Path      | Global Skills Path           |
| ------------------------ | ------------------------ | ---------------------------- |
| Claude Code              | `.claude/skills/`        | `~/.claude/skills/`          |
| GitHub Copilot / VS Code | `.github/skills/<name>/` | `~/.github/skills/`          |
| OpenCode                 | `.opencode/skill/`       | `~/.config/opencode/skills/` |
| Cursor                   | `.cursor/skills/`        | `~/.cursor/skills/`          |

Most implementations scan both project-local and home-directory paths for skills.

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

## Testing and verifying skill activation

### Verifying skill registration

After creating a skill, verify it's registered with the agent:

**Claude Code:**

```bash
# Check if skill appears in system prompt
# Restart Claude Code and look for skill in available_skills list
```

**GitHub Copilot:**

```bash
# Skills are loaded from .github/skills/ on workspace open
# Check VS Code output panel for skill loading logs
```

**OpenCode:**

```bash
# Skills load from .opencode/skill/ and ~/.config/opencode/skills/
# Restart OpenCode to reload skills
```

### Testing activation phrases

Create test prompts that should trigger your skill based on the description. For a `pdf-processing` skill:

**Should activate:**

- "Extract text from this PDF file"
- "I need to fill out a PDF form"
- "Can you help me merge these documents?"

**Should NOT activate:**

- "Help me with this Word document" (wrong file type)
- "Analyze this spreadsheet" (wrong domain)

### Debugging failed activations

**Symptom:** Skill never activates despite matching requests

**Diagnosis steps:**

1. Verify the skill directory name matches the `name` field exactly
2. Check that `SKILL.md` has valid YAML frontmatter with `---` delimiters
3. Ensure description is under 1024 characters and contains no XML tags
4. Restart the agent to reload skills
5. Use explicit trigger terms from your description in test prompts

**Symptom:** Skill activates too broadly

**Solution:** Add more specific domain terms to the description:

```yaml
# Too broad
description: "Process documents and extract data"

# More specific
description: "Extract structured data from PDF invoices and receipts.
             Use when processing accounting documents, not general PDFs."
```

**Symptom:** Skill activates too narrowly

**Solution:** Expand trigger terms and activation conditions:

```yaml
# Too narrow
description: "Extract invoice data from PDFs"

# Broader coverage
description: "Extract structured data from financial documents including
             invoices, receipts, bills, and statements. Use when working
             with accounting PDFs, financial records, or expense documents."
```

### Platform-specific gotchas

| Platform       | Issue                    | Solution                                                   |
| -------------- | ------------------------ | ---------------------------------------------------------- |
| Claude Code    | Skills not loading       | Ensure `.claude/skills/` exists and has proper permissions |
| GitHub Copilot | Nested skill paths       | Use flat structure: `.github/skills/skill-name/SKILL.md`   |
| OpenCode       | YAML parsing errors      | Validate YAML with `yamllint` before deployment            |
| All platforms  | Hardcoded paths breaking | Always use `{baseDir}` for skill-relative paths            |

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

## Real-world skill examples

### Example 1: Git commit message generator

```yaml
---
name: git-commit-helper
description: "Generate clear, conventional commit messages from git diffs.
             Use when writing commit messages, reviewing staged changes,
             or when the user mentions commits, git, or version control."
license: MIT
---

# Git Commit Helper

## When to use this skill
- User is about to commit code and needs a message
- User asks to "write a commit message"
- User mentions reviewing staged changes

## Instructions

### Step 1: Review staged changes
Run `git diff --staged` to see what will be committed.

### Step 2: Analyze changes
Identify:
- Primary type (feat, fix, docs, refactor, test, chore)
- Scope (component/module affected)
- Breaking changes

### Step 3: Generate message
Format:
```

<type>(<scope>): <short summary>

<detailed explanation if needed>

BREAKING CHANGE: <description if applicable>

```

## Examples

### Input
"Write a commit message for my changes"

### Output
```

feat(auth): add OAuth2 social login

Implemented Google and GitHub OAuth providers with automatic
account linking. Users can now sign in with social accounts.

```

```

### Example 2: Python testing skill

````yaml
---
name: python-test-generator
description: "Generate pytest test cases from Python functions and classes.
             Use when writing tests, adding test coverage, or when the user
             mentions pytest, testing, or test cases."
license: Apache-2.0
---

# Python Test Generator

## When to use this skill
- User needs to write tests for Python code
- User asks to "add test coverage"
- User mentions pytest, unittest, or testing

## Instructions

### Step 1: Analyze target code
Read the function/class to understand:
- Input parameters and types
- Return values
- Edge cases and error conditions
- Dependencies to mock

### Step 2: Generate test structure
Create test file following pytest conventions:
- `test_<module_name>.py`
- `test_<function_name>` test functions
- Fixtures for common setup

### Step 3: Write test cases
Cover:
- Happy path (valid inputs)
- Edge cases (empty, None, boundary values)
- Error cases (exceptions, validation)

## Examples

### Input
```python
def calculate_discount(price: float, percent: int) -> float:
    if percent < 0 or percent > 100:
        raise ValueError("Percent must be 0-100")
    return price * (1 - percent / 100)
````

### Output

```python
import pytest
from mymodule import calculate_discount

def test_calculate_discount_valid():
    assert calculate_discount(100.0, 20) == 80.0

def test_calculate_discount_zero():
    assert calculate_discount(100.0, 0) == 100.0

def test_calculate_discount_full():
    assert calculate_discount(100.0, 100) == 0.0

def test_calculate_discount_invalid_negative():
    with pytest.raises(ValueError):
        calculate_discount(100.0, -1)

def test_calculate_discount_invalid_over_100():
    with pytest.raises(ValueError):
        calculate_discount(100.0, 101)
```

## Edge cases

- Mock external dependencies with `pytest.fixture`
- Use `parametrize` for multiple similar test cases
- Handle async functions with `pytest.mark.asyncio`

````

## Common mistakes that prevent activation

### Description problems

**Issue:** Vague language that doesn't signal clear capability
```yaml
# ❌ Bad
description: "Helps with documents"

# ✅ Good
description: "Extract text, tables, and images from PDF documents.
             Use when working with PDFs or document parsing."
````

**Issue:** Missing "when to use" conditions

```yaml
# ❌ Bad
description: "Generate commit messages from git diffs"

# ✅ Good
description: "Generate commit messages from git diffs. Use when writing
             commits or when the user mentions git, staging, or version control."
```

**Issue:** Generic keywords instead of domain-specific terms

```yaml
# ❌ Bad
description: "Data tools for analysis"

# ✅ Good
description: "Analyze sales data from CRM exports and Excel files.
             Use for revenue reports, pipeline analysis, and quota tracking."
```

**Issue:** Descriptions over 500 characters that bury trigger terms

```yaml
# ❌ Bad - Important terms at the end
description: "This comprehensive skill provides a robust framework for
             enterprise-grade document processing workflows with advanced
             features including optical character recognition, natural
             language understanding, and semantic extraction capabilities
             specifically optimized for PDF files."

# ✅ Good - Key terms up front
description: "Extract text and data from PDF files using OCR and NLP.
             Use when processing documents, forms, or scanned PDFs."
```

### Structural errors

**Issue:** Name not matching directory name

```
❌ Directory: pdf-tools/
   name: pdf-processor

✅ Directory: pdf-processor/
   name: pdf-processor
```

**Issue:** Uppercase characters in name

```yaml
# ❌ Bad
name: PDF-Tools

# ✅ Good
name: pdf-tools
```

**Issue:** YAML tabs instead of spaces

```yaml
# ❌ Bad (uses tabs)
---
name: skill-name
description: Does things
---
# ✅ Good (uses spaces)
---
name: skill-name
description: 'Does things'
---
```

**Issue:** Hardcoded paths instead of `{baseDir}`

```yaml
# ❌ Bad
Run: python /home/user/skills/pdf-tools/extract.py

# ✅ Good
Run: python {baseDir}/scripts/extract.py
```

### Content issues

**Issue:** Second-person voice instead of imperative

```markdown
# ❌ Bad

You should run the extraction script to get the data.

# ✅ Good

Run the extraction script: `python {baseDir}/scripts/extract.py`
```

**Issue:** Explaining concepts the model already knows

```markdown
# ❌ Bad - Unnecessary explanation

Python is a programming language. To test Python code, you use pytest,
which is a testing framework that allows you to write test functions...

# ✅ Good - Direct instructions

Generate pytest test cases covering happy path, edge cases, and errors.
Use fixtures for common setup and parametrize for similar test cases.
```

**Issue:** Loading everything into `SKILL.md` instead of progressive disclosure

```markdown
# ❌ Bad - 10,000 token skill file

[Detailed API reference filling SKILL.md]

# ✅ Good - Progressive disclosure

For detailed API reference, see [API.md](references/API.md)
For advanced patterns, see [ADVANCED.md](references/ADVANCED.md)
```

## Troubleshooting activation issues

### Diagnostic workflow

1. **Verify skill registration**
   - Restart agent
   - Check logs for skill loading errors
   - Confirm skill appears in available skills list

2. **Test with explicit trigger terms**
   - Use exact phrases from description
   - Try multiple variations
   - Note which phrases work vs. don't work

3. **Validate structure**

   ```bash
   skills-ref validate ./my-skill
   ```

4. **Check platform-specific requirements**
   - Verify correct directory location
   - Ensure file permissions allow reading
   - Confirm YAML is valid (use yamllint)

5. **Simplify and iterate**
   - Start with minimal description
   - Add trigger terms incrementally
   - Test activation after each change

### When to file a bug

If a properly-structured skill fails to activate, the fault may lie with the client implementation. File a bug if:

- [ ] Skill passes `skills-ref validate`
- [ ] Description contains clear trigger terms
- [ ] Restart doesn't resolve the issue
- [ ] Other skills activate successfully
- [ ] Test prompts explicitly match description terms

Spec-compliant skills should work across all conforming agents. Include in bug report:

- Platform and version
- Complete `SKILL.md` content
- Test prompts that should activate the skill
- Agent logs showing skill registration

## Conclusion

Building auto-activating Agent Skills requires understanding that **the description field is the entire activation mechanism**—language models read it and decide based on semantic understanding, not algorithms. Write descriptions that clearly communicate capability and activation conditions using specific action verbs and explicit "Use when..." clauses.

Keep skills focused on single capabilities under 5,000 tokens, use progressive disclosure for detailed content, and structure directories following the spec exactly. The format's simplicity—just markdown files in folders—enables portability across GitHub Copilot, OpenCode, Cursor, and other conforming agents.

For a skill-helper meta-skill specifically, the description should include terms like "create skill," "write SKILL.md," "agent skills specification," "validate skill," and explicit conditions like "Use when building, validating, or improving Agent Skills." This ensures activation whenever users work on skill authoring tasks.

## Version history

- **v1** (Initial) - Original comprehensive guide
- **v2** (Current) - Added testing/debugging sections, real-world examples, platform-specific guidance, expanded troubleshooting
