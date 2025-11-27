"""
Research Agent - Performs web searches and extracts relevant information

This agent takes search queries from the Gap Analysis and uses the Brave Search API
to find relevant information, then extracts and summarizes the findings using Claude.
"""

import logging
import asyncio
import json
from typing import List, Dict, Any, Optional
import aiohttp
from pydantic import BaseModel, Field

from app.core.config import settings
from app.services.ai_service.llm_service import LLMService

logger = logging.getLogger(__name__)


class SearchResult(BaseModel):
    """Single search result with extracted information"""
    query: str = Field(description="The original search query")
    url: str = Field(description="URL of the source")
    title: str = Field(description="Title of the source")
    snippet: str = Field(description="Brief snippet from the source")
    extracted_info: str = Field(description="Relevant information extracted from this source")
    relevance_score: float = Field(description="Relevance score (0-1)", ge=0, le=1)


class ResearchResult(BaseModel):
    """Aggregated research results for all queries"""
    query: str = Field(description="The original search query")
    results: List[SearchResult] = Field(description="List of search results for this query")
    summary: str = Field(description="Summary of findings for this query")


class ResearchAgentResult(BaseModel):
    """Complete research agent output"""
    research_results: List[ResearchResult] = Field(description="Research results for each query")
    overall_summary: str = Field(description="Overall summary of all research findings")


