---
name: no-force-push-warning
enabled: true
event: bash
conditions:
  - field: command
    operator: contains
    pattern: "push --force"
action: warn
---

**Force Push Warning**

You are about to force push, which rewrites remote history.

This can cause problems for other collaborators. Consider:
- Using `--force-with-lease` instead (safer)
- Coordinating with your team first
- Only force pushing to your own branches
