# Hookify Rules

This directory contains reusable hookify rules. Copy any of these to your project's `.claude/` directory to enable them.

## Available Rules

### Safety Rules

| File | Description |
|------|-------------|
| `dangerous-rm.local.md` | Warns before `rm -rf` commands |
| `no-secrets.local.md` | Warns when hardcoding secrets |
| `no-force-push.local.md` | Warns before `git push --force` |

### Code Quality Rules

| File | Description |
|------|-------------|
| `no-console-log.local.md` | Warns when adding console.log |
| `no-todo-comments.local.md` | Warns when adding TODO comments |

### Project-Specific Rules

| File | Description |
|------|-------------|
| `require-tests.local.md` | Reminds to add tests when modifying code |

## Usage

1. Copy desired rules to your project:
   ```bash
   cp hooks/dangerous-rm.local.md .claude/hookify.dangerous-rm.local.md
   ```

2. Or copy all rules:
   ```bash
   cp hooks/*.local.md .claude/
   # Rename to add hookify prefix
   for f in .claude/*.local.md; do
     mv "$f" ".claude/hookify.$(basename $f)"
   done
   ```

3. Customize the rules by editing the files

## Creating Custom Rules

See the [Hookify documentation](../plugins/hookify/README.md) for rule syntax.

Basic structure:
```markdown
---
name: rule-name
enabled: true
event: bash|file|stop|prompt
conditions:
  - field: command|content|file_path
    operator: contains|regex_match|equals
    pattern: "pattern to match"
action: warn|block
---

Message shown when rule matches.
```
