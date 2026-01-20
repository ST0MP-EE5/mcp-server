---
name: no-todo-comments
enabled: false
event: file
conditions:
  - field: content
    operator: contains
    pattern: "// TODO"
action: warn
---

**TODO Comment Added**

You're adding a TODO comment. Consider:
- Creating a GitHub issue instead for tracking
- Completing the task now if it's small
- Adding a deadline or assignee to the TODO
