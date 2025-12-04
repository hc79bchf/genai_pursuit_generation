"""
Research Agent

Conducts web research for coverage gaps identified by the Gap Analysis Agent.
Filters and prioritizes results based on pursuit metadata (industry, technology, service type).

Memory Types Used:
- Short-term (Redis): Current gaps, active search queries
- Long-term (PostgreSQL): Reliable sources by domain, effective search patterns
- Episodic (ChromaDB): Past search results quality, source reliability scores
"""

import os
import re
import time
import json
import asyncio
import hashlib
from typing import TypedDict, Any, Optional
from urllib.parse import urlparse

import anthropic
from anthropic import AsyncAnthropic
import structlog

logger = structlog.get_logger(__name__)

from app.services.memory.short_term import ShortTermMemoryService
from app.services.memory.long_term import LongTermMemoryService
from app.services.memory.episodic import EpisodicMemoryService
from app.services.agents.token_tracking import calculate_cost, log_token_usage
from app.schemas.stage_review import PipelineStage


# Constants
MODEL_NAME = "claude-sonnet-4-5-20250929"
MAX_TOKENS = 8192
MAX_SEARCH_RESULTS_PER_GAP = 5
MAX_ARXIV_RESULTS_PER_GAP = 3
MAX_RESEARCH_TIME_MS = 120000  # 120 seconds target
ARXIV_SEARCH_TIMEOUT_MS = 30000  # 30 seconds for arxiv searches

# Arxiv MCP Configuration
ARXIV_MCP_CONFIG = {
    "command": "uv",
    "args": ["tool", "run", "arxiv-mcp-server"],
}


def get_arxiv_storage_path() -> str:
    """Get the storage path for arxiv papers."""
    return os.getenv("ARXIV_STORAGE_PATH", os.path.expanduser("~/.arxiv-mcp-server/papers"))


# Industry to Arxiv category mapping
INDUSTRY_ARXIV_CATEGORIES = {
    "Healthcare": ["cs.AI", "cs.LG", "cs.CL", "q-bio.QM"],
    "Financial Services": ["cs.AI", "cs.LG", "q-fin.ST", "q-fin.RM", "q-fin.CP"],
    "Technology": ["cs.AI", "cs.LG", "cs.SE", "cs.DC", "cs.NI"],
    "Manufacturing": ["cs.AI", "cs.RO", "cs.SY", "eess.SY"],
    "Government": ["cs.AI", "cs.CY", "cs.CR"],
    "Energy": ["cs.AI", "cs.SY", "eess.SY", "physics.soc-ph"],
    "Retail": ["cs.AI", "cs.LG", "cs.IR", "stat.ML"],
}

# Technology to Arxiv category mapping
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

# Default categories when no specific mapping exists
DEFAULT_ARXIV_CATEGORIES = ["cs.AI", "cs.LG", "cs.SE"]


# =============================================================================
# HITL Helper Functions
# =============================================================================


def extract_gaps_from_review(reviewed_output: Optional[dict]) -> tuple[list[dict], list[dict]]:
    """
    Extract gaps and research queries from a human-reviewed gap analysis output.

    Args:
        reviewed_output: The corrected output from EditTrackingMemory.get_corrected_output()

    Returns:
        Tuple of (gaps list, research_queries list)
    """
    if not reviewed_output:
        return [], []

    gaps = reviewed_output.get("gaps", [])
    research_queries = reviewed_output.get("research_queries", [])

    return gaps, research_queries


def merge_gap_analysis(
    original: dict,
    corrected_gaps: Optional[list[dict]],
    corrected_queries: Optional[list[dict]]
) -> dict:
    """
    Merge corrected gap analysis data with original.

    Corrected gaps/queries override original values. Other fields from original
    are preserved.

    Args:
        original: Original gap analysis report
        corrected_gaps: Corrected gaps list (may be None or empty)
        corrected_queries: Corrected research queries list (may be None or empty)

    Returns:
        Merged gap analysis report
    """
    merged = original.copy()

    # Use corrected gaps if provided and non-empty
    if corrected_gaps:
        merged["gaps"] = corrected_gaps

    # Use corrected queries if provided and non-empty
    if corrected_queries:
        merged["research_queries"] = corrected_queries

    return merged


async def apply_hitl_corrections(
    gap_analysis_report: dict,
    edit_tracking: Optional[Any],
    pursuit_id: Optional[str],
) -> dict:
    """
    Apply human-reviewed corrections to gap analysis report.

    Checks EditTrackingMemory for a reviewed gap analysis output and merges
    any corrections with the original report.

    Args:
        gap_analysis_report: Original gap analysis report
        edit_tracking: EditTrackingMemory instance (optional)
        pursuit_id: Pursuit ID for lookup (optional)

    Returns:
        Gap analysis report with human corrections applied (if any)
    """
    if not edit_tracking or not pursuit_id:
        return gap_analysis_report

    has_review = await edit_tracking.has_review(
        pursuit_id=pursuit_id,
        stage=PipelineStage.gap_analysis,
    )

    if not has_review:
        return gap_analysis_report

    corrected_output = await edit_tracking.get_corrected_output(
        pursuit_id=pursuit_id,
        stage=PipelineStage.gap_analysis,
    )

    if not corrected_output:
        return gap_analysis_report

    corrected_gaps, corrected_queries = extract_gaps_from_review(corrected_output)
    effective_gap_analysis = merge_gap_analysis(
        gap_analysis_report, corrected_gaps, corrected_queries
    )

    logger.info(
        "using_human_reviewed_gap_analysis",
        pursuit_id=pursuit_id,
        original_gaps_count=len(gap_analysis_report.get("gaps", [])),
        corrected_gaps_count=len(corrected_gaps) if corrected_gaps else 0,
    )

    return effective_gap_analysis


