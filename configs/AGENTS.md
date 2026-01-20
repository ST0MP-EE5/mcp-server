# OpenAI Codex / Agents Instructions

## Overview
Instructions for OpenAI Codex CLI and agentic workflows connecting to the MCP Hub.

## MCP Server

**Base URL:** `https://mcp.m9m.dev`

### Codex Configuration

Add to your Codex config:

```toml
[mcp_servers.mcp-hub]
url = "https://mcp.m9m.dev/mcp/sse"
http_headers = { "Authorization" = "Bearer YOUR_JWT_TOKEN" }
```

To get a JWT token, use GitHub OAuth:
```bash
# 1. Start device flow
curl -X POST https://mcp.m9m.dev/oauth/device

# 2. Visit the URL and enter the code shown

# 3. Get token
curl -X POST https://mcp.m9m.dev/oauth/token \
  -H "Content-Type: application/json" \
  -d '{"user_code":"YOUR_CODE"}'
```

### API Endpoints

```bash
# Health check (no auth required)
curl https://mcp.m9m.dev/health

# MCP health with auth
curl -H "Authorization: Bearer TOKEN" https://mcp.m9m.dev/mcp/health

# List registry
curl -H "Authorization: Bearer TOKEN" https://mcp.m9m.dev/api/v1/registry

# Get a skill
curl -H "Authorization: Bearer TOKEN" https://mcp.m9m.dev/api/v1/skills/code-simplifier
```

## Available MCPs

| MCP | URL | Description |
|-----|-----|-------------|
| **Greptile** | `api.greptile.com/mcp` | AI-powered codebase search, PR reviews |
| **Linear** | `mcp.linear.app/mcp` | Project management, issues |
| **Context7** | `mcp.context7.com/mcp` | Library documentation context |
| **Exa** | `mcp.exa.ai/mcp` | Web search, deep search, crawling |

## Memory

Cross-session memory powered by mem0:
- Scoped to your GitHub identity
- Persists across sessions and clients
- Use `memory_add`, `memory_search`, `memory_list` tools

## Skills

| Skill | Description |
|-------|-------------|
| `code-simplifier` | Simplifies and refines code for clarity |

## Plugins

| Plugin | Description |
|--------|-------------|
| `hookify` | Create hooks to prevent unwanted behaviors |
| `ralph-loop` | Continuous AI loops for iterative development |

## Guidelines

- Follow existing code patterns
- Write clean, maintainable code
- Add comments for complex logic only
- Prefer editing existing files over creating new ones
- Use Greptile for semantic codebase search
- Use Context7 for library documentation
- Use Exa for web research
