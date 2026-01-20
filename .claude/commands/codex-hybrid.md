---
description: Full-stack development with Claude+Codex hybrid (MCP + extended reasoning)
argument-hint: "<task description>"
allowed-tools: Read, Write, Bash, AskUser, Grep, Glob, Task, mcp__greptile__*, mcp__mcp-server__*
---

# Codex Hybrid Development Workflow

## Claude as Orchestrator (Parent Process)

**You (Claude) are the orchestrator/parent** of this entire workflow. Codex is a powerful child process you spawn for specific tasks, but YOU control the flow and handle everything Codex cannot do.

```
┌─────────────────────────────────────────────────────────────────┐
│                     CLAUDE (Orchestrator)                       │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ Capabilities YOU handle (Codex cannot):                     ││
│  │  • MCP Tools: Greptile, Context7, Memory, Linear            ││
│  │  • Interactive: AskUser for clarification                   ││
│  │  • Quality Gate: Local checks per phase, Greptile on PR     ││
│  │  • State Management: .codex-state/ persistence              ││
│  │  • Finalization: Commits, PRs, Memory updates               ││
│  └─────────────────────────────────────────────────────────────┘│
│                              │                                  │
│                              ▼                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │              CODEX (Child Process)                          ││
│  │  You spawn Codex for:                                       ││
│  │  • Planning with extended reasoning (xhigh)                 ││
│  │  • Code implementation (file read/write)                    ││
│  │  • Test execution                                           ││
│  │  • Beads task tracking                                      ││
│  │  • Spec Kit artifact creation                               ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

### Workflow Control Flow

```
CLAUDE: Phase 1 - Gather context (Greptile, Context7, Memory)
CLAUDE: Phase 2 - Ask clarifying questions (AskUser)
CLAUDE: Launch Codex → Phase 3 Planning
CLAUDE: Parse plan, verify completeness
FOR EACH implementation phase:
    CLAUDE: Launch Codex → Implement phase
    CLAUDE: Run local quality checks (tests, lint, types)
    IF score < 5:
        CLAUDE: Launch Codex → Fix issues
        CLAUDE: Re-run quality check (max 3 attempts)
    CLAUDE: Commit phase changes
CLAUDE: Phase 5 - Finalize (commit, PR + Greptile review, Memory update)
```

## Mandatory Tools for Codex

**MCP Setup (One-time)**: To give Codex access to MCP tools, run once:
```bash
codex mcp add mcp-server -- npx -y @anthropic/mcp-proxy "https://mcp.m9m.dev/mcp/sse" \
  --header "Authorization: Bearer YOUR_MCP_TOKEN"
```

**IMPORTANT**: When launching Codex, ALWAYS instruct it to use:

1. **Beads** (`bd` CLI) - Git-backed task tracking
   - `bd init` - Initialize in project
   - `bd create "Task" -p P1` - Create tasks with priority
   - `bd state <id> in_progress/closed` - Update task state
   - `bd dep add <child> <parent>` - Set dependencies
   - `bd ready` - List tasks ready to work on

2. **Spec Kit** - Spec-driven development artifacts
   - `spec.md` - Feature specification
   - `plan.md` - Implementation plan
   - `tasks.md` - Task breakdown
   - Templates in `~/.specify/templates/`

Every Codex prompt in this workflow includes these tool instructions by default.

## User Request

```
$ARGUMENTS
```

---

## PHASE 1: Context & Setup (Claude)

**Goal**: Gather comprehensive context using Claude's unique MCP capabilities.

### 1.1 Semantic Codebase Search (Greptile)

Query Greptile to understand the codebase architecture relevant to the task:

```
Use mcp__greptile__search_custom_context or mcp__greptile__list_merge_requests
to understand existing patterns, recent changes, and codebase structure.
```

Search for:
- Existing implementations of similar features
- Architectural patterns used in the codebase
- Recent PRs related to this area
- Custom context/patterns defined for the org

### 1.2 Library Documentation (Context7)

If the task involves external libraries:

```
Use mcp__mcp-server__context7__resolve-library-id to find the library
Then mcp__mcp-server__context7__query-docs for specific documentation
```

### 1.3 Memory Check

Check for past decisions and patterns:

```
Use mcp__mcp-server__mcp__memory_search with query related to the task
to find relevant past decisions, patterns, or learnings
```

### 1.4 Initialize Task Tracking (Beads)

```bash
# Initialize beads if not already done
bd init 2>/dev/null || true

