"""
Edit Tracking Memory Service for Human-in-the-Loop (HITL) functionality.

This service manages:
1. Stage outputs awaiting human review (Redis - short-term, TTL ~2 hours)
2. Completed reviews with edits (PostgreSQL - long-term, permanent)
3. Edit tracking across sessions for batch learning
4. Pipeline state management

Used by Stage Review endpoints (Section 10 of api-specification.md v1.3)
"""

import json
from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import UUID, uuid4

import redis.asyncio as redis
from sqlalchemy import Column, String, JSON, DateTime, Float, Integer, ForeignKey, select, and_
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import relationship

from app.core.database import Base
from app.schemas.stage_review import (
    PipelineStage,
    EditType,
    ApprovalStatus,
    StageStatus,
    SuggestionSeverity,
    HumanEdit,
    StageReview,
    StageOutput,
    ValidationSuggestion,
    StageReviewSummary,
    StageSummary,
)


# =============================================================================
# SQLAlchemy Models for Long-Term Storage
# =============================================================================


class StageReviewModel(Base):
    """SQLAlchemy model for storing completed stage reviews."""

    __tablename__ = "stage_reviews"

    review_id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    pursuit_id = Column(PGUUID(as_uuid=True), nullable=False, index=True)
    session_id = Column(PGUUID(as_uuid=True), nullable=False, index=True)
    stage = Column(String(50), nullable=False, index=True)
    reviewer_id = Column(PGUUID(as_uuid=True), nullable=False)
    approval_status = Column(String(30), nullable=False)
    edits = Column(JSON, default=list)
    reviewer_notes = Column(String, nullable=True)
    agent_output_hash = Column(String(100), nullable=True)
    started_at = Column(DateTime, nullable=False)
    completed_at = Column(DateTime, nullable=False)
    review_duration_seconds = Column(Float, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class LearnedPatternModel(Base):
    """SQLAlchemy model for storing learned correction patterns."""

    __tablename__ = "learned_patterns"

    pattern_id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    pattern_type = Column(String(50), nullable=False, index=True)
    field_path = Column(String(255), nullable=False, index=True)
    pattern_data = Column(JSON, nullable=False)
    confidence = Column(Float, default=0.0)
    occurrence_count = Column(Integer, default=1)
    source_session = Column(String(36), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


# =============================================================================
# Edit Tracking Memory Service
# =============================================================================


class EditTrackingMemory:
    """
    Memory service for Edit Tracking and HITL functionality.

    Uses Redis for short-term storage (stage outputs, pipeline state)
    and PostgreSQL for long-term storage (reviews, learned patterns).

    For testing, inject mock redis_client and db_session_factory.
    """

    DEFAULT_TTL = 7200  # 2 hours for stage outputs

    def __init__(
        self,
        redis_url: str = "redis://localhost:6379/0",
        database_url: str = "postgresql+asyncpg://localhost/pursuit_response",
        redis_client: Optional[Any] = None,
        db_session_factory: Optional[Any] = None,
    ):
        self.redis_url = redis_url
        self.database_url = database_url
        self._redis_client = redis_client
        self._engine = None
        self._session_factory = db_session_factory

    async def _get_redis(self) -> redis.Redis:
        """Get or create Redis client."""
        if self._redis_client is None:
            self._redis_client = redis.from_url(self.redis_url, decode_responses=True)
        return self._redis_client

    async def _get_db_session(self) -> AsyncSession:
        """Get database session."""
        if self._session_factory is not None:
            return self._session_factory()
        if self._engine is None:
            self._engine = create_async_engine(self.database_url)
            self._session_factory = async_sessionmaker(self._engine, expire_on_commit=False)
        return self._session_factory()

    def _stage_output_key(self, pursuit_id: UUID, stage: PipelineStage) -> str:
        """Generate Redis key for stage output."""
        return f"stage_output:{pursuit_id}:{stage.value}"

    def _pipeline_state_key(self, pursuit_id: UUID) -> str:
        """Generate Redis key for pipeline state."""
        return f"pipeline_state:{pursuit_id}"

    # =========================================================================
    # Stage Output Storage (Redis - Short-term)
    # =========================================================================

    async def store_stage_output(
        self,
        pursuit_id: UUID,
        stage: PipelineStage,
        agent_output: Dict[str, Any],
        validation_suggestions: Optional[List[Dict[str, Any]]] = None,
        processing_time_ms: Optional[int] = None,
        ttl_seconds: Optional[int] = None,
    ) -> None:
        """Store agent output for human review."""
        client = await self._get_redis()
        key = self._stage_output_key(pursuit_id, stage)

        # Check for previous review (for re-review scenarios)
        previous_review = await self.get_review_for_stage(pursuit_id, stage)

        # Build output data
        data = {
            "pursuit_id": str(pursuit_id),
            "stage": stage.value,
            "status": StageStatus.pending_review.value,
            "agent_output": agent_output,
            "validation_suggestions": validation_suggestions or [],
            "previous_review": previous_review.model_dump(mode="json") if previous_review else None,
            "processing_time_ms": processing_time_ms,
            "created_at": datetime.utcnow().isoformat(),
        }

        ttl = ttl_seconds or self.DEFAULT_TTL
        await client.setex(key, ttl, json.dumps(data))

        # Update pipeline state
        await self._update_pipeline_state(pursuit_id, stage, StageStatus.pending_review)

    async def get_stage_output(
        self,
        pursuit_id: UUID,
        stage: PipelineStage,
    ) -> Optional[StageOutput]:
        """Retrieve stage output awaiting review."""
        client = await self._get_redis()
        key = self._stage_output_key(pursuit_id, stage)

        data = await client.get(key)
        if data is None:
            return None

        parsed = json.loads(data)

        # Convert validation suggestions to models
        validation_suggestions = []
        for vs in parsed.get("validation_suggestions", []):
            validation_suggestions.append(
                ValidationSuggestion(
                    severity=vs["severity"],
                    category=vs["category"],
                    field_path=vs.get("field_path"),
                    message=vs["message"],
                    evidence=vs.get("evidence"),
                    suggested_value=vs.get("suggested_value"),
                    confidence=vs["confidence"],
                )
            )

        # Convert previous review if exists
        previous_review = None
        if parsed.get("previous_review"):
            pr = parsed["previous_review"]
            edits = [HumanEdit(**e) for e in pr.get("edits", [])]
            previous_review = StageReview(
                review_id=UUID(pr["review_id"]),
                pursuit_id=UUID(pr["pursuit_id"]),
                session_id=UUID(pr["session_id"]),
                stage=pr["stage"],
                reviewer_id=UUID(pr["reviewer_id"]),
                approval_status=pr["approval_status"],
                edits=edits,
                reviewer_notes=pr.get("reviewer_notes"),
                agent_output_hash=pr.get("agent_output_hash"),
                started_at=datetime.fromisoformat(pr["started_at"]),
                completed_at=datetime.fromisoformat(pr["completed_at"]),
                review_duration_seconds=pr.get("review_duration_seconds"),
            )

        return StageOutput(
            pursuit_id=UUID(parsed["pursuit_id"]),
            stage=parsed["stage"],
            status=parsed["status"],
            agent_output=parsed["agent_output"],
            validation_suggestions=validation_suggestions,
            previous_review=previous_review,
            created_at=datetime.fromisoformat(parsed["created_at"]),
            processing_time_ms=parsed.get("processing_time_ms"),
        )

    async def get_stage_output_ttl(
        self,
        pursuit_id: UUID,
        stage: PipelineStage,
    ) -> Optional[int]:
        """Get remaining TTL for stage output."""
        client = await self._get_redis()
        key = self._stage_output_key(pursuit_id, stage)
        ttl = await client.ttl(key)
        return ttl if ttl > 0 else None

    async def update_stage_status(
        self,
        pursuit_id: UUID,
        stage: PipelineStage,
        status: StageStatus,
    ) -> None:
        """Update the status of a stage output."""
        client = await self._get_redis()
        key = self._stage_output_key(pursuit_id, stage)

        data = await client.get(key)
        if data is None:
            return

        parsed = json.loads(data)
        parsed["status"] = status.value

        # Preserve TTL
        ttl = await client.ttl(key)
        if ttl > 0:
            await client.setex(key, ttl, json.dumps(parsed))
        else:
            await client.set(key, json.dumps(parsed))

        # Update pipeline state
        await self._update_pipeline_state(pursuit_id, stage, status)

    # =========================================================================
    # Stage Review Storage (PostgreSQL - Long-term)
    # =========================================================================

    async def store_review(self, review: StageReview) -> UUID:
        """Store a completed stage review."""
        async with await self._get_db_session() as session:
            db_review = StageReviewModel(
                review_id=review.review_id,
                pursuit_id=review.pursuit_id,
                session_id=review.session_id,
                stage=review.stage.value,
                reviewer_id=review.reviewer_id,
                approval_status=review.approval_status.value,
                edits=[e.model_dump(mode="json") for e in review.edits],
                reviewer_notes=review.reviewer_notes,
                agent_output_hash=review.agent_output_hash,
                started_at=review.started_at,
                completed_at=review.completed_at,
                review_duration_seconds=review.review_duration_seconds,
            )
            session.add(db_review)
            await session.commit()
            return review.review_id

    async def get_review(self, review_id: UUID) -> Optional[StageReview]:
        """Retrieve a review by ID."""
        async with await self._get_db_session() as session:
            result = await session.execute(
                select(StageReviewModel).where(StageReviewModel.review_id == review_id)
            )
            db_review = result.scalar_one_or_none()

            if db_review is None:
                return None

            return self._db_review_to_schema(db_review)

    async def get_reviews_for_pursuit(self, pursuit_id: UUID) -> List[StageReview]:
        """Get all reviews for a pursuit."""
        async with await self._get_db_session() as session:
            result = await session.execute(
                select(StageReviewModel)
                .where(StageReviewModel.pursuit_id == pursuit_id)
                .order_by(StageReviewModel.completed_at.desc())
            )
            db_reviews = result.scalars().all()

            return [self._db_review_to_schema(r) for r in db_reviews]

    async def get_review_for_stage(
        self,
        pursuit_id: UUID,
        stage: PipelineStage,
    ) -> Optional[StageReview]:
        """Get the latest review for a specific stage."""
        async with await self._get_db_session() as session:
            result = await session.execute(
                select(StageReviewModel)
                .where(
                    and_(
                        StageReviewModel.pursuit_id == pursuit_id,
                        StageReviewModel.stage == stage.value,
                    )
                )
                .order_by(StageReviewModel.completed_at.desc())
                .limit(1)
            )
            db_review = result.scalar_one_or_none()

            if db_review is None:
                return None

            return self._db_review_to_schema(db_review)

    def _db_review_to_schema(self, db_review: StageReviewModel) -> StageReview:
        """Convert database model to schema."""
        edits = [HumanEdit(**e) for e in (db_review.edits or [])]

        return StageReview(
            review_id=db_review.review_id,
            pursuit_id=db_review.pursuit_id,
            session_id=db_review.session_id,
            stage=db_review.stage,
            reviewer_id=db_review.reviewer_id,
            approval_status=db_review.approval_status,
            edits=edits,
            reviewer_notes=db_review.reviewer_notes,
            agent_output_hash=db_review.agent_output_hash,
            started_at=db_review.started_at,
            completed_at=db_review.completed_at,
            review_duration_seconds=db_review.review_duration_seconds,
        )

    # =========================================================================
    # Edit Tracking
    # =========================================================================

    async def get_edits_for_session(self, session_id: UUID) -> List[HumanEdit]:
        """Get all edits made in a session."""
        async with await self._get_db_session() as session:
            result = await session.execute(
                select(StageReviewModel).where(StageReviewModel.session_id == session_id)
            )
            db_reviews = result.scalars().all()

            all_edits = []
            for review in db_reviews:
                for edit_data in review.edits or []:
                    all_edits.append(HumanEdit(**edit_data))

            return all_edits

    async def get_edits_by_type(
        self,
        session_id: UUID,
        edit_type: EditType,
    ) -> List[HumanEdit]:
        """Get edits filtered by type."""
        all_edits = await self.get_edits_for_session(session_id)
        return [e for e in all_edits if e.edit_type == edit_type]

    async def get_edits_for_field(
        self,
        session_id: UUID,
        field_path: str,
    ) -> List[HumanEdit]:
        """Get edits for a specific field path."""
        all_edits = await self.get_edits_for_session(session_id)
        return [e for e in all_edits if e.field_path == field_path]

    async def get_edit_counts_by_stage(
        self,
        session_id: UUID,
    ) -> Dict[PipelineStage, int]:
        """Get edit counts per stage."""
        async with await self._get_db_session() as session:
            result = await session.execute(
                select(StageReviewModel).where(StageReviewModel.session_id == session_id)
            )
            db_reviews = result.scalars().all()

            counts = {}
            for review in db_reviews:
                stage = PipelineStage(review.stage)
                counts[stage] = len(review.edits or [])

            return counts

    # =========================================================================
    # Batch Learning
    # =========================================================================

    async def get_session_learning_data(self, session_id: UUID) -> Dict[str, Any]:
        """Get all learning data for a session."""
        edits = await self.get_edits_for_session(session_id)
        counts_by_stage = await self.get_edit_counts_by_stage(session_id)
        patterns = await self.get_correction_patterns(session_id)

        # Count by type
        edits_by_type = {}
        for edit in edits:
            type_name = edit.edit_type.value
            edits_by_type[type_name] = edits_by_type.get(type_name, 0) + 1

        return {
            "total_edits": len(edits),
            "edits_by_type": edits_by_type,
            "edits_by_stage": {k.value: v for k, v in counts_by_stage.items()},
            "correction_patterns": patterns,
        }

    async def get_correction_patterns(self, session_id: UUID) -> List[Dict[str, Any]]:
        """Extract correction patterns from session edits."""
        edits = await self.get_edits_for_session(session_id)

        # Group by field path
        field_edits: Dict[str, List[HumanEdit]] = {}
        for edit in edits:
            if edit.edit_type == EditType.correction:
                if edit.field_path not in field_edits:
                    field_edits[edit.field_path] = []
                field_edits[edit.field_path].append(edit)

        patterns = []
        for field_path, field_edit_list in field_edits.items():
            patterns.append({
                "field_path": field_path,
                "correction_count": len(field_edit_list),
                "corrections": [
                    {"from": e.original_value, "to": e.new_value}
                    for e in field_edit_list
                ],
            })

        return patterns

    async def store_learned_pattern(self, pattern: Dict[str, Any]) -> UUID:
        """Store a learned pattern."""
        pattern_id = uuid4()

        async with await self._get_db_session() as session:
            db_pattern = LearnedPatternModel(
                pattern_id=pattern_id,
                pattern_type=pattern["pattern_type"],
                field_path=pattern["field_path"],
                pattern_data=pattern,
                confidence=pattern.get("confidence", 0.0),
                occurrence_count=pattern.get("occurrence_count", 1),
                source_session=pattern.get("source_session"),
            )
            session.add(db_pattern)
            await session.commit()

        return pattern_id

    async def get_learned_pattern(self, pattern_id: UUID) -> Optional[Dict[str, Any]]:
        """Get a learned pattern by ID."""
        async with await self._get_db_session() as session:
            result = await session.execute(
                select(LearnedPatternModel).where(LearnedPatternModel.pattern_id == pattern_id)
            )
            db_pattern = result.scalar_one_or_none()

            if db_pattern is None:
                return None

            return db_pattern.pattern_data

    async def get_learned_patterns_for_field(
        self,
        field_path: str,
    ) -> List[Dict[str, Any]]:
        """Get learned patterns for a specific field."""
        async with await self._get_db_session() as session:
            result = await session.execute(
                select(LearnedPatternModel).where(LearnedPatternModel.field_path == field_path)
            )
            db_patterns = result.scalars().all()

            return [p.pattern_data for p in db_patterns]

    async def get_aggregated_correction_patterns(
        self,
        field_path: str,
        min_occurrences: int = 1,
    ) -> List[Dict[str, Any]]:
        """Get aggregated correction patterns across all sessions."""
        async with await self._get_db_session() as session:
            result = await session.execute(select(StageReviewModel))
            all_reviews = result.scalars().all()

            # Aggregate corrections
            corrections: Dict[str, Dict[str, int]] = {}  # to_value -> {from_value: count}

            for review in all_reviews:
                for edit_data in review.edits or []:
                    edit = HumanEdit(**edit_data)
                    if edit.field_path == field_path and edit.edit_type == EditType.correction:
                        to_val = str(edit.new_value)
                        from_val = str(edit.original_value)

                        if to_val not in corrections:
                            corrections[to_val] = {}
                        corrections[to_val][from_val] = corrections[to_val].get(from_val, 0) + 1

            # Build patterns
            patterns = []
            for to_value, from_values in corrections.items():
                total = sum(from_values.values())
                if total >= min_occurrences:
                    patterns.append({
                        "to_value": to_value,
                        "from_values": from_values,
                        "total_occurrences": total,
                    })

            return patterns

    # =========================================================================
    # Pipeline State Management
    # =========================================================================

    async def _update_pipeline_state(
        self,
        pursuit_id: UUID,
        stage: PipelineStage,
        status: StageStatus,
    ) -> None:
        """Update pipeline state in Redis."""
        client = await self._get_redis()
        key = self._pipeline_state_key(pursuit_id)

        # Get existing state or create new
        state_data = await client.get(key)
        if state_data:
            state = json.loads(state_data)
        else:
            state = {s.value: StageStatus.not_started.value for s in PipelineStage}

        state[stage.value] = status.value
        await client.setex(key, self.DEFAULT_TTL, json.dumps(state))

    async def _get_pipeline_state(self, pursuit_id: UUID) -> Dict[str, str]:
        """Get current pipeline state."""
        client = await self._get_redis()
        key = self._pipeline_state_key(pursuit_id)

        state_data = await client.get(key)
        if state_data:
            return json.loads(state_data)

        return {s.value: StageStatus.not_started.value for s in PipelineStage}

    async def get_pipeline_summary(
        self,
        pursuit_id: UUID,
        session_id: UUID,
    ) -> StageReviewSummary:
        """Get summary of all stages for a pursuit."""
        state = await self._get_pipeline_state(pursuit_id)
        reviews = await self.get_reviews_for_pursuit(pursuit_id)

        # Build stage summaries
        stages = {}
        total_edits = 0

        for stage in PipelineStage:
            stage_reviews = [r for r in reviews if r.stage == stage]
            latest_review = stage_reviews[0] if stage_reviews else None

            edit_count = len(latest_review.edits) if latest_review else 0
            total_edits += edit_count

            stages[stage.value] = StageSummary(
                status=state.get(stage.value, StageStatus.not_started.value),
                approval_status=latest_review.approval_status.value if latest_review else None,
                edits_count=edit_count,
                reviewed_at=latest_review.completed_at.isoformat() if latest_review else None,
            )

        # Determine current stage and progress
        current_stage = await self.get_current_stage(pursuit_id)
        reviewed_count = sum(
            1 for s in state.values()
            if s == StageStatus.reviewed.value
        )
        progress = int((reviewed_count / len(PipelineStage)) * 100)

        return StageReviewSummary(
            pursuit_id=pursuit_id,
            session_id=session_id,
            stages=stages,
            total_edits=total_edits,
            current_stage=current_stage.value,
            pipeline_progress_percentage=progress,
        )

    async def get_current_stage(self, pursuit_id: UUID) -> PipelineStage:
        """Determine the current stage in the pipeline."""
        state = await self._get_pipeline_state(pursuit_id)

        stage_order = list(PipelineStage)
        for stage in stage_order:
            status = state.get(stage.value, StageStatus.not_started.value)
            if status != StageStatus.reviewed.value:
                return stage

        # All reviewed, return last stage
        return PipelineStage.document_generation

    async def can_proceed_to_next_stage(self, pursuit_id: UUID) -> bool:
        """Check if user can proceed to the next stage."""
        state = await self._get_pipeline_state(pursuit_id)
        current = await self.get_current_stage(pursuit_id)

        # Can proceed if current stage is reviewed
        return state.get(current.value) == StageStatus.reviewed.value

    async def get_corrected_output(
        self,
        pursuit_id: UUID,
        stage: PipelineStage,
    ) -> Dict[str, Any]:
        """Get agent output with human edits applied."""
        output = await self.get_stage_output(pursuit_id, stage)
        if output is None:
            return {}

        corrected = output.agent_output.copy()

        # Get latest review with edits
        review = await self.get_review_for_stage(pursuit_id, stage)
        if review is None or not review.edits:
            return corrected

        # Apply edits to output
        for edit in review.edits:
            corrected = self._apply_edit(corrected, edit)

        return corrected

    def _apply_edit(self, data: Dict[str, Any], edit: HumanEdit) -> Dict[str, Any]:
        """Apply a single edit to the data."""
        path_parts = edit.field_path.split(".")
        current = data

        # Navigate to parent of target field
        for part in path_parts[:-1]:
            if part not in current:
                current[part] = {}
            current = current[part]

        # Apply the edit
        final_key = path_parts[-1]

        if edit.edit_type == EditType.deletion:
            if final_key in current:
                del current[final_key]
        elif edit.edit_type == EditType.addition:
            current[final_key] = edit.new_value
        else:  # correction, enhancement, reorder
            current[final_key] = edit.new_value

        return data

    # =========================================================================
    # Cleanup
    # =========================================================================

    async def cleanup_session(self, pursuit_id: UUID) -> None:
        """Clean up session data (stage outputs) for a pursuit."""
        client = await self._get_redis()

        # Delete all stage outputs
        for stage in PipelineStage:
            key = self._stage_output_key(pursuit_id, stage)
            await client.delete(key)

        # Delete pipeline state
        state_key = self._pipeline_state_key(pursuit_id)
        await client.delete(state_key)

    async def archive_pursuit(self, pursuit_id: UUID) -> bool:
        """Archive completed pursuit data."""
        # Clean up short-term storage
        await self.cleanup_session(pursuit_id)

        # Reviews remain in long-term storage
        return True

    async def close(self) -> None:
        """Close connections."""
        if self._redis_client:
            await self._redis_client.close()
            self._redis_client = None

        if self._engine:
            await self._engine.dispose()
            self._engine = None
