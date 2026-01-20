---
description: Sync or transfer your Claude Code setup (hooks, plugins, settings) to another machine
argument-hint: "<backup|restore|export|status>"
allowed-tools: Read, Write, Bash, AskUser, Glob
---

# Sync Setup Command

You are helping the user backup, restore, or transfer their Claude Code local configuration. This includes hooks, plugins, settings, and MCP connections.

**Local components that need syncing:**
- `~/.claude/settings.json` - MCP connections, preferences
- `~/.claude/hooks/` - Custom hooks
- `~/.claude/plugins/` - Installed plugins
- Project-level `CLAUDE.md` files - Already in git

## User Request

```
$ARGUMENTS
```

## Step 1: Determine the Operation

Based on the arguments, determine what the user wants:
- **backup** / **export** - Save current setup to a transferable format
- **restore** / **import** - Restore from a backup
- **status** - Show what's currently configured locally
- **No argument** - Ask what they want to do

## Step 2: Ask Clarifying Questions

Use AskUser to understand the user's needs:

### For Backup/Export:
```
I'll help you backup your Claude Code setup. A few questions:

1. What do you want to backup?
   - Everything (hooks, plugins, settings)
   - Just hooks
   - Just plugins
   - Just MCP settings

2. Where should I save the backup?
   - Current directory (./claude-backup/)
   - Home directory (~/.claude-backup/)
   - Custom path

3. Should I include sensitive data?
   - Yes, include JWT tokens (for same-user restore)
   - No, strip tokens (I'll re-auth via OAuth)

4. What format?
   - Directory (copy files as-is)
   - Tar archive (claude-backup.tar.gz)
```

### For Restore/Import:
```
I'll help you restore your Claude Code setup. A few questions:

1. Where is your backup located?
   - [Let user specify path]

2. What should I restore?
   - Everything
   - Just hooks
   - Just plugins
   - Just MCP settings

3. How should I handle conflicts?
   - Overwrite existing
   - Merge (keep both, rename conflicts)
   - Skip existing

4. Do you need to re-authenticate?
   - Yes, walk me through OAuth
   - No, tokens are in the backup
```

### For Status:
No questions needed - just scan and report.

## Step 3: Execute the Operation

### Backup Operation

```bash
# Create backup directory
BACKUP_DIR="${BACKUP_PATH:-./claude-backup-$(date +%Y%m%d-%H%M%S)}"
mkdir -p "$BACKUP_DIR"

# Backup settings (optionally strip tokens)
if [ "$INCLUDE_TOKENS" = "yes" ]; then
  cp ~/.claude/settings.json "$BACKUP_DIR/"
else
  # Strip sensitive data
  cat ~/.claude/settings.json | jq 'walk(if type == "object" then del(.MCP_HEADERS, .Authorization, .token, .apiKey) else . end)' > "$BACKUP_DIR/settings.json"
fi

# Backup hooks
if [ -d ~/.claude/hooks ]; then
  cp -r ~/.claude/hooks "$BACKUP_DIR/"
fi

# Backup plugins
if [ -d ~/.claude/plugins ]; then
  cp -r ~/.claude/plugins "$BACKUP_DIR/"
fi

# Create manifest
cat > "$BACKUP_DIR/manifest.json" << EOF
{
  "created": "$(date -Iseconds)",
  "machine": "$(hostname)",
  "user": "$(whoami)",
  "components": {
    "settings": $([ -f "$BACKUP_DIR/settings.json" ] && echo true || echo false),
    "hooks": $([ -d "$BACKUP_DIR/hooks" ] && echo true || echo false),
    "plugins": $([ -d "$BACKUP_DIR/plugins" ] && echo true || echo false)
  },
  "tokens_included": $INCLUDE_TOKENS
}
EOF

# Optionally create archive
if [ "$FORMAT" = "archive" ]; then
  tar -czf "${BACKUP_DIR}.tar.gz" -C "$(dirname $BACKUP_DIR)" "$(basename $BACKUP_DIR)"
  rm -rf "$BACKUP_DIR"
  echo "Backup saved to: ${BACKUP_DIR}.tar.gz"
else
  echo "Backup saved to: $BACKUP_DIR"
fi
```

### Restore Operation

```bash
BACKUP_PATH="$USER_SPECIFIED_PATH"

# Extract if archive
if [[ "$BACKUP_PATH" == *.tar.gz ]]; then
  TEMP_DIR=$(mktemp -d)
  tar -xzf "$BACKUP_PATH" -C "$TEMP_DIR"
  BACKUP_PATH="$TEMP_DIR/$(ls $TEMP_DIR)"
fi

# Check manifest
if [ -f "$BACKUP_PATH/manifest.json" ]; then
  cat "$BACKUP_PATH/manifest.json" | jq .
fi

# Restore settings
if [ -f "$BACKUP_PATH/settings.json" ]; then
  if [ "$CONFLICT_MODE" = "merge" ]; then
    # Merge MCP servers
    jq -s '.[0] * .[1]' ~/.claude/settings.json "$BACKUP_PATH/settings.json" > ~/.claude/settings.json.new
    mv ~/.claude/settings.json.new ~/.claude/settings.json
  else
    cp "$BACKUP_PATH/settings.json" ~/.claude/settings.json
  fi
fi

# Restore hooks
if [ -d "$BACKUP_PATH/hooks" ]; then
  mkdir -p ~/.claude/hooks
  cp -r "$BACKUP_PATH/hooks/"* ~/.claude/hooks/
fi

# Restore plugins
if [ -d "$BACKUP_PATH/plugins" ]; then
  mkdir -p ~/.claude/plugins
  cp -r "$BACKUP_PATH/plugins/"* ~/.claude/plugins/
fi
```

