# Code Review Skill

When reviewing code, follow this systematic approach:

## 1. Security Review
- Check for SQL injection vulnerabilities
- Look for XSS attack vectors
- Verify proper input validation
- Ensure secrets are not hardcoded
- Check authentication/authorization logic
- Review dependency versions for known CVEs

## 2. Performance Analysis
- Identify N+1 query patterns
- Check for unnecessary re-renders (React)
- Look for memory leaks
- Verify proper caching strategies
- Check for blocking operations in async code

## 3. Code Quality
- Verify single responsibility principle
- Check for code duplication (DRY)
- Ensure proper error handling
- Verify logging is adequate
- Check test coverage

## 4. Maintainability
- Review naming conventions
- Check code organization
- Verify documentation is adequate
- Ensure consistent code style
- Look for dead code

## 5. Output Format

For each issue found, provide:
```
**[SEVERITY: HIGH/MEDIUM/LOW]** - Category
File: path/to/file.ext, Line: XX
Issue: Description of the problem
Recommendation: How to fix it
```

Always start with a brief summary and end with actionable next steps.
