# Session Summary Generator

Generate a comprehensive session summary for continuing work in a future coding session.

## Instructions

Create a detailed summary of the current coding session that includes:

### 1. Session Overview
- What was the main goal/task for this session?
- What features or fixes were worked on?

### 2. Completed Work
List all completed tasks with:
- File paths modified
- Brief description of changes
- Key code sections or patterns used

### 3. In-Progress Work
For any incomplete tasks:
- Current state of implementation
- What remains to be done
- Any blockers or dependencies

### 4. Technical Context
- Important architectural decisions made
- New patterns or conventions introduced
- API endpoints added or modified
- Database schema changes (if any)

### 5. Key Files Modified
List the most important files that were changed, with line numbers for critical sections:
```
- path/to/file.ts:XX-YY - Description of change
```

### 6. Environment & Configuration
- Any new environment variables needed
- Configuration changes
- Dependencies added

### 7. Testing Status
- What was tested?
- Any known issues or failing tests?

### 8. Next Steps
Prioritized list of what should be done next:
1. First priority task
2. Second priority task
...

### 9. Important Notes
- Any gotchas or edge cases discovered
- Performance considerations
- Security considerations

---

**Format the summary in a way that can be directly used as context for a new Claude Code session.**

Provide the summary in a code block so it can be easily copied. 