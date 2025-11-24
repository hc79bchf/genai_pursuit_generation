import logging
from typing import Type, TypeVar
from pydantic import BaseModel
from anthropic import AsyncAnthropic
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type
from app.core.config import settings

# Configure logger
logger = logging.getLogger(__name__)

T = TypeVar("T", bound=BaseModel)

class LLMService:
    def __init__(self):
        self.client = AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)
        # Default to fast model, can be overridden
        self.model = settings.LLM_MODEL_FAST 

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=4, max=10),
        retry=retry_if_exception_type(Exception),
        reraise=True
    )
    async def generate_json(self, prompt: str, schema: Type[T], model: str = None) -> T:
        """
        Generates a structured response from the LLM matching the provided Pydantic schema
        using Anthropic's tool use capabilities.
        Includes retry logic for transient errors.
        """
        target_model = model or self.model
        tool_name = schema.__name__
        tool_description = schema.__doc__ or f"Extract {tool_name} data"
        
        # Convert Pydantic schema to Anthropic tool schema
        input_schema = schema.model_json_schema()
        
        tool_definition = {
            "name": tool_name,
            "description": tool_description.strip(),
            "input_schema": input_schema
        }

        try:
            logger.info(f"Sending request to LLM ({target_model}) for tool: {tool_name}")
            
            response = await self.client.messages.create(
                model=target_model,
                max_tokens=4096,
                system="You are a helpful AI assistant. Use the provided tool to extract the requested information.",
                messages=[
                    {"role": "user", "content": prompt}
                ],
                tools=[tool_definition],
                tool_choice={"type": "tool", "name": tool_name},
                temperature=0
            )
            
            # Extract tool use content
            for content_block in response.content:
                if content_block.type == "tool_use" and content_block.name == tool_name:
                    tool_input = content_block.input
                    logger.info(f"Successfully extracted data for {tool_name}")
                    return schema(**tool_input)
            
            error_msg = f"Model did not use the expected tool: {tool_name}"
            logger.error(error_msg)
            raise ValueError(error_msg)
            
        except Exception as e:
            logger.error(f"Error calling LLM: {e}")
            raise e

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=4, max=10),
        retry=retry_if_exception_type(Exception),
        reraise=True
    )
    async def generate_text(self, prompt: str, system: str = None, model: str = None) -> str:
        """
        Generates a free-form text response from the LLM.
        """
        target_model = model or self.model
        system_prompt = system or "You are a helpful AI assistant."

        try:
            logger.info(f"Sending request to LLM ({target_model})")
            
            response = await self.client.messages.create(
                model=target_model,
                max_tokens=4096,
                system=system_prompt,
                messages=[
                    {"role": "user", "content": prompt}
                ],
                temperature=0.7
            )
            
            return response.content[0].text
            
        except Exception as e:
            logger.error(f"Error calling LLM: {e}")
            raise e
