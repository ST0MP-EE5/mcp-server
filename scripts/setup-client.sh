#!/bin/bash
# MCP Server Client Setup Script
# Run this on any machine to connect to the MCP server and install plugins/hooks

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  MCP Server Client Setup${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# Configuration
MCP_SERVER_URL="${MCP_SERVER_URL:-https://mcp.m9m.dev}"
MCP_API_KEY="${MCP_API_KEY:-}"

# Check if API key is provided
if [ -z "$MCP_API_KEY" ]; then
    echo -e "${YELLOW}MCP_API_KEY not set. Please enter your API key:${NC}"
    read -s MCP_API_KEY
    echo ""
fi

if [ -z "$MCP_API_KEY" ]; then
    echo -e "${RED}Error: API key is required${NC}"
    exit 1
fi

# Verify server connection
echo -e "${YELLOW}1. Verifying server connection...${NC}"
HEALTH=$(curl -s -f "${MCP_SERVER_URL}/health" 2>/dev/null || echo "FAILED")
if [ "$HEALTH" = "FAILED" ]; then
    echo -e "${RED}Error: Cannot connect to ${MCP_SERVER_URL}${NC}"
    exit 1
fi
echo -e "${GREEN}   Server is healthy${NC}"

# Verify API key
echo -e "${YELLOW}2. Verifying API key...${NC}"
AUTH_CHECK=$(curl -s -f -H "Authorization: Bearer ${MCP_API_KEY}" "${MCP_SERVER_URL}/api/v1/registry" 2>/dev/null || echo "FAILED")
if [ "$AUTH_CHECK" = "FAILED" ]; then
    echo -e "${RED}Error: Invalid API key${NC}"
    exit 1
fi
echo -e "${GREEN}   API key is valid${NC}"

# Check if Claude Code is installed
echo -e "${YELLOW}3. Checking Claude Code installation...${NC}"
if ! command -v claude &> /dev/null; then
    echo -e "${RED}Error: Claude Code CLI not found${NC}"
    echo "Install it from: https://claude.ai/code"
    exit 1
fi
echo -e "${GREEN}   Claude Code is installed${NC}"

# Configure MCP server connection
echo -e "${YELLOW}4. Configuring MCP server connection...${NC}"

CLAUDE_SETTINGS="$HOME/.claude/settings.json"
mkdir -p "$HOME/.claude"

# Create or update settings.json
if [ -f "$CLAUDE_SETTINGS" ]; then
    # Backup existing settings
    cp "$CLAUDE_SETTINGS" "$CLAUDE_SETTINGS.backup"

    # Check if jq is available for JSON manipulation
    if command -v jq &> /dev/null; then
        # Use jq to merge MCP server config
        jq --arg url "${MCP_SERVER_URL}/mcp/sse" --arg key "$MCP_API_KEY" '
            .mcpServers["mcp-server"] = {
                "command": "npx",
                "args": ["-y", "mcp-remote", $url],
                "env": {
                    "MCP_HEADERS": ("Authorization: Bearer " + $key)
                }
            }
        ' "$CLAUDE_SETTINGS.backup" > "$CLAUDE_SETTINGS"
        echo -e "${GREEN}   MCP server added to settings.json${NC}"
    else
        echo -e "${YELLOW}   jq not found, using claude mcp add command...${NC}"
        claude mcp add -t sse \
            -H "Authorization: Bearer ${MCP_API_KEY}" \
            -s user \
            mcp-server \
            "${MCP_SERVER_URL}/mcp/sse" 2>/dev/null || true
    fi
else
    # Create new settings file
    cat > "$CLAUDE_SETTINGS" << EOF
{
  "mcpServers": {
    "mcp-server": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "${MCP_SERVER_URL}/mcp/sse"],
      "env": {
        "MCP_HEADERS": "Authorization: Bearer ${MCP_API_KEY}"
      }
    }
  }
}
EOF
    echo -e "${GREEN}   Created settings.json with MCP server${NC}"
fi

# Install plugins
echo -e "${YELLOW}5. Installing plugins...${NC}"

# Enable hookify plugin
echo "   Installing hookify..."
claude plugins enable hookify@claude-code-plugins 2>/dev/null || echo "   (hookify may already be installed)"

# Enable ralph-wiggum plugin
echo "   Installing ralph-wiggum..."
claude plugins enable ralph-wiggum@claude-code-plugins 2>/dev/null || echo "   (ralph-wiggum may already be installed)"

# Enable typescript-lsp plugin
echo "   Installing typescript-lsp..."
claude plugins enable typescript-lsp@claude-plugins-official 2>/dev/null || echo "   (typescript-lsp may already be installed)"

echo -e "${GREEN}   Plugins installed${NC}"

# Create example hook rules
echo -e "${YELLOW}6. Creating example hook rules...${NC}"

HOOKS_DIR=".claude"
mkdir -p "$HOOKS_DIR"

# Dangerous rm command warning
cat > "$HOOKS_DIR/hookify.dangerous-rm.local.md" << 'EOF'
---
name: dangerous-rm-warning
enabled: true
event: bash
conditions:
  - field: command
    operator: contains
    pattern: "rm -rf"
action: warn
---

**Dangerous Command Detected**

You are about to run a potentially destructive `rm -rf` command.

Please verify:
- The path is correct
- You have backups if needed
- This is intentional
EOF

# No secrets in code warning
cat > "$HOOKS_DIR/hookify.no-secrets.local.md" << 'EOF'
---
name: no-secrets-warning
enabled: true
event: file
conditions:
  - field: content
    operator: regex_match
    pattern: "(api_key|secret|password|token)\\s*[=:]\\s*['\"][^'\"]{10,}"
action: warn
---

**Potential Secret Detected**

The code you're writing may contain a hardcoded secret (API key, password, token).

Consider:
- Using environment variables instead
- Adding the file to .gitignore
- Using a secrets manager
EOF

echo -e "${GREEN}   Example hook rules created in $HOOKS_DIR/${NC}"

# Verify setup
echo -e "${YELLOW}7. Verifying setup...${NC}"

# Test MCP connection
echo "   Testing MCP tools..."
MCP_TEST=$(curl -s -H "Authorization: Bearer ${MCP_API_KEY}" "${MCP_SERVER_URL}/mcp/health" | grep -o '"status":"healthy"' || echo "")
if [ -n "$MCP_TEST" ]; then
    echo -e "${GREEN}   MCP server connection verified${NC}"
else
    echo -e "${YELLOW}   Warning: Could not verify MCP server connection${NC}"
fi

# Summary
echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Setup Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "MCP Server: ${MCP_SERVER_URL}"
echo ""
echo "Installed plugins:"
echo "  - hookify (hook rule engine)"
echo "  - ralph-wiggum (AI loops)"
echo "  - typescript-lsp (code intelligence)"
echo ""
echo "Hook rules created:"
echo "  - .claude/hookify.dangerous-rm.local.md"
echo "  - .claude/hookify.no-secrets.local.md"
echo ""
echo "Available remote resources:"
echo "  - Skills: code-simplifier"
echo "  - Configs: claude, codex"
echo "  - MCPs: github, linear, greptile"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Restart Claude Code to load new settings"
echo "2. Add more hook rules to .claude/hookify.*.local.md"
echo "3. Use 'mcp__list_skills' to see available skills"
echo ""
