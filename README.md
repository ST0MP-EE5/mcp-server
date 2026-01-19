# AI Infrastructure Hub (AIH) - Template

A portable, self-hosted infrastructure layer that provides MCPs, skills, plugins, hooks, and configuration to any compatible AI system.

**Fork this template to create your own AI Hub** - your AI tooling follows you everywhere, whether you're using Claude.ai, Claude Code, Cursor, Windsurf, GPT, or a local LLM.

## Getting Started

1. Fork or clone this repository
2. Customize `aih-config.yaml` with your hub name, MCPs, and skills
3. Add your own skills in `skills/`
4. Generate API keys and deploy

## Features

- **MCP Gateway** - Aggregate all your MCPs behind a single endpoint
- **Skills Registry** - Store and serve reusable instruction sets
- **Config Sync** - Serve `.claude`, `.cursorrules`, etc. to any client
- **Auth & Permissions** - API key authentication with granular permissions
- **Hot Reload** - Update config without restarting
- **Audit Logging** - Track all access

## Quick Start

### 1. Clone and Setup

```bash
git clone https://github.com/yourusername/ai-hub.git
cd ai-hub
npm install
cp .env.example .env
```

### 2. Generate an API Key

```bash
node scripts/generate-key.js claude-ai
```

Copy the output to your `aih-config.yaml`.

### 3. Configure

Edit `aih-config.yaml` with your MCPs, skills, and settings.

### 4. Run

```bash
# Development
npm run dev

# Production
npm run build
npm start

# Docker
docker-compose up -d
```

## Connecting Clients

### Claude.ai / Claude Code

Add this MCP server in your settings:

```json
{
  "mcpServers": {
    "ai-hub": {
      "url": "https://your-hub.domain.com/mcp/sse",
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
        "args": ["-y", "@anthropic/mcp-remote", "https://your-hub.domain.com/mcp/sse"],
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
const skills = await fetch('https://your-hub.domain.com/api/v1/skills', {
  headers: { 'Authorization': 'Bearer YOUR_API_KEY' }
}).then(r => r.json());

// Get a specific config
const claudeMd = await fetch('https://your-hub.domain.com/api/v1/configs/claude_md', {
  headers: { 'Authorization': 'Bearer YOUR_API_KEY' }
}).then(r => r.text());
```

## Built-in Tools

When connected via MCP, these tools are available:

| Tool | Description |
|------|-------------|
| `aih__list_mcps` | List all available MCPs |
| `aih__list_skills` | List all skills |
| `aih__get_skill` | Get skill content by name |
| `aih__list_configs` | List available configs |
| `aih__get_config` | Get config content |
| `aih__health` | Check hub health |

## API Endpoints

```
GET  /health                    # Health check (public)
GET  /api/v1/registry           # Full registry
GET  /api/v1/registry/mcps      # List MCPs
GET  /api/v1/registry/skills    # List skills
GET  /api/v1/skills/:name       # Get skill content
GET  /api/v1/registry/configs   # List configs
GET  /api/v1/configs/:name      # Get config content
POST /api/v1/reload             # Hot reload config
GET  /mcp/sse                   # MCP SSE endpoint
POST /mcp/messages              # MCP message handler
```

## Deployment

### DigitalOcean App Platform

1. Push to GitHub
2. Create new App in DO
3. Connect repo
4. Add environment variables
5. Deploy

### DigitalOcean Droplet

```bash
# On your droplet
git clone https://github.com/yourusername/ai-hub.git
cd ai-hub
cp .env.example .env
# Edit .env with your values
docker-compose up -d
```

### With SSL (Recommended)

Use Caddy or nginx-proxy with Let's Encrypt for automatic SSL.

## Directory Structure

```
ai-hub/
├── aih-config.yaml      # Master configuration
├── .env                 # Secrets (gitignored)
├── src/                 # Server source code
├── skills/              # Skill definitions
├── configs/             # IDE configurations
├── plugins/             # Plugin scripts
├── hooks/               # Event handlers
└── docker-compose.yaml  # Deployment config
```

## Security

- API keys are hashed (SHA-256) before storage
- Use HTTPS in production
- Set `ALLOWED_ORIGINS` for CORS
- Use granular permissions per API key
- Never commit `.env` file

## Roadmap

- [ ] Web management UI
- [ ] Git sync for skills/configs
- [ ] Plugin runtime (sandboxed execution)
- [ ] Hook system with cron support
- [ ] Multi-user support
- [ ] Analytics dashboard

## License

MIT
