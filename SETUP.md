# MCP Server Setup Guide

## Quick Start

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

## Connecting to MCP Server

### Claude Code

Add to `~/.claude/settings.json`:

```json
{
  "mcpServers": {
    "mcp-server": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "https://your-server.com/mcp/sse"],
      "env": {
        "MCP_HEADERS": "Authorization: Bearer YOUR_API_KEY"
      }
    }
  }
}
```

Or use CLI:

```bash
claude mcp add -t sse \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -s user \
  mcp-server \
  https://your-server.com/mcp/sse
```

### OpenAI Codex / Other Agents

Use REST API:

```bash
# List all resources
curl -H "Authorization: Bearer API_KEY" \
  https://your-server.com/api/v1/registry

# Get specific skill
curl -H "Authorization: Bearer API_KEY" \
  https://your-server.com/api/v1/skills/code-simplifier

# Get config
curl -H "Authorization: Bearer API_KEY" \
  https://your-server.com/api/v1/configs/codex
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
