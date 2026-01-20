# Claude Code Instructions

## Overview
Instructions for Claude Code (CLI) connecting to the MCP Hub at `mcp.m9m.dev`.

## Connection Setup

Add to your Claude Code settings (`~/.claude/settings.json`):

```json
{
  "mcpServers": {
    "mcp-server": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "https://mcp.m9m.dev/mcp/sse"],
      "env": {
        "MCP_HEADERS": "Authorization: Bearer YOUR_JWT_TOKEN"
      }
    }
  }
}
```

To get a JWT token, use GitHub OAuth:
1. `curl -X POST https://mcp.m9m.dev/oauth/device`
2. Visit the URL and enter the code
3. `curl -X POST https://mcp.m9m.dev/oauth/token -d '{"user_code":"YOUR_CODE"}'`

## Available MCPs

| MCP | Description | Tools |
|-----|-------------|-------|
| **Greptile** | AI-powered codebase search | `search_code`, `list_pull_requests`, `trigger_code_review` |
| **Linear** | Project management | `create_issue`, `list_issues`, `update_issue` |
| **Context7** | Documentation context | `resolve`, `get_library_docs` |
| **Exa** | Web search & crawling | `web_search_exa`, `deep_search_exa`, `crawling_exa` |

## Memory

Cross-session memory is enabled via mem0. Memories are scoped to your GitHub identity.

- Add memory: Share preferences/context in conversation
- Search memory: Ask about previous conversations
- Memory persists across sessions

## Guidelines

- Follow existing code patterns
- Write clean, maintainable code
- Add comments for complex logic only
- Prefer editing existing files over creating new ones
- Use Greptile for semantic codebase search before making changes
- Use Context7 for library documentation lookups
