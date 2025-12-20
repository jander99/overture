# Testing MCP Configuration Changes

This guide provides step-by-step instructions for validating MCP server configurations across all supported AI clients after making changes to your Overture configuration.

## Overview

After adding, removing, or modifying MCP servers in your `overture.yml` or `.overture/config.yaml` files, you should test that:

1. The configuration syncs correctly to each client
2. Each client can start the MCP server successfully
3. The MCP server's tools are available in each client
4. The MCP server responds correctly to tool invocations

---

## Pre-Testing Checklist

Before testing, ensure:

- [ ] You've saved your changes to `~/.config/overture/config.yml` or `.overture/config.yaml`
- [ ] You've run `overture validate` to check for configuration errors
- [ ] You've run `overture sync` to update all client configurations
- [ ] You've noted which MCP servers you added/modified/removed

---

## Testing: Claude Code

**Config Location:** `~/.claude.json` (user) and `./.mcp.json` (project)

### Step 1: Verify Config Was Written

```bash
# Check user config
cat ~/.claude.json | jq '.mcpServers | keys'

# Check project config (if applicable)
cat .mcp.json | jq '.mcpServers | keys'
```

**Expected:** You should see your MCP server names listed.

### Step 2: Restart Claude Code

Claude Code needs to be restarted to pick up configuration changes:

```bash
# Exit any running Claude Code session
# Then start a new session
claude
```

**Note:** If Claude Code is running in your editor (VS Code extension), reload the window.

### Step 3: Verify MCP Server Startup

In a new Claude Code conversation, ask:

```
What MCP servers are currently connected?
```

**Expected Response:** Claude should list all configured MCP servers with their status (connected/disconnected).

**Troubleshooting:**

- If a server is disconnected, check the command/args in your config
- Use `claude mcp list` to see available servers
- Check server logs if available

### Step 4: Test MCP Server Tools

For each MCP server you added/modified, test a specific tool:

**Example: Testing filesystem MCP**

```
Using the filesystem MCP, list the files in the current directory.
```

**Example: Testing memory MCP**

```
Using the memory MCP, store this information: "Project name is Overture"
```

**Example: Testing custom MCP**

```
Using the [your-mcp-name] server, [describe a task using its tools]
```

**Expected:** Claude should successfully invoke the MCP tool and return results.

**Troubleshooting:**

- If Claude doesn't know about the tool, the MCP server may not have started
- Check `~/.claude/logs/` for MCP server error messages
- Verify the `command` and `args` are correct for your MCP server

### Step 5: Verify Environment Variables (if applicable)

If your MCP uses environment variables:

```bash
# Check the env vars are set
echo $GITHUB_TOKEN
echo $DATABASE_URL
# etc.
```

Then test a feature that requires the env var:

```
Using the github MCP, show my recent repositories.
```

**Expected:** The MCP should use the environment variable successfully.

---

## Testing: GitHub Copilot CLI

**Config Location:** `~/.config/github-copilot/mcp.json` (user) and `./.github/mcp.json` (project)

### Step 1: Verify Config Was Written

```bash
# Check user config
cat ~/.config/github-copilot/mcp.json | jq '.mcpServers | keys'

# Check project config (if applicable)
cat .github/mcp.json | jq '.mcpServers | keys'
```

**Expected:** You should see your MCP server names listed.

**Note:** The `github` MCP server should NOT appear in the list (Overture automatically excludes it because Copilot CLI bundles it).

### Step 2: Restart Copilot CLI

Copilot CLI loads MCP configurations on startup:

```bash
# Exit any running copilot session
# Start a new session
copilot
```

### Step 3: Verify MCP Server Availability

In a new Copilot CLI session, check available tools:

```bash
# In copilot chat
What tools do you have access to?
```

**Expected Response:** Copilot should mention tools from your MCP servers (e.g., "I can access the filesystem", "I have memory storage capabilities").

**Alternative:** Use the `/tools` command if available.

### Step 4: Test MCP Server Tools

For each MCP server you added/modified, test a specific tool:

**Example: Testing filesystem MCP**

```
Read the README.md file in the current directory using the filesystem tool.
```

**Example: Testing memory MCP**

```
Store a note in memory that says "Testing Copilot CLI integration".
```

**Expected:** Copilot should successfully use the MCP tool and return results.

**Troubleshooting:**

- Check `~/.config/github-copilot/logs/` for errors
- Verify the MCP server binary is in your PATH
- Test the MCP server command manually: `npx @modelcontextprotocol/server-filesystem /tmp`

### Step 5: Test GitHub MCP (Built-in)

Verify that the built-in GitHub MCP still works (since we exclude it from config):

```
Show me my recent GitHub repositories.
```