class SourceInfo(TypedDict):
    """Information about a web or academic source."""
    url: str
    title: str
    domain: str
    snippet: str
    relevance_score: float
    metadata_match_score: float
    source_type: str  # "web" or "academic"


class ResearchFinding(TypedDict):
    """Research finding for a single gap."""
    gap: str
    query_used: str
    findings: list[dict]
    sources: list[SourceInfo]
    confidence: float


class ResearchResult(TypedDict):
    """Complete result from research agent."""
    findings: list[ResearchFinding]
    total_sources_evaluated: int
    total_sources_used: int
    total_academic_sources: int  # Count of arxiv/academic sources
    total_web_sources: int  # Count of web sources
    processing_time_ms: int
    input_tokens: int
    output_tokens: int
    estimated_cost_usd: float


class ResearchMemory:
    """Memory services for Research Agent.

    Memory Types:
    - Short-term (Redis): Current gaps being researched, active queries
    - Long-term (PostgreSQL): Reliable sources by industry/service, effective search patterns
    - Episodic (ChromaDB): Past research quality scores, source reliability history
    """

    def __init__(
        self,
        redis_url: str = "redis://localhost:6379/0",
        database_url: Optional[str] = None,
        chroma_persist_dir: str = "./chroma_data"
    ):
        self.short_term = ShortTermMemoryService(redis_url)
        self.long_term = LongTermMemoryService(
            database_url or os.getenv("DATABASE_URL", "postgresql+asyncpg://localhost/pursuit_db")
        )
        self.episodic = EpisodicMemoryService(
            persist_directory=chroma_persist_dir,
            collection_name="research_episodes"
        )

    # Short-term memory methods
    async def store_current_gaps(self, session_id: str, gaps: list[dict]) -> None:
        """Store current gaps being researched in session."""
        await self.short_term.store(
            session_id=session_id,
            key="current_gaps",
            value=gaps,
            ttl=3600
        )

    async def store_active_query(self, session_id: str, query: str, gap: str) -> None:
        """Store currently active search query."""
        await self.short_term.store(
            session_id=session_id,
            key="active_query",
            value={"query": query, "gap": gap},
            ttl=600
        )

    async def get_session_context(self, session_id: str) -> dict:
        """Get current session context for research."""
        gaps = await self.short_term.retrieve(session_id, "current_gaps")
        active = await self.short_term.retrieve(session_id, "active_query")
        return {
            "current_gaps": gaps,
            "active_query": active
        }

    # Long-term memory methods
    async def get_reliable_sources(self, industry: str, service_type: str) -> list[dict]:
        """Get reliable sources for given industry and service type."""
        patterns = await self.long_term.retrieve_patterns(
            pattern_type="reliable_source",
            filters={"industry": industry, "service_type": service_type}
        )
        return patterns

    async def get_effective_search_patterns(self, industry: str, service_type: str) -> list[dict]:
        """Get search patterns that have worked well historically."""
        patterns = await self.long_term.retrieve_patterns(
            pattern_type="search_pattern",
            filters={"industry": industry, "service_type": service_type}
        )
        return patterns

    async def store_source_reliability(
        self,
        domain: str,
        industry: str,
        service_type: str,
        reliability_score: float
    ) -> None:
        """Store or update source reliability score."""
        await self.long_term.store_pattern(
            pattern_type="reliable_source",
            pattern={
                "domain": domain,
                "industry": industry,
                "service_type": service_type,
                "reliability_score": reliability_score
            }
        )

    # Episodic memory methods
    async def store_research_episode(
        self,
        pursuit_id: str,
        gap: str,
        query: str,
        findings: list[dict],
        quality_score: float
    ) -> None:
        """Store a research episode for future learning."""
        episode_id = hashlib.md5(f"{pursuit_id}:{gap}:{query}".encode()).hexdigest()
        await self.episodic.store(
            memory_id=episode_id,
            content=f"Research for gap: {gap}. Query: {query}",
            metadata={
                "pursuit_id": pursuit_id,
                "gap": gap,
                "query": query,
                "findings_count": len(findings),
                "quality_score": quality_score,
                "timestamp": time.time()
            },
            value={
                "findings": findings,
                "quality_score": quality_score
            }
        )

    async def get_similar_research(self, gap: str, limit: int = 3) -> list[dict]:
        """Get similar past research episodes for learning."""
        results = await self.episodic.search(
            query=gap,
            n_results=limit,
            filter_metadata={"quality_score": {"$gte": 0.7}}
        )
        return results

    async def update_research_quality(
        self,
        pursuit_id: str,
        gap: str,
        query: str,
        quality_score: float,
        feedback: Optional[str] = None
    ) -> None:
        """Update quality score for a research episode based on user feedback."""
        episode_id = hashlib.md5(f"{pursuit_id}:{gap}:{query}".encode()).hexdigest()
        existing = await self.episodic.retrieve(episode_id)
        if existing:
            value = existing.get("value", {})
            value["quality_score"] = quality_score
            value["feedback"] = feedback
            await self.episodic.store(
                memory_id=episode_id,
                content=f"Research for gap: {gap}. Query: {query}",
                metadata={
                    "pursuit_id": pursuit_id,
                    "gap": gap,
                    "query": query,
                    "quality_score": quality_score
                },
                value=value
            )


