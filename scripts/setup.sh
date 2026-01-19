#!/bin/bash
set -e

echo "========================================="
echo "  MCP-Server Setup Script"
echo "========================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check for required tools
check_tool() {
    if command -v "$1" &> /dev/null; then
        echo -e "${GREEN}✓${NC} $1 found"
        return 0
    else
        echo -e "${RED}✗${NC} $1 not found"
        return 1
    fi
}

echo "Checking prerequisites..."
check_tool "node"
check_tool "npm"
check_tool "python3"
echo ""

# 1. Install main server dependencies
echo "Installing server dependencies..."
npm install
echo -e "${GREEN}✓${NC} Server dependencies installed"
echo ""

# 2. Build main server
echo "Building server..."
npm run build
echo -e "${GREEN}✓${NC} Server built"
echo ""

# 3. Install TypeScript LSP globally (if not already)
echo "Checking TypeScript LSP..."
if ! command -v typescript-language-server &> /dev/null; then
    echo "Installing TypeScript Language Server..."
    npm install -g typescript-language-server typescript
    echo -e "${GREEN}✓${NC} TypeScript LSP installed"
else
    echo -e "${GREEN}✓${NC} TypeScript LSP already installed"
fi
echo ""

# 4. Pre-cache context7 MCP
echo "Pre-caching context7 MCP..."
npx -y @upstash/context7-mcp --version 2>/dev/null || true
echo -e "${GREEN}✓${NC} context7 MCP cached"
echo ""

# 5. Make hook scripts executable
echo "Setting up plugin hooks..."
chmod +x ./plugins/ralph-loop/hooks/*.sh 2>/dev/null || true
chmod +x ./plugins/ralph-loop/scripts/*.sh 2>/dev/null || true
chmod +x ./plugins/hookify/hooks/*.py 2>/dev/null || true
echo -e "${GREEN}✓${NC} Plugin hooks configured"
echo ""

# 6. Check for required environment variables
echo "Checking environment variables..."
ENV_FILE=".env"
MISSING_VARS=()

if [ -f "$ENV_FILE" ]; then
    source "$ENV_FILE"
fi

if [ -z "$GITHUB_PERSONAL_ACCESS_TOKEN" ]; then
    MISSING_VARS+=("GITHUB_PERSONAL_ACCESS_TOKEN")
fi

if [ -z "$GREPTILE_API_KEY" ]; then
    MISSING_VARS+=("GREPTILE_API_KEY")
fi

if [ ${#MISSING_VARS[@]} -gt 0 ]; then
    echo -e "${YELLOW}⚠${NC} Missing environment variables (add to .env):"
    for var in "${MISSING_VARS[@]}"; do
        echo "   - $var"
    done
else
    echo -e "${GREEN}✓${NC} All required environment variables set"
fi
echo ""

# 7. Verify setup
echo "========================================="
echo "  Setup Complete!"
echo "========================================="
echo ""
echo "Configured plugins:"
echo "  - context7 (npm MCP)"
echo "  - github (HTTP MCP)"
echo "  - linear (HTTP MCP)"
echo "  - greptile (HTTP MCP)"
echo "  - typescript-lsp (Local LSP)"
echo "  - hookify (Python hooks)"
echo "  - ralph-loop (Shell hooks)"
echo "  - code-simplifier (Skill/Agent)"
echo ""
echo "Next steps:"
echo "  1. Add missing env vars to .env (if any)"
echo "  2. Start the server: npm start"
echo "  3. Connect your AI IDE to the server"
echo ""