# Create main task
MAIN_TASK=$(bd create "Implement: ${TASK_DESCRIPTION}" -p P1 2>/dev/null | grep -o 'DO-[a-z0-9]*' || echo "manual-task")
echo "Created main task: $MAIN_TASK"
```

### 1.5 Create Feature Spec (Optional)

If the task is complex enough to warrant a spec:

```
Consider running /speckit.specify to create a formal feature specification
```

---

## PHASE 2: Clarification (Claude)

**Goal**: Ask targeted questions to gather requirements before implementation.

### 2.1 Ask 3-6 Clarifying Questions

**Use the AskUser tool** to ask questions that will significantly impact implementation:

Good questions to ask:
- **Scope**: What's the minimum viable version vs full implementation?
- **Technology**: Any specific libraries, patterns, or frameworks to use?
- **Constraints**: Performance requirements, compatibility needs, deadlines?
- **Integration**: How should this interact with existing systems?
- **Testing**: What level of test coverage is expected?
- **Error handling**: How should edge cases and failures be handled?

Example:
```
I'm preparing to implement this feature. A few questions:

1. What's the scope priority?
   - Minimum viable (core functionality only)
   - Full implementation (all features)
   - Incremental (MVP first, then iterate)

2. Are there specific technology constraints?
   - Must use existing patterns in codebase
   - Open to new libraries/approaches
   - Specific framework requirements

3. What testing approach do you prefer?
   - Unit tests only
   - Unit + Integration tests
   - Full coverage including E2E

4. How should errors be handled?
   - Fail fast with clear messages
   - Graceful degradation
   - Retry with backoff
```

### 2.2 Compile Requirements

After getting answers, compile a comprehensive requirements document that includes:
- Core requirements (must have)
- Nice-to-have features
- Technology constraints
- Testing requirements
- Integration points
- Success criteria

---

## PHASE 3: Planning (Codex)

**Goal**: Use Codex with extended reasoning to create a detailed implementation plan.

### 3.1 Configure MCP for Codex (One-time Setup)

**Note**: Codex MCP is configured separately, not via exec flags. Run this once to give Codex access to MCP tools:

```bash
# Check if MCP is already configured
codex mcp list