# Industry-specific source domains
INDUSTRY_SOURCES = {
    "Healthcare": [
        "healthit.gov", "cms.gov", "nih.gov", "who.int", "healthaffairs.org",
        "modernhealthcare.com", "beckershospitalreview.com", "himss.org"
    ],
    "Financial Services": [
        "federalreserve.gov", "sec.gov", "finra.org", "bloomberg.com",
        "reuters.com", "wsj.com", "ft.com", "risk.net"
    ],
    "Technology": [
        "techcrunch.com", "wired.com", "zdnet.com", "infoworld.com",
        "computerworld.com", "cio.com", "techrepublic.com"
    ],
    "Manufacturing": [
        "industryweek.com", "manufacturingglobal.com", "nist.gov",
        "asme.org", "sme.org", "mmsonline.com"
    ],
    "Government": [
        "gsa.gov", "acquisition.gov", "sam.gov", "govtech.com",
        "gcn.com", "nextgov.com", "fedscoop.com"
    ]
}

# Technology-specific documentation sources
TECHNOLOGY_SOURCES = {
    "Microsoft Azure": ["docs.microsoft.com", "azure.microsoft.com", "learn.microsoft.com"],
    "AWS": ["docs.aws.amazon.com", "aws.amazon.com"],
    "Google Cloud": ["cloud.google.com"],
    "ServiceNow": ["docs.servicenow.com", "servicenow.com"],
    "Salesforce": ["developer.salesforce.com", "help.salesforce.com"],
    "SAP": ["help.sap.com", "sap.com"],
    "Workday": ["doc.workday.com", "workday.com"]
}


def _get_preferred_domains(metadata: dict) -> list[str]:
    """Get preferred source domains based on pursuit metadata."""
    domains = []

    industry = metadata.get("industry", "")
    if industry in INDUSTRY_SOURCES:
        domains.extend(INDUSTRY_SOURCES[industry])

    technologies = metadata.get("technologies", [])
    for tech in technologies:
        if tech in TECHNOLOGY_SOURCES:
            domains.extend(TECHNOLOGY_SOURCES[tech])

    return list(set(domains))


def _calculate_metadata_match(source: dict, metadata: dict, preferred_domains: list[str]) -> float:
    """Calculate how well a source matches the pursuit metadata."""
    score = 0.5

    domain = urlparse(source.get("url", "")).netloc.replace("www.", "")
    if any(pref in domain for pref in preferred_domains):
        score += 0.3

    industry = metadata.get("industry", "").lower()
    content = (source.get("title", "") + " " + source.get("snippet", "")).lower()
    if industry and industry in content:
        score += 0.1

    technologies = metadata.get("technologies", [])
    for tech in technologies:
        if tech.lower() in content:
            score += 0.05

    return min(score, 1.0)


RESEARCH_PROMPT = """You are a research agent tasked with finding information to fill gaps in a proposal response.

Your goal is to find accurate, relevant information from the provided web search results to address each gap.

## Instructions:
1. For each gap, analyze the search results provided
2. Extract key information that addresses the gap
3. Prioritize information from authoritative sources
4. Focus on facts, methodologies, best practices, and statistics
5. Note the source for each piece of information

## Metadata Context:
- Industry: {industry}
- Service Types: {service_types}
- Technologies: {technologies}
- Geography: {geography}

## Important:
- Only extract information that is directly relevant to the gap
- Do not make up or infer information not present in the sources
- Rate your confidence in each finding
- Prefer industry-specific and technology-specific sources

## Gaps to Research:
{gaps_and_results}

Return your findings as a JSON object with this structure:
{{
  "findings": [
    {{
      "gap": "the gap being addressed",
      "query_used": "the search query used",
      "extracted_info": [
        {{
          "content": "extracted information",
          "source_url": "url of the source",
          "confidence": 0.85,
          "relevance": "explanation of how this addresses the gap"
        }}
      ],
      "overall_confidence": 0.8
    }}
  ]
}}

If no relevant information is found for a gap, include it with an empty extracted_info array and confidence of 0.0.
"""


