# AI Infrastructure Hub (AIH)

A portable, self-hosted infrastructure layer that provides MCPs, skills, plugins, hooks, and configuration to any compatible AI system.

## Vision

Your AI tooling follows you everywhere — whether you're using Claude.ai, Claude Code, Cursor, Windsurf, GPT, or a local LLM. One source of truth, accessible from anywhere.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                     DigitalOcean Droplet                            │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │                    AI Hub Gateway (MCP)                       │  │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐              │  │
│  │  │  Registry   │ │   Router    │ │    Auth     │              │  │
│  │  │  Service    │ │   Service   │ │   Service   │              │  │
│  │  └─────────────┘ └─────────────┘ └─────────────┘              │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                              │                                      │
│  ┌───────────────────────────┼───────────────────────────────────┐  │
│  │                    Storage Layer                              │  │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐  │  │
│  │  │  MCPs   │ │ Skills  │ │ Plugins │ │  Hooks  │ │ Configs │  │  │
│  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘  │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                              │                                      │
│  ┌───────────────────────────┼───────────────────────────────────┐  │
│  │              External MCP Connections                         │  │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐              │  │
│  │  │ Stripe  │ │ Vercel  │ │ GitHub  │ │  Your   │              │  │
│  │  │   MCP   │ │   MCP   │ │   MCP   │ │  MCPs   │              │  │
│  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘              │  │
│  └───────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
                              │
         ┌────────────────────┼────────────────────┐
         │                    │                    │
         ▼                    ▼                    ▼
   ┌──────────┐        ┌──────────┐        ┌──────────┐
   │ Claude.ai│        │  Cursor  │        │ Local LLM│
   │          │        │ Windsurf │        │  Ollama  │
   └──────────┘        └──────────┘        └──────────┘
```

---

## Core Components

### 1. Registry Service
Maintains a catalog of all available resources:
- MCPs (local and external)
- Skills (instruction sets)
- Plugins (capability extensions)
- Hooks (event handlers)
- Configs (dotfiles, settings)

### 2. Router Service  
Routes requests to appropriate MCPs:
- Proxies tool calls to external MCPs
- Load balances across instances
- Handles failover

### 3. Auth Service
Secures access:
- API key authentication
- Per-resource permissions
- Rate limiting
- Audit logging

---

## Data Schema

### Master Configuration (`aih-config.yaml`)

```yaml
version: "1.0"
name: "my-ai-hub"  # Rename to your hub name

# Authentication
auth:
  api_keys:
    - name: "claude-ai"
      key_hash: "sha256:abc123..."  # hashed, never plain
      permissions: ["*"]
    - name: "cursor"
      key_hash: "sha256:def456..."
      permissions: ["mcps/*", "skills/*"]
  
  # Optional OAuth for web UI
  oauth:
    provider: "github"
    client_id: "${GITHUB_CLIENT_ID}"
    allowed_users: ["your-username"]  # Your GitHub username

# MCP Registry
mcps:
  # External MCPs (proxied through hub)
  external:
    - name: "stripe"
      url: "https://mcp.stripe.com"
      auth:
        type: "bearer"
        token: "${STRIPE_MCP_TOKEN}"
      enabled: true
      
    - name: "vercel"
      url: "https://mcp.vercel.com"
      auth:
        type: "oauth"
        token: "${VERCEL_TOKEN}"
      enabled: true

    # Add your own external MCPs here

  # Self-hosted MCPs (running on this server)
  # Add your local MCPs when implemented
  local: []

# Skills (Instruction Sets)
skills:
  - name: "code-review"
    description: "Thorough code review with security focus"
    file: "./skills/code-review.md"
    tags: ["development", "security"]

  # Add your own skills here

# Plugins (Extended Capabilities)
plugins:
  - name: "web-scraper"
    description: "Advanced web scraping with JS rendering"
    file: "./plugins/web-scraper.js"
    runtime: "node"
    
  - name: "pdf-processor"
    description: "Extract and analyze PDF content"
    file: "./plugins/pdf-processor.py"
    runtime: "python"

