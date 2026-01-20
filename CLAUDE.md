# AI Hub - Claude Code Reference

## Design Philosophy

This system is **AI-native**: all interfaces output machine-readable JSON, no human UI exists. All management is via CLI or API.

## Available Slash Commands

### Development & Planning

| Command | Description |
|---------|-------------|
| `/codex-plan <task>` | Create detailed implementation plan using Codex 5.2 with xhigh reasoning |
| `/sync-setup <action>` | Backup, restore, or transfer Claude Code setup (hooks, plugins, settings) |

### UI & React Development

| Command | Description |
|---------|-------------|
| `/ui-skills [file]` | Apply opinionated UI constraints (Tailwind, accessibility, animation, typography) |
| `/rams [file]` | Run accessibility (WCAG 2.1) and visual design review |
| `/vercel-labs:react-best-practices [file]` | Apply Vercel's 45 React/Next.js performance rules |
| `/vercel-labs:web-design-guidelines [file]` | Review against web interface design standards |
| `/vercel-labs:claude.ai:vercel-deploy-claimable` | Deploy to Vercel with claimable preview URL |

### Spec Kit (Feature Development)

| Command | Description |
|---------|-------------|
| `/speckit.constitution` | Create/update project constitution |
| `/speckit.specify` | Create feature specification from description |
| `/speckit.clarify` | Identify underspecified areas and ask clarification questions |
| `/speckit.plan` | Generate implementation plan |
| `/speckit.tasks` | Generate dependency-ordered tasks |
| `/speckit.implement` | Execute the implementation plan |
| `/speckit.analyze` | Cross-artifact consistency analysis |
| `/speckit.checklist` | Generate custom checklist for feature |
| `/speckit.taskstoissues` | Convert tasks to GitHub issues |

## CLI Reference

All commands output JSON to stdout. Exit code 0 = success, 1 = error.

```bash
# All commands follow this pattern:
mcp <command> [subcommand] [args] [--flags]

# Output is always JSON:
# { "ok": true, ... } or { "ok": false, "error": { "code": "...", "message": "..." } }
```

### Core Commands

| Command | Description | Example |
|---------|-------------|---------|
| `mcp init [name]` | Initialize hub | `mcp init my-hub` |
| `mcp status` | Full system status | `mcp status \| jq .server.status` |
| `mcp backup` | Export all state | `mcp backup` |
| `mcp restore <path>` | Restore from backup | `mcp restore ./backups/backup-123.json` |

### Key Management

| Command | Description |
|---------|-------------|
| `mcp key generate <n> [perms]` | Generate API key |
| `mcp key list` | List keys (hashes only) |
| `mcp key revoke <n>` | Revoke key |

### MCP Management

| Command | Description |
|---------|-------------|
| `mcp remote list` | List all MCPs |
| `mcp remote add <n> <url> [--token=X]` | Add external MCP |
| `mcp remote test <n>` | Test connectivity |
| `mcp remote enable <n>` | Enable MCP |
| `mcp remote disable <n>` | Disable MCP |
| `mcp remote remove <n>` | Remove MCP |

### Skill Management

| Command | Description |
|---------|-------------|
| `mcp skill list` | List skills |
| `mcp skill add <n> [desc] [--tags=X]` | Add skill |
| `mcp skill get <n>` | Get skill content |
| `mcp skill update <n> <content>` | Update skill |
| `mcp skill remove <n>` | Remove skill |

### Config Management

| Command | Description |
|---------|-------------|
| `mcp config list` | List configs |
| `mcp config get <n>` | Get config content |
| `mcp config set <n> <content>` | Set config |

### Server Management

| Command | Description |
|---------|-------------|
| `mcp server start [--daemon]` | Start server |
| `mcp server stop` | Stop daemon |
| `mcp server logs [--lines=N]` | View logs (JSON lines) |

### Deployment (DigitalOcean)

| Command | Description |
|---------|-------------|
| `mcp deploy doctl-check` | Check if doctl is installed/authenticated |
| `mcp deploy app-spec --repo=X` | Generate App Platform spec (.do/app.yaml) |
| `mcp deploy app-create` | Create app via doctl |
| `mcp deploy app-list` | List your DO apps |
| `mcp deploy app-status <id>` | Get app deployment status |
| `mcp deploy droplet-script --repo=X` | Generate droplet setup script |

## Natural Language Mappings

When user says → Execute command:

