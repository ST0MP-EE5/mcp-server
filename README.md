# MCP Server

A self-hosted **Model Context Protocol (MCP)** server with persistent memory, OAuth authentication, and external MCP proxying. Deploy your own MCP server for Claude Code, Codex, and other AI coding assistants.

**Live Server**: `https://mcp.m9m.dev`

## Features

- **GitHub OAuth** - Authenticate with GitHub Device Flow (no redirect URLs needed)
- **Persistent Memory** - Cross-session memory powered by mem0 (26% accuracy improvement)
- **External MCP Proxy** - GitHub, Greptile, Linear, Context7 tools
- **Plugin System** - Hookify for behavior rules, Ralph Loop for iterative development
- **Skills Registry** - Reusable instruction sets for AI assistants
- **SSE Protocol** - Real-time MCP communication

## Quick Start

### For Users (Connect to Existing Server)

```bash
# Authenticate with GitHub
curl -s -X POST https://mcp.m9m.dev/oauth/device | jq '.'
# Go to the URL shown, enter the code
curl -s -X POST https://mcp.m9m.dev/oauth/token \
  -H "Content-Type: application/json" \
  -d '{"user_code":"YOUR-CODE"}' | jq '.access_token'
```

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

### For Developers (Self-Host)

```bash
git clone https://github.com/ST0MP-EE5/mcp-server.git
cd mcp-server
npm install
cp .env.example .env  # Configure your secrets
npm run dev
```

See [SETUP.md](./SETUP.md) for detailed setup instructions.

## Project Structure

```
mcp-server/
├── mcp-server.yaml      # Main configuration
├── .env                 # Environment secrets
├── src/                 # TypeScript source
│   ├── index.ts         # Server entry point
│   ├── mcp-gateway.ts   # MCP protocol + memory tools
│   ├── memory/          # mem0 integration
│   └── oauth/           # GitHub OAuth
├── plugins/             # Claude Code plugins
│   ├── hookify/         # Behavior rules engine
│   ├── ralph-loop/      # Iterative AI loops
│   ├── code-simplifier/ # Code simplification skill
│   └── external/        # External MCP templates
│       ├── github/
│       ├── greptile/
│       ├── linear/
│       └── context7/
├── hooks/               # Reusable hookify rules
├── configs/             # IDE configs (CLAUDE.md, AGENTS.md)
└── specs/               # Feature specifications
```

## Available Tools

### Hub Tools (Built-in)

| Tool | Description |
|------|-------------|
| `mcp__mcp-server__mcp__list_mcps` | List all connected MCPs |
| `mcp__mcp-server__mcp__list_skills` | List available skills |
| `mcp__mcp-server__mcp__get_skill` | Get skill content |
| `mcp__mcp-server__mcp__health` | Server health check |

### Memory Tools (mem0)

| Tool | Description |
|------|-------------|
| `mcp__memory_add` | Store memories from messages |
| `mcp__memory_search` | Semantic search over memories |
| `mcp__memory_list` | List all memories with pagination |
| `mcp__memory_delete` | Delete specific memory |
| `mcp__memory_delete_all` | Delete all memories (scoped to user) |

### External MCPs

| MCP | Tools Available |
|-----|-----------------|
| **GitHub** | Repository management, issues, PRs, code search |
| **Greptile** | AI-powered codebase search and understanding |
| **Linear** | Project management, issues, cycles |
| **Context7** | Context management |

## Authentication

### GitHub OAuth (Recommended)

```bash
# 1. Start device flow
curl -s -X POST https://mcp.m9m.dev/oauth/device

# 2. Go to https://github.com/login/device and enter the code

# 3. Get your token
curl -s -X POST https://mcp.m9m.dev/oauth/token \
  -H "Content-Type: application/json" \
  -d '{"user_code":"YOUR-CODE"}'
```

Tokens are valid for 30 days. Memories are scoped to your GitHub username.

### API Key (Legacy)

Generate a key and add its hash to `mcp-server.yaml`:
```bash
openssl rand -hex 32
echo -n "your_key" | shasum -a 256 | awk '{print "sha256:"$1}'
```

## Configuration

### mcp-server.yaml

```yaml
version: "1.0"
name: "mcp-server"

auth:
  oauth:
    enabled: true
    provider: "github"
    client_id: "${GITHUB_CLIENT_ID}"
    jwt_secret: "${JWT_SECRET}"
    token_expiry: "30d"

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

    - name: "linear"
      url: "https://mcp.linear.app/mcp"
      auth:
        type: "none"
      enabled: true

  local:
    - name: "context7"
      command: "npx"
      args: ["-y", "@upstash/context7-mcp"]
      enabled: true

memory:
  enabled: true
  provider: "cloud"
  cloud:
    apiKey: "${MEM0_API_KEY}"

plugins:
  - name: "hookify"
    path: "./plugins/hookify"
    enabled: true

  - name: "ralph-loop"
    path: "./plugins/ralph-loop"
    enabled: true

skills:
  - name: "code-simplifier"
    file: "./plugins/code-simplifier/agents/code-simplifier.md"
    tags: ["refactoring", "code-quality"]
```

### Required Environment Variables

```bash
# OAuth
GITHUB_CLIENT_ID=your_github_oauth_app_client_id
JWT_SECRET=your_jwt_secret_for_signing_tokens

# External MCPs
GITHUB_PERSONAL_ACCESS_TOKEN=ghp_your_token
GREPTILE_API_KEY=your_greptile_key

# Memory
MEM0_API_KEY=your_mem0_api_key
```

## Plugins

### Hookify

Create rules to prevent unwanted behaviors:
- Warn before dangerous commands (`rm -rf`)
- Block hardcoded secrets
- Enforce code quality standards

See [hooks/](./hooks/) for available rules.

### Ralph Loop (Ralph Wiggum)

Run Claude in a continuous loop for iterative development tasks.

## API Endpoints

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/health` | GET | No | Basic health check |
| `/mcp/health` | GET | No | Detailed health with MCP status |
| `/mcp/sse` | GET | Yes | SSE connection for MCP clients |
| `/mcp/messages` | POST | Yes | MCP message handler |
| `/oauth/device` | POST | No | Start GitHub device flow |
| `/oauth/token` | POST | No | Exchange code for token |
| `/api/v1/registry` | GET | Yes | Full resource registry |
| `/api/v1/skills/:name` | GET | Yes | Get skill content |

## Deployment

### DigitalOcean App Platform (Recommended)

```bash
doctl apps create --spec .do/app.yaml
```

See [SETUP.md](./SETUP.md) for detailed deployment instructions.

### Docker

```bash
docker build -t mcp-server .
docker run -d -p 3000:3000 --env-file .env mcp-server
```

## Development

```bash
npm run dev      # Development with hot-reload
npm run build    # Build TypeScript
npm start        # Production
npm run lint     # ESLint
npm test         # Run tests
```

## Client Setup

### Claude Code

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

### OpenAI Codex

Create `codex.json` in your project:
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

Run: `codex --mcp-config codex.json`

## License

MIT
