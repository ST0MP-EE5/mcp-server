# OpenAI Codex / Agents Instructions

## Overview
Instructions for OpenAI Codex CLI and agentic workflows.

## MCP Server Access

The MCP server is available at: `https://mcp.m9m.dev`

### API Endpoints

```bash
# Health check (no auth required)
curl https://mcp.m9m.dev/health

# MCP health with auth
curl -H "Authorization: Bearer API_KEY" https://mcp.m9m.dev/mcp/health

# List skills
curl -H "Authorization: Bearer API_KEY" https://mcp.m9m.dev/api/v1/registry

# Get a skill
curl -H "Authorization: Bearer API_KEY" https://mcp.m9m.dev/api/v1/skills/code-simplifier

# Get a config
curl -H "Authorization: Bearer API_KEY" https://mcp.m9m.dev/api/v1/configs/codex
```

### Available Resources

**External MCPs:**
- GitHub (https://api.githubcopilot.com/mcp/)
- Linear (https://mcp.linear.app/mcp)
- Greptile (https://api.greptile.com/mcp)

**Local MCPs:**
- context7 (npm package)
- typescript-lsp (Language Server)

**Skills:**
- code-simplifier: Simplifies and refines code

**Plugins:**
- hookify: Create hooks to prevent unwanted behaviors
- ralph-loop: Continuous AI loops for iterative development

## Guidelines
- Follow existing code patterns
- Write clean, maintainable code
- Add comments for complex logic only
- Prefer editing existing files over creating new ones
