"""
Research Agent - Conducts web research using Claude's research capabilities

This agent takes confirmed gaps and the deep research prompt from Gap Analysis,
then uses Claude's web search tool to conduct comprehensive research
and generate actionable insights for the RFP response.

Research Methods:
1. Claude Web Search Tool (web_search_20250305) - For web searches
2. arXiv MCP Server - For academic paper searches
"""

import os
import logging
import time
import json
import re
import asyncio
from typing import List, Dict, Any, Optional
from urllib.parse import urlparse
from pydantic import BaseModel, Field

from anthropic import AsyncAnthropic
from app.core.config import settings
from app.services.ai_service.llm_service import LLMService

logger = logging.getLogger(__name__)


# Configuration Constants
MODEL_NAME = "claude-sonnet-4-5-20250929"
MAX_TOKENS = 8192
MAX_SEARCH_RESULTS_PER_GAP = 5
MAX_ARXIV_RESULTS_PER_GAP = 3
MAX_RESEARCH_TIME_MS = 120000  # 120 seconds
ARXIV_SEARCH_TIMEOUT_MS = 30000  # 30 seconds

# arXiv MCP Configuration
ARXIV_MCP_CONFIG = {
    "command": "uv",
    "args": ["tool", "run", "arxiv-mcp-server"],
}


def get_arxiv_storage_path() -> str:
    """Get the storage path for arxiv papers."""
    return os.getenv("ARXIV_STORAGE_PATH", os.path.expanduser("~/.arxiv-mcp-server/papers"))


# Industry to arXiv category mapping
INDUSTRY_ARXIV_CATEGORIES = {
    "Healthcare": ["cs.AI", "cs.LG", "cs.CL", "q-bio.QM"],
    "Financial Services": ["cs.AI", "cs.LG", "q-fin.ST", "q-fin.RM", "q-fin.CP"],
    "Technology": ["cs.AI", "cs.LG", "cs.SE", "cs.DC", "cs.NI"],
    "Manufacturing": ["cs.AI", "cs.RO", "cs.SY", "eess.SY"],
    "Government": ["cs.AI", "cs.CY", "cs.CR"],
    "Energy": ["cs.AI", "cs.SY", "eess.SY", "physics.soc-ph"],
    "Retail": ["cs.AI", "cs.LG", "cs.IR", "stat.ML"],
}

# Technology to arXiv category mapping
TECHNOLOGY_ARXIV_CATEGORIES = {
    "AI/ML": ["cs.AI", "cs.LG", "cs.CL", "cs.CV", "stat.ML"],
    "Machine Learning": ["cs.LG", "stat.ML", "cs.AI"],
    "Natural Language Processing": ["cs.CL", "cs.AI", "cs.LG"],
    "Cloud": ["cs.DC", "cs.NI", "cs.SE"],
    "DevOps": ["cs.SE", "cs.DC"],
    "Cybersecurity": ["cs.CR", "cs.AI"],
    "Data Analytics": ["cs.DB", "cs.LG", "stat.ML"],
    "Blockchain": ["cs.CR", "cs.DC"],
}

DEFAULT_ARXIV_CATEGORIES = ["cs.AI", "cs.LG", "cs.SE"]


class ResearchFinding(BaseModel):
    """Research finding for a single gap"""
    gap: str = Field(description="The gap being addressed")
    research_area: str = Field(description="The area of research conducted")
    findings: List[Dict[str, Any]] = Field(description="List of findings with content and confidence")
    sources: List[Dict[str, Any]] = Field(default_factory=list, description="Sources used")
    recommendations: List[str] = Field(default_factory=list, description="Actionable recommendations")
    confidence: float = Field(description="Overall confidence score (0-1)", ge=0, le=1)


class ResearchResult(BaseModel):
    """Complete research agent output"""
    findings: List[ResearchFinding] = Field(description="Research findings for each gap")
    overall_summary: str = Field(description="Executive summary of all research")
    key_insights: List[str] = Field(default_factory=list, description="Key insights discovered")
    action_items: List[str] = Field(default_factory=list, description="Prioritized action items")
    total_sources_evaluated: int = Field(default=0)
    total_sources_used: int = Field(default=0)
    total_web_sources: int = Field(default=0)
    total_academic_sources: int = Field(default=0)
    processing_time_ms: int = Field(description="Processing time in milliseconds")


