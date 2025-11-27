# Brave API Search Issue - Diagnosis & Solution

## Problem Identified

**Issue:** Deep Search not returning good results

**Root Cause:** Brave API Rate Limiting

---

## Diagnosis Results

### Test 1: Direct API Calls
```
Query 1: "client organization strategic goals"
✅ Status: 200 - SUCCESS
✅ Results: 5 high-quality results returned

Query 2: "AWS cloud migration best practices 2024"
❌ Status: 429 - RATE LIMITED
❌ Error: "Request rate limit exceeded for plan"

Query 3: "enterprise software development timeline"
❌ Status: 429 - RATE LIMITED
❌ Error: "Request rate limit exceeded for plan"
```

### Test 2: With Rate Limiting Delays (2 seconds between requests)
```
Query 1: "AWS cloud migration pricing models"
✅ Status: 200 - SUCCESS
✅ Results: 3 results

Query 2: "enterprise software development timeline"
✅ Status: 200 - SUCCESS (after 2-second delay)
✅ Results: 3 results

Query 3: "cloud security compliance requirements"
✅ Status: 200 - SUCCESS (after 2-second delay)
✅ Results: 3 results
```

---

## Brave API Rate Limits (Free Plan)

From the error response:
```json
{
  "plan": "Free",
  "rate_limit": 1,          // ⚠️ Only 1 request per second
  "rate_current": 1,
  "quota_limit": 2000,      // 2000 requests per month
  "quota_current": 5,
  "component": "rate_limiter"
}
```

**Key Constraints:**
- **Rate Limit:** 1 request per second
- **Monthly Quota:** 2,000 requests
- **Current Usage:** 5 requests used

---

## Why Deep Search Fails

The Research Agent (`backend/app/services/ai_service/research_agent.py`) loops through multiple search queries sequentially:

```python
for query in search_queries:
    # Perform web search
    search_results = await self._brave_search(query, count=max_results_per_query)
    # Process results...
```

**Problem:** When there are multiple queries (e.g., 5-6 gaps), the agent makes rapid consecutive API calls:
1. Query 1: ✅ Success
2. Query 2: ❌ Rate limited (429)
3. Query 3: ❌ Rate limited (429)
4. Query 4: ❌ Rate limited (429)
5. Query 5: ❌ Rate limited (429)

**Result:** Only the first query gets results, rest fail with 429 errors.

---

## Solutions

### Solution 1: Add Rate Limiting Delays (Recommended)

Modify `research_agent.py` line 79-92 to add delays between requests:

```python
for i, query in enumerate(search_queries):
    logger.info(f"Researching query: {query}")

    # Add delay between requests to respect rate limits (except for first query)
    if i > 0:
        logger.info(f"Waiting 1.5 seconds to respect Brave API rate limits...")
        await asyncio.sleep(1.5)  # 1.5 seconds = safe buffer

    # Perform web search
    search_results = await self._brave_search(query, count=max_results_per_query)
    # ... rest of code
```

**Pros:**
- Simple fix
- Works with free tier
- No additional costs

**Cons:**
- Slower execution (1.5 seconds per query)
- With 5 queries = ~7.5 seconds total

---

### Solution 2: Upgrade Brave API Plan

Upgrade to a paid plan for higher rate limits:

**Free Plan:** 1 req/sec, 2,000/month
**Paid Plans:** Higher limits available

**Pros:**
- Faster execution
- No delays needed
- More monthly requests

**Cons:**
- Monthly cost
- May be overkill for development

---

### Solution 3: Implement Retry Logic with Exponential Backoff

Add retry logic when hitting 429 errors:

```python
async def _brave_search_with_retry(self, query: str, count: int = 5, max_retries: int = 3):
    for attempt in range(max_retries):
        try:
            result = await self._brave_search(query, count)
            if result:  # Success
                return result
        except Exception as e:
            if "429" in str(e) and attempt < max_retries - 1:
                wait_time = (2 ** attempt) * 1.5  # 1.5s, 3s, 6s
                logger.warning(f"Rate limited, waiting {wait_time}s...")
                await asyncio.sleep(wait_time)
            else:
                raise
    return []
```

**Pros:**
- Handles rate limits gracefully
- Automatic recovery

**Cons:**
- More complex
- Still slows down on rate limits

---

## Recommended Implementation

**For immediate fix (Development):** Use Solution 1

Add to `research_agent.py` around line 79:

```python
import asyncio  # Add at top if not already imported

async def research(self, ...):
    # ... existing code ...

    for i, query in enumerate(search_queries):
        logger.info(f"Researching query {i+1}/{len(search_queries)}: {query}")

        # Respect Brave API rate limits (1 req/sec for free tier)
        if i > 0:
            await asyncio.sleep(1.5)  # 1.5 second delay between requests

        # Perform web search
        search_results = await self._brave_search(query, count=max_results_per_query)

        # ... rest of existing code ...
```

---

## Testing the Fix

After implementing the delay:

```bash
# Test the research agent
docker exec pursuit_backend python -c "
import asyncio
from app.services.ai_service.research_agent import ResearchAgent
from app.services.ai_service.llm_service import LLMService

async def test():
    queries = [
        'cloud migration timeline',
        'cloud migration pricing',
        'cloud migration security'
    ]

    context = {
        'entity_name': 'Test Corp',
        'industry': 'Technology'
    }

    llm = LLMService()
    agent = ResearchAgent(llm)

    result = await agent.research(queries, context, 'test-user', max_results_per_query=3)

    print('Results:', len(result['research_results']))
    for r in result['research_results']:
        print(f\"- {r['query']}: {len(r['results'])} results\")

asyncio.run(test())
"
```

**Expected Output:**
```
Results: 3
- cloud migration timeline: 3 results
- cloud migration pricing: 3 results
- cloud migration security: 3 results
```

---

## Performance Impact

### Without Fix:
- Time: ~3 seconds (all requests fire immediately)
- Success Rate: 1/5 queries (20%)
- Results: Poor

### With Fix (1.5s delays):
- Time: ~9 seconds for 5 queries (1.5s × 4 delays + processing)
- Success Rate: 5/5 queries (100%)
- Results: Excellent

**Trade-off:** Slightly slower but much more reliable results.

---

## Alternative: Batch Processing

For production, consider batching queries:

```python
# Instead of 5 sequential queries, process in smaller batches
batch_size = 1  # One at a time for free tier
for i in range(0, len(queries), batch_size):
    batch = queries[i:i+batch_size]
    await process_batch(batch)
    await asyncio.sleep(1.5)  # Delay between batches
```

---

## Monitoring

Add logging to track rate limit issues:

```python
async def _brave_search(self, query: str, count: int = 5):
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(...) as response:
                if response.status == 429:
                    logger.error(f"RATE LIMITED: {query}")
                    # Log rate limit info for monitoring
                    return []
                # ... rest of code
```

---

## Current API Usage

From error message:
- **Used:** 5 requests
- **Remaining:** 1,995 requests this month
- **Rate:** 1 request per second (free tier)

**Plenty of quota remaining** - just need to slow down the request rate!

---

## Summary

| Issue | Impact | Fix |
|-------|--------|-----|
| Rate Limiting | Only first query succeeds | Add 1.5s delays between queries |
| Empty Results | Poor user experience | Implement retry logic |
| 429 Errors | Agent fails silently | Add error handling & logging |

**Recommended Action:** Implement Solution 1 (add delays) immediately for development testing.

---

**Last Updated:** 2025-11-26
**API Plan:** Brave Search API - Free Tier
**Rate Limit:** 1 request/second
**Status:** Diagnosed - Fix ready to implement