async def research_agent(
    gap_analysis_report: dict,
    metadata: dict,
    memory: Optional[ResearchMemory] = None,
    session_id: Optional[str] = None,
    pursuit_id: Optional[str] = None,
    edit_tracking: Optional[Any] = None,
) -> ResearchResult:
    """
    Research Agent - Conducts web research for coverage gaps.

    Args:
        gap_analysis_report: Output from Gap Analysis Agent containing gaps and research_queries
        metadata: Pursuit metadata (industry, service_types, technologies, geography)
        memory: Optional ResearchMemory instance for memory-enhanced research
        session_id: Optional session ID for short-term memory
        pursuit_id: Optional pursuit ID for episodic memory
        edit_tracking: Optional EditTrackingMemory for HITL integration

    Returns:
        ResearchResult with findings for each gap, sources, and processing time
    """
    start_time = time.time()

    # HITL Integration: Apply any human-reviewed corrections to gap analysis
    effective_gap_analysis = await apply_hitl_corrections(
        gap_analysis_report, edit_tracking, pursuit_id
    )

    gaps = effective_gap_analysis.get("gaps", [])
    research_queries = effective_gap_analysis.get("research_queries", [])

    # Handle empty gaps case
    if not gaps and not research_queries:
        return ResearchResult(
            findings=[],
            total_sources_evaluated=0,
            total_sources_used=0,
            processing_time_ms=int((time.time() - start_time) * 1000)
        )

    preferred_domains = _get_preferred_domains(metadata)

    # Memory integration
    if memory and session_id:
        await memory.store_current_gaps(session_id, gaps)

        industry = metadata.get("industry", "")
        service_types = metadata.get("service_types", [])
        primary_service = service_types[0] if service_types else ""

        reliable_sources = await memory.get_reliable_sources(industry, primary_service)
        await memory.get_effective_search_patterns(industry, primary_service)

        for source in reliable_sources:
            if source.get("domain"):
                preferred_domains.append(source["domain"])

    # Build query-to-gap mapping
    query_gap_map = {}
    for rq in research_queries:
        query_gap_map[rq.get("query", "")] = rq.get("target_gap", "")

    # Generate queries if not provided
    if not research_queries and gaps:
        research_queries = []
        for gap in gaps:
            gap_req = gap.get("requirement", "")
            industry = metadata.get("industry", "")
            technologies = metadata.get("technologies", [])
            tech_str = " ".join(technologies[:2]) if technologies else ""

            query = f"{industry} {gap_req} {tech_str} best practices".strip()
            research_queries.append({"query": query, "target_gap": gap_req})
            query_gap_map[query] = gap_req

    # Execute combined web + arxiv searches
    all_search_results = await _execute_all_searches(
        research_queries,
        metadata,
        preferred_domains
    )

    # Build prompt with search results
    gaps_and_results = _format_gaps_and_results(research_queries, all_search_results, query_gap_map)

    # Call Claude to analyze and extract findings
    client = AsyncAnthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

    prompt = RESEARCH_PROMPT.format(
        industry=metadata.get("industry", "Not specified"),
        service_types=", ".join(metadata.get("service_types", [])) or "Not specified",
        technologies=", ".join(metadata.get("technologies", [])) or "Not specified",
        geography=metadata.get("geography", "Not specified"),
        gaps_and_results=gaps_and_results
    )

    response = await client.messages.create(
        model=MODEL_NAME,
        max_tokens=MAX_TOKENS,
        messages=[{"role": "user", "content": prompt}]
    )

    response_text = response.content[0].text
    findings_data = _parse_research_response(response_text)

    # Extract token usage
    input_tokens = response.usage.input_tokens
    output_tokens = response.usage.output_tokens
    estimated_cost = calculate_cost(input_tokens, output_tokens)

    # Log token usage
    log_token_usage(
        agent_name="research",
        input_tokens=input_tokens,
        output_tokens=output_tokens,
        pursuit_id=pursuit_id
    )

    # Debug: log parsed findings
    findings_list = findings_data.get("findings", [])
    logger.debug(
        "research_analysis_parsed",
        findings_count=len(findings_list),
        response_length=len(response_text),
        has_findings="findings" in findings_data,
        first_finding_keys=list(findings_list[0].keys()) if findings_list else [],
        first_finding_confidence=findings_list[0].get("overall_confidence", "NOT_FOUND") if findings_list else None
    )

    # Build final result
    findings = []
    total_sources_evaluated = 0
    total_sources_used = 0
    total_academic_sources = 0
    total_web_sources = 0

    for finding in findings_data.get("findings", []):
        gap = finding.get("gap", "")
        query = finding.get("query_used", "")
        extracted = finding.get("extracted_info", [])
        confidence = finding.get("overall_confidence", 0.0)

        search_results = all_search_results.get(query, [])
        total_sources_evaluated += len(search_results)

        sources = []
        for info in extracted:
            url = info.get("source_url", "")
            for sr in search_results:
                if sr.get("url") == url:
                    source_type = sr.get("source_type", "web")
                    sources.append(SourceInfo(
                        url=url,
                        title=sr.get("title", ""),
                        domain=urlparse(url).netloc,
                        snippet=sr.get("snippet", ""),
                        relevance_score=info.get("confidence", 0.5),
                        metadata_match_score=_calculate_metadata_match(sr, metadata, preferred_domains),
                        source_type=source_type
                    ))
                    total_sources_used += 1
                    if source_type == "academic":
                        total_academic_sources += 1
                    else:
                        total_web_sources += 1
                    break

        research_finding = ResearchFinding(
            gap=gap,
            query_used=query,
            findings=[{
                "content": info.get("content", ""),
                "relevance": info.get("relevance", ""),
                "confidence": info.get("confidence", 0.5)
            } for info in extracted],
            sources=sources,
            confidence=confidence
        )
        findings.append(research_finding)

        # Store in episodic memory
        if memory and pursuit_id:
            await memory.store_research_episode(
                pursuit_id=pursuit_id,
                gap=gap,
                query=query,
                findings=research_finding["findings"],
                quality_score=confidence
            )

    processing_time_ms = int((time.time() - start_time) * 1000)

    return ResearchResult(
        findings=findings,
        total_sources_evaluated=total_sources_evaluated,
        total_sources_used=total_sources_used,
        total_academic_sources=total_academic_sources,
        total_web_sources=total_web_sources,
        processing_time_ms=processing_time_ms,
        input_tokens=input_tokens,
        output_tokens=output_tokens,
        estimated_cost_usd=estimated_cost
    )


