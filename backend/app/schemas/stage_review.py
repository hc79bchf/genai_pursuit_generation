"""
Stage Review and Edit Tracking schemas for Human-in-the-Loop (HITL) functionality.

These schemas support:
- Human review of agent outputs at each pipeline stage
- Tracking edits/corrections made by users
- Validation suggestions from the Validation Agent
- Pipeline progress tracking

Used by API endpoints in Section 10-12 of api-specification.md v1.4
"""

from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional
from uuid import UUID, uuid4

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


# ============================================================================
# ENUMS
# ============================================================================

class PipelineStage(str, Enum):
    """The 7 agent stages in the pursuit pipeline (in order)."""

    metadata_extraction = "metadata_extraction"
    team_composition = "team_composition"
    similar_pursuit_identification = "similar_pursuit_identification"
    gap_analysis = "gap_analysis"
    research = "research"
    synthesis = "synthesis"
    document_generation = "document_generation"


class EditType(str, Enum):
    """Types of edits users can make to agent outputs."""

    correction = "correction"      # Fixed an error
    enhancement = "enhancement"    # Added detail/clarity
    deletion = "deletion"          # Removed something
    addition = "addition"          # Added new item
    reorder = "reorder"            # Changed sequence


class ApprovalStatus(str, Enum):
    """Review outcomes for a stage."""

    approved = "approved"                      # No changes, proceed
    approved_with_edits = "approved_with_edits"  # Changes made, proceed
    rejected = "rejected"                      # Requires re-run of agent


class StageStatus(str, Enum):
    """Stage lifecycle states."""

    not_started = "not_started"        # Agent hasn't run yet
    running = "running"                # Agent currently executing
    pending_review = "pending_review"  # Agent complete, awaiting human review
    reviewed = "reviewed"              # Human review complete
    error = "error"                    # Agent failed


class SuggestionSeverity(str, Enum):
    """Severity levels for validation suggestions."""

    critical = "critical"    # Must be addressed before proceeding
    warning = "warning"      # Should be reviewed
    info = "info"            # Informational note
    suggestion = "suggestion"  # Optional improvement


# ============================================================================
# MODELS
# ============================================================================

class HumanEdit(BaseModel):
    """
    Represents a single edit made by a user during stage review.

    Tracks the field path, original value, new value, and edit type
    to enable edit propagation tracking and learning from corrections.
    """

    edit_id: UUID = Field(default_factory=uuid4, description="Unique identifier for this edit")
    field_path: str = Field(..., min_length=1, description="JSONPath-like path to the edited field")
    original_value: Any = Field(default=None, description="Value before edit")
    new_value: Any = Field(default=None, description="Value after edit")
    edit_type: EditType = Field(..., description="Type of edit made")
    reason: Optional[str] = Field(default=None, description="User-provided reason for edit")
    created_at: datetime = Field(default_factory=datetime.utcnow, description="When the edit was made")

    @model_validator(mode="after")
    def validate_edit_values(self) -> "HumanEdit":
        """Validate edit values based on edit type."""
        # Both values cannot be None
        if self.original_value is None and self.new_value is None:
            raise ValueError("original_value and new_value cannot both be None")

        # Deletion: new_value must be None
        if self.edit_type == EditType.deletion and self.new_value is not None:
            raise ValueError("deletion edit must have new_value=None")

        # Addition: original_value must be None
        if self.edit_type == EditType.addition and self.original_value is not None:
            raise ValueError("addition edit must have original_value=None")

        return self

    model_config = ConfigDict(
        json_encoders={UUID: str, datetime: lambda v: v.isoformat()}
    )


class ValidationSuggestion(BaseModel):
    """
    Suggestion from the Validation Agent (Claude Haiku) during stage review.

    Provides real-time feedback to help users identify potential issues
    in agent outputs before they approve the stage.
    """

    id: UUID = Field(default_factory=uuid4, description="Unique identifier for this suggestion")
    severity: SuggestionSeverity = Field(..., description="Severity level")
    category: str = Field(..., description="Category of the suggestion (e.g., field_accuracy, completeness)")
    field_path: Optional[str] = Field(default=None, description="Path to related field, if applicable")
    message: str = Field(..., description="Human-readable suggestion message")
    evidence: Optional[str] = Field(default=None, description="Evidence supporting the suggestion")
    suggested_value: Optional[Any] = Field(default=None, description="Suggested correction value")
    confidence: float = Field(..., ge=0.0, le=1.0, description="Confidence score (0.0-1.0)")

    model_config = ConfigDict(json_encoders={UUID: str})


