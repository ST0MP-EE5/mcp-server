---
name: dangerous-rm-warning
enabled: true
event: bash
conditions:
  - field: command
    operator: contains
    pattern: "rm -rf"
action: warn
---

**Dangerous Command Detected**

You are about to run a potentially destructive `rm -rf` command.

Please verify:
- The path is correct
- You have backups if needed
- This is intentional