### Status Operation

```bash
echo "=== Claude Code Local Setup Status ==="

echo -e "\n📁 Settings (~/.claude/settings.json):"
if [ -f ~/.claude/settings.json ]; then
  echo "  ✓ Found"
  echo "  MCP Servers configured:"
  cat ~/.claude/settings.json | jq -r '.mcpServers | keys[]' 2>/dev/null | sed 's/^/    - /'
else
  echo "  ✗ Not found"
fi

echo -e "\n🪝 Hooks (~/.claude/hooks/):"
if [ -d ~/.claude/hooks ]; then
  HOOK_COUNT=$(find ~/.claude/hooks -name "*.md" -o -name "*.json" 2>/dev/null | wc -l)
  echo "  ✓ Found ($HOOK_COUNT hooks)"
  ls ~/.claude/hooks/ 2>/dev/null | head -5 | sed 's/^/    - /'
else
  echo "  ✗ Not found"
fi

echo -e "\n🔌 Plugins (~/.claude/plugins/):"
if [ -d ~/.claude/plugins ]; then
  PLUGIN_COUNT=$(ls -d ~/.claude/plugins/*/ 2>/dev/null | wc -l)
  echo "  ✓ Found ($PLUGIN_COUNT plugins)"
  ls ~/.claude/plugins/ 2>/dev/null | head -5 | sed 's/^/    - /'
else
  echo "  ✗ Not found"
fi

echo -e "\n🔐 MCP Server Connection:"
if grep -q "mcp.m9m.dev" ~/.claude/settings.json 2>/dev/null; then
  echo "  ✓ Connected to mcp.m9m.dev"
  if grep -q "Bearer" ~/.claude/settings.json 2>/dev/null; then
    echo "  ✓ JWT token configured"
  else
    echo "  ⚠ No JWT token - run OAuth to authenticate"
  fi
else
  echo "  ✗ Not connected to MCP hub"
fi
```

## Step 4: Re-Authentication (if needed)

If the user needs to re-authenticate after restore:

```bash
echo "Starting OAuth device flow..."

# Get device code
RESPONSE=$(curl -s -X POST https://mcp.m9m.dev/oauth/device)
USER_CODE=$(echo $RESPONSE | jq -r '.user_code')
VERIFICATION_URI=$(echo $RESPONSE | jq -r '.verification_uri')

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  1. Go to: $VERIFICATION_URI"
echo "  2. Enter code: $USER_CODE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Waiting for authorization... (press Enter after you've authorized)"
read

# Poll for token
TOKEN_RESPONSE=$(curl -s -X POST https://mcp.m9m.dev/oauth/token \
  -H "Content-Type: application/json" \
  -d "{\"user_code\":\"$USER_CODE\"}")

if echo $TOKEN_RESPONSE | jq -e '.token' > /dev/null 2>&1; then
  TOKEN=$(echo $TOKEN_RESPONSE | jq -r '.token')

  # Update settings.json with new token
  jq --arg token "$TOKEN" '.mcpServers["mcp-server"].env.MCP_HEADERS = "Authorization: Bearer " + $token' \
    ~/.claude/settings.json > ~/.claude/settings.json.new
  mv ~/.claude/settings.json.new ~/.claude/settings.json

  echo "✓ Authentication successful! Token saved to settings.json"
else
  echo "✗ Authentication failed. Try again or check if you authorized the app."
  echo $TOKEN_RESPONSE | jq .
fi
```

## Output Summary

After completing the operation, provide a summary:

### Backup Summary:
```
✅ Backup Complete

📦 Saved to: ./claude-backup-20260120-103045/

Contents:
  ✓ settings.json (MCP connections)
  ✓ hooks/ (12 hooks)
  ✓ plugins/ (3 plugins)

Tokens: Stripped (you'll need to re-auth via OAuth on restore)

To restore on another machine:
  1. Copy this folder to the new machine
  2. Run: /sync-setup restore ./claude-backup-20260120-103045/
```

### Restore Summary:
```
✅ Restore Complete

Restored:
  ✓ settings.json → ~/.claude/settings.json
  ✓ 12 hooks → ~/.claude/hooks/
  ✓ 3 plugins → ~/.claude/plugins/

⚠️ Action needed: Re-authenticate to MCP server
  The backup didn't include tokens. Run OAuth:
  curl -X POST https://mcp.m9m.dev/oauth/device
```

### Status Summary:
```
📊 Claude Code Setup Status

Component          Status    Details
─────────────────────────────────────────
Settings           ✓         2 MCP servers configured
Hooks              ✓         12 hooks installed
Plugins            ✓         3 plugins (hookify, ralph-wiggum, speckit)
MCP Connection     ✓         mcp.m9m.dev with valid JWT

Everything looks good! Your setup is complete.
```

## Important Notes

- **Always ask before overwriting** - Use AskUser for confirmation
- **Handle missing directories gracefully** - Create them if needed
- **Validate backups before restore** - Check manifest.json
- **Offer OAuth re-auth** - Tokens may be expired or stripped
- **Show clear summaries** - User should know exactly what happened

Now analyze the user's request and execute the appropriate operation.