async def _execute_searches(
    research_queries: list[dict],
    metadata: dict,
    preferred_domains: list[str],
    max_retries: int = 2,
    retry_delay: float = 1.0,
    rate_limit_delay: float = 0.5,
    timeout_ms: int = MAX_RESEARCH_TIME_MS
) -> dict[str, list[dict]]:
    """
    Execute web searches for each research query using Claude API web search.

    Uses Claude's built-in web search tool to find relevant information.
    Retries with exponential backoff on failure, returns empty results if all retries fail.
    Enforces overall timeout and rate limiting between requests.
    """
    results = {}
    client = AsyncAnthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
    start_time = time.time()
    timeout_seconds = timeout_ms / 1000

    for i, rq in enumerate(research_queries):
        # Check overall timeout
        elapsed = time.time() - start_time
        if elapsed >= timeout_seconds:
            logger.warning(
                "web_search_timeout",
                elapsed_ms=int(elapsed * 1000),
                timeout_ms=timeout_ms,
                queries_completed=i,
                queries_total=len(research_queries)
            )
            # Return empty results for remaining queries
            for remaining_rq in research_queries[i:]:
                results[remaining_rq.get("query", "")] = []
            break

        query = rq.get("query", "")
        search_results = []

        # Rate limiting between searches (skip for first query)
        if i > 0:
            await asyncio.sleep(rate_limit_delay)

        for attempt in range(max_retries + 1):
            try:
                # Use Claude API web search
                response = await client.messages.create(
                    model=MODEL_NAME,
                    max_tokens=4096,
                    tools=[{
                        "type": "web_search_20250305",
                        "name": "web_search",
                        "max_uses": MAX_SEARCH_RESULTS_PER_GAP
                    }],
                    messages=[{
                        "role": "user",
                        "content": f"Search the web for: {query}\n\nReturn the top {MAX_SEARCH_RESULTS_PER_GAP} most relevant results."
                    }]
                )

                # Parse search results from response
                search_results = _parse_web_search_response(response, metadata, preferred_domains)
                break  # Success, exit retry loop

            except Exception as e:
                if attempt < max_retries:
                    # Exponential backoff before retry
                    wait_time = retry_delay * (2 ** attempt)
                    logger.warning(
                        "web_search_retry",
                        query=query,
                        attempt=attempt + 1,
                        max_retries=max_retries,
                        wait_time=wait_time,
                        error=str(e)
                    )
                    await asyncio.sleep(wait_time)
                else:
                    # All retries exhausted, return empty results
                    logger.error(
                        "web_search_failed",
                        query=query,
                        total_attempts=max_retries + 1,
                        error=str(e)
                    )
                    search_results = []

        results[query] = search_results

    return results


def _parse_web_search_response(
    response: anthropic.types.Message,
    metadata: dict,
    preferred_domains: list[str]
) -> list[dict]:
    """Parse Claude's web search response to extract search results.

    NOTE: The web search tool response format (web_search_20250305) should be verified
    against actual Claude API responses. The expected block types are:
    - server_tool_use: Indicates web search was invoked
    - server_tool_result: Contains the actual search results
    - web_search_result: Individual search result with url, title, snippet

    If the API response format differs, this parser will need adjustment.
    """
    search_results = []

    # Debug: log response structure
    logger.debug(
        "web_search_response_structure",
        content_blocks=len(response.content),
        block_types=[getattr(b, 'type', 'unknown') for b in response.content]
    )

    for block in response.content:
        # Handle server tool use blocks (web search results)
        if hasattr(block, 'type') and block.type == 'server_tool_use':
            if hasattr(block, 'name') and block.name == 'web_search':
                # Web search was invoked - results will be in subsequent blocks
                continue

        # Handle server tool result blocks
        if hasattr(block, 'type') and block.type == 'server_tool_result':
            if hasattr(block, 'content'):
                for content_block in block.content:
                    if hasattr(content_block, 'type') and content_block.type == 'web_search_result':
                        # Extract search result
                        result = {
                            "url": getattr(content_block, 'url', ''),
                            "title": getattr(content_block, 'title', ''),
                            "snippet": getattr(content_block, 'snippet', getattr(content_block, 'encrypted_content', ''))
                        }
                        if result["url"]:
                            search_results.append(result)

        # Handle web_search_tool_result blocks (Claude API web search format)
        if hasattr(block, 'type') and block.type == 'web_search_tool_result':
            # Extract search results from the web_search_tool_result block
            if hasattr(block, 'content'):
                for content_block in block.content:
                    # Handle individual search result items
                    if hasattr(content_block, 'type') and content_block.type == 'web_search_result':
                        result = {
                            "url": getattr(content_block, 'url', ''),
                            "title": getattr(content_block, 'title', ''),
                            "snippet": getattr(content_block, 'snippet', getattr(content_block, 'page_content', ''))
                        }
                        if result["url"]:
                            search_results.append(result)
                            logger.debug(
                                "web_search_result_extracted",
                                url=result["url"][:60],
                                has_snippet=bool(result["snippet"])
                            )

        # Handle text blocks that might contain formatted results
        if hasattr(block, 'type') and block.type == 'text':
            # Try to extract any URLs mentioned in text response
            text = block.text
            # Look for markdown links or plain URLs
            url_pattern = r'https?://[^\s\)\]<>"]+'
            urls_found = re.findall(url_pattern, text)

            for url in urls_found[:MAX_SEARCH_RESULTS_PER_GAP]:
                if not any(r.get('url') == url for r in search_results):
                    search_results.append({
                        "url": url,
                        "title": f"Search result from {urlparse(url).netloc}",
                        "snippet": ""
                    })

    return search_results[:MAX_SEARCH_RESULTS_PER_GAP]


