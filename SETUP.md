# MCP Server Setup Guide

## Quick Start (New Machine)

Run the setup script to configure everything automatically:

```bash
# Set your API key
export MCP_API_KEY="your_api_key_here"

# Run setup
curl -fsSL https://raw.githubusercontent.com/ST0MP-EE5/mcp-server/main/scripts/setup-client.sh | bash
```

Or clone and run locally:

```bash
git clone https://github.com/ST0MP-EE5/mcp-server.git
cd mcp-server
MCP_API_KEY="your_key" ./scripts/setup-client.sh
```

---

## Hook Rules

Reusable hook rules are available in the `hooks/` directory. These rules work with the [Hookify plugin](./plugins/hookify/README.md) to warn or block certain actions.

### Available Rules

| Rule | Category | Description |
|------|----------|-------------|
| `dangerous-rm.local.md` | Safety | Warns before `rm -rf` commands |
| `no-secrets.local.md` | Safety | Warns when hardcoding secrets |
| `no-force-push.local.md` | Safety | Warns before `git push --force` |
| `no-console-log.local.md` | Quality | Warns when adding console.log |
| `no-todo-comments.local.md` | Quality | Warns when adding TODO comments |
| `require-tests.local.md` | Quality | Reminds to add tests when modifying code |

### Installing Rules

Copy desired rules to your project's `.claude/` directory with the `hookify.` prefix:

```bash
# Single rule
cp hooks/dangerous-rm.local.md .claude/hookify.dangerous-rm.local.md

# All rules
for f in hooks/*.local.md; do
  cp "$f" ".claude/hookify.$(basename $f)"
done
```

### Creating Custom Rules

Rules use this format:

```markdown
---
name: rule-name
enabled: true
event: bash|file|stop|prompt
conditions:
  - field: command|content|file_path
    operator: contains|regex_match|equals
    pattern: "pattern to match"
action: warn|block
---

Message shown when rule matches.
```

---

## What's Available Remotely vs Locally

| Resource | Location | Description |
|----------|----------|-------------|
| **MCP Tools** | Remote (DO server) | Core tools like `list_mcps`, `list_skills`, `get_skill` |
| **Skills** | Remote (DO server) | Markdown prompts served via API |
| **Configs** | Remote (DO server) | IDE configs (CLAUDE.md, AGENTS.md) |
| **External MCPs** | Remote (DO server) | Proxied MCPs (GitHub, Greptile, etc.) |
| **Plugins** | Local (each machine) | Claude Code extensions in `plugins/` |
| **Hook Rules** | Local (each machine) | Hookify rules copied to `.claude/` |

**Remote resources** are centralized on the MCP server - all clients connect to the same server and get the same tools/skills.

**Local resources** must be set up on each machine. The setup script handles plugins automatically; hook rules are opt-in per project.

---

## Manual Setup

### 1. Clone and Install

```bash
git clone https://github.com/your-repo/mcp-server.git
cd mcp-server
npm install
```

### 2. Configure Environment

Create `.env` file:

```bash
# Required for external MCPs
GITHUB_PERSONAL_ACCESS_TOKEN=ghp_your_token_here
GREPTILE_API_KEY=your_greptile_key_here

# Optional
LINEAR_API_KEY=your_linear_key_here
DO_API_TOKEN=dop_v1_your_do_token  # For DigitalOcean deployment

# Server API Key (generate with: openssl rand -hex 32)
MCP_SERVER_API_KEY=your_generated_api_key
```

### 3. Configure MCP Server

Edit `mcp-server.yaml`:

```yaml
version: "1.0"
name: "mcp-server"

auth:
  api_keys:
    - name: "main"
      # Generate hash: echo -n "your_key" | shasum -a 256
      key_hash: "sha256:your_key_hash_here"
      permissions: ["*"]

mcps:
  external:
    - name: "github"
      url: "https://api.githubcopilot.com/mcp/"
      auth:
        type: "bearer"
        token: "${GITHUB_PERSONAL_ACCESS_TOKEN}"
      enabled: true

    - name: "greptile"
      url: "https://api.greptile.com/mcp"
      auth:
        type: "bearer"
        token: "${GREPTILE_API_KEY}"
      enabled: true

  local: []

skills:
  - name: "code-simplifier"
    description: "Simplifies code for clarity"
    file: "./plugins/code-simplifier/agents/code-simplifier.md"
    tags: ["refactoring"]

configs:
  claude:
    file: "./configs/CLAUDE.md"
  codex:
    file: "./configs/AGENTS.md"
```