| User Says | Command |
|-----------|---------|
| "initialize" / "set up" / "create hub" | `mcp init` |
| "what's the status" / "health check" | `mcp status` |
| "add stripe mcp" | `mcp remote add stripe https://mcp.stripe.com --token=ASK` |
| "add a debugging skill" | `mcp skill add debugging "Systematic debugging"` |
| "generate api key for cursor" | `mcp key generate cursor` |
| "test the github connection" | `mcp remote test github` |
| "disable notion" | `mcp remote disable notion` |
| "show me all skills" | `mcp skill list` |
| "what skills do i have for writing" | `mcp skill list \| jq '.skills[] \| select(.tags[] == "writing")'` |
| "start the server" | `mcp server start --daemon` |
| "show recent logs" | `mcp server logs --lines=100` |
| "back everything up" | `mcp backup` |
| "deploy to digitalocean" | `mcp deploy app-spec --repo=X` then `mcp deploy app-create` |
| "deploy to droplet" | `mcp deploy droplet-script --repo=X` |
| "check doctl" | `mcp deploy doctl-check` |
| "what's the app status" | `mcp deploy app-list` |

## Deployment (Self-Hosted)

### DigitalOcean App Platform (Recommended)

Full workflow via CLI:

```bash
# 1. Check doctl is ready
mcp deploy doctl-check

# 2. Generate app spec (creates .do/app.yaml)
mcp deploy app-spec --repo=username/ai-hub --region=nyc

# 3. Commit and push to GitHub
git add .do/app.yaml
git commit -m "Add DO app spec"
git push

# 4. Create the app
mcp deploy app-create

# 5. Monitor deployment
mcp deploy app-status <app-id>
```

Flags for `app-spec`:
- `--repo=owner/name` (required) - GitHub repo
- `--region=nyc|sfo|ams|sgp` (default: nyc)
- `--branch=main` (default: main)
- `--size=basic-xxs|basic-xs|basic-s` (default: basic-xxs, ~$5/mo)

### DigitalOcean Droplet

```bash
# 1. Generate setup script
mcp deploy droplet-script --repo=https://github.com/you/ai-hub.git

# 2. Copy to droplet
scp scripts/setup-droplet.sh root@<ip>:/tmp/
scp .env root@<ip>:/opt/ai-hub/.env

# 3. Run setup (installs Node, clones, creates systemd service)
ssh root@<ip> 'bash /tmp/setup-droplet.sh'
```

Flags for `droplet-script`:
- `--repo=url` (required) - Git clone URL
- `--port=3000` (default)
- `--user=mcp` (default) - Linux user to run as
- `--dir=/opt/ai-hub` (default) - Install directory

### Option 3: Systemd Service (Manual)

```bash
# Create service file
cat > /etc/systemd/system/ai-hub.service << 'EOF'
[Unit]
Description=AI Infrastructure Hub
After=network.target

[Service]
Type=simple
User=mcp
WorkingDirectory=/opt/ai-hub
ExecStart=/usr/bin/node dist/index.js
Restart=always
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF

# Enable and start
systemctl enable ai-hub
systemctl start ai-hub
```

### Option 2: Docker

```bash
docker build -t ai-hub .
docker run -d \
  --name ai-hub \
  -p 3000:3000 \
  -v $(pwd)/mcp-config.yaml:/app/mcp-config.yaml:ro \
  -v $(pwd)/skills:/app/skills:ro \
  -v $(pwd)/.env:/app/.env:ro \
  --restart unless-stopped \
  ai-hub
```

### Option 3: Docker Compose

```bash
docker-compose up -d
```

## File Structure

```
/opt/ai-hub/              # Or wherever installed
├── mcp-config.yaml       # Main config (YAML)
├── .env                  # Secrets (KEY=value)
├── dist/                 # Compiled JS
├── skills/               # Skill markdown files
│   └── *.md
├── configs/              # IDE configs
│   └── .cursorrules, CLAUDE.md, etc.
├── logs/                 # Log files (JSON lines)
│   ├── combined.log
│   └── error.log
├── backups/              # Backup JSON files
└── mcp.pid               # PID file when daemonized
```

## Config Format (mcp-config.yaml)

```yaml
version: "1.0"
name: "hub-name"

auth:
  api_keys:
    - name: "key-name"
      key_hash: "sha256:..."
      permissions: ["*"]  # or ["skills/*", "mcps/stripe"]

mcps:
  external:
    - name: "stripe"
      url: "https://mcp.stripe.com"
      auth:
        type: "bearer"
        token: "${STRIPE_TOKEN}"  # References .env
      enabled: true
  local: []

skills:
  - name: "code-review"
    description: "Code review guidelines"
    file: "./skills/code-review.md"
    tags: ["dev"]

configs:
  cursor:
    file: "./configs/.cursorrules"
```

## API Endpoints

