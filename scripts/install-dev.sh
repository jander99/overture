#!/usr/bin/env bash

#
# Local Development Install Script
#
# Builds the Overture CLI and installs it globally via npm link
# for authentic user experience testing during development.
#
# Usage:
#   ./scripts/install-dev.sh
#

set -e  # Exit on error

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  Overture Local Development Install${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Get workspace root (script location is in scripts/ subdirectory)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKSPACE_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$WORKSPACE_ROOT"

# Step 1: Build the CLI
echo -e "${YELLOW}→${NC} Building @overture/cli..."
export NX_INTERACTIVE=false
export CI=true
export NX_DAEMON=false
npx nx build @overture/cli --verbose=false

if [ $? -ne 0 ]; then
  echo -e "${RED}✗${NC} Build failed"
  exit 1
fi
echo -e "${GREEN}✓${NC} Build complete"
echo ""

# Step 2: Install globally via npm link
echo -e "${YELLOW}→${NC} Installing globally via npm link..."
cd apps/cli
npm link

if [ $? -ne 0 ]; then
  echo -e "${RED}✗${NC} npm link failed"
  exit 1
fi
cd "$WORKSPACE_ROOT"
echo -e "${GREEN}✓${NC} Global symlink created"
echo ""

# Step 3: Verify installation
echo -e "${YELLOW}→${NC} Verifying installation..."
OVERTURE_PATH=$(which overture 2>/dev/null || echo "")

if [ -z "$OVERTURE_PATH" ]; then
  echo -e "${RED}✗${NC} 'overture' command not found in PATH"
  echo -e "${YELLOW}ℹ${NC}  You may need to add npm's global bin to your PATH:"
  echo -e "    export PATH=\"\$(npm bin -g):\$PATH\""
  exit 1
fi

echo -e "${GREEN}✓${NC} Command found at: $OVERTURE_PATH"
echo ""

# Test the command
echo -e "${YELLOW}→${NC} Testing 'overture --version'..."
VERSION=$(overture --version 2>/dev/null || echo "")

if [ -z "$VERSION" ]; then
  echo -e "${RED}✗${NC} Failed to run 'overture --version'"
  exit 1
fi

echo -e "${GREEN}✓${NC} Overture CLI v${VERSION}"
echo ""

# Success message
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}  ✓ Installation complete!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "The ${BLUE}overture${NC} command is now available globally."
echo ""
echo -e "${YELLOW}Development workflow:${NC}"
echo -e "  1. Make code changes"
echo -e "  2. Run: ${BLUE}./scripts/install-dev.sh${NC}"
echo -e "  3. Test: ${BLUE}overture <command>${NC}"
echo ""
echo -e "${YELLOW}Quick commands:${NC}"
echo -e "  ${BLUE}overture --version${NC}     Check version"
echo -e "  ${BLUE}overture doctor${NC}        System diagnostics"
echo -e "  ${BLUE}overture sync --dry-run${NC}  Preview sync changes"
echo ""
echo -e "To uninstall: ${BLUE}./scripts/uninstall-dev.sh${NC}"
echo ""
