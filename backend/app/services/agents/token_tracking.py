"""
Token Usage Tracking Utility

Provides functions to calculate costs from token counts and aggregate
costs across multiple agent calls.

Pricing (Claude Sonnet 4.5):
- Input: $3.00 per 1M tokens
- Output: $15.00 per 1M tokens
"""

from typing import TypedDict, Optional
import structlog

logger = structlog.get_logger(__name__)


# Pricing constants (USD per 1M tokens)
INPUT_PRICE_PER_MILLION = 3.0
OUTPUT_PRICE_PER_MILLION = 15.0


class TokenUsage(TypedDict):
    """Token usage for a single API call."""
    input_tokens: int
    output_tokens: int
    estimated_cost_usd: float


class TokenUsageSummary(TypedDict):
    """Aggregated token usage across multiple calls."""
    total_input_tokens: int
    total_output_tokens: int
    total_cost_usd: float
    call_count: int


def calculate_cost(input_tokens: int, output_tokens: int) -> float:
    """
    Calculate the estimated cost in USD from token counts.

    Args:
        input_tokens: Number of input tokens
        output_tokens: Number of output tokens

    Returns:
        Estimated cost in USD
    """
    input_cost = (input_tokens / 1_000_000) * INPUT_PRICE_PER_MILLION
    output_cost = (output_tokens / 1_000_000) * OUTPUT_PRICE_PER_MILLION
    return round(input_cost + output_cost, 6)


def create_token_usage(input_tokens: int, output_tokens: int) -> TokenUsage:
    """
    Create a TokenUsage dict from token counts.

    Args:
        input_tokens: Number of input tokens
        output_tokens: Number of output tokens

    Returns:
        TokenUsage dict with tokens and cost
    """
    return TokenUsage(
        input_tokens=input_tokens,
        output_tokens=output_tokens,
        estimated_cost_usd=calculate_cost(input_tokens, output_tokens)
    )


def aggregate_token_usage(usages: list[TokenUsage]) -> TokenUsageSummary:
    """
    Aggregate multiple token usage records into a summary.

    Args:
        usages: List of TokenUsage dicts

    Returns:
        TokenUsageSummary with totals
    """
    total_input = sum(u.get("input_tokens", 0) for u in usages)
    total_output = sum(u.get("output_tokens", 0) for u in usages)

    return TokenUsageSummary(
        total_input_tokens=total_input,
        total_output_tokens=total_output,
        total_cost_usd=calculate_cost(total_input, total_output),
        call_count=len(usages)
    )


def log_token_usage(
    agent_name: str,
    input_tokens: int,
    output_tokens: int,
    pursuit_id: Optional[str] = None
) -> None:
    """
    Log token usage with structlog.

    Args:
        agent_name: Name of the agent
        input_tokens: Number of input tokens
        output_tokens: Number of output tokens
        pursuit_id: Optional pursuit ID for context
    """
    cost = calculate_cost(input_tokens, output_tokens)

    logger.info(
        "token_usage",
        agent=agent_name,
        input_tokens=input_tokens,
        output_tokens=output_tokens,
        estimated_cost_usd=cost,
        pursuit_id=pursuit_id
    )
