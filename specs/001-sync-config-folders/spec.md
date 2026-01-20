# Feature Specification: Sync Config Folders

**Feature Branch**: `001-sync-config-folders`
**Created**: 2026-01-19
**Status**: Draft
**Input**: User description: "Sync project folders with mcp-server.yaml configuration - remove unused plugins and ensure only configured MCPs, skills, plugins, and hooks remain"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Clean Plugins Folder (Priority: P1)

As a developer, I want the plugins/ folder to only contain plugins that are defined in mcp-server.yaml, so that the repository stays clean and doesn't include unused code.

**Why this priority**: The plugins folder is the largest source of unused files. Cleaning it first provides the most immediate value by reducing repository size and confusion.

**Independent Test**: Can be fully tested by comparing plugins/ folder contents against mcp-server.yaml plugins section and verifying only configured plugins remain.

**Acceptance Scenarios**:

1. **Given** mcp-server.yaml defines plugins: hookify, ralph-loop, **When** sync is performed, **Then** only those plugin directories plus code-simplifier (referenced by skills) remain in plugins/
2. **Given** plugins/ contains directories not listed in mcp-server.yaml, **When** sync is performed, **Then** those directories are removed
3. **Given** a plugin is referenced in both plugins section and skills section, **When** sync is performed, **Then** that plugin is retained

---

### User Story 2 - Preserve Hook Rules (Priority: P2)

As a developer, I want the hooks/ folder to retain reusable hook rule files that work with the hookify plugin, while understanding these are templates not runtime hooks.

**Why this priority**: The hooks/ folder contains reusable rule templates documented in SETUP.md. These are separate from the plugin hook handlers in plugins/hookify/hooks/.

**Independent Test**: Verify hooks/ contains the documented rule files that match SETUP.md documentation.

**Acceptance Scenarios**:

1. **Given** hooks/ contains rule files (*.local.md), **When** sync is verified, **Then** rule files matching SETUP.md documentation are preserved
2. **Given** hooks/ is documented as containing reusable rules, **When** a user copies a rule to .claude/, **Then** the hookify plugin can use it

---

### User Story 3 - Verify Skills References (Priority: P3)

As a developer, I want skills defined in mcp-server.yaml to point to files that actually exist in the repository.

**Why this priority**: Skills reference specific markdown files. Ensuring these references are valid prevents runtime errors.

**Independent Test**: For each skill in mcp-server.yaml, verify the referenced file path exists.

**Acceptance Scenarios**:

1. **Given** mcp-server.yaml defines skill "code-simplifier" with file "./plugins/code-simplifier/agents/code-simplifier.md", **When** verification runs, **Then** that file exists
2. **Given** a skill references a non-existent file, **When** verification runs, **Then** the issue is reported

---

### Edge Cases

- What happens when a plugin is referenced by a skill but not in the plugins section? Answer: It should be retained (skill dependencies are implicit plugins).
- How does system handle the plugins/external/ subdirectory? Answer: This contains external plugin definitions that may or may not be in use - should be evaluated separately.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST remove plugin directories from plugins/ that are not:
  - Listed in mcp-server.yaml plugins section, OR
  - Referenced by files in mcp-server.yaml skills section
- **FR-002**: System MUST retain plugins/ directories for: hookify, ralph-loop, code-simplifier
- **FR-003**: System MUST preserve hooks/ directory contents (reusable rule templates)
- **FR-004**: System MUST NOT modify mcp-server.yaml during sync
- **FR-005**: System MUST preserve .gitkeep files in otherwise empty directories
- **FR-006**: System MUST handle plugins/external/ subdirectory appropriately (contains external plugin templates)

### Key Entities

- **Plugin**: A directory in plugins/ containing Claude Code plugin code (hooks, commands, agents)
- **Skill**: A markdown file referenced in mcp-server.yaml that provides agent instructions
- **Hook Rule**: A markdown file in hooks/ that defines patterns for hookify plugin to match

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: After sync, plugins/ contains exactly 3 core plugin directories: hookify, ralph-loop, code-simplifier
- **SC-002**: All skills referenced in mcp-server.yaml point to files that exist
- **SC-003**: hooks/ directory retains all 6 documented rule files (dangerous-rm, no-console-log, no-force-push, no-secrets, no-todo-comments, require-tests)
- **SC-004**: Repository size is reduced by removing unused plugin directories

## Assumptions

- The plugins/external/ subdirectory contains reference implementations for third-party integrations and should be evaluated case-by-case
- LSP plugins (typescript-lsp, pyright-lsp, etc.) in plugins/ are not needed since they're used as local MCPs in mcp-server.yaml, not as Claude Code plugins
- The mcp-server.yaml is the single source of truth for what should be retained