# Hooks (Event Handlers)
hooks:
  - name: "on-conversation-start"
    trigger: "conversation.start"
    action: "./hooks/inject-context.js"
    
  - name: "on-tool-error"
    trigger: "tool.error"
    action: "./hooks/notify-discord.js"

# IDE/Client Configurations
configs:
  claude:
    file: "./configs/.claude"
    
  claude_md:
    file: "./configs/CLAUDE.md"
    
  cursor:
    file: "./configs/.cursorrules"
    
  windsurf:
    file: "./configs/.windsurfrules"
    
  continue:
    file: "./configs/config.json"

# Secrets (references to env vars or vault)
secrets:
  provider: "env"  # or "vault", "doppler", etc.
  mappings:
    STRIPE_MCP_TOKEN: "${STRIPE_MCP_TOKEN}"
    VERCEL_TOKEN: "${VERCEL_TOKEN}"
    OPENAI_API_KEY: "${OPENAI_API_KEY}"
```

---

## API Endpoints

### Registry API

```
GET  /api/v1/registry              # Full registry
GET  /api/v1/registry/mcps         # List MCPs
GET  /api/v1/registry/skills       # List skills
GET  /api/v1/registry/plugins      # List plugins
GET  /api/v1/registry/configs      # List configs
```

### Resource API

```
GET  /api/v1/skills/:name          # Get skill content
GET  /api/v1/configs/:name         # Get config content
POST /api/v1/hooks/:name/trigger   # Manually trigger hook
```

### MCP Gateway (SSE)

```
GET  /mcp/sse                      # Main MCP SSE endpoint
POST /mcp/messages                 # MCP message handler

# Direct MCP access (proxied)
GET  /mcp/:name/sse                # Specific MCP SSE
POST /mcp/:name/messages           # Specific MCP messages
```

### Management API

```
POST /api/v1/sync                  # Sync from git
POST /api/v1/reload                # Hot reload config
GET  /api/v1/health                # Health check
GET  /api/v1/logs                  # Recent logs
```

---

## MCP Gateway Protocol

The hub exposes a unified MCP interface that aggregates all registered MCPs.

### Tool Discovery

When a client connects, the gateway returns all available tools:

```json
{
  "tools": [
    {
      "name": "stripe__create_payment_link",
      "description": "Create a Stripe payment link",
      "inputSchema": { ... },
      "source": "stripe"
    },
    {
      "name": "example_mcp__example_tool",
      "description": "Example tool from your custom MCP",
      "inputSchema": { ... },
      "source": "example-mcp"
    },
    {
      "name": "aih__get_skill",
      "description": "Retrieve a skill definition",
      "inputSchema": {
        "type": "object",
        "properties": {
          "name": { "type": "string" }
        }
      },
      "source": "hub"
    }
  ]
}
```

### Tool Routing

Tools are namespaced: `{mcp_name}__{tool_name}`

When a tool is called:
1. Gateway parses the namespace
2. Routes to appropriate MCP
3. Injects auth if needed
4. Returns result

---

## Client Integration

### Claude.ai / Claude Code

Add to your MCP settings:

```json
{
  "mcpServers": {
    "ai-hub": {
      "url": "https://aih.yourdomain.com/mcp/sse",
      "headers": {
        "Authorization": "Bearer YOUR_API_KEY"
      }
    }
  }
}
```

### Cursor / Windsurf

```json
{
  "mcp": {
    "servers": {
      "ai-hub": {
        "command": "npx",
        "args": ["-y", "@anthropic/mcp-remote", "https://aih.yourdomain.com/mcp/sse"],
        "env": {
          "MCP_AUTH_TOKEN": "YOUR_API_KEY"
        }
      }
    }
  }
}
```

### Programmatic Access

```javascript
// Fetch your skills
const skills = await fetch('https://aih.yourdomain.com/api/v1/skills', {
  headers: { 'Authorization': 'Bearer YOUR_API_KEY' }
}).then(r => r.json());