def _generate_simulated_results(query: str, metadata: dict, preferred_domains: list[str]) -> list[dict]:
    """Generate simulated search results for testing purposes."""
    industry = metadata.get("industry", "General")

    # Create realistic simulated results based on query and metadata
    simulated = []

    if "HIPAA" in query or "compliance" in query.lower():
        simulated.append({
            "url": "https://healthit.gov/topic/privacy-security-and-hipaa/security-risk-assessment",
            "title": "HIPAA Security Risk Assessment - HealthIT.gov",
            "snippet": "The HIPAA Security Rule requires covered entities to conduct risk assessments to identify vulnerabilities and implement appropriate safeguards."
        })
        simulated.append({
            "url": "https://cms.gov/Regulations-and-Guidance/Administrative-Simplification/HIPAA-ACA",
            "title": "HIPAA Administrative Simplification - CMS",
            "snippet": "Comprehensive guide to HIPAA compliance requirements including privacy, security, and breach notification rules."
        })

    if "patient portal" in query.lower():
        simulated.append({
            "url": "https://healthit.gov/topic/health-it-and-health-information-exchange-basics/patient-portals",
            "title": "Patient Portals - HealthIT.gov",
            "snippet": "Patient portals provide secure online access to personal health information. Best practices for implementation and security."
        })

    if "azure" in query.lower() or "Microsoft Azure" in metadata.get("technologies", []):
        simulated.append({
            "url": "https://docs.microsoft.com/en-us/azure/compliance/offerings/offering-hipaa-us",
            "title": "Azure HIPAA Compliance - Microsoft Docs",
            "snippet": "Microsoft Azure provides HIPAA-compliant cloud services with Business Associate Agreements and comprehensive security controls."
        })

    # Add generic results if none specific
    if not simulated:
        simulated.append({
            "url": f"https://example.com/{industry.lower()}-best-practices",
            "title": f"{industry} Best Practices Guide",
            "snippet": f"Comprehensive guide to {industry.lower()} industry standards and best practices for enterprise implementations."
        })

    return simulated[:MAX_SEARCH_RESULTS_PER_GAP]


# =============================================================================
# Arxiv MCP Integration Functions
# =============================================================================


def _get_arxiv_categories(metadata: dict) -> list[str]:
    """
    Get relevant arxiv categories based on pursuit metadata.

    Maps industry and technology keywords to arxiv category codes.

    Args:
        metadata: Pursuit metadata with industry and technologies

    Returns:
        List of arxiv category codes (e.g., ["cs.AI", "cs.LG"])
    """
    categories = set()

    # Add categories based on industry
    industry = metadata.get("industry", "")
    if industry in INDUSTRY_ARXIV_CATEGORIES:
        categories.update(INDUSTRY_ARXIV_CATEGORIES[industry])

    # Add categories based on technologies
    technologies = metadata.get("technologies", [])
    for tech in technologies:
        if tech in TECHNOLOGY_ARXIV_CATEGORIES:
            categories.update(TECHNOLOGY_ARXIV_CATEGORIES[tech])
        # Check for partial matches
        for key, cats in TECHNOLOGY_ARXIV_CATEGORIES.items():
            if key.lower() in tech.lower() or tech.lower() in key.lower():
                categories.update(cats)

    # Return default categories if none found
    if not categories:
        return DEFAULT_ARXIV_CATEGORIES.copy()

    return list(categories)


def _parse_arxiv_result(mcp_result: dict) -> dict:
    """
    Parse an arxiv paper result from MCP response into standard format.

    Args:
        mcp_result: Raw result from arxiv MCP server

    Returns:
        Standardized paper dict with url, title, snippet, arxiv_id, etc.
    """
    paper_id = mcp_result.get("paper_id", mcp_result.get("id", ""))

    return {
        "url": f"https://arxiv.org/abs/{paper_id}",
        "title": mcp_result.get("title", "Untitled Paper"),
        "snippet": mcp_result.get("abstract", mcp_result.get("summary", "")),
        "arxiv_id": paper_id,
        "authors": mcp_result.get("authors", []),
        "published": mcp_result.get("published", mcp_result.get("date", "")),
        "categories": mcp_result.get("categories", []),
        "source_type": "academic",
    }


