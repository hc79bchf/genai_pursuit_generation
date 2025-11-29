# Comprehensive Code Review

Perform a thorough code review of the entire codebase to identify bugs, issues, defects, and areas for improvement. Generate a remediation plan without implementing fixes.

## Review Scope

### 1. Backend Code Review
Scan all files in `backend/app/`:
- **API Endpoints** (`api/v1/endpoints/`) - Route handlers, request validation, response formatting
- **Services** (`services/`) - Business logic, AI agents, memory services
- **Models** (`models/`) - SQLAlchemy models, relationships, constraints
- **Schemas** (`schemas/`) - Pydantic validation models
- **Core** (`core/`) - Configuration, database, security

### 2. Frontend Code Review
Scan all files in `frontend/src/`:
- **Pages** (`app/`) - Next.js pages and layouts
- **Components** (`components/`) - Reusable UI components
- **Lib** (`lib/`) - Utilities, API client, helpers
- **Store** (`store/`) - State management

### 3. Infrastructure Review
- `docker-compose.yml` - Service configuration
- `Dockerfile` files - Build configurations
- Environment variable usage

## Review Checklist

### Bug Detection
- [ ] Null/undefined reference errors
- [ ] Race conditions in async code
- [ ] Memory leaks (unclosed connections, event listeners)
- [ ] Incorrect error propagation
- [ ] Missing await on async functions
- [ ] Infinite loops or recursion risks
- [ ] Type mismatches
- [ ] Off-by-one errors
- [ ] SQL injection vulnerabilities
- [ ] XSS vulnerabilities

### Error Handling
- [ ] Try-catch blocks around risky operations
- [ ] Proper error messages (not exposing internals)
- [ ] Error recovery mechanisms
- [ ] Graceful degradation
- [ ] Timeout handling for external calls
- [ ] Retry logic for transient failures
- [ ] User-friendly error messages in frontend

### Logging
- [ ] Appropriate log levels (debug, info, warning, error)
- [ ] Sensitive data not logged (passwords, tokens, PII)
- [ ] Request/response logging for debugging
- [ ] Performance metrics logging
- [ ] Error stack traces captured
- [ ] Correlation IDs for tracing

### Code Robustness
- [ ] Input validation on all endpoints
- [ ] Defensive programming (null checks, bounds checking)
- [ ] Resource cleanup (connections, files, streams)
- [ ] Idempotency where needed
- [ ] Rate limiting considerations
- [ ] Concurrent access handling
- [ ] Database transaction management

### Security
- [ ] Authentication on protected routes
- [ ] Authorization checks
- [ ] CORS configuration
- [ ] Secret management
- [ ] Input sanitization
- [ ] Output encoding

### Performance
- [ ] N+1 query problems
- [ ] Unnecessary database calls
- [ ] Missing indexes (inferred from queries)
- [ ] Large payload handling
- [ ] Caching opportunities
- [ ] Async operations where beneficial

## Output Format

Generate a comprehensive report with:

### Executive Summary
- Total issues found by severity (Critical, High, Medium, Low)
- Overall code health assessment

### Issues by Category

For each issue found:
```
### [SEVERITY] Issue Title
**File:** path/to/file.py:line_number
**Category:** Bug | Error Handling | Logging | Security | Performance
**Description:** Clear description of the issue
**Impact:** What could go wrong
**Current Code:**
```python
# problematic code snippet
```
**Remediation:**
- Step-by-step fix instructions
- Code changes needed (but don't implement)
```

### Remediation Plan

Prioritized list of fixes:
1. **Critical** - Must fix immediately (security, data loss)
2. **High** - Fix soon (bugs affecting functionality)
3. **Medium** - Plan to fix (code quality, minor bugs)
4. **Low** - Nice to have (optimization, cleanup)

### Summary Statistics
- Files reviewed
- Lines of code scanned
- Issues by severity
- Issues by category

## Instructions

1. Systematically scan backend and frontend code
2. Use Grep and Read tools to examine files
3. Look for patterns that indicate issues
4. Document each finding with file path and line number
5. Provide clear remediation steps
6. Do NOT implement any fixes - only report

**Focus on actionable findings. Skip trivial style issues unless they indicate deeper problems.**
