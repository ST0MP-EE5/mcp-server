---
name: require-tests-reminder
enabled: false
event: stop
conditions:
  - field: transcript
    operator: contains
    pattern: "function"
action: warn
---

**Testing Reminder**

You've been writing code that includes functions.

Before finishing:
- Have you added unit tests?
- Have you run the existing test suite?
- Are edge cases covered?

Run tests with: `npm test`
