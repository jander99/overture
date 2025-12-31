# Agent Skill Template & Grading Rubric

> **Version**: 1.0  
> **Based on**: AgentSkills.io Specification, Anthropic Skills Repository, ClaudeKit Skills Analysis  
> **Purpose**: Template for creating high-activation skills and rubric for grading existing skills

---

## Table of Contents

1. [Canonical Skill Template](#canonical-skill-template)
2. [Grading Rubric](#grading-rubric)
3. [Detailed Scoring Guide](#detailed-scoring-guide)
4. [Quick Checklist](#quick-checklist)
5. [Examples by Grade](#examples-by-grade)

---

## Canonical Skill Template

### Directory Structure

```
skill-name/
├── SKILL.md              # Required - Main skill file
├── references/           # Optional - Deep documentation
│   ├── getting-started.md
│   ├── api-reference.md
│   └── troubleshooting.md
├── scripts/              # Optional - Executable code
│   └── helper.py
└── assets/               # Optional - Static resources
    └── template.html
```

### SKILL.md Template

```yaml
---
name: skill-name
description: [ACTION VERB] [domain/capability] with [technologies/tools]. Capabilities include [feature-1] ([sub-features]), [feature-2] ([sub-features]). Use when [trigger-1], [trigger-2], [trigger-3], or [trigger-N]. Supports [additional-context].
---
```

````markdown
# Skill Name

[1-2 sentence overview of what this skill does and its primary value proposition.]

## When to Use

- [Specific scenario 1 - complete user intent]
- [Specific scenario 2 - complete user intent]
- [Specific scenario 3 - complete user intent]
- [Edge case scenario]

## Quick Start

### Prerequisites

- [Dependency 1 with version]
- [Environment variable: `VAR_NAME`]
- [Required tool/package]

### Basic Usage

```bash
# Actual command with real flags
command --flag value --option
```
````

## Core Workflow

### Step 1: [Action]

[Brief instruction]

```code
# Concrete example
```

### Step 2: [Action]

[Brief instruction]

## Reference Navigation

| Topic     | Reference             | Load When           |
| --------- | --------------------- | ------------------- |
| [Topic 1] | `references/file1.md` | [Trigger condition] |
| [Topic 2] | `references/file2.md` | [Trigger condition] |

## Quick Decision Matrix

| Need     | Solution     |
| -------- | ------------ |
| [Need 1] | [Solution 1] |
| [Need 2] | [Solution 2] |

## Error Handling

| Error                | Cause        | Solution    |
| -------------------- | ------------ | ----------- |
| [Error code/message] | [Root cause] | [Fix steps] |

## Resources

- [Official docs link]
- [API reference link]

````

---

## Grading Rubric

### Overall Grade Scale

| Grade | Score | Description |
|-------|-------|-------------|
| **A** | 90-100 | Excellent - High activation, comprehensive, well-structured |
| **B** | 80-89 | Good - Solid activation, minor improvements possible |
| **C** | 70-79 | Adequate - Will activate but inconsistently |
| **D** | 60-69 | Poor - Low activation, significant issues |
| **F** | 0-59 | Failing - Will rarely activate or is malformed |

### Scoring Categories

| Category | Weight | Max Points |
|----------|--------|------------|
| **Description Quality** | 35% | 35 |
| **Structure & Organization** | 25% | 25 |
| **Content Quality** | 20% | 20 |
| **Technical Implementation** | 15% | 15 |
| **Specification Compliance** | 5% | 5 |
| **Total** | 100% | 100 |

---

## Detailed Scoring Guide

### 1. Description Quality (35 points)

The description is the PRIMARY activation mechanism. This is the most critical element.

#### 1.1 Action Verb Opening (5 points)

| Points | Criteria |
|--------|----------|
| 5 | Starts with strong action verb (Build, Create, Implement, Process, Debug, Analyze) |
| 3 | Starts with weaker verb (Help, Assist, Provide, Enable) |
| 1 | Starts with noun or passive construction |
| 0 | Missing or starts with article (A, The) |

**Examples:**
- 5 pts: "Build robust backend systems with..."
- 3 pts: "Helps with backend development..."
- 1 pt: "Backend development tool for..."

#### 1.2 "Use when" Trigger Phrase (10 points)

| Points | Criteria |
|--------|----------|
| 10 | Explicit "Use when" followed by 3+ specific scenarios |
| 7 | "Use when" present with 1-2 scenarios |
| 4 | Implicit triggers without "Use when" phrase |
| 0 | No trigger scenarios at all |

**Examples:**
- 10 pts: "Use when designing APIs, implementing authentication, optimizing queries, or building microservices."
- 7 pts: "Use when working with databases."
- 0 pts: "A comprehensive database tool."

#### 1.3 Technology/Keyword Density (10 points)

| Points | Criteria |
|--------|----------|
| 10 | 10+ relevant technology keywords |
| 7 | 5-9 technology keywords |
| 4 | 2-4 technology keywords |
| 1 | 1 technology keyword |
| 0 | No specific technologies mentioned |

**Count these as keywords:**
- Languages: Python, TypeScript, Go, Rust
- Frameworks: React, Next.js, FastAPI, Django
- Tools: Docker, Kubernetes, PostgreSQL
- Concepts: OAuth, JWT, REST, GraphQL
- File types: PDF, DOCX, JSON, YAML

#### 1.4 Parenthetical Enumeration (5 points)

| Points | Criteria |
|--------|----------|
| 5 | Uses parentheticals to group sub-features: "databases (PostgreSQL, MongoDB, Redis)" |
| 3 | Some grouping but inconsistent |
| 0 | No grouping, just flat lists or prose |

#### 1.5 Task-Centric Framing (5 points)

| Points | Criteria |
|--------|----------|
| 5 | Focuses on user goals and outcomes |
| 3 | Mix of tool-centric and task-centric |
| 0 | Entirely tool-centric (describes what tool does, not what user achieves) |

**Examples:**
- 5 pts: "Extract text and tables from PDF files, fill forms, merge documents"
- 0 pts: "A PDF library wrapper with various methods"

---

### 2. Structure & Organization (25 points)

#### 2.1 Progressive Disclosure (10 points)

| Points | Criteria |
|--------|----------|
| 10 | SKILL.md <100 lines, deep content in references/, clear navigation |
| 7 | SKILL.md 100-200 lines, some references |
| 4 | SKILL.md 200-500 lines, minimal references |
| 0 | Monolithic SKILL.md >500 lines or missing references for complex skill |

#### 2.2 Reference Navigation (5 points)

| Points | Criteria |
|--------|----------|
| 5 | Clear navigation table/section with "Load when" guidance |
| 3 | References mentioned but no navigation section |
| 0 | No reference navigation or orphaned references |

#### 2.3 Quick Start Section (5 points)

| Points | Criteria |
|--------|----------|
| 5 | Prerequisites + concrete usage example within first 30 lines |
| 3 | Quick start present but missing prerequisites or examples |
| 0 | No quick start section |

#### 2.4 Decision Matrix/Quick Reference (5 points)

| Points | Criteria |
|--------|----------|
| 5 | Decision matrix or quick reference table present |
| 3 | Partial decision guidance in prose form |
| 0 | No decision guidance |

---

### 3. Content Quality (20 points)

#### 3.1 Concrete Examples (8 points)

| Points | Criteria |
|--------|----------|
| 8 | Copy-paste ready commands with real flags and parameters |
| 5 | Examples present but incomplete (missing flags, placeholders) |
| 2 | Pseudocode only |
| 0 | No examples |

#### 3.2 Error Handling Documentation (6 points)

| Points | Criteria |
|--------|----------|
| 6 | Error table with codes, causes, and solutions |
| 4 | Some error handling mentioned |
| 0 | No error handling documentation |

#### 3.3 Prerequisites Documentation (6 points)

| Points | Criteria |
|--------|----------|
| 6 | Specific versions, API keys, environment variables documented |
| 3 | General prerequisites without specifics |
| 0 | No prerequisites documented |

---

### 4. Technical Implementation (15 points)

#### 4.1 Script Quality (if applicable) (5 points)

| Points | Criteria |
|--------|----------|
| 5 | Scripts documented, self-contained, with error handling |
| 3 | Scripts present but poorly documented |
| 0 | Scripts missing when needed, or broken |
| N/A | No scripts needed for this skill type |

#### 4.2 Cross-Skill Integration (5 points)

| Points | Criteria |
|--------|----------|
| 5 | Appropriate cross-references to related skills |
| 3 | Some integration mentioned |
| 0 | No integration when it would be beneficial |
| N/A | Standalone skill, integration not applicable |

#### 4.3 Tool Expectations (5 points)

| Points | Criteria |
|--------|----------|
| 5 | Clear indication of what tools skill expects (Bash, Read, Write, etc.) |
| 3 | Implicit tool usage |
| 0 | No clarity on tool requirements |

---

### 5. Specification Compliance (5 points)

#### 5.1 Name Field (2 points)

| Points | Criteria |
|--------|----------|
| 2 | Valid: lowercase, hyphens only, 1-64 chars, no consecutive hyphens |
| 0 | Invalid name format |

#### 5.2 Description Field (2 points)

| Points | Criteria |
|--------|----------|
| 2 | Valid: 1-1024 characters, non-empty |
| 0 | Invalid (empty, >1024 chars, or missing) |

#### 5.3 Directory Structure (1 point)

| Points | Criteria |
|--------|----------|
| 1 | Follows spec: SKILL.md present, proper subdirectories |
| 0 | Non-compliant structure |

---

## Quick Checklist

### Pre-Flight Checklist (Must Pass)

- [ ] `name` field: lowercase, hyphens, 1-64 chars
- [ ] `description` field: 1-1024 chars, non-empty
- [ ] SKILL.md exists in skill root directory
- [ ] Directory name matches `name` field

### Activation Checklist (High Priority)

- [ ] Description starts with action verb
- [ ] "Use when" phrase present with 3+ scenarios
- [ ] 5+ technology keywords in description
- [ ] Task-centric framing (user goals, not tool features)
- [ ] Parenthetical enumeration for sub-features

### Structure Checklist (Medium Priority)

- [ ] SKILL.md under 100 lines (or justified)
- [ ] references/ directory for deep content
- [ ] Quick Start section with prerequisites
- [ ] Reference Navigation table
- [ ] Decision Matrix or Quick Reference

### Quality Checklist (Standard Priority)

- [ ] Copy-paste ready examples
- [ ] Error handling documentation
- [ ] Specific prerequisites (versions, env vars)
- [ ] No orphaned references
- [ ] No pseudocode (real commands only)

---

## Examples by Grade

### Grade A Example (Score: 95)

```yaml
---
name: backend-development
description: Build robust backend systems with modern technologies (Node.js, Python, Go, Rust), frameworks (NestJS, FastAPI, Django), databases (PostgreSQL, MongoDB, Redis), APIs (REST, GraphQL, gRPC), authentication (OAuth 2.1, JWT), testing strategies, security best practices (OWASP Top 10), performance optimization, scalability patterns (microservices, caching, sharding), DevOps practices (Docker, Kubernetes, CI/CD), and monitoring. Use when designing APIs, implementing authentication, optimizing database queries, setting up CI/CD pipelines, handling security vulnerabilities, building microservices, or developing production-ready backend systems.
---
````

**Why A:**

- Action verb opening ("Build")
- 30+ technology keywords
- 7 explicit "Use when" scenarios
- Excellent parenthetical grouping
- Task-centric framing

### Grade C Example (Score: 72)

```yaml
---
name: database-helper
description: A tool for working with databases. Supports PostgreSQL and MongoDB. Can help with queries and schema design.
---
```

**Why C:**

- Weak opening ("A tool")
- Only 2 technology keywords
- No "Use when" triggers
- No parenthetical grouping
- Tool-centric framing

### Grade F Example (Score: 45)

```yaml
---
name: DB_Tool
description: helps with stuff
---
```

**Why F:**

- Invalid name (uppercase, underscore)
- No action verb
- No technology keywords
- No triggers
- Vague and uninformative

---

## Grading Worksheet

Use this worksheet to grade a skill:

```
Skill Name: ___________________
Date Graded: __________________

DESCRIPTION QUALITY (35 pts max)
├── Action Verb Opening:      ___ / 5
├── "Use when" Triggers:      ___ / 10
├── Keyword Density:          ___ / 10
├── Parenthetical Enum:       ___ / 5
└── Task-Centric Framing:     ___ / 5
    Subtotal:                 ___ / 35

STRUCTURE & ORGANIZATION (25 pts max)
├── Progressive Disclosure:   ___ / 10
├── Reference Navigation:     ___ / 5
├── Quick Start Section:      ___ / 5
└── Decision Matrix:          ___ / 5
    Subtotal:                 ___ / 25

CONTENT QUALITY (20 pts max)
├── Concrete Examples:        ___ / 8
├── Error Handling:           ___ / 6
└── Prerequisites:            ___ / 6
    Subtotal:                 ___ / 20

TECHNICAL IMPLEMENTATION (15 pts max)
├── Script Quality:           ___ / 5  (or N/A)
├── Cross-Skill Integration:  ___ / 5  (or N/A)
└── Tool Expectations:        ___ / 5
    Subtotal:                 ___ / 15

SPECIFICATION COMPLIANCE (5 pts max)
├── Name Field Valid:         ___ / 2
├── Description Valid:        ___ / 2
└── Directory Structure:      ___ / 1
    Subtotal:                 ___ / 5

═══════════════════════════════════════
TOTAL SCORE:                  ___ / 100

GRADE: _____ (A/B/C/D/F)

NOTES:
_________________________________
_________________________________
_________________________________
```

---

## Appendix: Common Deductions

| Issue                            | Typical Deduction |
| -------------------------------- | ----------------- |
| Missing "Use when" phrase        | -10               |
| Vague description                | -15 to -25        |
| Monolithic SKILL.md (>200 lines) | -6                |
| No concrete examples             | -8                |
| Pseudocode instead of real code  | -6                |
| Missing prerequisites            | -6                |
| Invalid name format              | -2                |
| No error handling docs           | -6                |
| Tool-centric framing             | -5                |
| Orphaned references              | -3                |

---

## Appendix: Description Formula

The high-activation description follows this structure:

```
[ACTION VERB] [domain] with [technologies].
Capabilities include [feature-1] ([sub-features]), [feature-2] ([sub-features]).
Use when [trigger-1], [trigger-2], [trigger-3], or [trigger-N].
[Optional: Supports/Includes additional-context.]
```

**Components:**

1. **Action Verb** (required): Build, Create, Implement, Process, Debug, Analyze, Extract, Generate
2. **Domain** (required): The problem space (backend systems, PDF documents, authentication)
3. **Technologies** (required): Specific tools, frameworks, languages in parenthetical groups
4. **"Use when" triggers** (required): 3+ specific scenarios starting with "Use when"
5. **Additional context** (optional): Supported features, limitations, integrations

**Length guidance:**

- Minimum: 100 characters
- Optimal: 200-400 characters
- Maximum: 1024 characters (spec limit)

Descriptions under 100 characters almost never provide enough trigger density for reliable activation.
