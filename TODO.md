# Overture TODOs

## Critical Issues

### Bootstrapping Problem

**Issue:** Overture should manage its own CLAUDE.md via `.overture/config.yaml`

**Current State:**
- Overture's CLAUDE.md has a manually-maintained managed section (lines 698-779)
- The managed section is written by hand to demonstrate the pattern
- This violates the principle that Overture should "eat its own dog food"

**Desired State:**
- Create `.overture/config.yaml` for the Overture project
- Define MCP servers used for development (sequentialthinking, filesystem, context7, memory, nx)
- Run `overture sync` to auto-generate the managed section
- Managed section stays up-to-date as configuration changes

**Blockers:**
- ~~Requires v0.2 feature: User global config support (`~/.config/overture.yml`)~~ ✅ RESOLVED (v0.2 complete)
- ~~Global MCPs (sequentialthinking, filesystem, etc.) need to be referenced from global config~~ ✅ AVAILABLE
- ~~Current v0.1 only supports project-scoped MCPs~~ ✅ FIXED in v0.2

**Status:** Ready to implement! v0.2 is complete with user global config support.

**Next Steps:**
1. Create `~/.config/overture.yml` with global MCPs (sequentialthinking, filesystem, context7, memory, nx)
2. Create `.overture/config.yaml` in the Overture project root
3. Configure project to reference global MCPs
4. Run `overture sync` to auto-generate the managed section in CLAUDE.md
5. Remove manual managed section maintenance

**Priority:** High (v0.2 is now complete, blocker is removed)

**Related:**
- docs/PURPOSE.md - Phase roadmap
- CLAUDE.md:769-773 - Bootstrapping note

---

## v0.2 - Multi-Platform MCP Manager

**Target:** Next major release

**Features:**
- [ ] User global config (`~/.config/overture.yml`)
- [ ] User/project precedence and deduplication logic
- [ ] Multi-platform adapters:
  - [ ] Claude Desktop (`~/Library/Application Support/Claude/mcp.json`)
  - [ ] Claude Code user config (`~/.config/claude/mcp.json`)
  - [ ] GitHub Copilot CLI (research location)
  - [ ] VSCode Copilot (if config exposed)
  - [ ] IntelliJ Copilot (if config exposed)
- [ ] `overture audit` command - scan all configs, report conflicts
- [ ] `overture consolidate` command - merge configs into single source

**Research Needed:**
- Copilot CLI configuration location and format
- VSCode Copilot extension config API
- IntelliJ Copilot plugin config access

---

## v0.3 - Enhanced Documentation

**Target:** After v0.2

**Features:**
- [ ] Workflow instruction templates in config
- [ ] User-defined MCP orchestration patterns
- [ ] AGENTS.md generation for GitHub Copilot
- [ ] Team best practices in version control
- [ ] Workflow validation and linting

**Schema Design Needed:**
- `documentation.workflows[]` structure
- `documentation.agent_mcp_mappings` format
- AGENTS.md template format (Copilot-specific)

---

## v0.4 - Intelligent Mappings

**Target:** Research phase

**Features:**
- [ ] Plugin agent/skill metadata extraction
- [ ] Agent capability registry (database or JSON)
- [ ] Automatic agent→MCP recommendations
- [ ] Community-driven mapping contributions
- [ ] ML-based usage pattern analysis (ambitious)

**Open Questions:**
- How to extract plugin metadata without running plugins?
- Central registry vs distributed declarations?
- How to keep mappings up-to-date as plugins evolve?

---

## Documentation Improvements

- [ ] Add migration guide for users switching from manual configs
- [ ] Create video walkthrough of `overture init` and `overture sync`
- [ ] Document all CLI commands with examples
- [ ] Add troubleshooting section to docs/user-guide.md
- [ ] Create comparison table: Overture vs manual config management

---

## Testing & Quality

- [ ] E2E tests in `apps/cli-e2e/`
- [ ] Integration tests with real .mcp.json files
- [ ] Test Claude CLI plugin installation (requires mocking or real Claude CLI)
- [ ] Performance benchmarks for large configs
- [ ] Test across platforms (macOS, Linux, Windows)

---

## Developer Experience

- [ ] Add `overture doctor` command - health check for configuration
- [ ] Better error messages with actionable suggestions
- [ ] Interactive mode for `overture init` with prompts
- [ ] Dry-run mode for all commands (`--dry-run` flag)
- [ ] Verbose logging (`--verbose` flag)

---

## Nice-to-Have

- [ ] VSCode extension for Overture config editing
- [ ] IntelliJ plugin for Overture config editing
- [ ] Web-based config editor
- [ ] GitHub Action for validating .overture/config.yaml
- [ ] Pre-commit hook for `overture validate`
- [ ] Auto-completion for config YAML files

---

## Notes

**Bootstrapping Problem Timeline:**
1. v0.1 (current) - Manual managed section in Overture's CLAUDE.md
2. v0.2 (next) - Create `.overture/config.yaml`, but still manual section
3. v0.2 complete - Run `overture sync`, auto-generate managed section
4. Future - Managed section stays updated automatically

**Philosophy:**
- Overture should use Overture to manage itself
- Dogfooding ensures the tool works in real-world scenarios
- Bootstrapping problem is expected for meta-tools

**Related Reading:**
- docs/PURPOSE.md - Full vision and roadmap
- docs/user-guide.md - User-facing documentation
- docs/examples.md - Configuration examples