async def _get_arxiv_mcp_session():
    """
    Create and initialize an MCP session for the arxiv server.

    Returns:
        Initialized MCP ClientSession

    Raises:
        ConnectionError: If unable to connect to MCP server
    """
    try:
        from mcp import ClientSession, StdioServerParameters
        from mcp.client.stdio import stdio_client

        storage_path = get_arxiv_storage_path()
        server_params = StdioServerParameters(
            command=ARXIV_MCP_CONFIG["command"],
            args=ARXIV_MCP_CONFIG["args"] + ["--storage-path", storage_path],
        )

        return stdio_client(server_params)
    except Exception as e:
        logger.error("arxiv_mcp_connection_failed", error=str(e))
        raise ConnectionError(f"Failed to connect to arxiv MCP server: {e}")


async def _call_arxiv_search(
    session,
    query: str,
    categories: list[str],
    max_results: int = MAX_ARXIV_RESULTS_PER_GAP,
) -> list[dict]:
    """
    Call the arxiv MCP server's search_papers tool.

    Args:
        session: MCP ClientSession
        query: Search query string
        categories: List of arxiv category codes to filter by
        max_results: Maximum number of results to return

    Returns:
        List of parsed paper results
    """
    try:
        result = await session.call_tool(
            "search_papers",
            arguments={
                "query": query,
                "max_results": max_results,
                "categories": categories,
            }
        )

        # Parse the result content
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

        return [_parse_arxiv_result(p) for p in papers[:max_results]]
    except Exception as e:
        logger.warning("arxiv_search_call_failed", query=query, error=str(e))
        return []


async def _execute_arxiv_searches(
    research_queries: list[dict],
    metadata: dict,
    timeout_ms: int = ARXIV_SEARCH_TIMEOUT_MS,
) -> dict[str, list[dict]]:
    """
    Execute arxiv searches for each research query using MCP.

    Args:
        research_queries: List of query dicts with 'query' and 'target_gap' keys
        metadata: Pursuit metadata for category filtering
        timeout_ms: Timeout in milliseconds for the entire operation

    Returns:
        Dict mapping query strings to lists of paper results
    """
    results = {}
    categories = _get_arxiv_categories(metadata)

    for rq in research_queries:
        query = rq.get("query", "")
        results[query] = []

        try:
            # Try to connect to MCP server and search
            # Using wait_for for Python 3.9 compatibility (asyncio.timeout added in 3.11)
            async def _perform_arxiv_search():
                try:
                    mcp_context = await _get_arxiv_mcp_session()
                    async with mcp_context as (read, write):
                        from mcp import ClientSession
                        async with ClientSession(read, write) as session:
                            await session.initialize()
                            papers = await _call_arxiv_search(
                                session, query, categories, MAX_ARXIV_RESULTS_PER_GAP
                            )
                            return papers
                except ConnectionError as e:
                    logger.warning("arxiv_mcp_unavailable", query=query, error=str(e))
                    return []

            papers = await asyncio.wait_for(
                _perform_arxiv_search(),
                timeout=timeout_ms / 1000
            )
            results[query] = papers
            logger.debug(
                "arxiv_search_completed",
                query=query[:50],
                papers_found=len(papers),
            )

        except asyncio.TimeoutError:
            logger.warning("arxiv_search_timeout", query=query, timeout_ms=timeout_ms)
            results[query] = []
        except Exception as e:
            logger.error("arxiv_search_error", query=query, error=str(e))
            results[query] = []

    return results


async def _execute_web_searches(
    research_queries: list[dict],
    metadata: dict,
    preferred_domains: list[str],
    max_retries: int = 2,
    retry_delay: float = 1.0,
    rate_limit_delay: float = 0.5,
    timeout_ms: int = MAX_RESEARCH_TIME_MS
) -> dict[str, list[dict]]:
    """
    Execute web searches for each research query using Claude API web search.

    This is a renamed version of the original _execute_searches function.
    """
    results = {}
    client = AsyncAnthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
    start_time = time.time()
    timeout_seconds = timeout_ms / 1000

    for i, rq in enumerate(research_queries):
        # Check overall timeout
        elapsed = time.time() - start_time
        if elapsed >= timeout_seconds:
            logger.warning(
                "web_search_timeout",
                elapsed_ms=int(elapsed * 1000),
                timeout_ms=timeout_ms,
                queries_completed=i,
                queries_total=len(research_queries)
            )
            # Return empty results for remaining queries
            for remaining_rq in research_queries[i:]:
                results[remaining_rq.get("query", "")] = []
            break

        query = rq.get("query", "")
        search_results = []

        # Rate limiting between searches (skip for first query)
        if i > 0:
            await asyncio.sleep(rate_limit_delay)

        for attempt in range(max_retries + 1):
            try:
                # Use Claude API web search
                response = await client.messages.create(
                    model=MODEL_NAME,
                    max_tokens=4096,
                    tools=[{
                        "type": "web_search_20250305",
                        "name": "web_search",
                        "max_uses": MAX_SEARCH_RESULTS_PER_GAP
                    }],
                    messages=[{
                        "role": "user",
                        "content": f"Search the web for: {query}\n\nReturn the top {MAX_SEARCH_RESULTS_PER_GAP} most relevant results."
                    }]
                )

                # Parse search results from response
                search_results = _parse_web_search_response(response, metadata, preferred_domains)
                # Mark as web sources
                for sr in search_results:
                    sr["source_type"] = "web"
                break  # Success, exit retry loop

            except Exception as e:
                if attempt < max_retries:
                    # Exponential backoff before retry
                    wait_time = retry_delay * (2 ** attempt)
                    logger.warning(
                        "web_search_retry",
                        query=query,
                        attempt=attempt + 1,
                        max_retries=max_retries,
                        wait_time=wait_time,
                        error=str(e)
                    )
                    await asyncio.sleep(wait_time)
                else:
                    # All retries exhausted, return empty results
                    logger.error(
                        "web_search_failed",
                        query=query,
                        total_attempts=max_retries + 1,
                        error=str(e)
                    )
                    search_results = []

        results[query] = search_results

    return results


