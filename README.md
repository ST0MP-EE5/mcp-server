# MCP Server Template

A self-hosted **Model Context Protocol (MCP)** server template for AI-native development. Deploy your own MCP server with custom tools, skills, and integrations for Claude, Cursor, Windsurf, and other AI coding assistants.

## Features

- **MCP Gateway** - SSE-based protocol server for AI tool integration
- **Tool Registry** - Manage and expose tools to AI clients
- **Skills System** - Reusable instruction sets for AI assistants
- **API Key Auth** - Secure access control with permissions
- **Hot Reload** - Config changes apply without restart
- **Local MCPs** - Run custom MCP servers (e.g., DigitalOcean tools)
- **External MCPs** - Proxy to services like Stripe, Vercel, GitHub

## Quick Start

```bash
# 1. Clone and install
git clone https://github.com/YOUR_USERNAME/mcp-server.git
cd mcp-server
npm install

# 2. Initialize
cp .env.example .env
# Edit mcp-server.yaml with your settings

# 3. Generate API key
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# Add the hash to mcp-server.yaml

# 4. Start
npm run dev   # Development with hot-reload
npm start     # Production
```

## Project Structure

```
mcp-server/
├── mcp-server.yaml    # Main configuration
├── .env               # Environment secrets
├── src/               # TypeScript source
│   ├── index.ts       # Server entry point
│   ├── cli.ts         # CLI tool
│   ├── mcp-gateway.ts # MCP protocol handler
│   └── ...
├── mcps/              # Local MCP servers
│   └── digitalocean/  # Example: DO tools (32 tools)
├── skills/            # Instruction sets
├── configs/           # IDE configs
├── plugins/           # Extended capabilities
└── hooks/             # Event handlers
```

## CLI Commands

All commands output JSON. Use `mcp-server` after global install or `npm run cli`.

```bash
# Initialization
mcp-server init [name]              # Initialize new server

# Status
mcp-server status                   # System health and stats

# API Keys
mcp-server key generate <name>      # Generate new API key
mcp-server key list                 # List keys (hashes only)
mcp-server key revoke <name>        # Revoke a key

# MCP Management
mcp-server mcp list                 # List all MCPs
mcp-server mcp add <name> <url>     # Add external MCP
mcp-server mcp test <name>          # Test connection
mcp-server mcp enable <name>        # Enable MCP
mcp-server mcp disable <name>       # Disable MCP

# Skills
mcp-server skill list               # List skills
mcp-server skill add <name> [desc]  # Add skill
mcp-server skill get <name>         # Get skill content

# Server
mcp-server server start [--daemon]  # Start server
mcp-server server stop              # Stop daemon
mcp-server server logs              # View logs

# Deployment
mcp-server deploy app-spec          # Generate DO App Platform spec
mcp-server deploy app-create        # Deploy to DO
mcp-server deploy droplet-script    # Generate droplet setup script
```

## Configuration (mcp-server.yaml)

```yaml
version: "1.0"
name: "my-mcp-server"

auth:
  api_keys:
    - name: "claude-ai"
      key_hash: "sha256:..."  # Hash of your API key
      permissions: ["*"]

mcps:
  external:
    - name: "stripe"
      url: "https://mcp.stripe.com"
      auth:
        type: "bearer"
        token: "${STRIPE_MCP_TOKEN}"
      enabled: true

  local:
    - name: "digitalocean"
      path: "./mcps/digitalocean"
      port: 3001
      enabled: true

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

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/health` | GET | No | Health check |
| `/mcp/health` | GET | No | Detailed MCP status |
| `/mcp/sse` | GET | Yes | SSE connection |
| `/mcp/messages` | POST | Yes | MCP messages |
| `/api/v1/registry` | GET | Yes | Full registry |
| `/api/v1/skills/:name` | GET | Yes | Skill content |

## Built-in Tools

When connected via MCP, these tools are available:

| Tool | Description |
|------|-------------|
| `mcp__list_mcps` | List all available MCPs |
| `mcp__list_skills` | List all skills |
| `mcp__get_skill` | Get skill content by name |
| `mcp__list_configs` | List available configs |
| `mcp__get_config` | Get config content |
| `mcp__health` | Check server health |

---

# DigitalOcean Deployment Guide

## Option 1: App Platform (Recommended)

**Cost**: ~$5/month | **Difficulty**: Easy | **SSL**: Automatic

### Prerequisites
- DigitalOcean account with billing enabled
- GitHub account with repo access
- `doctl` CLI installed (optional)

### Step-by-Step Setup

#### 1. Prepare Your Repository

```bash
# Fork/clone this template
git clone https://github.com/YOUR_USERNAME/mcp-server.git
cd mcp-server

# Install dependencies and verify build
npm install
npm run build

# Create .env with your tokens
cp .env.example .env
# Edit .env: DO_API_TOKEN=dop_v1_your_token_here

# Commit and push
git add .
git commit -m "Initial setup"
git push origin main
```

#### 2. Create App via DigitalOcean Console