**Expected:** Copilot should use its built-in GitHub integration successfully.

---

## Testing: OpenCode

**Config Location:** `~/.config/opencode/opencode.json` (user) and `./opencode.json` (project)

### Step 1: Verify Config Was Written

```bash
# Check user config
cat ~/.config/opencode/opencode.json | jq '.mcp | keys'

# Check project config (if applicable)
cat opencode.json | jq '.mcp | keys'
```

**Expected:** You should see your MCP server names listed.

### Step 2: Restart OpenCode

OpenCode needs to reload its configuration:

```bash
# Exit any running OpenCode session
# Start a new session
opencode
```

**Note:** If OpenCode is running in your editor, use the "Reload Window" command.

### Step 3: Check MCP Server Status

OpenCode typically shows MCP server status in its UI. Look for:

- MCP server indicators in the status bar
- MCP panel or sidebar showing connected servers
- Settings > MCP Servers section

**Expected:** All configured MCP servers should show as "enabled" and "connected".

### Step 4: Test MCP Server Tools

In an OpenCode conversation, test each MCP server:

**Example: Testing filesystem MCP**

```
Use the filesystem MCP to list all TypeScript files in the src/ directory.
```

**Example: Testing memory MCP**

```
Use the memory MCP to remember that this is a testing session.
```

**Expected:** OpenCode should invoke the MCP tool and show results.

**Troubleshooting:**

- Check OpenCode's developer console for errors (Help > Toggle Developer Tools)
- Verify the `command` array in the config matches the MCP server's expected format
- Check that `enabled: true` is set for each MCP server

### Step 5: Verify Environment Variables (if applicable)

If your MCP uses environment variables with OpenCode's `{env:VAR}` syntax:

```bash
# Check the config has the correct format
cat ~/.config/opencode/opencode.json | jq '.mcp.github.environment'
```

**Expected:** Variables should use `{env:GITHUB_TOKEN}` syntax, not `${GITHUB_TOKEN}`.

Test the MCP functionality:

```
Use the github MCP to fetch my profile information.
```

**Expected:** The MCP should successfully use the environment variable.

---

## Common MCP Servers and Test Cases

### filesystem

**Test 1: List Directory**

```
List all files in the current directory.
```

**Test 2: Read File**

```
Read the contents of package.json and tell me the project name.
```

**Test 3: Write File**

```
Create a new file called test.txt with the content "Hello from [client-name]".
```

### memory

**Test 1: Store Information**

```
Remember that my favorite color is blue.
```

**Test 2: Retrieve Information**

```
What's my favorite color?
```

**Test 3: List Entities**

```
What information have you stored in memory?
```

### github (Claude Code / OpenCode only)

**Test 1: List Repositories**

```
Show me my recent GitHub repositories.
```

**Test 2: Create Issue**

```
Create a test issue in [repo-name] titled "Testing MCP integration".
```

**Test 3: Search Code**

```
Search GitHub for examples of using the MCP protocol.
```

### sequentialthinking

**Test 1: Complex Reasoning**

```
Use sequential thinking to plan out a 5-day vacation itinerary to Japan.
```

**Expected:** Should show detailed step-by-step reasoning process.

### context7 (formerly Brave Search)

**Test 1: Documentation Lookup**

```
Use context7 to fetch the latest documentation for React hooks.
```

**Test 2: Library Research**

```
Look up how to use the zod library for schema validation.
```

---

## Validation Checklist

After testing all clients, verify:

- [ ] **Claude Code**: All MCP servers connected and tools working
- [ ] **Copilot CLI**: MCP tools available and responding correctly
- [ ] **OpenCode**: MCP servers enabled and functioning
- [ ] **Config files**: All client configs match your Overture configuration
- [ ] **Environment variables**: Sensitive data not exposed, variables resolved correctly
- [ ] **GitHub MCP**: Excluded from Copilot CLI config (not duplicated)
- [ ] **Error logs**: No MCP startup errors in any client

---

## Troubleshooting Guide

### MCP Server Won't Start

**Symptoms:**

- Client shows server as "disconnected" or "failed"
- Tools from the MCP are not available

**Diagnosis:**

1. **Check the command is valid:**

   ```bash
   # Test the MCP server command manually
   npx -y @modelcontextprotocol/server-filesystem /tmp
   ```

2. **Check command is in PATH:**

   ```bash
   which npx
   which uvx
   ```

3. **Check logs:**
   - Claude Code: `~/.claude/logs/`
   - Copilot CLI: `~/.config/github-copilot/logs/`
   - OpenCode: Developer Tools > Console

4. **Verify config syntax:**
   ```bash
   overture validate
   cat ~/.claude.json | jq .  # Should not error
   ```

