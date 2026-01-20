#!/usr/bin/env python3
"""UserPromptSubmit hook executor for hookify plugin.

This script is called by Claude Code when user submits a prompt.
It reads .claude/hookify.*.local.md files and evaluates rules.
"""

import os
import sys
import json

# Add plugin root to Python path for imports
# First try CLAUDE_PLUGIN_ROOT, then fall back to script directory's parent
PLUGIN_ROOT = os.environ.get('CLAUDE_PLUGIN_ROOT')
if not PLUGIN_ROOT:
    # Get the directory containing this script (hooks/), then go up one level
    PLUGIN_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

if PLUGIN_ROOT not in sys.path:
    sys.path.insert(0, PLUGIN_ROOT)

try:
    from core.config_loader import load_rules
    from core.rule_engine import RuleEngine
except ImportError as e:
    # If imports fail, allow operation silently (don't spam user)
    print(json.dumps({}), file=sys.stdout)
    sys.exit(0)


def main():
    """Main entry point for UserPromptSubmit hook."""
    try:
        # Read input from stdin
        input_data = json.load(sys.stdin)

        # Load user prompt rules
        rules = load_rules(event='prompt')

        # Evaluate rules
        engine = RuleEngine()
        result = engine.evaluate_rules(rules, input_data)

        # Always output JSON (even if empty)
        print(json.dumps(result), file=sys.stdout)

    except Exception as e:
        error_output = {
            "systemMessage": f"Hookify error: {str(e)}"
        }
        print(json.dumps(error_output), file=sys.stdout)

    finally:
        # ALWAYS exit 0
        sys.exit(0)


if __name__ == '__main__':
    main()