# If not configured, add the MCP server (one-time setup)
# Extract token from Claude settings
MCP_TOKEN=$(node -e "
  const fs = require('fs');
  const settings = JSON.parse(fs.readFileSync(process.env.HOME + '/.claude/settings.json'));
  console.log(settings.mcpServers?.['mcp-server']?.env?.MCP_HEADERS?.replace('Authorization: Bearer ', '') || '');
" 2>/dev/null)

# Add MCP server to Codex (if token found)
if [ -n "$MCP_TOKEN" ]; then
  codex mcp add mcp-server -- npx -y @anthropic/mcp-proxy "https://mcp.m9m.dev/mcp/sse" \
    --header "Authorization: Bearer $MCP_TOKEN"
  echo "MCP server configured for Codex"
else
  echo "No MCP token found - Codex will run without MCP access"
fi
```

Once configured, Codex automatically has access to MCP tools in all sessions.

### 3.2 Craft Planning Prompt

Create a comprehensive prompt for Codex that includes:
1. **Full task description** from user
2. **All requirements** gathered from clarification
3. **Codebase context** from Greptile searches
4. **Library documentation** from Context7
5. **Past decisions** from Memory
6. **Plan structure template**

### 3.3 Execute Codex for Planning

```bash
# Create state directory
mkdir -p .codex-state

# Save initial state
cat > .codex-state/phase-0.json << EOF
{
  "task": "$TASK_DESCRIPTION",
  "requirements": $REQUIREMENTS_JSON,
  "context": $CONTEXT_JSON,
  "timestamp": "$(date -Iseconds)"
}
EOF

# Run Codex for planning (MCP access if configured via 'codex mcp add')
codex exec --full-auto --skip-git-repo-check \
  -c model=gpt-5.2-codex \
  -c model_reasoning_effort=xhigh \
  --output-last-message /tmp/codex-plan-result.txt \
  "
# PLANNING TASK

You are creating a detailed implementation plan. You have access to MCP tools for querying documentation if needed.

## Task
$TASK_DESCRIPTION

## Requirements
$COMPILED_REQUIREMENTS

## Codebase Context
$GREPTILE_CONTEXT

## MANDATORY TOOLS - You MUST use these:

### Beads (Task Tracking)
You MUST use Beads for task management throughout this project:
\`\`\`bash
# Initialize (if not done)
bd init

# Create tasks with priorities (P0=critical, P1=high, P2=medium, P3=low)
bd create \"Task title\" -p P1 --description=\"Details here\"

# Set task dependencies
bd dep add <child-task-id> <parent-task-id>

# Update task state as you work
bd state <task-id> in_progress   # When starting
bd state <task-id> closed        # When complete

# Check ready tasks (no blocked dependencies)
bd ready

# List all tasks
bd list
\`\`\`

### Spec Kit (Feature Specification)
Follow Spec Kit patterns for documentation:
- Create \`spec.md\` for feature specification (use ~/.specify/templates/spec-template.md)
- Create \`plan.md\` for implementation plan (use ~/.specify/templates/plan-template.md)
- Create \`tasks.md\` for task breakdown (use ~/.specify/templates/tasks-template.md)

## Instructions

1. First, initialize Beads: \`bd init\`
2. Create a main task: \`bd create \"$TASK_DESCRIPTION\" -p P1\`
3. Create the feature spec in \`spec.md\` following Spec Kit template
4. Create a detailed implementation plan in \`plan.md\` with phases
5. For each phase, create a Beads task with \`bd create\`
6. Set up task dependencies with \`bd dep add\`
7. Each phase should be independently implementable and testable
8. Include specific file paths, function names, and code snippets
9. Define clear acceptance criteria for each phase

## Plan Structure (plan.md)

Use this structure:

# Implementation Plan: [Task Name]

## Overview
[Brief summary]

## Phase 1: [Foundation]
**Beads Task ID**: [will be created]
### Tasks
- Task 1.1: [Specific task with file paths]
- Task 1.2: [...]
### Acceptance Criteria
- [ ] [Testable criterion]
### Files to Modify
- path/to/file.ts

## Phase 2: [Core Implementation]
[Same structure...]

## Phase N: [Testing & Polish]
[Same structure...]

## Dependency Graph
[Which phases depend on others]

---

After writing the plan, create all Beads tasks:
\`\`\`bash
# Example task creation for phases
PHASE1=\$(bd create \"Phase 1: Foundation\" -p P1 | grep -o 'DO-[a-z0-9]*')
PHASE2=\$(bd create \"Phase 2: Core Implementation\" -p P1 | grep -o 'DO-[a-z0-9]*')
bd dep add \$PHASE2 \$PHASE1  # Phase 2 depends on Phase 1
\`\`\`

Write the complete plan now. Do NOT ask questions - you have all the information needed.
"
```

### 3.4 Create Beads Tasks for Each Phase

After plan is generated, parse it and create tasks:

```bash
# Parse plan.md and create Beads tasks for each phase
# This would extract phases and create tasks with dependencies
```

---

## PHASE 4: Implementation Loop (Codex + Greptile Quality Gate)

**Goal**: Execute each phase, verify with Greptile, achieve 5/5 quality before proceeding.

### 4.1 Implementation Loop Structure

For each phase in the plan:

```
┌─────────────────────────────────────────────────┐
│ 4a. Save State Snapshot                         │
│     → .codex-state/phase-N-pre.json             │
├─────────────────────────────────────────────────┤
│ 4b. Execute Phase with Codex                    │
│     → codex exec --full-auto "Implement..."     │
├─────────────────────────────────────────────────┤
│ 4c. Greptile Quality Check (Ralph Loop)         │
│     → Score 1-5, must achieve 5/5               │
│     → If <5: Codex fixes, re-check              │
│     → Max 3 attempts per phase                  │
├─────────────────────────────────────────────────┤
│ 4d. Phase Complete                              │
│     → Mark Beads task closed                    │
│     → Git commit for phase                      │
│     → Continue to next phase                    │
└─────────────────────────────────────────────────┘
```

### 4.2 Phase Implementation Script

```bash
implement_phase() {
  local PHASE_NUM=$1
  local PHASE_TASKS=$2
  local MAX_ATTEMPTS=3
  local ATTEMPT=0
  local SCORE=0

  # Save pre-implementation state
  cat > .codex-state/phase-${PHASE_NUM}-pre.json << EOF
{
  "phase": $PHASE_NUM,
  "status": "starting",
  "timestamp": "$(date -Iseconds)"
}
EOF

  # Mark Beads task as in-progress
  bd state "phase-${PHASE_NUM}" in_progress 2>/dev/null || true

  while [ $SCORE -lt 5 ] && [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
    ATTEMPT=$((ATTEMPT + 1))
    echo "Phase $PHASE_NUM - Attempt $ATTEMPT/$MAX_ATTEMPTS"

    # Execute implementation with Codex (MCP access if configured)
    codex exec --full-auto --skip-git-repo-check \
      -c model=gpt-5.2-codex \
      -c model_reasoning_effort=xhigh \
      --output-last-message /tmp/codex-phase-${PHASE_NUM}.txt \
      "
Implement Phase $PHASE_NUM of the plan.

## Current State
$(cat .codex-state/phase-$((PHASE_NUM - 1))-post.json 2>/dev/null || echo '{}')

## Tasks for this Phase
$PHASE_TASKS

## MANDATORY: Beads Task Tracking

You MUST use Beads to track your progress:

\`\`\`bash
# Mark this phase as in-progress when starting
bd state \"phase-${PHASE_NUM}\" in_progress

# As you complete subtasks, you can create and close them:
SUBTASK=\$(bd create \"Subtask description\" -p P2 | grep -o 'DO-[a-z0-9]*')
bd state \$SUBTASK in_progress
# ... do the work ...
bd state \$SUBTASK closed

# When phase is complete:
bd state \"phase-${PHASE_NUM}\" closed
\`\`\`

## Instructions
1. First, mark the phase task as in_progress: \`bd state phase-${PHASE_NUM} in_progress\`
2. Read the plan from plan.md and spec from spec.md
3. Implement all tasks for Phase $PHASE_NUM
4. Write/modify the necessary files
5. Run tests if applicable
6. Update Beads task states as you complete work
7. Mark phase complete when done: \`bd state phase-${PHASE_NUM} closed\`
8. Do NOT ask questions - just implement

$([ $ATTEMPT -gt 1 ] && echo "
## Previous Attempt Feedback
The previous implementation had issues:
$(cat /tmp/greptile-feedback-${PHASE_NUM}.txt 2>/dev/null)

Fix these issues in this attempt.
")
"

    # Local Quality Check (lint, tests, type check)
    echo "Running local quality checks..."

    SCORE=0
    FEEDBACK=""

    # Check 1: TypeScript compilation
    if npx tsc --noEmit 2>/dev/null; then
      SCORE=$((SCORE + 2))
      echo "✓ TypeScript: No type errors"
    else
      FEEDBACK="$FEEDBACK\n- TypeScript compilation errors found"
      echo "✗ TypeScript: Type errors found"
    fi

    # Check 2: Tests pass
    if npm test 2>/dev/null || npx vitest run 2>/dev/null; then
      SCORE=$((SCORE + 2))
      echo "✓ Tests: All passing"
    else
      FEEDBACK="$FEEDBACK\n- Test failures found"
      echo "✗ Tests: Failures found"
    fi

    # Check 3: Linting (if configured)
    if npm run lint 2>/dev/null; then
      SCORE=$((SCORE + 1))
      echo "✓ Lint: No issues"
    else
      # Lint not configured or has warnings - partial credit
      SCORE=$((SCORE + 1))
      echo "~ Lint: Skipped or warnings only"
    fi

    echo "Quality score: $SCORE/5"

    if [ $SCORE -lt 5 ]; then
      echo "Issues found:"
      echo -e "$FEEDBACK"
      echo "$FEEDBACK" > /tmp/quality-feedback-${PHASE_NUM}.txt
    fi
  done

  # Save post-implementation state
  cat > .codex-state/phase-${PHASE_NUM}-post.json << EOF
{
  "phase": $PHASE_NUM,
  "status": "completed",
  "score": $SCORE,
  "attempts": $ATTEMPT,
  "timestamp": "$(date -Iseconds)"
}
EOF

  if [ $SCORE -eq 5 ]; then
    echo "✓ Phase $PHASE_NUM achieved 5/5 quality score"
    bd state "phase-${PHASE_NUM}" closed 2>/dev/null || true

    # Commit phase changes
    git add -A
    git commit -m "Phase $PHASE_NUM complete: $PHASE_SUMMARY" 2>/dev/null || true

    return 0
  else
    echo "⚠ Phase $PHASE_NUM maxed attempts at score $SCORE/5"
    return 1
  fi
}
```

### 4.3 Local Quality Gate Criteria

Local quality checks run after each phase (Greptile reviews happen on PR creation):

1. **TypeScript Compilation** (2 points)
   - `npx tsc --noEmit` passes
   - No type errors
   - Proper type annotations

2. **Tests Pass** (2 points)
   - `npm test` or `npx vitest run` passes
   - All existing tests still work
   - New tests for new functionality

3. **Linting** (1 point)
   - `npm run lint` passes (if configured)
   - No major style violations
   - Consistent code formatting

5. **Documentation** (1 point)
   - Code is self-documenting or has appropriate comments
   - API documentation if applicable
   - Types properly defined

**Must achieve 5/5 to proceed to next phase.**

---

## PHASE 5: Finalization (Claude)

**Goal**: Wrap up with final commit, PR creation, and memory updates.

### 5.1 Final Git Operations

```bash
# Ensure all changes are committed
git status
git add -A
git diff --cached --stat

# Create final commit if there are uncommitted changes
git commit -m "$(cat <<'EOF'
Complete: $TASK_DESCRIPTION

## Summary
- [List of phases completed]
- [Key features implemented]
- [Tests added]

## Quality Scores
- All phases passed local quality checks (TypeScript, tests, lint)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
Co-Authored-By: Codex <noreply@openai.com>
EOF
)" 2>/dev/null || echo "No uncommitted changes"
```

### 5.2 Create Pull Request and Trigger Greptile Review

```bash
# Push branch to remote
git push -u origin $(git branch --show-current)

# Create PR with comprehensive description
PR_URL=$(gh pr create --title "Implement: $TASK_TITLE" --body "$(cat <<'EOF'
## Summary
[Brief description of what was implemented]

## Changes
- Phase 1: [Summary]
- Phase 2: [Summary]
- ...

## Quality Assurance
- All phases passed local quality checks (TypeScript, tests, lint)
- Greptile review will run automatically on this PR

## Test Plan
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Manual testing completed

---
Generated with Claude+Codex Hybrid Workflow
EOF
)")

# Extract PR number from URL
PR_NUMBER=$(echo "$PR_URL" | grep -oE '[0-9]+$')
echo "Created PR #$PR_NUMBER: $PR_URL"

# Greptile will automatically review the PR when configured as a GitHub App
# You can also manually trigger a review:
# mcp__greptile__trigger_code_review name="owner/repo" remote="github" prNumber=$PR_NUMBER

echo "Greptile review will run automatically on PR #$PR_NUMBER"
```

### 5.3 Monitor Greptile Review (Optional)

After PR creation, Greptile automatically reviews if configured as a GitHub App.
To check review status:

```bash
# List recent reviews
mcp__greptile__list_code_reviews

# Get specific PR review details
mcp__greptile__get_merge_request name="owner/repo" remote="github" defaultBranch="main" prNumber=$PR_NUMBER

# Check Greptile comments on the PR
mcp__greptile__list_merge_request_comments name="owner/repo" remote="github" defaultBranch="main" prNumber=$PR_NUMBER greptileGenerated=true
```

### 5.4 Update Memory with Learnings

```
Use mcp__mcp-server__mcp__memory_add to store:
- Key decisions made during implementation
- Patterns discovered or established
- Lessons learned
- Technology choices and rationale
```

### 5.5 Close Main Beads Task

```bash
bd state "$MAIN_TASK" closed 2>/dev/null || true
echo "Task $MAIN_TASK completed"
```

---

## Execution Instructions

**You (Claude) are the PARENT PROCESS orchestrating this entire workflow.**

Codex is a powerful but stateless child process. YOU must:
- **Control the flow** - Decide when to spawn Codex and what to ask it
- **Handle MCP operations** - Only you can use Greptile, Context7, Memory
- **Manage state** - Persist context in .codex-state/ between Codex calls
- **Run quality gates** - Local checks (tests, lint, types) after each phase; Greptile on PR
- **Handle user interaction** - Only you can use AskUser

### Step-by-Step Orchestration

```
┌─ PHASE 1: Context (YOU do this) ────────────────────────────────┐
│  1. Query Greptile for codebase understanding                   │
│  2. Query Context7 for library docs if needed                   │
│  3. Query Memory for past decisions                             │
│  4. Initialize Beads: bd init && bd create main task            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─ PHASE 2: Clarification (YOU do this) ──────────────────────────┐
│  1. Use AskUser to ask 3-6 targeted questions                   │
│  2. Compile requirements from answers                           │
│  3. Save requirements to .codex-state/requirements.json         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─ PHASE 3: Planning (Spawn Codex) ───────────────────────────────┐
│  YOU: Craft comprehensive prompt with all MCP context           │
│  YOU: Launch `codex exec --full-auto ...`                       │
│  CODEX: Creates spec.md, plan.md, Beads tasks                   │
│  YOU: Verify plan completeness, parse phases                    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─ PHASE 4: Implementation Loop (YOU orchestrate) ────────────────┐
│  FOR EACH PHASE in plan:                                        │
│    YOU: Save state snapshot                                     │
│    YOU: Launch Codex for implementation                         │
│    CODEX: Implements phase, uses Beads                          │
│    YOU: Run Greptile quality check                              │
│    IF score < 5:                                                │
│      YOU: Launch Codex with feedback to fix                     │
│      YOU: Re-check (max 3 attempts)                             │
│    YOU: Git commit for phase                                    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─ PHASE 5: Finalization (YOU do this) ───────────────────────────┐
│  1. Final git commit with comprehensive message                 │
│  2. Create PR if requested (gh pr create)                       │
│  3. Update Memory with learnings (mcp__memory_add)              │
│  4. Close main Beads task                                       │
└─────────────────────────────────────────────────────────────────┘
```

### Key Principles

| Principle | Why |
|-----------|-----|
| **Never skip clarification** | User input shapes the entire implementation |
| **Quality gate is mandatory** | Each phase must achieve 5/5 before proceeding |
| **State is preserved** | .codex-state/ allows recovery from Codex context compaction |
| **You control Codex** | It's a tool you wield, not an equal partner |
| **Track everything** | Beads provides visibility into progress |

### What Codex Cannot Do (You Must Handle)

- ❌ Query Greptile for codebase search
- ❌ Query Context7 for documentation
- ❌ Access Memory for past decisions
- ❌ Ask user questions interactively
- ❌ Run quality gates on its own output
- ❌ Make git commits (you do this after verifying)
- ❌ Create PRs
- ❌ Persist state between invocations

### What Codex Does Well (Spawn It For)

- ✅ Extended reasoning (xhigh effort)
- ✅ Reading/writing multiple files
- ✅ Code generation and implementation
- ✅ Running tests and builds
- ✅ Using Beads for task tracking
- ✅ Creating Spec Kit artifacts
- ✅ Autonomous execution (--full-auto)

---

**BEGIN NOW: Execute Phase 1 - gather context using YOUR MCP tools (Greptile, Context7, Memory).**