class StageReview(BaseModel):
    """
    Complete review record for one pipeline stage.

    Captures the user's approval decision, any edits made, timing information,
    and a hash of the original output for integrity tracking.
    """

    review_id: UUID = Field(default_factory=uuid4, description="Unique identifier for this review")
    pursuit_id: UUID = Field(..., description="ID of the pursuit being reviewed")
    session_id: UUID = Field(..., description="ID of the review session")
    stage: PipelineStage = Field(..., description="Pipeline stage being reviewed")
    reviewer_id: UUID = Field(..., description="ID of the user who reviewed")
    approval_status: ApprovalStatus = Field(..., description="Review outcome")
    edits: List[HumanEdit] = Field(default_factory=list, description="List of edits made during review")
    reviewer_notes: Optional[str] = Field(default=None, description="Optional notes from reviewer")
    agent_output_hash: Optional[str] = Field(default=None, description="Hash of original agent output")
    started_at: datetime = Field(..., description="When review started")
    completed_at: datetime = Field(..., description="When review was submitted")
    review_duration_seconds: Optional[float] = Field(default=None, description="Computed review duration")

    @model_validator(mode="after")
    def validate_review(self) -> "StageReview":
        """Validate review based on approval status and timestamps."""
        # Approved status should have empty edits
        if self.approval_status == ApprovalStatus.approved and len(self.edits) > 0:
            raise ValueError("approved status should not have edits")

        # Approved with edits must have edits
        if self.approval_status == ApprovalStatus.approved_with_edits and len(self.edits) == 0:
            raise ValueError("approved_with_edits status requires non-empty edits list")

        # completed_at must be >= started_at
        if self.completed_at < self.started_at:
            raise ValueError("completed_at must be >= started_at")

        # Compute review duration if not set
        if self.review_duration_seconds is None:
            self.review_duration_seconds = (self.completed_at - self.started_at).total_seconds()

        return self

    model_config = ConfigDict(
        json_encoders={UUID: str, datetime: lambda v: v.isoformat()}
    )


class StageOutput(BaseModel):
    """
    Agent output ready for human review.

    Contains the raw agent output, any validation suggestions,
    and reference to previous review if this is a re-review.
    """

    pursuit_id: UUID = Field(..., description="ID of the pursuit")
    stage: PipelineStage = Field(..., description="Pipeline stage")
    status: StageStatus = Field(..., description="Current status of this stage")
    agent_output: Dict[str, Any] = Field(..., description="Raw output from the agent")
    validation_suggestions: List[ValidationSuggestion] = Field(
        default_factory=list,
        description="Suggestions from Validation Agent"
    )
    previous_review: Optional[StageReview] = Field(
        default=None,
        description="Previous review if re-reviewing"
    )
    created_at: datetime = Field(
        default_factory=datetime.utcnow,
        description="When output was created"
    )
    processing_time_ms: Optional[int] = Field(
        default=None,
        description="Agent processing time in milliseconds"
    )

    model_config = ConfigDict(
        json_encoders={UUID: str, datetime: lambda v: v.isoformat()}
    )


class StageSummary(BaseModel):
    """Summary of a single stage's review status."""

    status: str = Field(..., description="Stage status")
    approval_status: Optional[str] = Field(default=None, description="Approval status if reviewed")
    edits_count: int = Field(default=0, description="Number of edits made")
    reviewed_at: Optional[str] = Field(default=None, description="ISO timestamp when reviewed")


class StageReviewSummary(BaseModel):
    """
    Summary of all stages for a pursuit.

    Provides an overview of pipeline progress and review status
    across all 5 agent stages.
    """

    pursuit_id: UUID = Field(..., description="ID of the pursuit")
    session_id: UUID = Field(..., description="ID of the session")
    stages: Dict[str, StageSummary] = Field(..., description="Status of each stage")
    total_edits: int = Field(default=0, description="Total edits across all stages")
    current_stage: str = Field(..., description="Current active stage")
    pipeline_progress_percentage: int = Field(
        ...,
        ge=0,
        le=100,
        description="Overall progress (0-100)"
    )

    @field_validator("stages")
    @classmethod
    def validate_all_stages_present(cls, v: Dict[str, Any]) -> Dict[str, Any]:
        """Ensure all 5 pipeline stages are present."""
        required_stages = {stage.value for stage in PipelineStage}

        if set(v.keys()) != required_stages:
            missing = required_stages - set(v.keys())
            extra = set(v.keys()) - required_stages
            errors = []
            if missing:
                errors.append(f"missing stages: {missing}")
            if extra:
                errors.append(f"unexpected stages: {extra}")
            raise ValueError("; ".join(errors))

        return v

    model_config = ConfigDict(json_encoders={UUID: str})
