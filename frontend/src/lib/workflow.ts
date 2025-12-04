/**
 * Workflow stages configuration for pursuit pipeline
 */

export type WorkflowStage =
    | "overview"
    | "metadata"
    | "gap-analysis"
    | "research"
    | "synthesis"
    | "document-generation"
    | "validation"

export interface WorkflowStageConfig {
    id: WorkflowStage
    name: string
    shortName: string
    description: string
    detailedDescription: string
    path: (pursuitId: string) => string
    estimatedTime: string
}

export const WORKFLOW_STAGES: WorkflowStageConfig[] = [
    {
        id: "overview",
        name: "PURSUIT OVERVIEW",
        shortName: "OVERVIEW",
        description: "Review pursuit details and upload RFP documents",
        detailedDescription: "Starting point for your pursuit. Enter client details, opportunity information, assign team members, and upload RFP documents. This provides the foundation for AI-powered metadata extraction.",
        path: (id) => `/dashboard/pursuits/${id}/workflow/overview`,
        estimatedTime: "5 min",
    },
    {
        id: "metadata",
        name: "STAGING",
        shortName: "STAGING",
        description: "Stage all required inputs for the agentic workflow",
        detailedDescription: "AI extracts key metadata from your RFP documents including objectives, requirements, and client needs. Review extracted data, select similar past pursuits as references, and choose an outline template.",
        path: (id) => `/dashboard/pursuits/${id}/workflow/metadata`,
        estimatedTime: "15-30 sec",
    },
    {
        id: "gap-analysis",
        name: "GAP ANALYSIS",
        shortName: "GAP ANALYSIS",
        description: "Identify coverage gaps against past pursuits",
        detailedDescription: "AI compares RFP requirements against your selected reference pursuits to identify coverage gaps. Review what's covered by past work, confirm gaps needing research, and generate a deep research prompt.",
        path: (id) => `/dashboard/pursuits/${id}/workflow/gap-analysis`,
        estimatedTime: "30 sec",
    },
    {
        id: "research",
        name: "RESEARCH",
        shortName: "RESEARCH",
        description: "Conduct web and academic research for gaps",
        detailedDescription: "Using the deep research prompt, AI conducts web and academic research to gather information for identified gaps. Review findings that will inform proposal synthesis.",
        path: (id) => `/dashboard/pursuits/${id}/workflow/research`,
        estimatedTime: "2 min",
    },
    {
        id: "synthesis",
        name: "SYNTHESIS",
        shortName: "SYNTHESIS",
        description: "Combine research findings and create proposal outline",
        detailedDescription: "Combine research findings with reference pursuit content to create a comprehensive proposal outline. Select relevant research results and review synthesized sections.",
        path: (id) => `/dashboard/pursuits/${id}/workflow/synthesis`,
        estimatedTime: "60-90 sec",
    },
    {
        id: "document-generation",
        name: "DOCUMENT GENERATION",
        shortName: "DOC GEN",
        description: "Generate final proposal document (PPTX/DOCX)",
        detailedDescription: "Transform the synthesized proposal outline into a polished presentation. AI generates a professional PowerPoint based on your outline, ready for client presentation.",
        path: (id) => `/dashboard/pursuits/${id}/workflow/document-generation`,
        estimatedTime: "30-60 sec",
    },
    {
        id: "validation",
        name: "VALIDATION",
        shortName: "VALIDATION",
        description: "Final quality validation and review",
        detailedDescription: "Final step in the workflow. Run automated quality checks, download the final document, and update pursuit status. Mark as ready for submission once validations pass.",
        path: (id) => `/dashboard/pursuits/${id}/workflow/validation`,
        estimatedTime: "30 sec",
    },
]

export function getStageIndex(stageId: WorkflowStage): number {
    return WORKFLOW_STAGES.findIndex((s) => s.id === stageId)
}

export function getStageById(stageId: WorkflowStage): WorkflowStageConfig | undefined {
    return WORKFLOW_STAGES.find((s) => s.id === stageId)
}

export function getNextStage(currentStageId: WorkflowStage): WorkflowStageConfig | undefined {
    const currentIndex = getStageIndex(currentStageId)
    if (currentIndex < WORKFLOW_STAGES.length - 1) {
        return WORKFLOW_STAGES[currentIndex + 1]
    }
    return undefined
}

export function getPreviousStage(currentStageId: WorkflowStage): WorkflowStageConfig | undefined {
    const currentIndex = getStageIndex(currentStageId)
    if (currentIndex > 0) {
        return WORKFLOW_STAGES[currentIndex - 1]
    }
    return undefined
}

/**
 * Map pursuit status/current_stage to workflow stage
 */
export function mapPursuitStageToWorkflow(pursuitStage?: string): WorkflowStage {
    if (!pursuitStage) return "overview"

    const stageMap: Record<string, WorkflowStage> = {
        "draft": "overview",
        "metadata_extraction": "metadata",
        "gap_analysis": "gap-analysis",
        "research": "research",
        "synthesis": "synthesis",
        "document_generation": "document-generation",
        "validation": "validation",
        "complete": "validation",
    }

    return stageMap[pursuitStage.toLowerCase()] || "overview"
}
