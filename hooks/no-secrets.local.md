---
name: no-hardcoded-secrets
enabled: true
event: file
conditions:
  - field: content
    operator: contains
    pattern: "API_KEY="
action: warn
---

**Potential Hardcoded Secret**

The code contains what looks like a hardcoded API key or secret.

Best practices:
- Use environment variables: `process.env.API_KEY`
- Use a `.env` file (add to `.gitignore`)
- Use a secrets manager for production
