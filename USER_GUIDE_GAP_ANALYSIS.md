# User Guide: Viewing Gap Analysis Results

## System Status
✅ **All systems operational and restarted with Brave API key**
- Backend: Running on http://localhost:8000
- Frontend: Running on http://localhost:3000
- Database: Initialized with test user
- Brave API: Configured and working

---

## How to Access Gap Analysis Results in the UI

### Step 1: Login
1. Navigate to http://localhost:3000
2. You'll be redirected to the login page
3. Enter credentials:
   - **Email:** `test@example.com`
   - **Password:** `password123`
4. Click "Sign In"

### Step 2: Navigate to Gap Assessment
Once logged in, you have two options:

**Option A: Direct URL**
- Go directly to: http://localhost:3000/dashboard/gap-assessment

**Option B: Through Sidebar**
- Look for "Gap Assessment" in the left sidebar
- Click to navigate to the gap assessment page

### Step 3: View or Run Gap Analysis

The Gap Assessment page shows:

**Left Side: RFP Metadata**
- Displays the extracted metadata from your most recent pursuit
- Shows entity name, industry, technologies, etc.

**Right Side: Target Outline**
- Shows your selected proposal template
- Template structure and sections
- Button to "Run Gap Analysis Agent"

**Bottom Section: Analysis Results** (appears after running analysis)
- **Identified Gaps**: Red cards showing missing information
- **Recommended Search Queries**: Blue cards with search queries to fill gaps
- **AI Reasoning**: Explanation of why gaps were identified

---

## Quick Test: Create and Analyze a Pursuit

If you want to test the full workflow from scratch:

### 1. Create a New Pursuit
```bash
# Run this from terminal to create a test pursuit via API
docker exec pursuit_backend python scripts/verify_gap_analysis.py
```

This will:
- Create a new pursuit
- Upload a test RFP file
- Extract metadata
- Run gap analysis
- Display results in ~15-20 seconds

### 2. View Results in UI
1. After running the script, refresh http://localhost:3000/dashboard/gap-assessment
2. You should see:
   - The new pursuit metadata on the left
   - Gap analysis results at the bottom showing:
     - **Gaps identified** (e.g., "Executive Summary", "Pricing")
     - **Search queries** (e.g., "client organization strategic goals")

---

## Sample Gap Analysis Output

Here's what you should see after running analysis:

### Identified Gaps (Red Cards)
```
📍 Executive Summary
📍 Pricing
```

### Recommended Search Queries (Blue Cards)
```
🔍 client organization strategic goals
🔍 client organization pricing models
```

### AI Reasoning
```
The "Extracted Metadata" does not contain information required to
fulfill the "Executive Summary" and "Pricing" sections of the
"Target Proposal Outline". The metadata is missing details on the
client organization's strategic goals and pricing models, which
are critical for these proposal sections.
```

---

## UI Features

### Edit Results
Click the "Edit Results" button to:
- ✏️ Add or remove gaps
- ✏️ Modify search queries
- ✏️ Update reasoning
- 💾 Save changes back to database

### Interactive Search Queries
- Hover over search query cards to see arrow indicator
- Click to navigate to Deep Search page (if implemented)

---

## Troubleshooting

### "Failed to fetch" Error
**Solution:**
1. Clear browser cache and cookies for localhost:3000
2. Check browser console (F12) for detailed errors
3. Verify backend is running:
   ```bash
   curl http://localhost:8000/health
   # Should return: {"status":"healthy"}
   ```

### No Results Showing
**Possible causes:**
1. **No pursuit exists**: Create one using the test script above
2. **Analysis not run yet**: Click "Run Gap Analysis Agent" button
3. **Still processing**: Wait 15-20 seconds and refresh

### Analysis Button Disabled
**Check that:**
1. A pursuit exists (left side should show metadata)
2. A template is selected (right side should show template structure)
3. Not currently analyzing (button shows spinning loader)

---

## API Endpoints for Testing

### Check Pursuit Exists
```bash
# Login and get token
TOKEN=$(curl -s -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=test@example.com&password=password123" | \
  jq -r '.access_token')

# Get all pursuits
curl -s -H "Authorization: Bearer $TOKEN" \
  http://localhost:8000/api/v1/pursuits/ | jq

# Get specific pursuit with gap analysis
curl -s -H "Authorization: Bearer $TOKEN" \
  http://localhost:8000/api/v1/pursuits/YOUR_PURSUIT_ID | jq
```

### Trigger Gap Analysis via API
```bash
# Replace YOUR_PURSUIT_ID with actual ID
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test Template",
    "description": "A test template",
    "details": ["Executive Summary", "Technical Approach", "Pricing"]
  }' \
  http://localhost:8000/api/v1/pursuits/YOUR_PURSUIT_ID/gap-analysis
```

---

## Page URLs Reference

| Page | URL |
|------|-----|
| Login | http://localhost:3000/login |
| Dashboard | http://localhost:3000/dashboard |
| Pursuits List | http://localhost:3000/dashboard/pursuits |
| New Pursuit | http://localhost:3000/dashboard/pursuits/new |
| Gap Assessment | http://localhost:3000/dashboard/gap-assessment |
| Template Library | http://localhost:3000/dashboard/pursuits/library |
| Deep Search | http://localhost:3000/dashboard/deep-search |
| API Docs | http://localhost:8000/docs |

---

## Expected Workflow

```
1. Login with test credentials
   ↓
2. Create new pursuit (or use existing)
   ↓
3. Upload RFP document
   ↓
4. Navigate to Gap Assessment page
   ↓
5. Select a template from library
   ↓
6. Click "Run Gap Analysis Agent"
   ↓
7. Wait 15-20 seconds
   ↓
8. View results: Gaps + Search Queries
   ↓
9. (Optional) Edit and save results
   ↓
10. Use search queries for Deep Search (next step)
```

---

## Current System State

After running the test script earlier, the system should have:
- ✅ One or more test pursuits in the database
- ✅ Gap analysis results stored
- ✅ Ready to view in UI at http://localhost:3000/dashboard/gap-assessment

### To View Results Now:
1. Go to http://localhost:3000
2. Login with `test@example.com` / `password123`
3. Navigate to Gap Assessment page
4. You should see the results from the test run

---

## Need Fresh Data?

Run this to create a new pursuit with gap analysis:

```bash
docker exec pursuit_backend python scripts/verify_gap_analysis.py
```

Then refresh the Gap Assessment page in your browser.

---

**Last Updated:** 2025-11-26
**Frontend:** http://localhost:3000/dashboard/gap-assessment
**Backend Status:** http://localhost:8000/health