### Environment Variables Not Working

**Symptoms:**

- MCP server starts but fails when using features requiring env vars
- "Authentication failed" or "Missing credentials" errors

**Diagnosis:**

1. **Check env vars are set:**

   ```bash
   echo $GITHUB_TOKEN
   echo $DATABASE_URL
   ```

2. **Check config format:**
   - Claude Code / Copilot CLI: Use `${VAR}` syntax
   - OpenCode: Use `{env:VAR}` syntax

3. **Verify the client can access env vars:**
   - Restart your terminal session
   - Export vars in the shell before starting the client
   - Check if the client needs vars in a specific config file

### Tools Not Available Despite Server Running

**Symptoms:**

- MCP server shows as "connected"
- AI client doesn't seem to know about the tools

**Diagnosis:**

1. **Check the MCP server implements the tools:**

   ```bash
   # Test the MCP server manually and check its tool list
   npx -y @modelcontextprotocol/inspector npx -y @modelcontextprotocol/server-filesystem /tmp
   ```

2. **Restart the client** - Some clients cache tool lists

3. **Check client permissions** - Some clients require explicit permission to use tools

4. **Verify the MCP server version** - Ensure you're using a compatible version

---

## Automated Testing Script

For convenience, here's a script to quickly validate all client configs:

```bash
#!/bin/bash
# validate-mcp-configs.sh

echo "🔍 Validating MCP Configurations..."
echo

# Validate Overture config
echo "1. Validating Overture configuration..."
overture validate || exit 1
echo "   ✅ Overture config valid"
echo

# Check Claude Code config
echo "2. Checking Claude Code config..."
if [ -f ~/.claude.json ]; then
  jq empty ~/.claude.json 2>/dev/null && echo "   ✅ ~/.claude.json is valid JSON" || echo "   ❌ ~/.claude.json has JSON errors"
  echo "   MCP Servers: $(jq -r '.mcpServers | keys | join(", ")' ~/.claude.json)"
else
  echo "   ⚠️  ~/.claude.json not found"
fi
echo

# Check Copilot CLI config
echo "3. Checking Copilot CLI config..."
if [ -f ~/.config/github-copilot/mcp.json ]; then
  jq empty ~/.config/github-copilot/mcp.json 2>/dev/null && echo "   ✅ ~/.config/github-copilot/mcp.json is valid JSON" || echo "   ❌ ~/.config/github-copilot/mcp.json has JSON errors"
  echo "   MCP Servers: $(jq -r '.mcpServers | keys | join(", ")' ~/.config/github-copilot/mcp.json)"

  # Check GitHub MCP is excluded
  if jq -e '.mcpServers.github' ~/.config/github-copilot/mcp.json >/dev/null 2>&1; then
    echo "   ⚠️  WARNING: 'github' MCP found (should be excluded for Copilot CLI)"
  fi
else
  echo "   ⚠️  ~/.config/github-copilot/mcp.json not found"
fi
echo

# Check OpenCode config
echo "4. Checking OpenCode config..."
if [ -f ~/.config/opencode/opencode.json ]; then
  jq empty ~/.config/opencode/opencode.json 2>/dev/null && echo "   ✅ ~/.config/opencode/opencode.json is valid JSON" || echo "   ❌ ~/.config/opencode/opencode.json has JSON errors"
  echo "   MCP Servers: $(jq -r '.mcp | keys | join(", ")' ~/.config/opencode/opencode.json)"
else
  echo "   ⚠️  ~/.config/opencode/opencode.json not found"
fi
echo

echo "✅ Validation complete!"
echo
echo "Next steps:"
echo "1. Restart each AI client to load the new configuration"
echo "2. Test MCP server connectivity in each client"
echo "3. Verify tools are available and working"
```

**Usage:**

```bash
chmod +x validate-mcp-configs.sh
./validate-mcp-configs.sh
```

---

## Best Practices

1. **Test incrementally** - Add one MCP server at a time and test before adding more
2. **Keep backups** - Run `overture backup` before making major changes
3. **Use dry-run** - Test with `overture sync --dry-run --detail` before applying changes
4. **Check logs** - Always check client logs when troubleshooting
5. **Document custom MCPs** - Keep notes on what each MCP server does and how to test it
6. **Version control** - Commit your `.overture/config.yaml` to track changes over time

---

## Related Documentation

- [User Guide](./user-guide.md) - Complete Overture usage guide
- [Configuration Examples](./examples.md) - Sample MCP configurations
- [Overture Schema](./overture-schema.md) - Configuration reference
- [Troubleshooting](./user-guide.md#troubleshooting) - Common issues and solutions

---

**Last Updated:** 2025-12-20  
**Applies to:** Overture v0.3.0+