class ResearchAgent:
    """
    Research Agent that performs web searches and extracts relevant information

    Uses:
    - Brave Search API for web search
    - Claude Haiku for content extraction and summarization
    """

    def __init__(self, llm_service: LLMService):
        self.llm_service = llm_service
        self.brave_api_key = settings.BRAVE_API_KEY
        self.brave_search_url = "https://api.search.brave.com/res/v1/web/search"

    async def research(
        self,
        search_queries: List[str],
        pursuit_context: Dict[str, Any],
        user_id: str,
        max_results_per_query: int = 5
    ) -> Dict[str, Any]:
        """
        Perform research using search queries from gap analysis

        Args:
            search_queries: List of search queries to research
            pursuit_context: Context about the pursuit (metadata)
            user_id: User ID for memory storage
            max_results_per_query: Max number of results to process per query

        Returns:
            Dict containing research results
        """
        logger.info(f"Starting research for {len(search_queries)} queries")

        all_research_results = []

        for i, query in enumerate(search_queries):
            logger.info(f"Researching query {i+1}/{len(search_queries)}: {query}")

            # Respect Brave API rate limits (1 request per second for free tier)
            # Add delay between requests (except for the first one)
            if i > 0:
                logger.info(f"Waiting 1.5 seconds to respect Brave API rate limits...")
                await asyncio.sleep(1.5)

            # Perform web search
            search_results = await self._brave_search(query, count=max_results_per_query)

            if not search_results:
                logger.warning(f"No search results found for query: {query}")
                all_research_results.append({
                    "query": query,
                    "results": [],
                    "summary": "No relevant information found for this query."
                })
                continue

            # Extract and analyze each result
            extracted_results = []
            for result in search_results:
                extracted_info = await self._extract_relevant_info(
                    query=query,
                    title=result.get("title", ""),
                    snippet=result.get("description", ""),
                    url=result.get("url", ""),
                    pursuit_context=pursuit_context
                )

                if extracted_info:
                    extracted_results.append({
                        "query": query,
                        "url": result.get("url", ""),
                        "title": result.get("title", ""),
                        "snippet": result.get("description", ""),
                        "extracted_info": extracted_info["content"],
                        "relevance_score": extracted_info["relevance_score"]
                    })

            # Summarize findings for this query
            query_summary = await self._summarize_query_findings(
                query=query,
                results=extracted_results,
                pursuit_context=pursuit_context
            )

            all_research_results.append({
                "query": query,
                "results": extracted_results,
                "summary": query_summary
            })

        # Generate overall summary
        overall_summary = await self._generate_overall_summary(
            research_results=all_research_results,
            pursuit_context=pursuit_context
        )

        result = {
            "research_results": all_research_results,
            "overall_summary": overall_summary
        }

        logger.info(f"Research complete. Found {sum(len(r['results']) for r in all_research_results)} total results")

        return result

    async def _brave_search(self, query: str, count: int = 5) -> List[Dict[str, Any]]:
        """
        Perform a web search using Brave Search API

        Args:
            query: Search query
            count: Number of results to return

        Returns:
            List of search results
        """
        if not self.brave_api_key:
            logger.error("BRAVE_API_KEY not configured")
            return []

        headers = {
            "Accept": "application/json",
            "X-Subscription-Token": self.brave_api_key
        }

        params = {
            "q": query,
            "count": count,
            "search_lang": "en",
            "safesearch": "moderate"
        }

        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(
                    self.brave_search_url,
                    headers=headers,
                    params=params,
                    timeout=aiohttp.ClientTimeout(total=10)
                ) as response:
                    if response.status == 200:
                        data = await response.json()
                        results = data.get("web", {}).get("results", [])
                        logger.info(f"Brave search returned {len(results)} results for: {query}")
                        return results
                    elif response.status == 429:
                        error_data = await response.json()
                        logger.error(f"Brave API rate limited for query: {query}")
                        logger.error(f"Rate limit details: {error_data.get('error', {}).get('meta', {})}")
                        return []
                    else:
                        error_text = await response.text()
                        logger.error(f"Brave search failed with status {response.status}: {error_text}")
                        return []
        except Exception as e:
            logger.error(f"Error performing Brave search: {e}", exc_info=True)
            return []

    async def _extract_relevant_info(
        self,
        query: str,
        title: str,
        snippet: str,
        url: str,
        pursuit_context: Dict[str, Any]
    ) -> Optional[Dict[str, Any]]:
        """
        Extract relevant information from a search result

        Args:
            query: Original search query
            title: Result title
            snippet: Result snippet
            url: Result URL
            pursuit_context: Pursuit metadata for context

        Returns:
            Dict with extracted content and relevance score
        """
        prompt = f"""You are analyzing a web search result to extract information relevant to an RFP response.

**Search Query:** {query}

**Pursuit Context:**
- Client: {pursuit_context.get('entity_name', 'Unknown')}
- Industry: {pursuit_context.get('industry', 'Unknown')}
- Services: {', '.join(pursuit_context.get('service_types', []))}
- Technologies: {', '.join(pursuit_context.get('technologies', []))}

**Search Result:**
Title: {title}
URL: {url}
Snippet: {snippet}

**Task:**
1. Extract key information from this result that would be useful for the RFP response
2. Focus on facts, statistics, best practices, or relevant case studies
3. Assess relevance (0-1 scale) based on how useful this is for the proposal

Provide your response as valid JSON with:
- "content": The extracted relevant information (2-3 sentences max)
- "relevance_score": Float between 0 and 1

If the result is not relevant, set relevance_score to 0 and content to empty string.

Return ONLY the JSON object, no other text.
"""

        try:
            response_text = await self.llm_service.generate_text(
                prompt=prompt,
                system="You are a helpful assistant that extracts relevant information from search results. Always respond with valid JSON.",
                model=settings.LLM_MODEL_SMART  # Use Haiku for speed
            )

            # Parse JSON response
            result = json.loads(response_text)
            return result
        except json.JSONDecodeError as e:
            logger.error(f"Error parsing JSON from LLM response: {e}")
            logger.error(f"Response was: {response_text}")
            return None
        except Exception as e:
            logger.error(f"Error extracting info from result: {e}", exc_info=True)
            return None

    async def _summarize_query_findings(
        self,
        query: str,
        results: List[Dict[str, Any]],
        pursuit_context: Dict[str, Any]
    ) -> str:
        """
        Summarize all findings for a single search query

        Args:
            query: Original search query
            results: List of extracted results
            pursuit_context: Pursuit metadata

        Returns:
            Summary text
        """
        if not results:
            return "No relevant information found for this query."

        # Filter results by relevance score
        relevant_results = [r for r in results if r.get("relevance_score", 0) > 0.3]

        if not relevant_results:
            return "No highly relevant information found for this query."

        results_text = "\n\n".join([
            f"Source: {r['title']}\nURL: {r['url']}\nInfo: {r['extracted_info']}"
            for r in relevant_results
        ])

        prompt = f"""Summarize the following research findings for the query: "{query}"

**Pursuit Context:**
- Client: {pursuit_context.get('entity_name', 'Unknown')}
- Industry: {pursuit_context.get('industry', 'Unknown')}

**Research Findings:**
{results_text}

**Task:**
Provide a concise summary (3-4 sentences) of the key findings that would be useful for the RFP response.
Focus on actionable insights and relevant information.
"""

        try:
            summary = await self.llm_service.generate_text(
                prompt=prompt,
                model=settings.LLM_MODEL_SMART
            )
            return summary
        except Exception as e:
            logger.error(f"Error summarizing query findings: {e}", exc_info=True)
            return "Error generating summary."

    async def _generate_overall_summary(
        self,
        research_results: List[Dict[str, Any]],
        pursuit_context: Dict[str, Any]
    ) -> str:
        """
        Generate an overall summary of all research findings

        Args:
            research_results: All research results
            pursuit_context: Pursuit metadata

        Returns:
            Overall summary text
        """
        summaries = "\n\n".join([
            f"Query: {r['query']}\nFindings: {r['summary']}"
            for r in research_results
        ])

        prompt = f"""Provide an executive summary of the following research findings for an RFP response.

**Pursuit Context:**
- Client: {pursuit_context.get('entity_name', 'Unknown')}
- Industry: {pursuit_context.get('industry', 'Unknown')}
- Services: {', '.join(pursuit_context.get('service_types', []))}

**Research Summaries:**
{summaries}

**Task:**
Create a concise executive summary (4-5 sentences) highlighting:
1. Key insights discovered through research
2. How these findings address the gaps in the proposal
3. Main recommendations for the proposal team

Focus on actionable insights.
"""

        try:
            summary = await self.llm_service.generate_text(
                prompt=prompt,
                model=settings.LLM_MODEL_SMART
            )
            return summary
        except Exception as e:
            logger.error(f"Error generating overall summary: {e}", exc_info=True)
            return "Error generating overall summary."
