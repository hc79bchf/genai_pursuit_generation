from typing import Any, List
from uuid import UUID
import shutil
import os
import logging
from datetime import datetime

logger = logging.getLogger(__name__)

from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form, Body
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from pydantic import BaseModel
from typing import Optional, Dict, Any

class PPTGenerationRequest(BaseModel):
    custom_research: Optional[Dict[str, Any]] = None

from app.core.database import get_db
from app.models.pursuit import Pursuit
from app.models.pursuit_file import PursuitFile
from app.models.user import User
from app.schemas import pursuit as pursuit_schemas
from app.schemas import file as file_schemas
from app.core import security
from app.api import deps # We might need to create deps.py for get_current_user

router = APIRouter()

# Placeholder for get_current_user dependency until we create deps.py
# For now, we will simulate it or create deps.py next.
# Let's assume we will create app/api/deps.py

from app.api.deps import get_current_user

@router.get("/", response_model=List[pursuit_schemas.Pursuit])
async def read_pursuits(
    db: AsyncSession = Depends(get_db),
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_current_user),
) -> Any:
    """
    Retrieve pursuits.
    """
    result = await db.execute(
        select(Pursuit)
        .options(selectinload(Pursuit.files))
        .order_by(Pursuit.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    pursuits = result.scalars().all()
    return pursuits

@router.post("/", response_model=pursuit_schemas.Pursuit)
async def create_pursuit(
    *,
    db: AsyncSession = Depends(get_db),
    pursuit_in: pursuit_schemas.PursuitCreate,
    current_user: User = Depends(get_current_user),
) -> Any:
    """
    Create new pursuit.
    """
    pursuit_data = pursuit_in.dict()
    if not pursuit_data.get("internal_pursuit_owner_id"):
        pursuit_data["internal_pursuit_owner_id"] = current_user.id
    if not pursuit_data.get("internal_pursuit_owner_name"):
        pursuit_data["internal_pursuit_owner_name"] = current_user.full_name or "Unknown"
    if not pursuit_data.get("internal_pursuit_owner_email"):
        pursuit_data["internal_pursuit_owner_email"] = current_user.email

    pursuit = Pursuit(
        **pursuit_data,
        created_by_id=current_user.id,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow()
    )
    db.add(pursuit)
    await db.commit()
    
    # Re-query to ensure files are loaded (even if empty) to avoid MissingGreenlet
    result = await db.execute(
        select(Pursuit)
        .options(selectinload(Pursuit.files))
        .where(Pursuit.id == pursuit.id)
    )
    pursuit = result.scalars().first()
    return pursuit

@router.get("/{pursuit_id}", response_model=pursuit_schemas.Pursuit)
async def read_pursuit(
    *,
    db: AsyncSession = Depends(get_db),
    pursuit_id: UUID,
    current_user: User = Depends(get_current_user),
) -> Any:
    """
    Get pursuit by ID.
    """
    result = await db.execute(
        select(Pursuit)
        .options(selectinload(Pursuit.files))
        .where(Pursuit.id == pursuit_id)
    )
    pursuit = result.scalars().first()
    if not pursuit:
        raise HTTPException(status_code=404, detail="Pursuit not found")
    return pursuit

@router.put("/{pursuit_id}", response_model=pursuit_schemas.Pursuit)
async def update_pursuit(
    *,
    db: AsyncSession = Depends(get_db),
    pursuit_id: UUID,
    pursuit_in: pursuit_schemas.PursuitUpdate,
    current_user: User = Depends(get_current_user),
) -> Any:
    """
    Update a pursuit.
    """
    result = await db.execute(select(Pursuit).where(Pursuit.id == pursuit_id))
    pursuit = result.scalars().first()
    if not pursuit:
        raise HTTPException(status_code=404, detail="Pursuit not found")
    
    update_data = pursuit_in.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(pursuit, field, value)
    
    pursuit.updated_at = datetime.utcnow()
    db.add(pursuit)
    await db.commit()
    
    # Re-query to ensure files are loaded
    result = await db.execute(
        select(Pursuit)
        .options(selectinload(Pursuit.files))
        .where(Pursuit.id == pursuit_id)
    )
    pursuit = result.scalars().first()
    return pursuit

@router.post("/{pursuit_id}/files", response_model=file_schemas.PursuitFile)
async def upload_file(
    *,
    db: AsyncSession = Depends(get_db),
    pursuit_id: UUID,
    file: UploadFile = File(...),
    file_type: str = Form(...),
    current_user: User = Depends(get_current_user),
) -> Any:
    """
    Upload a file for a pursuit.
    """
    # Verify pursuit exists
    result = await db.execute(select(Pursuit).where(Pursuit.id == pursuit_id))
    pursuit = result.scalars().first()
    if not pursuit:
        raise HTTPException(status_code=404, detail="Pursuit not found")

    # Save file
    upload_dir = f"uploads/{pursuit_id}"
    os.makedirs(upload_dir, exist_ok=True)
    file_path = f"{upload_dir}/{file.filename}"
    
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    file_size = os.path.getsize(file_path)
    
    db_file = PursuitFile(
        pursuit_id=pursuit_id,
        file_name=file.filename,
        file_type=file_type,
        file_path=file_path,
        file_size_bytes=file_size,
        mime_type=file.content_type or "application/octet-stream",
        uploaded_at=datetime.utcnow()
    )
    db.add(db_file)
    await db.commit()
    await db.refresh(db_file)
    return db_file

@router.post("/{pursuit_id}/extract", response_model=pursuit_schemas.Pursuit)
async def extract_metadata(
    *,
    db: AsyncSession = Depends(get_db),
    pursuit_id: UUID,
    file_id: UUID = None,
    current_user: User = Depends(get_current_user),
) -> Any:
    """
    Trigger metadata extraction for a pursuit.
    """
    # 1. Get Pursuit
    result = await db.execute(
        select(Pursuit)
        .options(selectinload(Pursuit.files))
        .where(Pursuit.id == pursuit_id)
    )
    pursuit = result.scalars().first()
    if not pursuit:
        raise HTTPException(status_code=404, detail="Pursuit not found")

    # 2. Get File (specific or latest RFP)
    if file_id:
        result = await db.execute(select(PursuitFile).where(PursuitFile.id == file_id, PursuitFile.pursuit_id == pursuit_id))
        pursuit_file = result.scalars().first()
        if not pursuit_file:
            raise HTTPException(status_code=404, detail="File not found")
    else:
        # Find latest RFP file
        result = await db.execute(
            select(PursuitFile)
            .where(PursuitFile.pursuit_id == pursuit_id, PursuitFile.file_type == "rfp")
            .order_by(PursuitFile.uploaded_at.desc())
        )
        pursuit_file = result.scalars().first()
        if not pursuit_file:
            raise HTTPException(status_code=400, detail="No RFP file found for this pursuit")

    # 3. Read File Content
    try:
        from app.services.file_service import FileService
        
        # Check if text is already extracted
        if pursuit_file.extracted_text and len(pursuit_file.extracted_text) > 0:
            rfp_text = pursuit_file.extracted_text
        else:
            rfp_text = FileService.extract_text(pursuit_file.file_path)
            
            # Save extracted text to DB
            pursuit_file.extracted_text = rfp_text
            pursuit_file.extraction_status = "completed"
            db.add(pursuit_file)
            await db.commit()
            
    except Exception as e:
        logger.error(f"Error reading file: {e}", exc_info=True)
        pursuit_file.extraction_status = "failed"
        db.add(pursuit_file)
        await db.commit()
        raise HTTPException(status_code=500, detail=f"Error reading file: {str(e)}")

    # 4. Initialize Agent
    from app.services.ai_service.llm_service import LLMService
    from app.services.ai_service.metadata_agent import MetadataExtractionAgent
    from app.services.ai_service.gap_analysis_agent import GapAnalysisAgent
    from app.services.ai_service.research_agent import ResearchAgent
    from app.services.ai_service.ppt_outline_agent import PPTOutlineAgent
    
    llm_service = LLMService()
    agent = MetadataExtractionAgent(llm_service)

    # 5. Extract Metadata
    try:
        extracted_data = await agent.extract(rfp_text, user_id=str(current_user.id))
    except Exception as e:
        logger.error(f"Extraction failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Extraction failed: {str(e)}")

    # 6. Update Pursuit
    # Map extracted fields to Pursuit model fields
    # Note: extracted_data is a dict from the agent
    
    if extracted_data.get("entity_name"):
        pursuit.entity_name = extracted_data["entity_name"]
    if extracted_data.get("client_pursuit_owner_name"):
        pursuit.client_pursuit_owner_name = extracted_data["client_pursuit_owner_name"]
    if extracted_data.get("client_pursuit_owner_email"):
        pursuit.client_pursuit_owner_email = extracted_data["client_pursuit_owner_email"]
    if extracted_data.get("industry"):
        pursuit.industry = extracted_data["industry"]
    if extracted_data.get("service_types"):
        pursuit.service_types = extracted_data["service_types"]
    if extracted_data.get("technologies"):
        pursuit.technologies = extracted_data["technologies"]
    if extracted_data.get("geography"):
        pursuit.geography = extracted_data["geography"]
    if extracted_data.get("submission_due_date"):
        pursuit.submission_due_date = extracted_data["submission_due_date"]
    if extracted_data.get("estimated_fees_usd"):
        pursuit.estimated_fees_usd = extracted_data["estimated_fees_usd"]
    if extracted_data.get("expected_format"):
        pursuit.expected_format = extracted_data["expected_format"]
    if extracted_data.get("rfp_objective"):
        # Store in requirements_text or a new field? 
        # For now, let's append to requirements_text or just ignore if no field maps perfectly
        pass
    
    # Store full extraction in outline_json or similar if needed, or just update fields
    # For now, we updated the main fields.
    
    pursuit.updated_at = datetime.utcnow()
    db.add(pursuit)
    await db.commit()
    await db.refresh(pursuit)
    
    return pursuit

@router.post("/{pursuit_id}/gap-analysis", response_model=pursuit_schemas.Pursuit)
async def trigger_gap_analysis(
    *,
    db: AsyncSession = Depends(get_db),
    pursuit_id: UUID,
    template_details: dict,
    current_user: User = Depends(get_current_user),
) -> Any:
    """
    Trigger gap analysis for a pursuit (runs synchronously).
    """
    result = await db.execute(
        select(Pursuit)
        .options(selectinload(Pursuit.files))
        .where(Pursuit.id == pursuit_id)
    )
    pursuit = result.scalars().first()
    if not pursuit:
        raise HTTPException(status_code=404, detail="Pursuit not found")

    # Prepare metadata for gap analysis
    pursuit_metadata = {
        "id": str(pursuit.id),
        "entity_name": pursuit.entity_name,
        "industry": pursuit.industry,
        "service_types": pursuit.service_types or [],
        "technologies": pursuit.technologies or [],
        "requirements_text": pursuit.requirements_text,
        "submission_due_date": str(pursuit.submission_due_date) if pursuit.submission_due_date else None,
        "estimated_fees_usd": float(pursuit.estimated_fees_usd) if pursuit.estimated_fees_usd else None,
    }

    # Run gap analysis synchronously
    from app.services.ai_service.llm_service import LLMService
    from app.services.ai_service.gap_analysis_agent import GapAnalysisAgent

    try:
        llm_service = LLMService()
        agent = GapAnalysisAgent(llm_service)
        gap_result = await agent.analyze(pursuit_metadata, template_details, str(current_user.id))

        # Update pursuit with gap analysis result
        pursuit.gap_analysis_result = gap_result
        pursuit.updated_at = datetime.utcnow()
        db.add(pursuit)
        await db.commit()

    except Exception as e:
        logger.error(f"Gap analysis failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Gap analysis failed: {str(e)}")

    # Re-query to ensure files are loaded
    result = await db.execute(
        select(Pursuit)
        .options(selectinload(Pursuit.files))
        .where(Pursuit.id == pursuit_id)
    )
    pursuit = result.scalars().first()

    return pursuit

@router.patch("/{pursuit_id}/gap-analysis", response_model=pursuit_schemas.Pursuit)
async def update_gap_analysis(
    *,
    db: AsyncSession = Depends(get_db),
    pursuit_id: UUID,
    gap_analysis_update: dict,
    current_user: User = Depends(get_current_user),
) -> Any:
    """
    Update gap analysis results for a pursuit.
    Allows users to edit gaps and search queries.
    """
    result = await db.execute(
        select(Pursuit)
        .options(selectinload(Pursuit.files))
        .where(Pursuit.id == pursuit_id)
    )
    pursuit = result.scalars().first()
    if not pursuit:
        raise HTTPException(status_code=404, detail="Pursuit not found")

    # Validate that gap_analysis_update has the expected structure
    if not isinstance(gap_analysis_update, dict):
        raise HTTPException(status_code=400, detail="Invalid gap analysis format")

    # Update the gap_analysis_result field
    pursuit.gap_analysis_result = gap_analysis_update
    pursuit.updated_at = datetime.utcnow()

    db.add(pursuit)
    await db.commit()

    # Re-query to ensure files are loaded
    result = await db.execute(
        select(Pursuit)
        .options(selectinload(Pursuit.files))
        .where(Pursuit.id == pursuit_id)
    )
    pursuit = result.scalars().first()

    return pursuit

@router.post("/{pursuit_id}/research", response_model=pursuit_schemas.Pursuit)
async def trigger_research(
    *,
    db: AsyncSession = Depends(get_db),
    pursuit_id: UUID,
    current_user: User = Depends(get_current_user),
) -> Any:
    """
    Trigger deep research using search queries from gap analysis (runs synchronously).
    """
    result = await db.execute(
        select(Pursuit)
        .options(selectinload(Pursuit.files))
        .where(Pursuit.id == pursuit_id)
    )
    pursuit = result.scalars().first()
    if not pursuit:
        raise HTTPException(status_code=404, detail="Pursuit not found")

    if not pursuit.gap_analysis_result:
        raise HTTPException(status_code=400, detail="Gap analysis must be completed first")

    # Extract search queries from gap analysis
    search_queries = pursuit.gap_analysis_result.get("search_queries", [])
    if not search_queries:
        raise HTTPException(status_code=400, detail="No search queries found in gap analysis")

    # Prepare pursuit context
    pursuit_context = {
        "id": str(pursuit.id),
        "entity_name": pursuit.entity_name,
        "industry": pursuit.industry,
        "service_types": pursuit.service_types or [],
        "technologies": pursuit.technologies or [],
        "requirements_text": pursuit.requirements_text,
    }

    # Run research synchronously
    from app.services.ai_service.llm_service import LLMService
    from app.services.ai_service.research_agent import ResearchAgent

    try:
        llm_service = LLMService()
        agent = ResearchAgent(llm_service)
        research_result = await agent.research(search_queries, pursuit_context, str(current_user.id))

        # Update pursuit with research result
        pursuit.research_result = research_result
        pursuit.updated_at = datetime.utcnow()
        db.add(pursuit)
        await db.commit()

    except Exception as e:
        logger.error(f"Research failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Research failed: {str(e)}")

    # Re-query to ensure files are loaded
    result = await db.execute(
        select(Pursuit)
        .options(selectinload(Pursuit.files))
        .where(Pursuit.id == pursuit_id)
    )
    pursuit = result.scalars().first()

    return pursuit

@router.post("/{pursuit_id}/generate-ppt-outline", response_model=Dict[str, Any])
async def generate_ppt_outline(
    pursuit_id: UUID,
    request: Optional[PPTGenerationRequest] = Body(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    """
    Generate a PPT outline for a specific pursuit using AI.
    """
    result = await db.execute(
        select(Pursuit)
        .where(Pursuit.id == pursuit_id)
    )
    pursuit = result.scalars().first()
    if not pursuit:
        raise HTTPException(status_code=404, detail="Pursuit not found")

    # Initialize services
    from app.services.ai_service.llm_service import LLMService
    from app.services.ai_service.ppt_outline_agent import PPTOutlineAgent
    
    llm_service = LLMService()
    ppt_agent = PPTOutlineAgent(llm_service)

    # Prepare context
    pursuit_metadata = {
        "entity_name": pursuit.entity_name,
        "industry": pursuit.industry,
        "service_types": pursuit.service_types,
        "technologies": pursuit.technologies,
        "submission_due_date": pursuit.submission_due_date,
        "requirements_text": pursuit.requirements_text,
    }

    # Get research result
    # If custom_research is provided in the body, use it. Otherwise use the one from DB.
    research_result = getattr(pursuit, "research_result", None)
    
    if request and request.custom_research:
        research_result = request.custom_research

    try:
        markdown_content = await ppt_agent.generate_outline(
            pursuit_metadata=pursuit_metadata,
            research_result=research_result,
            user_id=str(current_user.id)
        )

        # 1. Save Markdown to file
        # Use absolute path for reliability
        base_upload_dir = os.path.abspath("uploads")
        upload_dir = os.path.join(base_upload_dir, str(pursuit_id))
        os.makedirs(upload_dir, exist_ok=True)
        timestamp = datetime.utcnow().strftime("%Y%m%d%H%M%S")
        md_filename = f"proposal_outline_{timestamp}.md"
        md_path = f"{upload_dir}/{md_filename}"
        
        with open(md_path, "w") as f:
            f.write(markdown_content)

        # 2. Convert to PPTX using MARP
        pptx_filename = f"proposal_outline_{timestamp}.pptx"
        pptx_path = f"{upload_dir}/{pptx_filename}"
        
        # Also generate HTML for preview
        html_filename = f"proposal_outline_{timestamp}.html"
        html_path = f"{upload_dir}/{html_filename}"
        
        # Run marp command
        # --allow-local-files is needed if we reference local images
        import subprocess
        
        # PPTX Command
        cmd_pptx = ["marp", "--pptx", md_path, "-o", pptx_path, "--allow-local-files"]
        
        # HTML Command
        cmd_html = ["marp", "--html", md_path, "-o", html_path, "--allow-local-files"]
        
        try:
            # Generate PPTX
            logger.info(f"Generating PPTX: {' '.join(cmd_pptx)}")
            subprocess.run(cmd_pptx, capture_output=True, text=True, check=True)
            
            # Generate HTML
            logger.info(f"Generating HTML: {' '.join(cmd_html)}")
            subprocess.run(cmd_html, capture_output=True, text=True, check=True)
            
        except subprocess.CalledProcessError as e:
            logger.error(f"Marp failed: {e.stderr}")
            raise HTTPException(status_code=500, detail=f"Failed to generate presentation: {e.stderr}")

        # Read HTML content for preview
        preview_html = ""
        # Retry reading a few times
        import time
        for _ in range(3):
            if os.path.exists(html_path):
                logger.info(f"HTML file found at {html_path}")
                with open(html_path, "r") as f:
                    preview_html = f.read()
                logger.info(f"Read {len(preview_html)} bytes from HTML file")
                if len(preview_html) > 0:
                    break
            else:
                logger.warning(f"HTML file NOT found at {html_path}, retrying...")
                time.sleep(0.5)

        # 3. Save File Records
        # Save Markdown file record
        md_file_size = os.path.getsize(md_path)
        db_md_file = PursuitFile(
            pursuit_id=pursuit_id,
            file_name=md_filename,
            file_type="additional_reference", # Use allowed type
            file_path=md_path,
            file_size_bytes=md_file_size,
            mime_type="text/markdown",
            uploaded_at=datetime.utcnow()
        )
        db.add(db_md_file)

        # Save PPTX file record
        if os.path.exists(pptx_path):
            pptx_file_size = os.path.getsize(pptx_path)
            db_pptx_file = PursuitFile(
                pursuit_id=pursuit_id,
                file_name=pptx_filename,
                file_type="output_pptx", # Use allowed type
                file_path=pptx_path,
                file_size_bytes=pptx_file_size,
                mime_type="application/vnd.openxmlformats-officedocument.presentationml.presentation",
                uploaded_at=datetime.utcnow()
            )
            db.add(db_pptx_file)

        # Save HTML preview file record
        if os.path.exists(html_path) and len(preview_html) > 0:
            html_file_size = os.path.getsize(html_path)
            db_html_file = PursuitFile(
                pursuit_id=pursuit_id,
                file_name=html_filename,
                file_type="additional_reference",
                file_path=html_path,
                file_size_bytes=html_file_size,
                mime_type="text/html",
                uploaded_at=datetime.utcnow()
            )
            db.add(db_html_file)

        # 4. Update Pursuit
        # Store the markdown content in proposal_outline_framework
        pursuit.proposal_outline_framework = markdown_content
        
        pursuit.updated_at = datetime.utcnow()
        db.add(pursuit)
        await db.commit()
        await db.refresh(pursuit)
        
        return {
            "markdown": markdown_content,
            "preview_html": preview_html,
            "pptx_file_id": db_pptx_file.id if os.path.exists(pptx_path) else None,
            "md_file_id": db_md_file.id
        }
    except Exception as e:
        logger.error(f"Error generating PPT outline: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{pursuit_id}/files/{file_id}/download")
async def download_file(
    pursuit_id: UUID,
    file_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Download a file associated with a pursuit.
    """
    # Verify pursuit access
    pursuit = await db.get(Pursuit, pursuit_id)
    if not pursuit:
        raise HTTPException(status_code=404, detail="Pursuit not found")
    
    # Get file record
    stmt = select(PursuitFile).where(
        PursuitFile.id == file_id,
        PursuitFile.pursuit_id == pursuit_id
    )
    result = await db.execute(stmt)
    file_record = result.scalar_one_or_none()
    
    if not file_record:
        raise HTTPException(status_code=404, detail="File not found")
        
    # Check if file exists on disk
    file_path = file_record.file_path
    if not os.path.exists(file_path):
         # Try relative path from app root if absolute path fails
         # This handles cases where path might be stored differently
         relative_path = file_path.lstrip("/")
         if os.path.exists(relative_path):
             file_path = relative_path
         else:
            raise HTTPException(status_code=404, detail="File not found on server")
            
    return FileResponse(
        path=file_path,
        filename=file_record.file_name,
        media_type=file_record.mime_type
    )


