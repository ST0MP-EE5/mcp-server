---
name: no-console-log
enabled: true
event: file
conditions:
  - field: content
    operator: contains
    pattern: "console.log"
action: warn
---

**Console.log Detected**

You're adding `console.log` statements to the code.

Consider:
- Using a proper logger (winston, pino, etc.)
- Removing debug logs before committing
- Using conditional logging for development only