# Research prompt that guides Claude's web search
RESEARCH_SYSTEM_PROMPT = """You are an expert research analyst conducting web research for RFP proposal responses.

Your task is to search the web and academic sources to find relevant, accurate information that addresses the identified gaps.

IMPORTANT GUIDELINES:
1. Use the web search tool to find current, authoritative information
2. Focus on industry-specific sources, official documentation, and best practices
3. Prioritize information from reputable domains (.gov, .edu, major tech companies, industry publications)
4. Extract specific facts, statistics, methodologies, and case studies
5. Always cite your sources with URLs
6. Assess the relevance and confidence of each finding
7. Generate actionable recommendations based on your research
8. If you cannot find relevant information, indicate this clearly

Your response must be valid JSON matching the specified structure."""


RESEARCH_PROMPT_TEMPLATE = """## Research Task

### Pursuit Context
- **Client:** {entity_name}
- **Industry:** {industry}
- **Services Required:** {service_types}
- **Technologies:** {technologies}

### Deep Research Guidance
{deep_research_prompt}

### Gaps to Research
{gaps_list}

### Instructions
For each gap:
1. Use the web search tool to find relevant information
2. Search for industry best practices, case studies, and authoritative sources
3. Extract key findings that address the gap
4. Provide specific, actionable recommendations

### Response Format
Return a JSON object with this structure:
{{
    "findings": [
        {{
            "gap": "The specific gap being addressed",
            "research_area": "Primary area of research",
            "findings": [
                {{
                    "content": "Specific finding or insight from web search",
                    "source_url": "https://example.com/source",
                    "source_title": "Title of the source",
                    "relevance": "How this addresses the gap",
                    "confidence": 0.85
                }}
            ],
            "recommendations": [
                "Specific actionable recommendation based on research"
            ],
            "confidence": 0.8
        }}
    ],
    "overall_summary": "Executive summary of research findings (3-4 sentences)",
    "key_insights": ["Key insight 1", "Key insight 2"],
    "action_items": ["Prioritized action item 1", "Prioritized action item 2"]
}}

Search the web thoroughly for each gap before responding."""