async def _execute_all_searches(
    research_queries: list[dict],
    metadata: dict,
    preferred_domains: list[str],
) -> dict[str, list[dict]]:
    """
    Execute both web and arxiv searches in parallel and combine results.

    Args:
        research_queries: List of query dicts
        metadata: Pursuit metadata
        preferred_domains: Preferred domains for web search

    Returns:
        Combined dict mapping queries to merged results (web + arxiv)
    """
    # Run web and arxiv searches in parallel
    try:
        web_task = asyncio.create_task(
            _execute_web_searches(research_queries, metadata, preferred_domains)
        )
        arxiv_task = asyncio.create_task(
            _execute_arxiv_searches(research_queries, metadata)
        )

        # Wait for both with individual error handling
        web_results = {}
        arxiv_results = {}

        try:
            web_results = await web_task
        except Exception as e:
            logger.error("web_search_task_failed", error=str(e))
            for rq in research_queries:
                web_results[rq.get("query", "")] = []

        try:
            arxiv_results = await arxiv_task
        except Exception as e:
            logger.error("arxiv_search_task_failed", error=str(e))
            for rq in research_queries:
                arxiv_results[rq.get("query", "")] = []

        # Combine results
        combined = {}
        for rq in research_queries:
            query = rq.get("query", "")
            web_items = web_results.get(query, [])
            arxiv_items = arxiv_results.get(query, [])
            combined[query] = web_items + arxiv_items

        logger.info(
            "combined_search_completed",
            queries=len(research_queries),
            total_web_results=sum(len(v) for v in web_results.values()),
            total_arxiv_results=sum(len(v) for v in arxiv_results.values()),
        )

        return combined

    except Exception as e:
        logger.error("execute_all_searches_failed", error=str(e))
        # Return empty results for all queries
        return {rq.get("query", ""): [] for rq in research_queries}


def _format_gaps_and_results(
    research_queries: list[dict],
    search_results: dict[str, list[dict]],
    query_gap_map: dict[str, str]
) -> str:
    """Format gaps and search results for the LLM prompt."""
    sections = []

    for i, rq in enumerate(research_queries, 1):
        query = rq.get("query", "")
        gap = query_gap_map.get(query, rq.get("target_gap", "Unknown gap"))
        results = search_results.get(query, [])

        section = f"""
### Gap {i}: {gap}
**Search Query:** {query}

**Search Results:**
"""

        if results:
            for j, result in enumerate(results, 1):
                section += f"""
{j}. **{result.get('title', 'Untitled')}**
   URL: {result.get('url', '')}
   Snippet: {result.get('snippet', 'No snippet available')}
"""
        else:
            section += "\nNo search results available.\n"

        sections.append(section)

    return "\n".join(sections)


def _parse_research_response(response_text: str) -> dict:
    """Parse the LLM response to extract findings."""
    json_match = re.search(r'\{[\s\S]*\}', response_text)
    if json_match:
        try:
            parsed = json.loads(json_match.group())
            logger.debug(
                "research_response_json_parsed",
                findings_count=len(parsed.get("findings", [])),
                json_length=len(json_match.group())
            )
            return parsed
        except json.JSONDecodeError as e:
            logger.warning(
                "research_response_json_error",
                error=str(e),
                json_preview=json_match.group()[:500]
            )

    logger.warning(
        "research_response_no_json",
        response_preview=response_text[:500]
    )
    return {"findings": []}


# Learning functions
async def update_research_quality(
    memory: ResearchMemory,
    pursuit_id: str,
    gap: str,
    query: str,
    quality_score: float,
    feedback: Optional[str] = None
) -> None:
    """Update research quality based on user feedback."""
    await memory.update_research_quality(
        pursuit_id=pursuit_id,
        gap=gap,
        query=query,
        quality_score=quality_score,
        feedback=feedback
    )


async def update_source_reliability(
    memory: ResearchMemory,
    domain: str,
    industry: str,
    service_type: str,
    reliability_score: float
) -> None:
    """Update reliability score for a source domain."""
    await memory.store_source_reliability(
        domain=domain,
        industry=industry,
        service_type=service_type,
        reliability_score=reliability_score
    )
