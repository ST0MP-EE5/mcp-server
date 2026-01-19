# AI Hub - Claude Code Reference

## Design Philosophy

This system is **AI-native**: all interfaces output machine-readable JSON, no human UI exists. All management is via CLI or API.

## CLI Reference

All commands output JSON to stdout. Exit code 0 = success, 1 = error.

```bash
# All commands follow this pattern:
aih <command> [subcommand] [args] [--flags]

# Output is always JSON:
# { "ok": true, ... } or { "ok": false, "error": { "code": "...", "message": "..." } }
```

### Core Commands

| Command | Description | Example |
|---------|-------------|---------|
| `aih init [name]` | Initialize hub | `aih init my-hub` |
| `aih status` | Full system status | `aih status \| jq .server.status` |
| `aih backup` | Export all state | `aih backup` |
| `aih restore <path>` | Restore from backup | `aih restore ./backups/backup-123.json` |

### Key Management

| Command | Description |
|---------|-------------|
| `aih key generate <n> [perms]` | Generate API key |
| `aih key list` | List keys (hashes only) |
| `aih key revoke <n>` | Revoke key |

### MCP Management

| Command | Description |
|---------|-------------|
| `aih mcp list` | List all MCPs |
| `aih mcp add <n> <url> [--token=X]` | Add external MCP |
| `aih mcp test <n>` | Test connectivity |
| `aih mcp enable <n>` | Enable MCP |
| `aih mcp disable <n>` | Disable MCP |
| `aih mcp remove <n>` | Remove MCP |

### Skill Management

| Command | Description |
|---------|-------------|
| `aih skill list` | List skills |
| `aih skill add <n> [desc] [--tags=X]` | Add skill |
| `aih skill get <n>` | Get skill content |
| `aih skill update <n> <content>` | Update skill |
| `aih skill remove <n>` | Remove skill |

### Config Management

| Command | Description |
|---------|-------------|
| `aih config list` | List configs |
| `aih config get <n>` | Get config content |
| `aih config set <n> <content>` | Set config |

### Server Management

| Command | Description |
|---------|-------------|
| `aih server start [--daemon]` | Start server |
| `aih server stop` | Stop daemon |
| `aih server logs [--lines=N]` | View logs (JSON lines) |

### Deployment (DigitalOcean)

| Command | Description |
|---------|-------------|
| `aih deploy doctl-check` | Check if doctl is installed/authenticated |
| `aih deploy app-spec --repo=X` | Generate App Platform spec (.do/app.yaml) |
| `aih deploy app-create` | Create app via doctl |
| `aih deploy app-list` | List your DO apps |
| `aih deploy app-status <id>` | Get app deployment status |
| `aih deploy droplet-script --repo=X` | Generate droplet setup script |

## Natural Language Mappings

When user says → Execute command:

| User Says | Command |
|-----------|---------|
| "initialize" / "set up" / "create hub" | `aih init` |
| "what's the status" / "health check" | `aih status` |
| "add stripe mcp" | `aih mcp add stripe https://mcp.stripe.com --token=ASK` |
| "add a debugging skill" | `aih skill add debugging "Systematic debugging"` |
| "generate api key for cursor" | `aih key generate cursor` |
| "test the github connection" | `aih mcp test github` |
| "disable notion" | `aih mcp disable notion` |
| "show me all skills" | `aih skill list` |
| "what skills do i have for writing" | `aih skill list \| jq '.skills[] \| select(.tags[] == "writing")'` |
| "start the server" | `aih server start --daemon` |
| "show recent logs" | `aih server logs --lines=100` |
| "back everything up" | `aih backup` |
| "deploy to digitalocean" | `aih deploy app-spec --repo=X` then `aih deploy app-create` |
| "deploy to droplet" | `aih deploy droplet-script --repo=X` |
| "check doctl" | `aih deploy doctl-check` |
| "what's the app status" | `aih deploy app-list` |

## Deployment (Self-Hosted)

### DigitalOcean App Platform (Recommended)

Full workflow via CLI:

```bash
# 1. Check doctl is ready
aih deploy doctl-check

# 2. Generate app spec (creates .do/app.yaml)
aih deploy app-spec --repo=username/ai-hub --region=nyc

# 3. Commit and push to GitHub
git add .do/app.yaml
git commit -m "Add DO app spec"
git push

# 4. Create the app
aih deploy app-create

# 5. Monitor deployment
aih deploy app-status <app-id>
```

Flags for `app-spec`:
- `--repo=owner/name` (required) - GitHub repo
- `--region=nyc|sfo|ams|sgp` (default: nyc)
- `--branch=main` (default: main)
- `--size=basic-xxs|basic-xs|basic-s` (default: basic-xxs, ~$5/mo)

### DigitalOcean Droplet

```bash
# 1. Generate setup script
aih deploy droplet-script --repo=https://github.com/you/ai-hub.git

# 2. Copy to droplet
scp scripts/setup-droplet.sh root@<ip>:/tmp/
scp .env root@<ip>:/opt/ai-hub/.env

# 3. Run setup (installs Node, clones, creates systemd service)
ssh root@<ip> 'bash /tmp/setup-droplet.sh'
```

Flags for `droplet-script`:
- `--repo=url` (required) - Git clone URL
- `--port=3000` (default)
- `--user=aih` (default) - Linux user to run as
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
User=aih
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
  -v $(pwd)/aih-config.yaml:/app/aih-config.yaml:ro \
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
├── aih-config.yaml       # Main config (YAML)
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
└── aih.pid               # PID file when daemonized
```

## Config Format (aih-config.yaml)

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
aih status | jq .

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
aih status                          # Check if already running
cat logs/error.log | tail -20       # Check errors
LOG_LEVEL=debug aih server start    # Verbose mode

# MCP not working
aih mcp test <n>                 # Test connection
aih status | jq '.mcps.<n>'     # Check circuit breaker

# Out of connections
aih status | jq .connections        # Check limits
# Clients should reconnect; if stuck, restart

# Config issues
cat aih-config.yaml | python3 -c "import yaml,sys; yaml.safe_load(sys.stdin)" && echo "valid"
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
