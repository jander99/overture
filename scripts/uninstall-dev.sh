#!/usr/bin/env bash

#
# Local Development Uninstall Script
#
# Removes the globally linked Overture CLI that was installed
# via npm link during local development.
#
# Usage:
#   ./scripts/uninstall-dev.sh
#

set -e  # Exit on error

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  Overture Local Development Uninstall${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Get workspace root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKSPACE_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$WORKSPACE_ROOT"

# Check if overture is currently linked
OVERTURE_PATH=$(which overture 2>/dev/null || echo "")

if [ -z "$OVERTURE_PATH" ]; then
  echo -e "${YELLOW}ℹ${NC}  'overture' command not found - nothing to uninstall"
  exit 0
fi

echo -e "${YELLOW}→${NC} Found linked installation at: $OVERTURE_PATH"
echo ""

# Unlink from apps/cli directory
echo -e "${YELLOW}→${NC} Removing global symlink..."
cd apps/cli
npm unlink

if [ $? -ne 0 ]; then
  echo -e "${RED}✗${NC} npm unlink failed"
  exit 1
fi
cd "$WORKSPACE_ROOT"
echo -e "${GREEN}✓${NC} Global symlink removed"
echo ""

# Verify removal
OVERTURE_PATH=$(which overture 2>/dev/null || echo "")

if [ -n "$OVERTURE_PATH" ]; then
  echo -e "${YELLOW}⚠${NC}  Warning: 'overture' command still found at: $OVERTURE_PATH"
  echo -e "${YELLOW}ℹ${NC}  This may be the published npm package or another installation"
else
  echo -e "${GREEN}✓${NC} 'overture' command no longer in PATH"
fi
echo ""

# Success message
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}  ✓ Uninstall complete!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "The local development version has been unlinked."
echo ""
echo -e "${YELLOW}To install the published version:${NC}"
echo -e "  ${BLUE}npm install -g @overture/cli${NC}"
echo ""
echo -e "${YELLOW}To reinstall for local development:${NC}"
echo -e "  ${BLUE}./scripts/install-dev.sh${NC}"
echo ""