class ResearchAgent:
    """
    Research Agent that conducts web research using Claude's capabilities.

    Uses:
    - Claude's web search tool (web_search_20250305) for live web searches
    - arXiv MCP Server for academic paper searches
    - Deep research prompt to guide search focus

    The agent performs actual web searches, not just uses existing knowledge.
    """

    def __init__(self, llm_service: LLMService):
        self.llm_service = llm_service
        self.client = AsyncAnthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

    async def research(
        self,
        search_queries: List[str],
        pursuit_context: Dict[str, Any],
        user_id: str,
        max_results_per_query: int = 5
    ) -> Dict[str, Any]:
        """
        Conduct research using Claude's web search and arXiv.

        Args:
            search_queries: List of search queries (gap descriptions)
            pursuit_context: Context including deep_research_prompt, metadata
            user_id: User ID for tracking
            max_results_per_query: Max results per query

        Returns:
            Dict containing research findings, sources, summary, and recommendations
        """
        start_time = time.time()

        logger.info(f"Starting research with web search for {len(search_queries)} gaps")

        # Extract context
        entity_name = pursuit_context.get('entity_name', 'Unknown Client')
        industry = pursuit_context.get('industry', 'Not specified')
        service_types = pursuit_context.get('service_types', [])
        technologies = pursuit_context.get('technologies', [])
        deep_research_prompt = pursuit_context.get('deep_research_prompt', '')

        # If no deep research prompt, create a default one
        if not deep_research_prompt:
            deep_research_prompt = self._generate_default_prompt(search_queries, pursuit_context)

        # Format gaps list
        gaps_list = self._format_gaps_list(search_queries)

        # Build the research prompt
        prompt = RESEARCH_PROMPT_TEMPLATE.format(
            entity_name=entity_name,
            industry=industry,
            service_types=', '.join(service_types) if service_types else 'Not specified',
            technologies=', '.join(technologies) if technologies else 'Not specified',
            deep_research_prompt=deep_research_prompt,
            gaps_list=gaps_list
        )

        # Run web search and arXiv search in parallel
        web_task = asyncio.create_task(
            self._execute_web_search_research(prompt, search_queries, pursuit_context)
        )
        arxiv_task = asyncio.create_task(
            self._execute_arxiv_searches(search_queries, pursuit_context)
        )

        # Wait for both
        try:
            web_results = await web_task
        except Exception as e:
            logger.error(f"Web search failed: {e}")
            web_results = {"findings": [], "overall_summary": "", "key_insights": [], "action_items": []}

        try:
            arxiv_results = await arxiv_task
        except Exception as e:
            logger.error(f"arXiv search failed: {e}")
            arxiv_results = {}

        # Merge results
        result = self._merge_results(web_results, arxiv_results, search_queries)

        processing_time_ms = int((time.time() - start_time) * 1000)
        result["processing_time_ms"] = processing_time_ms

        # Convert to legacy format for backward compatibility
        result["research_results"] = self._convert_to_legacy_format(result)

        logger.info(f"Research complete in {processing_time_ms}ms. "
                   f"Found {result.get('total_sources_used', 0)} sources.")

        return result

    async def _execute_web_search_research(
        self,
        prompt: str,
        search_queries: List[str],
        pursuit_context: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Execute research using Claude's web search tool."""
        try:
            # Call Claude with web search tool enabled
            response = await self.client.messages.create(
                model=MODEL_NAME,
                max_tokens=MAX_TOKENS,
                system=RESEARCH_SYSTEM_PROMPT,
                tools=[{
                    "type": "web_search_20250305",
                    "name": "web_search",
                    "max_uses": MAX_SEARCH_RESULTS_PER_GAP * len(search_queries)
                }],
                messages=[{"role": "user", "content": prompt}]
            )

            # Extract the response
            response_text = ""
            sources_found = []

            for block in response.content:
                if hasattr(block, 'type'):
                    if block.type == 'text':
                        response_text = block.text
                    elif block.type == 'web_search_tool_result':
                        # Extract sources from web search results
                        if hasattr(block, 'content'):
                            for content_block in block.content:
                                if hasattr(content_block, 'type') and content_block.type == 'web_search_result':
                                    sources_found.append({
                                        "url": getattr(content_block, 'url', ''),
                                        "title": getattr(content_block, 'title', ''),
                                        "snippet": getattr(content_block, 'snippet', getattr(content_block, 'page_content', '')),
                                        "source_type": "web"
                                    })

            # Parse the JSON response
            result = self._parse_research_response(response_text)

            # Add source counts
            result["total_web_sources"] = len(sources_found)
            result["total_sources_evaluated"] = len(sources_found)

            # Attach sources to findings
            self._attach_sources_to_findings(result, sources_found)

            logger.info(f"Web search found {len(sources_found)} sources")

            return result

        except Exception as e:
            logger.error(f"Web search research failed: {e}", exc_info=True)
            return {
                "findings": [],
                "overall_summary": f"Web search could not be completed: {str(e)}",
                "key_insights": [],
                "action_items": [],
                "total_web_sources": 0
            }

    async def _execute_arxiv_searches(
        self,
        search_queries: List[str],
        pursuit_context: Dict[str, Any]
    ) -> Dict[str, List[Dict]]:
        """Execute arXiv searches for academic papers."""
        results = {}
        categories = self._get_arxiv_categories(pursuit_context)

        for query in search_queries:
            results[query] = []
            try:
                papers = await self._search_arxiv(query, categories)
                results[query] = papers
                logger.debug(f"arXiv found {len(papers)} papers for: {query[:50]}")
            except Exception as e:
                logger.warning(f"arXiv search failed for query: {query[:50]}, error: {e}")

        return results

    async def _search_arxiv(self, query: str, categories: List[str]) -> List[Dict]:
        """Search arXiv for papers matching the query."""
        try:
            # Try to use MCP if available
            mcp_context = await self._get_arxiv_mcp_session()
            async with mcp_context as (read, write):
                from mcp import ClientSession
                async with ClientSession(read, write) as session:
                    await session.initialize()
                    result = await session.call_tool(
                        "search_papers",
                        arguments={
                            "query": query,
                            "max_results": MAX_ARXIV_RESULTS_PER_GAP,
                            "categories": categories,
                        }
                    )

                    papers = []
                    if hasattr(result, 'content'):
                        for content in result.content:
                            if hasattr(content, 'text'):
                                try:
                                    paper_data = json.loads(content.text)
                                    if isinstance(paper_data, list):
                                        papers.extend(paper_data)
                                    elif isinstance(paper_data, dict):
                                        papers.append(paper_data)
                                except json.JSONDecodeError:
                                    continue

                    return [self._parse_arxiv_result(p) for p in papers[:MAX_ARXIV_RESULTS_PER_GAP]]

        except Exception as e:
            logger.warning(f"arXiv MCP unavailable: {e}")
            return []

    async def _get_arxiv_mcp_session(self):
        """Create MCP session for arXiv server."""
        from mcp import ClientSession, StdioServerParameters
        from mcp.client.stdio import stdio_client

        storage_path = get_arxiv_storage_path()
        server_params = StdioServerParameters(
            command=ARXIV_MCP_CONFIG["command"],
            args=ARXIV_MCP_CONFIG["args"] + ["--storage-path", storage_path],
        )
        return stdio_client(server_params)

    def _parse_arxiv_result(self, result: Dict) -> Dict:
        """Parse arXiv paper result into standard format."""
        paper_id = result.get("paper_id", result.get("id", ""))
        return {
            "url": f"https://arxiv.org/abs/{paper_id}",
            "title": result.get("title", "Untitled Paper"),
            "snippet": result.get("abstract", result.get("summary", ""))[:500],
            "arxiv_id": paper_id,
            "authors": result.get("authors", []),
            "published": result.get("published", ""),
            "source_type": "academic"
        }

    def _get_arxiv_categories(self, pursuit_context: Dict) -> List[str]:
        """Get relevant arXiv categories based on pursuit context."""
        categories = set()

        industry = pursuit_context.get("industry", "")
        if industry in INDUSTRY_ARXIV_CATEGORIES:
            categories.update(INDUSTRY_ARXIV_CATEGORIES[industry])

        technologies = pursuit_context.get("technologies", [])
        for tech in technologies:
            if tech in TECHNOLOGY_ARXIV_CATEGORIES:
                categories.update(TECHNOLOGY_ARXIV_CATEGORIES[tech])
            for key, cats in TECHNOLOGY_ARXIV_CATEGORIES.items():
                if key.lower() in tech.lower() or tech.lower() in key.lower():
                    categories.update(cats)

        return list(categories) if categories else DEFAULT_ARXIV_CATEGORIES

    def _merge_results(
        self,
        web_results: Dict,
        arxiv_results: Dict[str, List[Dict]],
        search_queries: List[str]
    ) -> Dict[str, Any]:
        """Merge web search and arXiv results."""
        result = web_results.copy()

        # Count academic sources
        total_academic = sum(len(papers) for papers in arxiv_results.values())
        result["total_academic_sources"] = total_academic
        result["total_sources_used"] = result.get("total_web_sources", 0) + total_academic
        result["total_sources_evaluated"] = result.get("total_sources_evaluated", 0) + total_academic

        # Add arXiv sources to relevant findings
        for finding in result.get("findings", []):
            gap = finding.get("gap", "")
            # Find matching arXiv results
            for query, papers in arxiv_results.items():
                if query.lower() in gap.lower() or gap.lower() in query.lower():
                    for paper in papers:
                        finding.setdefault("sources", []).append(paper)

        return result

    def _attach_sources_to_findings(self, result: Dict, sources: List[Dict]):
        """Attach discovered sources to relevant findings."""
        findings = result.get("findings", [])
        if not findings or not sources:
            return

        # Distribute sources across findings
        sources_per_finding = max(1, len(sources) // len(findings))
        for i, finding in enumerate(findings):
            start_idx = i * sources_per_finding
            end_idx = start_idx + sources_per_finding
            finding_sources = sources[start_idx:end_idx]
            finding.setdefault("sources", []).extend(finding_sources)

    def _generate_default_prompt(self, search_queries: List[str], pursuit_context: Dict[str, Any]) -> str:
        """Generate a default research prompt if none provided."""
        industry = pursuit_context.get('industry', 'the relevant industry')

        prompt_parts = [
            f"Research the following areas for a {industry} client proposal:",
            ""
        ]

        for i, query in enumerate(search_queries, 1):
            prompt_parts.append(f"{i}. {query}")

        prompt_parts.extend([
            "",
            "For each area:",
            "- Search for industry best practices and standards",
            "- Find relevant case studies and success stories",
            "- Identify compliance and regulatory requirements",
            "- Recommend specific implementation approaches"
        ])

        return "\n".join(prompt_parts)

    def _format_gaps_list(self, search_queries: List[str]) -> str:
        """Format the gaps/queries as a numbered list."""
        if not search_queries:
            return "No specific gaps identified."

        formatted = []
        for i, query in enumerate(search_queries, 1):
            formatted.append(f"{i}. {query}")

        return "\n".join(formatted)

    def _parse_research_response(self, response_text: str) -> Dict[str, Any]:
        """Parse the LLM response to extract research findings."""
        # Try to find JSON in the response
        json_match = re.search(r'\{[\s\S]*\}', response_text)

        if json_match:
            try:
                parsed = json.loads(json_match.group())
                logger.debug(f"Parsed research response with {len(parsed.get('findings', []))} findings")
                return parsed
            except json.JSONDecodeError as e:
                logger.warning(f"JSON parse error: {e}")
                # Try to fix common JSON issues
                cleaned = json_match.group()
                cleaned = re.sub(r',(\s*[}\]])', r'\1', cleaned)
                try:
                    return json.loads(cleaned)
                except json.JSONDecodeError:
                    pass

        logger.warning("Could not parse research response as JSON")
        return {
            "findings": [],
            "overall_summary": response_text[:500] if response_text else "No summary available",
            "key_insights": [],
            "action_items": []
        }

    def _convert_to_legacy_format(self, research_data: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Convert research format to legacy format for backward compatibility."""
        legacy_results = []

        for finding in research_data.get("findings", []):
            legacy_result = {
                "query": finding.get("gap", ""),
                "results": [],
                "summary": ""
            }

            # Convert findings to results
            for f in finding.get("findings", []):
                legacy_result["results"].append({
                    "query": finding.get("gap", ""),
                    "url": f.get("source_url", ""),
                    "title": f.get("source_title", finding.get("research_area", "Research Finding")),
                    "snippet": f.get("relevance", ""),
                    "extracted_info": f.get("content", ""),
                    "relevance_score": f.get("confidence", 0.5),
                    "source_type": "web"
                })

            # Add sources from finding
            for source in finding.get("sources", []):
                legacy_result["results"].append({
                    "query": finding.get("gap", ""),
                    "url": source.get("url", ""),
                    "title": source.get("title", ""),
                    "snippet": source.get("snippet", ""),
                    "extracted_info": source.get("snippet", ""),
                    "relevance_score": 0.7,
                    "source_type": source.get("source_type", "web")
                })

            # Build summary
            recommendations = finding.get("recommendations", [])
            if recommendations:
                legacy_result["summary"] = "Recommendations: " + "; ".join(recommendations[:3])
            else:
                legacy_result["summary"] = f"Research conducted on: {finding.get('research_area', 'N/A')}"

            legacy_results.append(legacy_result)

        return legacy_results
