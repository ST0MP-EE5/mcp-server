# DigitalOcean MCP Server

A Model Context Protocol (MCP) server that provides AI assistants with tools to manage DigitalOcean infrastructure.

## Features

- **Droplets**: Create, manage, resize, and delete virtual machines
- **App Platform**: Deploy and manage applications
- **Databases**: Provision managed PostgreSQL, MySQL, Redis, MongoDB
- **Domains & DNS**: Manage domains and DNS records
- **Account**: Check balance and account status

## Setup

### 1. Install dependencies

```bash
cd mcps/digitalocean
npm install
```

### 2. Set environment variable

```bash
export DO_API_TOKEN=your_digitalocean_api_token
```

Or add to your `.env` file:
```
DO_API_TOKEN=dop_v1_xxxxxxxxxxxxx
```

### 3. Build

```bash
npm run build
```

### 4. Run

```bash
npm start
```

## Integration with AI Hub

Add to `aih-config.yaml`:

```yaml
mcps:
  local:
    - name: "digitalocean"
      path: "./mcps/digitalocean"
      port: 3001
      enabled: true
```

Add to `.env`:
```
DO_API_TOKEN=your_token_here
```

## Available Tools

### Droplets (Virtual Machines)

| Tool | Description | Safety |
|------|-------------|--------|
| `do__list_droplets` | List all droplets | Read |
| `do__get_droplet` | Get droplet details | Read |
| `do__create_droplet` | Create a new droplet | Write |
| `do__delete_droplet` | Delete a droplet | Destructive |
| `do__reboot_droplet` | Reboot a droplet | Write |
| `do__power_droplet` | Power on/off/cycle | Write |
| `do__resize_droplet` | Resize a droplet | Write |
| `do__snapshot_droplet` | Create snapshot | Write |
| `do__list_regions` | List available regions | Read |
| `do__list_sizes` | List droplet sizes | Read |
| `do__list_images` | List OS images | Read |
| `do__list_ssh_keys` | List SSH keys | Read |

### App Platform

| Tool | Description | Safety |
|------|-------------|--------|
| `do__list_apps` | List all apps | Read |
| `do__get_app` | Get app details | Read |
| `do__create_app` | Create new app | Write |
| `do__update_app` | Update app spec | Write |
| `do__delete_app` | Delete an app | Destructive |
| `do__get_app_logs` | Get app logs | Read |
| `do__restart_app` | Restart/redeploy | Write |

### Managed Databases

| Tool | Description | Safety |
|------|-------------|--------|
| `do__list_databases` | List all databases | Read |
| `do__get_database` | Get database details | Read |
| `do__create_database` | Create database cluster | Write |
| `do__delete_database` | Delete database | Destructive |

### Domains & DNS

| Tool | Description | Safety |
|------|-------------|--------|
| `do__list_domains` | List domains | Read |
| `do__get_domain` | Get domain info | Read |
| `do__create_domain` | Add domain to DNS | Write |
| `do__delete_domain` | Remove domain | Destructive |
| `do__list_records` | List DNS records | Read |
| `do__create_record` | Create DNS record | Write |
| `do__delete_record` | Delete DNS record | Destructive |

### Account

| Tool | Description | Safety |
|------|-------------|--------|
| `do__get_account` | Get account info | Read |
| `do__get_balance` | Get billing balance | Read |

## Example Usage

### Create a Droplet

```json
{
  "name": "do__create_droplet",
  "arguments": {
    "name": "my-server",
    "region": "nyc3",
    "size": "s-1vcpu-1gb",
    "image": "ubuntu-22-04-x64",
    "ssh_keys": ["12345"],
    "tags": ["production"]
  }
}
```

### Deploy an App

```json
{
  "name": "do__create_app",
  "arguments": {
    "spec": {
      "name": "my-app",
      "region": "nyc",
      "services": [{
        "name": "api",
        "github": {
          "repo": "username/repo",
          "branch": "main",
          "deploy_on_push": true
        },
        "run_command": "npm start",
        "http_port": 3000,
        "instance_size_slug": "basic-xxs"
      }]
    }
  }
}
```

### Create a DNS Record

```json
{
  "name": "do__create_record",
  "arguments": {
    "domain": "example.com",
    "type": "A",
    "name": "api",
    "data": "192.168.1.1",
    "ttl": 3600
  }
}
```

## Security Notes

- **DO_API_TOKEN**: Keep your API token secure. It provides full access to your DigitalOcean account.
- **Destructive operations**: Tools marked as "Destructive" will permanently delete resources.
- **Rate limits**: The DigitalOcean API has rate limits (5000 req/hour). This MCP respects those limits.

## Development

```bash
# Run in development mode
npm run dev

# Build
npm run build

# Run tests (when available)
npm test
```

## License

MIT
