"""Custom exceptions for the application."""


class ValidationError(Exception):
    """Raised when validation fails."""
    pass


class ExtractionError(Exception):
    """Raised when metadata extraction fails."""
    pass


class AgentError(Exception):
    """Raised when an AI agent encounters an error."""
    pass