### 4. Build and Run

```bash
# Development
npm run dev

# Production
npm run build
npm start
```

### 5. Verify

```bash
# Health check
curl http://localhost:3000/health

# Full status
curl http://localhost:3000/mcp/health
```

---

## Authentication

### Option 1: GitHub OAuth (Recommended)

Authenticate with your GitHub account - no API keys to manage.

**Step 1: Start device flow**
```bash
curl -s -X POST https://mcp.m9m.dev/oauth/device | jq '.'
```

**Step 2: Authorize**
- Go to the `verification_uri` shown (https://github.com/login/device)
- Enter the `user_code` displayed

**Step 3: Get your token**
```bash
curl -s -X POST https://mcp.m9m.dev/oauth/token \
  -H "Content-Type: application/json" \
  -d '{"user_code":"YOUR-CODE"}' | jq '.'
```

Your token is valid for 30 days. Memories are scoped to your GitHub username.

### Option 2: API Key

Generate a key and add its hash to `mcp-server.yaml`:

```bash
# Generate key
openssl rand -hex 32

# Generate hash for config
echo -n "your_key" | shasum -a 256 | awk '{print "sha256:"$1}'
```

---

## Connecting Clients

### Claude Code

Add to `~/.claude/settings.json`:

```json
{
  "mcpServers": {
    "mcp-server": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "https://mcp.m9m.dev/mcp/sse"],
      "env": {
        "MCP_HEADERS": "Authorization: Bearer YOUR_TOKEN"
      }
    }
  }
}
```

Or use CLI:

```bash
claude mcp add -t sse \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -s user \
  mcp-server \
  https://mcp.m9m.dev/mcp/sse
```

### OpenAI Codex

Codex uses the `AGENTS.md` config file. Set up in your project:

**Step 1: Create `codex.json` in your project root**
```json
{
  "mcpServers": {
    "mcp-server": {
      "url": "https://mcp.m9m.dev/mcp/sse",
      "headers": {
        "Authorization": "Bearer YOUR_TOKEN"
      }
    }
  }
}
```

**Step 2: Create/update `AGENTS.md` in your project**
```bash
curl -s -H "Authorization: Bearer YOUR_TOKEN" \
  https://mcp.m9m.dev/api/v1/configs/codex > AGENTS.md
```

**Step 3: Run Codex with MCP**
```bash
codex --mcp-config codex.json
```

Codex will now have access to all MCP tools including memory.

### Other MCP Clients

Use REST API for non-MCP clients:

```bash
# List all resources
curl -H "Authorization: Bearer YOUR_TOKEN" \
  https://mcp.m9m.dev/api/v1/registry

# Get specific skill
curl -H "Authorization: Bearer YOUR_TOKEN" \
  https://mcp.m9m.dev/api/v1/skills/code-simplifier
```

---

## Deployment

### DigitalOcean App Platform (Recommended)

1. **Create App Spec** (`.do/app.yaml`):

```yaml
name: mcp-server
services:
  - name: web
    github:
      repo: your-username/mcp-server
      branch: main
    build_command: npm run build
    run_command: npm start
    envs:
      - key: GITHUB_PERSONAL_ACCESS_TOKEN
        scope: RUN_TIME
        type: SECRET
      - key: GREPTILE_API_KEY
        scope: RUN_TIME
        type: SECRET
      - key: MCP_SERVER_API_KEY
        scope: RUN_TIME
        type: SECRET
    http_port: 3000
    instance_size_slug: basic-xxs
    instance_count: 1
region: nyc
```

2. **Deploy**:

```bash
doctl apps create --spec .do/app.yaml
```

### Docker

```bash
docker build -t mcp-server .
docker run -d \
  --name mcp-server \
  -p 3000:3000 \
  -e GITHUB_PERSONAL_ACCESS_TOKEN=xxx \
  -e GREPTILE_API_KEY=xxx \
  -e MCP_SERVER_API_KEY=xxx \
  --restart unless-stopped \
  mcp-server
```

---

## API Reference

### Endpoints

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/health` | GET | No | Basic health check |
| `/mcp/health` | GET | No | Detailed health with MCP status |
| `/mcp/sse` | GET | Yes | SSE connection for MCP clients |
| `/mcp/messages` | POST | Yes | MCP message handler |
| `/oauth/info` | GET | No | OAuth configuration status |
| `/oauth/device` | POST | No | Start GitHub device flow |
| `/oauth/token` | POST | No | Exchange device code for token |
| `/api/v1/registry` | GET | Yes | Full resource registry |
| `/api/v1/skills/:name` | GET | Yes | Get skill content |
| `/api/v1/configs/:name` | GET | Yes | Get config content |

### MCP Tools

| Tool | Description |
|------|-------------|
| `mcp__list_mcps` | List all connected MCPs |
| `mcp__list_skills` | List available skills |
| `mcp__get_skill` | Get skill content |
| `mcp__list_configs` | List available configs |
| `mcp__get_config` | Get config content |
| `mcp__health` | Detailed health check |
| `mcp__mcp_status` | Status of specific MCP |

### Memory Tools (mem0)

Persistent memory that works across sessions and clients. Memories are scoped by your identity (GitHub username or API key name).

| Tool | Description |
|------|-------------|
| `mcp__memory_add` | Store memories from messages |
| `mcp__memory_search` | Semantic search over memories |
| `mcp__memory_list` | List all memories with pagination |
| `mcp__memory_delete` | Delete a specific memory |
| `mcp__memory_delete_all` | Delete all memories (scoped) |

**Example: Store a preference**
```
Use mcp__memory_add with messages: [{"role": "user", "content": "I prefer TypeScript"}]
```

**Example: Recall preferences**
```
Use mcp__memory_search with query: "programming language preferences"
```

Memories persist across:
- Different sessions
- Different projects
- Claude Code and Codex (same token = shared memories)

### External MCP Tools

External MCP tools are namespaced: `{mcp_name}__{tool_name}`

Example: `github__search_code`, `greptile__query`

---

## Troubleshooting

### Server Won't Start

```bash
# Check config syntax
cat mcp-server.yaml | python3 -c "import yaml,sys; yaml.safe_load(sys.stdin)" && echo "OK"

# Check for missing env vars
grep '\${' mcp-server.yaml | while read line; do
  var=$(echo "$line" | sed 's/.*\${\([^}]*\)}.*/\1/')
  [ -z "${!var}" ] && echo "Missing: $var"
done

# Start with debug logging
LOG_LEVEL=debug npm start
```

### MCP Connection Fails

```bash
# Test SSE endpoint
curl -N -H "Authorization: Bearer YOUR_KEY" \
  https://your-server.com/mcp/sse

# Should return:
# event: endpoint
# data: https://your-server.com/mcp/messages?clientId=xxx
```

### External MCP Not Working

```bash
# Check MCP status
curl -H "Authorization: Bearer YOUR_KEY" \
  https://your-server.com/mcp/health | jq '.mcps'

# Test specific MCP
curl -H "Authorization: Bearer YOUR_KEY" \
  https://your-server.com/api/v1/mcp/github/status
```

---

## Security

- **API Keys**: Store in environment variables, never commit
- **HTTPS**: Always use HTTPS in production
- **Rate Limiting**: Built-in rate limiting (100 connections max)
- **Token Rotation**: Support multiple active keys for zero-downtime rotation

Generate secure API key:

```bash
openssl rand -hex 32
```

Generate key hash for config:

```bash
echo -n "your_api_key" | shasum -a 256 | awk '{print "sha256:"$1}'
```
