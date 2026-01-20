#!/bin/bash
set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}"
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║                    MCP Hub Installer                         ║"
echo "║         AI Infrastructure Hub for Claude Code                ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# Configuration
MCP_SERVER_URL="https://mcp.m9m.dev"
REPO_URL="https://raw.githubusercontent.com/ST0MP-EE5/mcp-server/main"
CLAUDE_DIR="$HOME/.claude"
SPECIFY_DIR="$HOME/.specify"

# Create directories
echo -e "${YELLOW}Creating directories...${NC}"
mkdir -p "$CLAUDE_DIR/commands"
mkdir -p "$SPECIFY_DIR/templates"

# Download slash commands
echo -e "${YELLOW}Installing slash commands...${NC}"

COMMANDS=(
  "codex-plan.md"
  "ui-skills.md"
  "init-project.md"
  "speckit.analyze.md"
  "speckit.checklist.md"
  "speckit.clarify.md"
  "speckit.constitution.md"
  "speckit.implement.md"
  "speckit.plan.md"
  "speckit.specify.md"
  "speckit.tasks.md"
  "speckit.taskstoissues.md"
)

for cmd in "${COMMANDS[@]}"; do
  echo "  → $cmd"
  curl -fsSL "$REPO_URL/.claude/commands/$cmd" -o "$CLAUDE_DIR/commands/$cmd" 2>/dev/null || echo "    (skipped - not found)"
done

# Download rams (from rams.ai)
echo "  → rams.md"
curl -fsSL https://rams.ai/install 2>/dev/null | bash -s -- --quiet 2>/dev/null || \
  curl -fsSL "$REPO_URL/.claude/commands/rams.md" -o "$CLAUDE_DIR/commands/rams.md" 2>/dev/null || true

# Download vercel-labs skills
echo -e "${YELLOW}Installing Vercel Labs skills...${NC}"
mkdir -p "$CLAUDE_DIR/commands/vercel-labs/react-best-practices/rules"
mkdir -p "$CLAUDE_DIR/commands/vercel-labs/web-design-guidelines"
mkdir -p "$CLAUDE_DIR/commands/vercel-labs/claude.ai/vercel-deploy-claimable"

curl -fsSL "$REPO_URL/.claude/commands/vercel-labs/react-best-practices/SKILL.md" \
  -o "$CLAUDE_DIR/commands/vercel-labs/react-best-practices/SKILL.md" 2>/dev/null || true
curl -fsSL "$REPO_URL/.claude/commands/vercel-labs/web-design-guidelines/SKILL.md" \
  -o "$CLAUDE_DIR/commands/vercel-labs/web-design-guidelines/SKILL.md" 2>/dev/null || true

echo "  → vercel-labs skills installed"

# Download Spec Kit templates
echo -e "${YELLOW}Installing Spec Kit templates...${NC}"
TEMPLATES=(
  "spec-template.md"
  "plan-template.md"
  "tasks-template.md"
  "checklist-template.md"
  "agent-file-template.md"
)

for tpl in "${TEMPLATES[@]}"; do
  echo "  → $tpl"
  curl -fsSL "$REPO_URL/.specify/templates/$tpl" -o "$SPECIFY_DIR/templates/$tpl" 2>/dev/null || echo "    (skipped)"
done

# Configure MCP Server connection
echo -e "${YELLOW}Configuring MCP Server connection...${NC}"

SETTINGS_FILE="$CLAUDE_DIR/settings.json"

if [ -f "$SETTINGS_FILE" ]; then
  # Check if mcp-server already configured
  if grep -q "mcp.m9m.dev" "$SETTINGS_FILE" 2>/dev/null; then
    echo -e "  ${GREEN}✓ MCP Server already configured${NC}"
  else
    echo -e "  ${YELLOW}Adding MCP Server to existing settings...${NC}"
    # Backup existing settings
    cp "$SETTINGS_FILE" "$SETTINGS_FILE.backup"

    # Use node/jq to merge settings if available, otherwise notify user
    if command -v node &> /dev/null; then
      node -e "
        const fs = require('fs');
        const settings = JSON.parse(fs.readFileSync('$SETTINGS_FILE', 'utf8'));
        settings.mcpServers = settings.mcpServers || {};
        settings.mcpServers['mcp-server'] = {
          command: 'npx',
          args: ['-y', 'mcp-remote', 'https://mcp.m9m.dev/mcp/sse'],
          env: {
            MCP_HEADERS: 'Authorization: Bearer YOUR_TOKEN_HERE'
          }
        };
        fs.writeFileSync('$SETTINGS_FILE', JSON.stringify(settings, null, 2));
      "
      echo -e "  ${GREEN}✓ MCP Server added to settings${NC}"
    else
      echo -e "  ${RED}Please manually add MCP Server to $SETTINGS_FILE${NC}"
    fi
  fi
