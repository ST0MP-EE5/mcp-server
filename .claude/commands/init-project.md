---
description: Initialize a new project with Spec Kit and Beads
argument-hint: "[project-name]"
allowed-tools: Bash, Write, Read
---

# Initialize Project

Set up a new project with Spec Kit templates and Beads issue tracking.

## Steps

1. **Initialize Beads** (if not already initialized):
```bash
bd init
```

2. **Create Spec Kit structure**:
```bash
mkdir -p .specify/templates .specify/memory .specify/scripts
```

3. **Copy global templates**:
```bash
cp -r ~/.specify/templates/* .specify/templates/ 2>/dev/null || echo "No global templates found"
```

4. **Create empty constitution** (to be customized per project):
```bash
cat > .specify/memory/constitution.md << 'EOF'
# Project Constitution

## Core Principles

### I. [First Principle]
[Description of your first guiding principle]

### II. [Second Principle]
[Description of your second guiding principle]

### III. [Third Principle]
[Description of your third guiding principle]

---
*Run `/speckit.constitution` to interactively define your project principles.*
EOF
```

5. **Confirm setup**:
```bash
echo "✓ Project initialized with:"
ls -la .specify/
ls -la .beads/ 2>/dev/null || echo "Run 'bd init' to initialize Beads"
```

## Usage

After running `/init-project`:
- Run `/speckit.constitution` to define project principles
- Run `/speckit.specify <feature>` to create specifications
- Use `bd create "Task"` to track issues
