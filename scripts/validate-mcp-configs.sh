#!/bin/bash
# validate-mcp-configs.sh
# Validates MCP configurations across all supported AI clients

set -e

echo "🔍 Validating MCP Configurations..."
echo

# Validate Overture config
echo "1. Validating Overture configuration..."
if ! overture validate 2>/dev/null; then
  echo "   ❌ Overture config validation failed"
  echo "   Run 'overture validate' for details"
  exit 1
fi
echo "   ✅ Overture config valid"
echo

# Check Claude Code config
echo "2. Checking Claude Code config..."
USER_FOUND=0
PROJECT_FOUND=0

# User config
if [ -f ~/.claude.json ]; then
  if jq empty ~/.claude.json 2>/dev/null; then
    echo "   ✅ User: ~/.claude.json is valid JSON"
    MCP_COUNT=$(jq -r '.mcpServers | keys | length' ~/.claude.json)
    echo "      MCP Servers ($MCP_COUNT): $(jq -r '.mcpServers | keys | join(", ")' ~/.claude.json)"
    USER_FOUND=1
  else
    echo "   ❌ User: ~/.claude.json has JSON errors"
  fi
else
  echo "   ⚠️  User: ~/.claude.json not found"
fi

# Project config
if [ -f .mcp.json ]; then
  if jq empty .mcp.json 2>/dev/null; then
    echo "   ✅ Project: ./.mcp.json is valid JSON"
    MCP_COUNT=$(jq -r '.mcpServers | keys | length' .mcp.json)
    echo "      MCP Servers ($MCP_COUNT): $(jq -r '.mcpServers | keys | join(", ")' .mcp.json)"
    PROJECT_FOUND=1
  else
    echo "   ❌ Project: ./.mcp.json has JSON errors"
  fi
else
  echo "   ℹ️  Project: ./.mcp.json not found (user config will be used)"
fi

if [ $USER_FOUND -eq 0 ] && [ $PROJECT_FOUND -eq 0 ]; then
  echo "   ⚠️  No Claude Code configs found"
fi
echo

# Check Copilot CLI config
echo "3. Checking Copilot CLI config..."
USER_FOUND=0
PROJECT_FOUND=0

# User config
if [ -f ~/.config/github-copilot/mcp.json ]; then
  if jq empty ~/.config/github-copilot/mcp.json 2>/dev/null; then
    echo "   ✅ User: ~/.config/github-copilot/mcp.json is valid JSON"
    MCP_COUNT=$(jq -r '.mcpServers | keys | length' ~/.config/github-copilot/mcp.json)
    echo "      MCP Servers ($MCP_COUNT): $(jq -r '.mcpServers | keys | join(", ")' ~/.config/github-copilot/mcp.json)"
    
    # Check GitHub MCP is excluded
    if jq -e '.mcpServers.github' ~/.config/github-copilot/mcp.json >/dev/null 2>&1; then
      echo "      ⚠️  WARNING: 'github' MCP found (should be excluded)"
    else
      echo "      ✅ 'github' MCP properly excluded"
    fi
    USER_FOUND=1
  else
    echo "   ❌ User: ~/.config/github-copilot/mcp.json has JSON errors"
  fi
else
  echo "   ⚠️  User: ~/.config/github-copilot/mcp.json not found"
fi

# Project config
if [ -f .github/mcp.json ]; then
  if jq empty .github/mcp.json 2>/dev/null; then
    echo "   ✅ Project: ./.github/mcp.json is valid JSON"
    MCP_COUNT=$(jq -r '.mcpServers | keys | length' .github/mcp.json)
    echo "      MCP Servers ($MCP_COUNT): $(jq -r '.mcpServers | keys | join(", ")' .github/mcp.json)"
    
    # Check GitHub MCP is excluded
    if jq -e '.mcpServers.github' .github/mcp.json >/dev/null 2>&1; then
      echo "      ⚠️  WARNING: 'github' MCP found (should be excluded)"
    else
      echo "      ✅ 'github' MCP properly excluded"
    fi
    PROJECT_FOUND=1
  else
    echo "   ❌ Project: ./.github/mcp.json has JSON errors"
  fi
else
  echo "   ℹ️  Project: ./.github/mcp.json not found (user config will be used)"
fi

if [ $USER_FOUND -eq 0 ] && [ $PROJECT_FOUND -eq 0 ]; then
  echo "   ⚠️  No Copilot CLI configs found"
fi
echo

# Check OpenCode config
echo "4. Checking OpenCode config..."
USER_FOUND=0
PROJECT_FOUND=0

# User config
if [ -f ~/.config/opencode/opencode.json ]; then
  if jq empty ~/.config/opencode/opencode.json 2>/dev/null; then
    echo "   ✅ User: ~/.config/opencode/opencode.json is valid JSON"
    MCP_COUNT=$(jq -r '.mcp | keys | length' ~/.config/opencode/opencode.json)
    echo "      MCP Servers ($MCP_COUNT): $(jq -r '.mcp | keys | join(", ")' ~/.config/opencode/opencode.json)"
    
    # Check for enabled field
    DISABLED_COUNT=$(jq -r '[.mcp[] | select(.enabled == false)] | length' ~/.config/opencode/opencode.json)
    if [ "$DISABLED_COUNT" -gt 0 ]; then
      echo "      ⚠️  $DISABLED_COUNT MCP server(s) disabled"
    fi
    USER_FOUND=1
  else
    echo "   ❌ User: ~/.config/opencode/opencode.json has JSON errors"
  fi
else
  echo "   ⚠️  User: ~/.config/opencode/opencode.json not found"
fi

# Project config
if [ -f opencode.json ]; then
  if jq empty opencode.json 2>/dev/null; then
    echo "   ✅ Project: ./opencode.json is valid JSON"
    MCP_COUNT=$(jq -r '.mcp | keys | length' opencode.json)
    echo "      MCP Servers ($MCP_COUNT): $(jq -r '.mcp | keys | join(", ")' opencode.json)"
    
    # Check for enabled field
    DISABLED_COUNT=$(jq -r '[.mcp[] | select(.enabled == false)] | length' opencode.json)
    if [ "$DISABLED_COUNT" -gt 0 ]; then
      echo "      ⚠️  $DISABLED_COUNT MCP server(s) disabled"
    fi
    PROJECT_FOUND=1
  else
    echo "   ❌ Project: ./opencode.json has JSON errors"
  fi
else
  echo "   ℹ️  Project: ./opencode.json not found (user config will be used)"
fi

if [ $USER_FOUND -eq 0 ] && [ $PROJECT_FOUND -eq 0 ]; then
  echo "   ⚠️  No OpenCode configs found"
fi
echo

# Summary
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Validation complete!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo
echo "Next steps:"
echo "  1. Restart each AI client to load the new configuration"
echo "  2. Test MCP server connectivity in each client"
echo "  3. Verify tools are available and working"
echo
echo "For detailed testing instructions, see:"
echo "  docs/testing-mcp-changes.md"
echo