All return JSON.

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/health` | GET | No | Basic health |
| `/mcp/health` | GET | No | Detailed health + MCP status |
| `/mcp/metrics` | GET | No | Prometheus metrics |
| `/mcp/sse` | GET | Yes | SSE connection |
| `/mcp/messages` | POST | Yes | MCP messages |
| `/api/v1/registry` | GET | Yes | Full registry |
| `/api/v1/skills/:name` | GET | Yes | Skill content |
| `/api/v1/configs/:name` | GET | Yes | Config content |

## Error Codes

| Code | Meaning |
|------|---------|
| `AUTH_REQUIRED` | Missing authorization header |
| `INVALID_KEY` | API key not found |
| `TOO_MANY_CONNECTIONS` | Rate limit hit |
| `MCP_NOT_FOUND` | Referenced MCP doesn't exist |
| `SKILL_NOT_FOUND` | Referenced skill doesn't exist |
| `CONFIG_NOT_FOUND` | Referenced config doesn't exist |
| `CIRCUIT_BREAKER_OPEN` | MCP temporarily disabled due to failures |
| `TIMEOUT` | Operation timed out |

## Monitoring

```bash
# Quick health check
curl -s localhost:3000/health | jq .status

# Full status
mcp status | jq .

# Watch connections
watch -n5 'curl -s localhost:3000/mcp/health | jq .connections'

# Prometheus scrape
curl localhost:3000/mcp/metrics

# Log streaming
tail -f logs/combined.log | jq .
```

## Troubleshooting

```bash
# Server won't start
mcp status                          # Check if already running
cat logs/error.log | tail -20       # Check errors
LOG_LEVEL=debug mcp server start    # Verbose mode

# MCP not working
mcp remote test <n>                 # Test connection
mcp status | jq '.mcps.<n>'     # Check circuit breaker

# Out of connections
mcp status | jq .connections        # Check limits
# Clients should reconnect; if stuck, restart

# Config issues
cat mcp-config.yaml | python3 -c "import yaml,sys; yaml.safe_load(sys.stdin)" && echo "valid"
```

## DigitalOcean MCP Tools

The DigitalOcean MCP provides tools for managing DO infrastructure.

### Natural Language Mappings

| User Says | Tool |
|-----------|------|
| "list my droplets" | `digitalocean__do__list_droplets` |
| "create a droplet" | `digitalocean__do__create_droplet` |
| "delete droplet 123" | `digitalocean__do__delete_droplet` |
| "show my apps" | `digitalocean__do__list_apps` |
| "deploy an app" | `digitalocean__do__create_app` |
| "list databases" | `digitalocean__do__list_databases` |
| "check my balance" | `digitalocean__do__get_balance` |
| "list DNS records for example.com" | `digitalocean__do__list_records` |
| "what regions are available" | `digitalocean__do__list_regions` |
| "what droplet sizes can I use" | `digitalocean__do__list_sizes` |

### Tool Categories

**Droplets (VMs):**
- `digitalocean__do__list_droplets` - List all droplets
- `digitalocean__do__get_droplet` - Get droplet details
- `digitalocean__do__create_droplet` - Create droplet
- `digitalocean__do__delete_droplet` - Delete droplet (destructive)
- `digitalocean__do__reboot_droplet` - Reboot droplet
- `digitalocean__do__power_droplet` - Power on/off/cycle
- `digitalocean__do__resize_droplet` - Resize droplet
- `digitalocean__do__list_regions` - List regions
- `digitalocean__do__list_sizes` - List sizes
- `digitalocean__do__list_images` - List OS images

**App Platform:**
- `digitalocean__do__list_apps` - List apps
- `digitalocean__do__get_app` - Get app details
- `digitalocean__do__create_app` - Create app
- `digitalocean__do__delete_app` - Delete app (destructive)
- `digitalocean__do__get_app_logs` - View logs
- `digitalocean__do__restart_app` - Restart app

**Databases:**
- `digitalocean__do__list_databases` - List databases
- `digitalocean__do__get_database` - Get DB details
- `digitalocean__do__create_database` - Create database
- `digitalocean__do__delete_database` - Delete database (destructive)

**Domains & DNS:**
- `digitalocean__do__list_domains` - List domains
- `digitalocean__do__list_records` - List DNS records
- `digitalocean__do__create_record` - Create DNS record
- `digitalocean__do__delete_record` - Delete record (destructive)

**Account:**
- `digitalocean__do__get_account` - Account info
- `digitalocean__do__get_balance` - Billing balance

### Setup

Add to `.env`:
```
DO_API_TOKEN=dop_v1_your_token_here
```

Build the MCP:
```bash
cd mcps/digitalocean && npm install && npm run build
```
