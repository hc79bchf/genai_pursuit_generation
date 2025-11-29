# Documentation and Codebase Review

Perform a comprehensive review of all documentation and codebase to ensure accuracy and consistency.

## Review Checklist

### 1. CLAUDE.md Review
Check `/CLAUDE.md` for:
- [ ] Correct model names (should be `claude-sonnet-4-5-20250929`)
- [ ] Accurate development status (what's implemented vs not started)
- [ ] Correct file paths and locations
- [ ] Up-to-date commands and instructions
- [ ] Accurate architecture descriptions
- [ ] Current performance targets and status

### 2. README.md Review
Check `/README.md` for:
- [ ] Accurate project description
- [ ] Correct setup instructions
- [ ] Working Docker commands
- [ ] Valid environment variable list
- [ ] Correct API endpoints documented

### 3. Technical Documentation
Review these files for accuracy:
- [ ] `/PRD.md` - Product requirements
- [ ] `/technical-architecture.md` - System architecture
- [ ] `/api-specification.md` - API endpoints
- [ ] `/database-schema.md` - Database design

### 4. Backend Code Consistency
Verify:
- [ ] All agents use correct model (`claude-sonnet-4-5-20250929`)
- [ ] API endpoints match documentation
- [ ] Database models match schema docs
- [ ] Environment variables in `config.py` match docs

### 5. Frontend Code Consistency
Verify:
- [ ] API calls match backend endpoints
- [ ] Component structure matches architecture
- [ ] Environment variables documented

### 6. Docker Configuration
Check:
- [ ] `docker-compose.yml` services match docs
- [ ] Port mappings are correct
- [ ] Environment variables are documented

### 7. Cross-Reference Validation
Ensure consistency between:
- [ ] CLAUDE.md ↔ README.md
- [ ] API docs ↔ Backend routes
- [ ] Database schema docs ↔ SQLAlchemy models
- [ ] Frontend API calls ↔ Backend endpoints

## Output Format

Provide a detailed report with:

1. **Summary**: Overall documentation health score (1-10)

2. **Issues Found**: List each issue with:
   - File path
   - Line number (if applicable)
   - Current (incorrect) content
   - Suggested correction

3. **Inconsistencies**: Cross-reference conflicts between files

4. **Missing Documentation**: Features/code without docs

5. **Outdated Information**: Content that needs updating

6. **Recommendations**: Prioritized list of fixes

## Instructions

1. Read all documentation files listed above
2. Cross-reference with actual codebase
3. Check for outdated information, typos, and inconsistencies
4. Generate a comprehensive report
5. Offer to fix critical issues automatically

**Focus on accuracy over completeness - it's better to flag potential issues than to miss real problems.**