else
  # Create new settings file
  cat > "$SETTINGS_FILE" << 'EOF'
{
  "mcpServers": {
    "mcp-server": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "https://mcp.m9m.dev/mcp/sse"],
      "env": {
        "MCP_HEADERS": "Authorization: Bearer YOUR_TOKEN_HERE"
      }
    }
  }
}
EOF
  echo -e "  ${GREEN}✓ Created settings.json with MCP Server${NC}"
fi

# OAuth Setup
echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}Authentication Setup${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo ""

# Check if running interactively with a real TTY
if [ -t 0 ] && [ -c /dev/tty ]; then
  read -p "Do you want to authenticate now via GitHub OAuth? (y/n) " -n 1 -r </dev/tty
  echo ""
else
  REPLY="n"
  echo -e "${YELLOW}Non-interactive mode. Run OAuth manually after install.${NC}"
fi

if [[ $REPLY =~ ^[Yy]$ ]]; then
  echo -e "${YELLOW}Starting OAuth device flow...${NC}"

  DEVICE_RESPONSE=$(curl -s -X POST "$MCP_SERVER_URL/oauth/device" 2>/dev/null)

  if [ -n "$DEVICE_RESPONSE" ]; then
    USER_CODE=$(echo "$DEVICE_RESPONSE" | grep -o '"user_code":"[^"]*"' | cut -d'"' -f4)
    VERIFICATION_URI=$(echo "$DEVICE_RESPONSE" | grep -o '"verification_uri":"[^"]*"' | cut -d'"' -f4)
    DEVICE_CODE=$(echo "$DEVICE_RESPONSE" | grep -o '"device_code":"[^"]*"' | cut -d'"' -f4)

    if [ -n "$USER_CODE" ]; then
      echo ""
      echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
      echo -e "  1. Go to: ${BLUE}$VERIFICATION_URI${NC}"
      echo -e "  2. Enter code: ${YELLOW}$USER_CODE${NC}"
      echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
      echo ""
      read -p "Press Enter after you've authorized in the browser..." </dev/tty 2>/dev/null || sleep 10

      # Poll for token
      TOKEN_RESPONSE=$(curl -s -X POST "$MCP_SERVER_URL/oauth/token" \
        -H "Content-Type: application/json" \
        -d "{\"device_code\":\"$DEVICE_CODE\"}" 2>/dev/null)

      TOKEN=$(echo "$TOKEN_RESPONSE" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

      if [ -n "$TOKEN" ]; then
        # Update settings with token
        if command -v node &> /dev/null; then
          node -e "
            const fs = require('fs');
            const settings = JSON.parse(fs.readFileSync('$SETTINGS_FILE', 'utf8'));
            settings.mcpServers['mcp-server'].env.MCP_HEADERS = 'Authorization: Bearer $TOKEN';
            fs.writeFileSync('$SETTINGS_FILE', JSON.stringify(settings, null, 2));
          "
          echo -e "${GREEN}✓ Authentication successful! Token saved.${NC}"
        else
          echo -e "${YELLOW}Token received. Please update $SETTINGS_FILE manually:${NC}"
          echo -e "  MCP_HEADERS: \"Authorization: Bearer $TOKEN\""
        fi
      else
        echo -e "${RED}✗ Failed to get token. Try again or authenticate manually.${NC}"
      fi
    fi
  else
    echo -e "${RED}✗ Could not reach MCP server. Skipping OAuth.${NC}"
  fi
else
  echo -e "${YELLOW}Skipping OAuth. You can authenticate later by running:${NC}"
  echo -e "  curl -X POST $MCP_SERVER_URL/oauth/device"
fi

# Summary
echo ""
echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}                    Installation Complete!                      ${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "Installed:"
echo -e "  ${GREEN}✓${NC} Slash commands → ~/.claude/commands/"
echo -e "  ${GREEN}✓${NC} Spec Kit templates → ~/.specify/templates/"
echo -e "  ${GREEN}✓${NC} MCP Server config → ~/.claude/settings.json"
echo ""
echo -e "Available commands:"
echo -e "  ${BLUE}/codex-plan${NC}     - Create implementation plans with Codex"
echo -e "  ${BLUE}/ui-skills${NC}      - UI constraints and review"
echo -e "  ${BLUE}/rams${NC}           - Accessibility review"
echo -e "  ${BLUE}/speckit.*${NC}      - Spec-driven development"
echo -e "  ${BLUE}/init-project${NC}   - Initialize new projects"
echo ""
echo -e "MCP Tools (after auth):"
echo -e "  ${BLUE}Greptile${NC}        - AI codebase search"
echo -e "  ${BLUE}Linear${NC}          - Issue tracking"
echo -e "  ${BLUE}Context7${NC}        - Library documentation"
echo -e "  ${BLUE}Memory${NC}          - Cross-session memory"
echo ""
echo -e "${YELLOW}Start Claude Code in any project to begin!${NC}"
echo ""