1. Go to [DigitalOcean App Platform](https://cloud.digitalocean.com/apps)
2. Click **Create App**
3. Select **GitHub** as source
4. Authorize and select your `mcp-server` repository
5. Configure:
   - **Branch**: `main`
   - **Source Directory**: `/` (root)
   - **Autodeploy**: Enabled

6. Configure Build Settings:
   - **Build Command**: `npm ci --include=dev && npm run build`
   - **Run Command**: `npm start`

7. Choose Plan:
   - **Basic** ($5/month) - Good for personal use
   - **Professional** ($12/month) - For production

8. Add Environment Variables:
   ```
   NODE_ENV = production
   DO_API_TOKEN = dop_v1_your_token_here (mark as SECRET)
   ```

9. Click **Create Resources**

#### 3. Create App via CLI (Alternative)

```bash
# Install doctl
brew install doctl  # macOS
# or: snap install doctl  # Linux

# Authenticate
doctl auth init
# Enter your DO API token when prompted

# Update .do/app.yaml with your repo
# Change: repo: YOUR_USERNAME/mcp-server

# Create the app
doctl apps create --spec .do/app.yaml

# Get your app ID
doctl apps list

# Update with secrets (create .do/app-with-secrets.yaml with token value)
doctl apps update <APP_ID> --spec .do/app-with-secrets.yaml
```

#### 4. Verify Deployment

```bash
# Get your app URL
doctl apps get <APP_ID> --format DefaultIngress

# Test health endpoint
curl https://your-app.ondigitalocean.app/health
# Expected: {"ok":true,"status":"healthy",...}

# Test MCP health
curl https://your-app.ondigitalocean.app/mcp/health
```

---

## Option 2: Droplet (VPS)

**Cost**: $4-6/month | **Difficulty**: Medium | **SSL**: Manual

### Step-by-Step Setup

#### 1. Create Droplet

1. Go to [DigitalOcean Droplets](https://cloud.digitalocean.com/droplets)
2. Click **Create Droplet**
3. Choose:
   - **Image**: Ubuntu 22.04 LTS
   - **Plan**: Basic $4/month (1GB RAM)
   - **Region**: Closest to you
   - **Authentication**: SSH Key (recommended)
4. Click **Create Droplet**

#### 2. Initial Server Setup

```bash
# SSH into your droplet
ssh root@YOUR_DROPLET_IP

# Update system
apt update && apt upgrade -y

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# Create app user
useradd -m -s /bin/bash mcp
```

#### 3. Deploy Application

```bash
# Clone your repo
git clone https://github.com/YOUR_USERNAME/mcp-server.git /opt/mcp-server
cd /opt/mcp-server

# Install and build
npm ci --production
npm run build

# Create .env
cat > .env << EOF
DO_API_TOKEN=dop_v1_your_token_here
NODE_ENV=production
PORT=3000
EOF

# Set ownership
chown -R mcp:mcp /opt/mcp-server
```

#### 4. Create Systemd Service

```bash
cat > /etc/systemd/system/mcp-server.service << 'EOF'
[Unit]
Description=MCP Server
After=network.target

[Service]
Type=simple
User=mcp
WorkingDirectory=/opt/mcp-server
ExecStart=/usr/bin/node dist/index.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF

# Enable and start
systemctl daemon-reload
systemctl enable mcp-server
systemctl start mcp-server
```

#### 5. Setup Firewall

```bash
ufw allow 22/tcp
ufw allow 3000/tcp
ufw enable
```

#### 6. Setup SSL with Nginx (Recommended)

```bash
# Install Nginx and Certbot
apt install -y nginx certbot python3-certbot-nginx

# Create Nginx config
cat > /etc/nginx/sites-available/mcp-server << 'EOF'
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_buffering off;  # Required for SSE
        proxy_read_timeout 86400;
    }
}
EOF

# Enable and get SSL
ln -s /etc/nginx/sites-available/mcp-server /etc/nginx/sites-enabled/
nginx -t && systemctl restart nginx
certbot --nginx -d your-domain.com
```

---

## Option 3: Docker

```bash
# Build and run
docker build -t mcp-server .
docker run -d \
  --name mcp-server \
  -p 3000:3000 \
  -v $(pwd)/mcp-server.yaml:/app/mcp-server.yaml:ro \
  -v $(pwd)/.env:/app/.env:ro \
  --restart unless-stopped \
  mcp-server

# Or use docker-compose
docker-compose up -d
```

---

## Connecting AI Clients

### Claude Code / Claude.ai
```json
{
  "mcpServers": {
    "my-server": {
      "url": "https://your-app.ondigitalocean.app/mcp/sse",
      "headers": {
        "Authorization": "Bearer YOUR_API_KEY"
      }
    }
  }
}
```

### Cursor
Add to `.cursor/mcp.json`:
```json
{
  "servers": {
    "my-server": {
      "url": "https://your-app.ondigitalocean.app/mcp/sse",
      "apiKey": "YOUR_API_KEY"
    }
  }
}
```

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Build fails "tsc not found" | Use `npm ci --include=dev` |
| 502 Bad Gateway | Check service status, verify port |
| Connection refused | Check firewall rules |
| SSL errors | Run `certbot renew` |

### Logs

```bash
# App Platform
doctl apps logs <APP_ID> --type run

# Droplet
journalctl -u mcp-server -f
```

---

## License

MIT