// Get a specific config
const claudeMd = await fetch('https://aih.yourdomain.com/api/v1/configs/claude_md', {
  headers: { 'Authorization': 'Bearer YOUR_API_KEY' }
}).then(r => r.text());
```

---

## Built-in Hub Tools

The hub itself exposes these tools:

| Tool | Description |
|------|-------------|
| `aih__list_mcps` | List all available MCPs |
| `aih__list_skills` | List all skills |
| `aih__get_skill` | Get skill content by name |
| `aih__list_configs` | List available configs |
| `aih__get_config` | Get config content |
| `aih__trigger_hook` | Manually trigger a hook |
| `aih__health` | Check hub health |

---

## Directory Structure

```
ai-hub/
├── aih-config.yaml          # Master configuration
├── .env                     # Secrets (gitignored)
├── server/                  # Hub server code
│   ├── index.ts
│   ├── registry.ts
│   ├── router.ts
│   ├── auth.ts
│   └── mcp-gateway.ts
├── mcps/                    # Self-hosted MCPs (add your own)
│   └── your-mcp/
│       ├── index.ts
│       └── package.json
├── skills/                  # Skill definitions
│   ├── code-review.md
│   └── your-skills.md
├── plugins/                 # Plugin scripts
│   ├── web-scraper.js
│   └── pdf-processor.py
├── hooks/                   # Event handlers
│   ├── inject-context.js
│   └── notify-discord.js
├── configs/                 # IDE configurations
│   ├── .claude
│   ├── CLAUDE.md
│   ├── .cursorrules
│   └── .windsurfrules
└── docker-compose.yaml      # Deployment
```

---

## Deployment

### Docker Compose

```yaml
version: '3.8'

services:
  ai-hub:
    build: .
    ports:
      - "443:443"
    environment:
      - NODE_ENV=production
      - STRIPE_MCP_TOKEN=${STRIPE_MCP_TOKEN}
      - VERCEL_TOKEN=${VERCEL_TOKEN}
    volumes:
      - ./data:/app/data
      - ./skills:/app/skills:ro
      - ./configs:/app/configs:ro
    restart: unless-stopped
    
  # Optional: Redis for caching
  redis:
    image: redis:alpine
    restart: unless-stopped
```

### DigitalOcean App Platform

```yaml
# .do/app.yaml
name: ai-hub
services:
  - name: api
    github:
      repo: your-username/ai-hub  # Your GitHub repo
      branch: main
    run_command: npm start
    envs:
      - key: STRIPE_MCP_TOKEN
        scope: RUN_TIME
        type: SECRET
```

---

## Security Considerations

1. **API Keys**: Always hashed, never stored plain
2. **Secrets**: Use environment variables or a secrets manager
3. **TLS**: Always HTTPS in production
4. **Rate Limiting**: Prevent abuse
5. **Audit Logs**: Track all access
6. **IP Allowlisting**: Optional additional security

---

## Roadmap

### Phase 1: Core (MVP)
- [ ] Basic MCP gateway
- [ ] Skill serving
- [ ] Config serving
- [ ] API key auth

### Phase 2: Enhanced
- [ ] MCP proxying with auth injection
- [ ] Hot reload
- [ ] Web management UI
- [ ] Git sync

### Phase 3: Advanced
- [ ] Multi-user support
- [ ] Plugin runtime
- [ ] Hook system
- [ ] Analytics dashboard

---

## CLI Tool (Future)

```bash
# Initialize new hub
aih init

# Add resources
aih add mcp stripe https://mcp.stripe.com
aih add skill code-review ./skills/code-review.md

# Sync to server
aih push

# Pull latest
aih pull

# Generate client configs
aih export cursor > .cursorrules
aih export claude > CLAUDE.md
```
