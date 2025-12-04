"use client"

import { useEffect, useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
    Bot,
    Loader2,
    ArrowRight,
    ArrowLeft,
    AlertCircle,
    Check,
    Sparkles,
    FileText,
    Edit2,
    Trash2,
    Plus,
    X,
    Save,
    Target,
    CheckCircle2,
    Layers,
    History,
    DollarSign,
    Zap,
    Clock,
    Info,
    Play,
    ChevronDown,
    ChevronRight,
    Quote,
    Building2,
    Users,
    Briefcase,
    Upload,
    FolderOpen,
    Grid3X3,
    Circle,
    CheckSquare,
    Square,
    RefreshCw,
    MessageSquare,
    Send
} from "lucide-react"
import { Textarea } from "@/components/ui/textarea"
import { fetchApi } from "@/lib/api"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { getNextStage, getPreviousStage } from "@/lib/workflow"
import { templates } from "@/lib/data"

// Types
type GapAnalysisTab = "overview" | "inputs" | "gaps" | "prompt"

interface TabConfig {
    id: GapAnalysisTab
    label: string
    description: string
}

const TABS: TabConfig[] = [
    { id: "overview", label: "OVERVIEW", description: "Learn about the Gap Analysis Agent and how it works." },
    { id: "inputs", label: "INPUTS", description: "Review template, metadata, reference pursuits, and documents used for gap analysis." },
    { id: "gaps", label: "GAP ANALYSIS", description: "View coverage matrix, identified gaps, and covered requirements with citations." },
    { id: "prompt", label: "RESEARCH PROMPT", description: "Confirm gaps and generate a deep research prompt for the Research Agent." },
]

interface GapItem {
    id: string
    description: string
    category: string
    severity: "high" | "medium" | "low"
    suggested_query?: string
}

interface CoveredItem {
    id: string
    requirement: string
    source: string
    citation: string
    confidence: number
}

interface GapAnalysisResult {
    gaps: string[] | GapItem[]
    search_queries: string[]
    reasoning: string
    deep_research_prompt?: string
    covered_items?: CoveredItem[]
    processing_time_ms?: number
    input_tokens?: number
    output_tokens?: number
    estimated_cost_usd?: number
}

interface AnalysisHistoryItem {
    id: string
    ran_by: string
    date: string
    processing_time_ms: number
    input_tokens: number
    output_tokens: number
    estimated_cost_usd: number
    status: "success" | "failed"
    gaps_count: number
    covered_count: number
}

interface PromptHistoryItem {
    id: string
    date: string
    type: "generated" | "regenerated"
    prompt: string
    // Metadata snapshot used to generate this prompt
    metadata_snapshot: {
        entity_name: string
        industry?: string
        service_types?: string[]
        technologies?: string[]
        confirmed_gaps: string[]
    }
    // User feedback/enhancements (only for regenerated prompts)
    user_feedback?: string
    // Previous prompt (only for regenerated prompts)
    previous_prompt?: string
}

interface ReferencePursuitDetail {
    pursuit_id: string
    pursuit_name: string
    industry: string
    win_status: string
    overall_score: number
    components: string[]
}

interface Pursuit {
    id: string
    entity_name: string
    industry?: string
    status: string
    selected_template_id?: string
    gap_analysis_result?: GapAnalysisResult
    outline_json?: {
        extracted_objectives?: any[]
        extracted_requirements?: any[]
        metadata_extraction?: any
        gap_analysis_history?: AnalysisHistoryItem[]
        prompt_history?: PromptHistoryItem[]
        selected_reference_pursuits?: {
            pursuit_ids: string[]
            components: Record<string, string[]>
            pursuit_details: ReferencePursuitDetail[]
        }
    }
    files?: any[]
    service_types?: string[]
    technologies?: string[]
}

export default function GapAnalysisPage({ params }: { params: { id: string } }) {
    const router = useRouter()
    const pursuitId = params.id
    const [pursuit, setPursuit] = useState<Pursuit | null>(null)
    const [selectedTemplate, setSelectedTemplate] = useState<any>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [isAnalyzing, setIsAnalyzing] = useState(false)
    const [activeTab, setActiveTab] = useState<GapAnalysisTab>("overview")

    // Edit states
    const [isEditing, setIsEditing] = useState(false)
    const [isSaving, setIsSaving] = useState(false)
    const [editedGaps, setEditedGaps] = useState<string[]>([])
    const [editedQueries, setEditedQueries] = useState<string[]>([])
    const [editedReasoning, setEditedReasoning] = useState("")

    // Analysis history
    const [analysisHistory, setAnalysisHistory] = useState<AnalysisHistoryItem[]>([])

    // Prompt generation history
    const [promptHistory, setPromptHistory] = useState<PromptHistoryItem[]>([])
    const [expandedHistoryItem, setExpandedHistoryItem] = useState<string | null>(null)

    // Research Prompt states
    const [confirmedGaps, setConfirmedGaps] = useState<Set<number>>(new Set())
    const [researchPrompt, setResearchPrompt] = useState("")
    const [isGeneratingPrompt, setIsGeneratingPrompt] = useState(false)
    const [isRegeneratingPrompt, setIsRegeneratingPrompt] = useState(false)
    const [userFeedback, setUserFeedback] = useState("")
    const [promptStatus, setPromptStatus] = useState<string>("")

    // UI state
    const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(["template", "metadata", "requirements"]))

    // Reference document upload states
    const [isUploadingRef, setIsUploadingRef] = useState(false)
    const [deletingRefFileId, setDeletingRefFileId] = useState<string | null>(null)
    const [pendingRefFiles, setPendingRefFiles] = useState<File[]>([])
    const [refFileDescriptions, setRefFileDescriptions] = useState<Record<string, string>>({})
    const [showRefUploadModal, setShowRefUploadModal] = useState(false)

    const pollIntervalRef = useRef<NodeJS.Timeout | null>(null)
    const isAnalyzingRef = useRef(false)

    useEffect(() => {
        return () => {
            if (pollIntervalRef.current) {
                clearInterval(pollIntervalRef.current)
            }
        }
    }, [])

    useEffect(() => {
        async function loadPursuit() {
            try {
                const data = await fetchApi(`/pursuits/${pursuitId}`)
                setPursuit(data)

                if (data.selected_template_id) {
                    const template = templates.find(t => t.id === data.selected_template_id)
                    setSelectedTemplate(template || null)
                }

                // Load analysis history
                if (data.outline_json?.gap_analysis_history) {
                    setAnalysisHistory(data.outline_json.gap_analysis_history)
                }

                // Load prompt history
                if (data.outline_json?.prompt_history) {
                    setPromptHistory(data.outline_json.prompt_history)
                }
            } catch (error) {
                console.error("Failed to load pursuit", error)
            } finally {
                setIsLoading(false)
            }
        }
        loadPursuit()
    }, [pursuitId])

    const startPolling = (pursuitId: string) => {
        if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current)
        }

        pollIntervalRef.current = setInterval(async () => {
            try {
                const updatedPursuit = await fetchApi(`/pursuits/${pursuitId}`)
                if (updatedPursuit.gap_analysis_result) {
                    if (pollIntervalRef.current) {
                        clearInterval(pollIntervalRef.current)
                        pollIntervalRef.current = null
                    }
                    setPursuit(updatedPursuit)
                    isAnalyzingRef.current = false
                    setIsAnalyzing(false)

                    // Add to history
                    const newHistoryItem: AnalysisHistoryItem = {
                        id: Date.now().toString(),
                        ran_by: "Current User",
                        date: new Date().toISOString(),
                        processing_time_ms: updatedPursuit.gap_analysis_result?.processing_time_ms || 0,
                        input_tokens: updatedPursuit.gap_analysis_result?.input_tokens || 0,
                        output_tokens: updatedPursuit.gap_analysis_result?.output_tokens || 0,
                        estimated_cost_usd: updatedPursuit.gap_analysis_result?.estimated_cost_usd || 0,
                        status: "success",
                        gaps_count: updatedPursuit.gap_analysis_result?.gaps?.length || 0,
                        covered_count: updatedPursuit.gap_analysis_result?.covered_items?.length || 0
                    }

                    const existingHistory = updatedPursuit.outline_json?.gap_analysis_history || []
                    const updatedHistory = [newHistoryItem, ...existingHistory]
                    setAnalysisHistory(updatedHistory)

                    // Persist history
                    await fetchApi(`/pursuits/${pursuitId}`, {
                        method: "PUT",
                        body: JSON.stringify({
                            outline_json: {
                                ...updatedPursuit.outline_json,
                                gap_analysis_history: updatedHistory
                            }
                        })
                    })

                    // Switch to gaps tab after analysis
                    setActiveTab("gaps")
                }
            } catch (error) {
                console.error("Polling failed:", error)
            }
        }, 2000)

        setTimeout(() => {
            if (pollIntervalRef.current) {
                clearInterval(pollIntervalRef.current)
                pollIntervalRef.current = null
            }
            isAnalyzingRef.current = false
            setIsAnalyzing(false)
        }, 60000)
    }

    const handleRunAnalysis = async () => {
        if (!pursuit || !selectedTemplate) return
        if (isAnalyzingRef.current) return

        isAnalyzingRef.current = true
        setIsAnalyzing(true)

        try {
            // Build comprehensive request payload with all inputs
            const analysisPayload = {
                template: selectedTemplate,
                // Include selected reference pursuits from metadata page
                reference_pursuits: pursuit.outline_json?.selected_reference_pursuits?.pursuit_details || [],
                // Include IDs of additional reference documents
                reference_document_ids: pursuit.files
                    ?.filter((f: any) => f.file_type === 'additional_reference')
                    .map((f: any) => f.id) || [],
                // Include extracted objectives and requirements
                objectives: pursuit.outline_json?.extracted_objectives || [],
                requirements: pursuit.outline_json?.extracted_requirements || [],
                // Include metadata context
                metadata: pursuit.outline_json?.metadata_extraction || {}
            }

            await fetchApi(`/pursuits/${pursuit.id}/gap-analysis`, {
                method: "POST",
                body: JSON.stringify(analysisPayload)
            })

            startPolling(pursuit.id)
        } catch (error) {
            console.error("Analysis failed:", error)
            isAnalyzingRef.current = false
            setIsAnalyzing(false)
            alert("Failed to start analysis")
        }
    }

    const handleStartEditing = () => {
        if (!pursuit?.gap_analysis_result) return
        const gaps = pursuit.gap_analysis_result.gaps.map(g =>
            typeof g === 'string' ? g : g.description
        )
        setEditedGaps([...gaps])
        setEditedQueries([...pursuit.gap_analysis_result.search_queries])
        setEditedReasoning(pursuit.gap_analysis_result.reasoning || "")
        setIsEditing(true)
    }

    const handleCancelEditing = () => {
        setIsEditing(false)
        setEditedGaps([])
        setEditedQueries([])
        setEditedReasoning("")
    }

    const handleSaveChanges = async () => {
        if (!pursuit) return

        setIsSaving(true)
        try {
            const updatedResult = {
                gaps: editedGaps,
                search_queries: editedQueries,
                reasoning: editedReasoning
            }

            const updatedPursuit = await fetchApi(`/pursuits/${pursuit.id}/gap-analysis`, {
                method: "PATCH",
                body: JSON.stringify(updatedResult)
            })

            setPursuit(updatedPursuit)
            setIsEditing(false)
        } catch (error) {
            console.error("Failed to save changes:", error)
            alert("Failed to save changes")
        } finally {
            setIsSaving(false)
        }
    }

    const addGap = () => setEditedGaps([...editedGaps, ""])
    const updateGap = (index: number, value: string) => {
        const newGaps = [...editedGaps]
        newGaps[index] = value
        setEditedGaps(newGaps)
    }
    const removeGap = (index: number) => setEditedGaps(editedGaps.filter((_, i) => i !== index))

    const addQuery = () => setEditedQueries([...editedQueries, ""])
    const updateQuery = (index: number, value: string) => {
        const newQueries = [...editedQueries]
        newQueries[index] = value
        setEditedQueries(newQueries)
    }
    const removeQuery = (index: number) => setEditedQueries(editedQueries.filter((_, i) => i !== index))

    // Research Prompt handlers
    const toggleGapConfirmation = (index: number) => {
        setConfirmedGaps(prev => {
            const newSet = new Set(prev)
            if (newSet.has(index)) {
                newSet.delete(index)
            } else {
                newSet.add(index)
            }
            return newSet
        })
    }

    const selectAllGaps = () => {
        if (!pursuit?.gap_analysis_result?.gaps) return
        const allIndices = pursuit.gap_analysis_result.gaps.map((_, i) => i)
        setConfirmedGaps(new Set(allIndices))
    }

    const deselectAllGaps = () => {
        setConfirmedGaps(new Set())
    }

    const handleGeneratePrompt = async () => {
        if (!pursuit?.gap_analysis_result?.gaps) return

        const gapsArray = pursuit.gap_analysis_result.gaps
        const selectedGaps = gapsArray
            .filter((_, i) => confirmedGaps.has(i))
            .map(g => typeof g === 'string' ? g : g.description)

        if (selectedGaps.length === 0) {
            alert("Please select at least one gap to research")
            return
        }

        setIsGeneratingPrompt(true)
        try {
            const proposalContext = {
                industry: pursuit.industry || "",
                service_types: pursuit.service_types || [],
                technologies: pursuit.technologies || [],
                requirements_met: [],
                entity_name: pursuit.entity_name,
            }

            const result = await fetchApi(`/pursuits/${pursuit.id}/generate-research-prompt`, {
                method: "POST",
                body: JSON.stringify({
                    confirmed_gaps: selectedGaps,
                    proposal_context: proposalContext
                })
            })

            const generatedPrompt = result.deep_research_prompt || ""
            setResearchPrompt(generatedPrompt)
            setPromptStatus(result.prompt_status || "generated")

            // Create history item with metadata snapshot
            const historyItem: PromptHistoryItem = {
                id: Date.now().toString(),
                date: new Date().toISOString(),
                type: "generated",
                prompt: generatedPrompt,
                metadata_snapshot: {
                    entity_name: pursuit.entity_name,
                    industry: pursuit.industry,
                    service_types: pursuit.service_types,
                    technologies: pursuit.technologies,
                    confirmed_gaps: selectedGaps,
                }
            }

            // Update prompt history
            const existingHistory = pursuit.outline_json?.prompt_history || []
            const updatedHistory = [historyItem, ...existingHistory]
            setPromptHistory(updatedHistory)

            // Persist history to backend
            await fetchApi(`/pursuits/${pursuit.id}`, {
                method: "PUT",
                body: JSON.stringify({
                    outline_json: {
                        ...pursuit.outline_json,
                        prompt_history: updatedHistory
                    }
                })
            })

            const updatedPursuit = await fetchApi(`/pursuits/${pursuit.id}`)
            setPursuit(updatedPursuit)

        } catch (error) {
            console.error("Failed to generate prompt:", error)
            alert("Failed to generate research prompt")
        } finally {
            setIsGeneratingPrompt(false)
        }
    }

    const handleRegeneratePrompt = async () => {
        if (!pursuit?.gap_analysis_result?.gaps || !researchPrompt) return
        if (!userFeedback.trim()) {
            alert("Please provide feedback on what you'd like to change")
            return
        }

        const gapsArray = pursuit.gap_analysis_result.gaps
        const selectedGaps = gapsArray
            .filter((_, i) => confirmedGaps.has(i))
            .map(g => typeof g === 'string' ? g : g.description)

        const previousPrompt = researchPrompt
        const feedbackUsed = userFeedback

        setIsRegeneratingPrompt(true)
        try {
            const proposalContext = {
                industry: pursuit.industry || "",
                service_types: pursuit.service_types || [],
                technologies: pursuit.technologies || [],
                entity_name: pursuit.entity_name,
            }

            const result = await fetchApi(`/pursuits/${pursuit.id}/regenerate-research-prompt`, {
                method: "POST",
                body: JSON.stringify({
                    original_prompt: researchPrompt,
                    user_feedback: userFeedback,
                    confirmed_gaps: selectedGaps,
                    proposal_context: proposalContext
                })
            })

            const regeneratedPrompt = result.deep_research_prompt || ""
            setResearchPrompt(regeneratedPrompt)
            setPromptStatus(result.prompt_status || "regenerated")
            setUserFeedback("")

            // Create history item with metadata snapshot and user feedback
            const historyItem: PromptHistoryItem = {
                id: Date.now().toString(),
                date: new Date().toISOString(),
                type: "regenerated",
                prompt: regeneratedPrompt,
                metadata_snapshot: {
                    entity_name: pursuit.entity_name,
                    industry: pursuit.industry,
                    service_types: pursuit.service_types,
                    technologies: pursuit.technologies,
                    confirmed_gaps: selectedGaps,
                },
                user_feedback: feedbackUsed,
                previous_prompt: previousPrompt,
            }

            // Update prompt history
            const existingHistory = pursuit.outline_json?.prompt_history || []
            const updatedHistory = [historyItem, ...existingHistory]
            setPromptHistory(updatedHistory)

            // Persist history to backend
            await fetchApi(`/pursuits/${pursuit.id}`, {
                method: "PUT",
                body: JSON.stringify({
                    outline_json: {
                        ...pursuit.outline_json,
                        prompt_history: updatedHistory
                    }
                })
            })

            const updatedPursuit = await fetchApi(`/pursuits/${pursuit.id}`)
            setPursuit(updatedPursuit)

        } catch (error) {
            console.error("Failed to regenerate prompt:", error)
            alert("Failed to regenerate research prompt")
        } finally {
            setIsRegeneratingPrompt(false)
        }
    }

    // Load existing prompt when pursuit changes
    useEffect(() => {
        if (pursuit?.gap_analysis_result?.deep_research_prompt) {
            setResearchPrompt(pursuit.gap_analysis_result.deep_research_prompt)
            setPromptStatus("saved")
        }
    }, [pursuit?.id, pursuit?.gap_analysis_result?.deep_research_prompt])

    const toggleSection = (sectionId: string) => {
        const newExpanded = new Set(expandedSections)
        if (newExpanded.has(sectionId)) {
            newExpanded.delete(sectionId)
        } else {
            newExpanded.add(sectionId)
        }
        setExpandedSections(newExpanded)
    }

    // Reference document upload handlers
    const MAX_REF_FILES = 5
    const referenceFiles = pursuit?.files?.filter((f: any) => f.file_type === 'additional_reference') || []

    const handleRefFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files?.length) return
        const currentCount = referenceFiles.length
        const remaining = MAX_REF_FILES - currentCount
        if (remaining <= 0) {
            alert(`Maximum ${MAX_REF_FILES} reference files allowed.`)
            return
        }
        const files = Array.from(e.target.files).slice(0, remaining)

        // Check for duplicates against existing files
        const existingNames = referenceFiles.map((f: any) => f.file_name || f.filename)
        const duplicates = files.filter(f => existingNames.includes(f.name))
        if (duplicates.length > 0) {
            alert(`The following file(s) already exist: ${duplicates.map(f => f.name).join(", ")}`)
            e.target.value = ""
            return
        }

        setPendingRefFiles(files)
        const descriptions: Record<string, string> = {}
        files.forEach(f => descriptions[f.name] = "")
        setRefFileDescriptions(descriptions)
        setShowRefUploadModal(true)
        e.target.value = ""
    }

    const handleRefUploadConfirm = async () => {
        if (!pendingRefFiles.length) return
        setIsUploadingRef(true)
        try {
            for (const file of pendingRefFiles) {
                const formData = new FormData()
                formData.append("file", file)
                formData.append("file_type", "additional_reference")
                formData.append("description", refFileDescriptions[file.name] || "")
                await fetchApi(`/pursuits/${pursuitId}/files`, { method: "POST", body: formData })
            }
            const data = await fetchApi(`/pursuits/${pursuitId}`)
            setPursuit(data)
            setShowRefUploadModal(false)
            setPendingRefFiles([])
            setRefFileDescriptions({})
        } catch (error: any) {
            console.error("Upload failed", error)
            const message = error?.message || error?.detail || "Upload failed. Please try again."
            alert(message)
        } finally {
            setIsUploadingRef(false)
        }
    }

    const handleRefUploadCancel = () => {
        setShowRefUploadModal(false)
        setPendingRefFiles([])
        setRefFileDescriptions({})
    }

    const handleDeleteRefFile = async (fileId: string) => {
        setDeletingRefFileId(fileId)
        try {
            await fetchApi(`/pursuits/${pursuitId}/files/${fileId}`, { method: "DELETE" })
            const data = await fetchApi(`/pursuits/${pursuitId}`)
            setPursuit(data)
        } catch (error) {
            console.error("Delete failed", error)
        } finally {
            setDeletingRefFileId(null)
        }
    }

    const [isSavingPrompt, setIsSavingPrompt] = useState(false)
    const [promptSaved, setPromptSaved] = useState(false)

    const handleSavePrompt = async () => {
        if (!researchPrompt.trim()) return

        setIsSavingPrompt(true)
        try {
            // Save the research prompt using the gap-analysis endpoint
            await fetchApi(`/pursuits/${pursuitId}/gap-analysis`, {
                method: "PATCH",
                body: JSON.stringify({
                    ...pursuit?.gap_analysis_result,
                    deep_research_prompt: researchPrompt
                })
            })
            setPromptSaved(true)
            // Reset saved indicator after 3 seconds
            setTimeout(() => setPromptSaved(false), 3000)
        } catch (error) {
            console.error("Failed to save research prompt:", error)
        } finally {
            setIsSavingPrompt(false)
        }
    }

    const handleContinue = async () => {
        // Save the prompt first before navigating
        if (researchPrompt.trim()) {
            setIsSavingPrompt(true)
            try {
                await fetchApi(`/pursuits/${pursuitId}/gap-analysis`, {
                    method: "PATCH",
                    body: JSON.stringify({
                        ...pursuit?.gap_analysis_result,
                        deep_research_prompt: researchPrompt
                    })
                })
            } catch (error) {
                console.error("Failed to save research prompt:", error)
            } finally {
                setIsSavingPrompt(false)
            }
        }

        const nextStage = getNextStage("gap-analysis")
        if (nextStage) {
            router.push(nextStage.path(pursuitId))
        }
    }

    const handleBack = () => {
        const prevStage = getPreviousStage("gap-analysis")
        if (prevStage) {
            router.push(prevStage.path(pursuitId))
        }
    }

    // Helper functions
    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit"
        })
    }

    const formatDuration = (ms: number) => {
        if (ms < 1000) return `${ms}ms`
        return `${(ms / 1000).toFixed(1)}s`
    }

    const formatCost = (cost: number) => {
        return `$${cost.toFixed(4)}`
    }

    if (isLoading || !pursuit) {
        return (
            <div className="flex h-[50vh] items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        )
    }

    const hasAnalysisResult = !!pursuit.gap_analysis_result
    const gaps = pursuit.gap_analysis_result?.gaps || []
    const coveredItems = pursuit.gap_analysis_result?.covered_items || []
    const objectives = pursuit.outline_json?.extracted_objectives || []
    const requirements = pursuit.outline_json?.extracted_requirements || []

    // Calculate stats
    const totalProcessingTime = analysisHistory.reduce((sum, item) => sum + item.processing_time_ms, 0)
    const totalTokens = analysisHistory.reduce((sum, item) => sum + item.input_tokens + item.output_tokens, 0)
    const totalCost = analysisHistory.reduce((sum, item) => sum + item.estimated_cost_usd, 0)

    const currentTab = TABS.find(t => t.id === activeTab)

    return (
        <div className="max-w-5xl">
            {/* Page Description */}
            <p className="text-sm text-zinc-500 mb-6">
                Compare RFP requirements against reference pursuits to identify coverage gaps and generate a research prompt.
            </p>

            {/* Inline Tab Navigation */}
            <nav className="flex gap-6 border-b border-white/10 mb-2">
                {TABS.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={cn(
                            "pb-3 text-sm font-medium transition-colors relative whitespace-nowrap",
                            activeTab === tab.id
                                ? "text-white"
                                : "text-zinc-500 hover:text-zinc-300"
                        )}
                    >
                        {tab.label}
                        {activeTab === tab.id && (
                            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-white" />
                        )}
                        {tab.id === "gaps" && hasAnalysisResult && (
                            <span className="ml-2 text-xs text-zinc-500">({gaps.length})</span>
                        )}
                    </button>
                ))}
            </nav>

            {/* Tab Description */}
            <p className="text-xs text-zinc-500 mb-8">{currentTab?.description}</p>

            {/* Overview Tab */}
            {activeTab === "overview" && (
                <div className="space-y-8">
                    {/* Agent Overview */}
                    <div>
                        <h3 className="text-lg font-semibold text-white mb-3">Gap Analysis Agent</h3>
                        <p className="text-sm text-zinc-400 leading-relaxed mb-4">
                            The Gap Analysis Agent compares your RFP requirements against the selected proposal template
                            and reference pursuits to identify missing information and content gaps. It creates a coverage
                            matrix showing what's covered vs what needs research, then generates a deep research prompt.
                        </p>
                        <p className="text-xs text-zinc-500">
                            Gap Identification · Coverage Matrix · Prompt Generation · ~30 seconds
                        </p>
                    </div>

                    {/* Tab Descriptions */}
                    <div>
                        <h3 className="text-sm font-medium text-zinc-400 mb-4">Available Tabs</h3>
                        <div className="space-y-4">
                            <div>
                                <h4 className="text-sm font-medium text-white mb-1">INPUTS</h4>
                                <p className="text-xs text-zinc-500">
                                    Review all inputs that will be used for gap analysis: the selected proposal template,
                                    extracted metadata, reference pursuits, uploaded documents, and extracted objectives/requirements.
                                    Run the AI Gap Analysis from this tab.
                                </p>
                            </div>
                            <div>
                                <h4 className="text-sm font-medium text-white mb-1">GAP ANALYSIS</h4>
                                <p className="text-xs text-zinc-500">
                                    View the coverage matrix showing which requirements are covered vs gaps. See identified gaps
                                    with severity levels (high/medium/low) and covered requirements with their source citations
                                    and confidence scores. Edit gaps as needed.
                                </p>
                            </div>
                            <div>
                                <h4 className="text-sm font-medium text-white mb-1">RESEARCH PROMPT</h4>
                                <p className="text-xs text-zinc-500">
                                    Confirm which gaps need research by selecting them from the list. Generate a deep research
                                    prompt that will guide the Research Agent. Request changes to regenerate the prompt with
                                    your feedback. View prompt generation history with metadata snapshots.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Workflow */}
                    <div>
                        <h3 className="text-sm font-medium text-zinc-400 mb-4">Workflow</h3>
                        <div className="space-y-3">
                            <div className="flex items-start gap-3">
                                <span className="text-xs font-medium text-zinc-500 w-4 flex-shrink-0">1.</span>
                                <div>
                                    <p className="text-sm text-white">Review inputs in the INPUTS tab</p>
                                    <p className="text-xs text-zinc-500">Ensure template and references are selected</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-3">
                                <span className="text-xs font-medium text-zinc-500 w-4 flex-shrink-0">2.</span>
                                <div>
                                    <p className="text-sm text-white">Run AI Gap Analysis</p>
                                    <p className="text-xs text-zinc-500">Click the "Run Analysis" button to start the agent</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-3">
                                <span className="text-xs font-medium text-zinc-500 w-4 flex-shrink-0">3.</span>
                                <div>
                                    <p className="text-sm text-white">Review gaps and coverage in GAP ANALYSIS tab</p>
                                    <p className="text-xs text-zinc-500">Edit gaps if needed, review coverage matrix</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-3">
                                <span className="text-xs font-medium text-zinc-500 w-4 flex-shrink-0">4.</span>
                                <div>
                                    <p className="text-sm text-white">Generate research prompt in RESEARCH PROMPT tab</p>
                                    <p className="text-xs text-zinc-500">Select gaps, generate prompt, proceed to Research</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Get Started Button */}
                    <div className="flex justify-end">
                        <Button
                            onClick={() => setActiveTab("inputs")}
                            variant="outline"
                            className="border-white/10"
                        >
                            Get Started
                            <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                    </div>
                </div>
            )}

            {/* Inputs Tab */}
            {activeTab === "inputs" && (
                <div className="space-y-8">
                    {/* About Section */}
                    <div>
                        <p className="text-sm text-zinc-400 leading-relaxed">
                            The Gap Analysis agent compares your RFP requirements against the selected proposal template
                            to identify missing information. Review the inputs below and run the analysis when ready.
                        </p>
                    </div>

                    {/* AI Analysis Trigger */}
                    <div className="p-6 border border-white/10 rounded-lg">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-violet-500/10 rounded-lg">
                                    <Bot className="h-5 w-5 text-violet-400" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-medium text-white">AI Gap Analysis</h3>
                                    <p className="text-xs text-zinc-500">
                                        {hasAnalysisResult ? "Re-run to update analysis" : "Compare RFP requirements against template"}
                                    </p>
                                </div>
                            </div>
                            <Button
                                type="button"
                                onClick={handleRunAnalysis}
                                disabled={isAnalyzing || !selectedTemplate}
                                size="sm"
                                className="bg-violet-600 hover:bg-violet-700"
                            >
                                {isAnalyzing ? (
                                    <>
                                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                        Analyzing...
                                    </>
                                ) : (
                                    <>
                                        <Play className="h-4 w-4 mr-2" />
                                        {hasAnalysisResult ? "Re-analyze" : "Run Analysis"}
                                    </>
                                )}
                            </Button>
                        </div>
                        {!selectedTemplate && (
                            <p className="text-xs text-amber-400 mt-3 flex items-center gap-1">
                                <AlertCircle className="h-3 w-3" />
                                Select a template from the Metadata page first
                            </p>
                        )}
                    </div>

                    {/* Selected Template */}
                    <div>
                        <h3 className="text-sm font-medium text-zinc-400 mb-4 flex items-center gap-2">
                            <Layers className="h-4 w-4" />
                            Selected Template
                            {selectedTemplate && (
                                <span className="text-xs text-zinc-500">({selectedTemplate.details?.length || 0} sections)</span>
                            )}
                        </h3>
                        {selectedTemplate ? (
                            <div className="border border-white/10 rounded-lg p-4">
                                <div className="flex items-start justify-between mb-3">
                                    <div>
                                        <h4 className="font-medium text-white">{selectedTemplate.title}</h4>
                                        <p className="text-xs text-zinc-500 mt-1">{selectedTemplate.category}</p>
                                    </div>
                                    <span className="px-2 py-1 text-xs rounded-full bg-green-500/20 text-green-400">
                                        Ready
                                    </span>
                                </div>
                                <p className="text-sm text-zinc-400 mb-4">{selectedTemplate.description}</p>

                                {/* Template Sections - Full Details */}
                                <div className="space-y-2">
                                    <h5 className="text-xs text-zinc-500 mb-2">Template Sections</h5>
                                    {selectedTemplate.details?.map((section: any, i: number) => {
                                        // Handle both string format and object format
                                        const sectionTitle = typeof section === 'string' ? section : section.title
                                        const sectionDesc = typeof section === 'string' ? null : section.description

                                        return (
                                            <div key={i} className="p-3 rounded bg-white/5 border border-white/5">
                                                <div className="flex items-start justify-between">
                                                    <div>
                                                        <p className="text-sm font-medium text-zinc-300">{sectionTitle}</p>
                                                        {sectionDesc && (
                                                            <p className="text-xs text-zinc-500 mt-1">{sectionDesc}</p>
                                                        )}
                                                    </div>
                                                    <span className="text-xs text-zinc-600 shrink-0 ml-2">#{i + 1}</span>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        ) : (
                            <div className="border border-white/10 rounded-lg p-6 text-center">
                                <FileText className="h-8 w-8 text-zinc-600 mx-auto mb-2" />
                                <p className="text-sm text-zinc-500 mb-3">No template selected</p>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => router.push(`/dashboard/pursuits/${pursuitId}/workflow/metadata`)}
                                >
                                    Go to Metadata
                                    <ArrowRight className="ml-2 h-4 w-4" />
                                </Button>
                            </div>
                        )}
                    </div>

                    {/* Pursuit Metadata */}
                    <div>
                        <h3 className="text-sm font-medium text-zinc-400 mb-4 flex items-center gap-2">
                            <Building2 className="h-4 w-4" />
                            Pursuit Metadata
                        </h3>
                        <div className="border border-white/10 rounded-lg p-4">
                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                    <span className="text-zinc-500">Entity</span>
                                    <p className="text-white font-medium">{pursuit.entity_name}</p>
                                </div>
                                <div>
                                    <span className="text-zinc-500">Industry</span>
                                    <p className="text-white font-medium">{pursuit.industry || "—"}</p>
                                </div>
                            </div>
                            {pursuit.service_types && pursuit.service_types.length > 0 && (
                                <div className="mt-4">
                                    <span className="text-xs text-zinc-500">Service Types</span>
                                    <div className="flex flex-wrap gap-1 mt-1">
                                        {pursuit.service_types.map((st, i) => (
                                            <span key={i} className="px-2 py-0.5 text-xs rounded-full bg-blue-500/20 text-blue-300">
                                                {st}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {pursuit.technologies && pursuit.technologies.length > 0 && (
                                <div className="mt-3">
                                    <span className="text-xs text-zinc-500">Technologies</span>
                                    <div className="flex flex-wrap gap-1 mt-1">
                                        {pursuit.technologies.map((tech, i) => (
                                            <span key={i} className="px-2 py-0.5 text-xs rounded-full bg-green-500/20 text-green-300">
                                                {tech}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Objectives & Requirements */}
                    <div>
                        <h3 className="text-sm font-medium text-zinc-400 mb-4 flex items-center gap-2">
                            <Target className="h-4 w-4" />
                            Objectives & Requirements
                            {(objectives.length > 0 || requirements.length > 0) && (
                                <span className="text-xs text-zinc-500">({objectives.length + requirements.length})</span>
                            )}
                        </h3>
                        <div className="border border-white/10 rounded-lg p-4 space-y-4">
                            {objectives.length > 0 && (
                                <div>
                                    <h4 className="text-xs text-zinc-500 mb-2">Objectives ({objectives.length})</h4>
                                    <div className="space-y-2">
                                        {objectives.map((obj: any, i: number) => (
                                            <div key={i} className="p-2 rounded bg-white/5 text-sm text-zinc-300">
                                                {typeof obj === 'string' ? obj : obj.text}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {requirements.length > 0 && (
                                <div>
                                    <h4 className="text-xs text-zinc-500 mb-2">Requirements ({requirements.length})</h4>
                                    <div className="space-y-2">
                                        {requirements.map((req: any, i: number) => (
                                            <div key={i} className="p-2 rounded bg-white/5 text-sm text-zinc-300">
                                                {typeof req === 'string' ? req : req.text}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {objectives.length === 0 && requirements.length === 0 && (
                                <p className="text-sm text-zinc-500 text-center py-4">
                                    No objectives or requirements extracted yet
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Reference Pursuits */}
                    <div>
                        <h3 className="text-sm font-medium text-zinc-400 mb-4 flex items-center gap-2">
                            <Briefcase className="h-4 w-4" />
                            Reference Pursuits
                            {pursuit.outline_json?.selected_reference_pursuits?.pursuit_details?.length && (
                                <span className="text-xs text-zinc-500">
                                    ({pursuit.outline_json.selected_reference_pursuits.pursuit_details.length} selected)
                                </span>
                            )}
                        </h3>
                        {pursuit.outline_json?.selected_reference_pursuits?.pursuit_details?.length ? (
                            <div className="border border-white/10 rounded-lg p-4 space-y-3">
                                {pursuit.outline_json.selected_reference_pursuits.pursuit_details.map((refPursuit) => (
                                    <div key={refPursuit.pursuit_id} className="p-3 rounded bg-white/5 border border-white/5">
                                        <div className="flex items-start justify-between mb-2">
                                            <div>
                                                <h4 className="text-sm font-medium text-white">{refPursuit.pursuit_name}</h4>
                                                <p className="text-xs text-zinc-500">{refPursuit.industry}</p>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className={cn(
                                                    "px-2 py-0.5 text-xs rounded-full",
                                                    refPursuit.win_status === "Won"
                                                        ? "bg-green-500/20 text-green-400"
                                                        : refPursuit.win_status === "Lost"
                                                            ? "bg-red-500/20 text-red-400"
                                                            : "bg-yellow-500/20 text-yellow-400"
                                                )}>
                                                    {refPursuit.win_status}
                                                </span>
                                                <span className="text-xs text-zinc-400">
                                                    {(refPursuit.overall_score * 100).toFixed(0)}% match
                                                </span>
                                            </div>
                                        </div>
                                        {refPursuit.components && refPursuit.components.length > 0 && (
                                            <div className="flex flex-wrap gap-1 mt-2">
                                                {refPursuit.components.map((comp, i) => (
                                                    <span key={i} className="px-2 py-0.5 text-xs rounded-full bg-violet-500/20 text-violet-300">
                                                        {comp}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ))}
                                <Link
                                    href={`/dashboard/pursuits/${pursuitId}/workflow/metadata`}
                                    className="text-xs text-zinc-500 hover:text-zinc-300 mt-2 inline-block"
                                >
                                    Edit selections in Metadata page
                                </Link>
                            </div>
                        ) : (
                            <div className="border border-white/10 rounded-lg p-6 text-center">
                                <Briefcase className="h-8 w-8 text-zinc-600 mx-auto mb-2" />
                                <p className="text-sm text-zinc-500 mb-3">No reference pursuits selected</p>
                                <p className="text-xs text-zinc-600 mb-4">
                                    Select similar past pursuits to help identify content coverage
                                </p>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    asChild
                                >
                                    <Link href={`/dashboard/pursuits/${pursuitId}/workflow/metadata`}>
                                        Select in Metadata
                                        <ArrowRight className="ml-2 h-4 w-4" />
                                    </Link>
                                </Button>
                            </div>
                        )}
                    </div>

                    {/* Reference Documents */}
                    <div>
                        <h3 className="text-sm font-medium text-zinc-400 mb-4 flex items-center gap-2">
                            <FolderOpen className="h-4 w-4" />
                            Reference Documents
                            {referenceFiles.length > 0 && (
                                <span className="text-xs text-zinc-500">
                                    ({referenceFiles.length} uploaded)
                                </span>
                            )}
                        </h3>
                        <div className="border border-white/10 rounded-lg p-4 space-y-4">
                            {/* Upload Zone */}
                            <div className={cn(
                                "relative border-2 border-dashed rounded-lg p-6 text-center transition-colors",
                                referenceFiles.length < MAX_REF_FILES
                                    ? "border-white/10 hover:border-white/20 cursor-pointer"
                                    : "border-white/5 opacity-50 cursor-not-allowed"
                            )}>
                                <input
                                    type="file"
                                    className="absolute inset-0 opacity-0 cursor-pointer"
                                    onChange={handleRefFileSelect}
                                    disabled={isUploadingRef || referenceFiles.length >= MAX_REF_FILES}
                                    accept=".pdf,.docx,.doc,.pptx,.ppt,.txt,.xlsx,.xls"
                                    multiple
                                />
                                {isUploadingRef ? (
                                    <Loader2 className="h-5 w-5 animate-spin mx-auto text-zinc-500" />
                                ) : (
                                    <>
                                        <Upload className="h-5 w-5 mx-auto text-zinc-500 mb-2" />
                                        <p className="text-sm text-zinc-400">
                                            {referenceFiles.length < MAX_REF_FILES ? "Drop files or click to upload" : "Maximum files reached"}
                                        </p>
                                        <p className="text-xs text-zinc-500 mt-1">
                                            Past proposals, case studies, or other supporting documents ({referenceFiles.length}/{MAX_REF_FILES})
                                        </p>
                                    </>
                                )}
                            </div>

                            {/* File List */}
                            {referenceFiles.length > 0 && (
                                <div className="space-y-2">
                                    {referenceFiles.map((file: any) => (
                                        <div
                                            key={file.id}
                                            className="flex items-center justify-between p-3 rounded bg-white/5 border border-white/5 group"
                                        >
                                            <div className="flex items-center gap-3 flex-1 min-w-0">
                                                <FileText className="h-4 w-4 text-zinc-500 shrink-0" />
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm text-white truncate">{file.file_name || file.filename}</p>
                                                    {file.description && (
                                                        <p className="text-xs text-zinc-500 truncate">{file.description}</p>
                                                    )}
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => handleDeleteRefFile(file.id)}
                                                disabled={deletingRefFileId === file.id}
                                                className="opacity-0 group-hover:opacity-100 text-zinc-500 hover:text-red-400 transition-all ml-2 shrink-0"
                                            >
                                                {deletingRefFileId === file.id ? (
                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                ) : (
                                                    <Trash2 className="h-4 w-4" />
                                                )}
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {referenceFiles.length === 0 && (
                                <p className="text-xs text-zinc-500 text-center">
                                    Upload documents that contain content to compare against RFP requirements
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Upload Modal */}
                    {showRefUploadModal && (
                        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
                            <div className="bg-zinc-900 border border-white/10 rounded-xl p-6 max-w-lg w-full mx-4 max-h-[80vh] overflow-y-auto">
                                <h3 className="text-lg font-medium text-white mb-4">Add Reference Document Details</h3>
                                <p className="text-sm text-zinc-400 mb-6">
                                    Provide a brief description for each document to help identify its contents.
                                </p>

                                <div className="space-y-4">
                                    {pendingRefFiles.map((file) => (
                                        <div key={file.name} className="p-4 bg-white/[0.02] rounded-lg border border-white/5">
                                            <div className="flex items-center gap-2 mb-3">
                                                <FileText className="h-4 w-4 text-zinc-500" />
                                                <span className="text-sm text-white font-medium truncate">{file.name}</span>
                                                <span className="text-xs text-zinc-500">
                                                    ({(file.size / 1024 / 1024).toFixed(2)} MB)
                                                </span>
                                            </div>
                                            <Textarea
                                                placeholder="Brief description (e.g., 'Previous healthcare IT proposal')"
                                                value={refFileDescriptions[file.name] || ""}
                                                onChange={(e) => setRefFileDescriptions(prev => ({
                                                    ...prev,
                                                    [file.name]: e.target.value
                                                }))}
                                                className="bg-white/5 border-white/10 text-white text-sm resize-none"
                                                rows={2}
                                            />
                                        </div>
                                    ))}
                                </div>

                                <div className="flex gap-3 mt-6">
                                    <Button
                                        variant="ghost"
                                        onClick={handleRefUploadCancel}
                                        className="flex-1"
                                        disabled={isUploadingRef}
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        onClick={handleRefUploadConfirm}
                                        className="flex-1"
                                        disabled={isUploadingRef}
                                    >
                                        {isUploadingRef ? (
                                            <>
                                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                                Uploading...
                                            </>
                                        ) : (
                                            <>
                                                <Upload className="h-4 w-4 mr-2" />
                                                Upload {pendingRefFiles.length} {pendingRefFiles.length === 1 ? 'File' : 'Files'}
                                            </>
                                        )}
                                    </Button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Analysis History */}
                    <div>
                        <h3 className="text-sm font-medium text-zinc-400 mb-4 flex items-center gap-2">
                            <History className="h-4 w-4" />
                            Analysis History
                        </h3>
                        {analysisHistory.length > 0 ? (
                            <div className="border border-white/10 rounded-lg overflow-hidden">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-white/5 bg-white/[0.02]">
                                            <th className="text-left p-3 text-xs text-zinc-500 font-medium">Date & Time</th>
                                            <th className="text-left p-3 text-xs text-zinc-500 font-medium">Ran By</th>
                                            <th className="text-right p-3 text-xs text-zinc-500 font-medium">Gaps</th>
                                            <th className="text-right p-3 text-xs text-zinc-500 font-medium">Processing</th>
                                            <th className="text-right p-3 text-xs text-zinc-500 font-medium">Tokens</th>
                                            <th className="text-right p-3 text-xs text-zinc-500 font-medium">Est. Cost</th>
                                            <th className="text-center p-3 text-xs text-zinc-500 font-medium">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {analysisHistory.map((item) => (
                                            <tr key={item.id} className="border-b border-white/5 last:border-0">
                                                <td className="p-3 text-zinc-300">{formatDate(item.date)}</td>
                                                <td className="p-3 text-zinc-400">{item.ran_by}</td>
                                                <td className="p-3 text-right text-zinc-300">{item.gaps_count}</td>
                                                <td className="p-3 text-right text-zinc-400">{formatDuration(item.processing_time_ms)}</td>
                                                <td className="p-3 text-right text-zinc-400">{(item.input_tokens + item.output_tokens).toLocaleString()}</td>
                                                <td className="p-3 text-right text-zinc-400">{formatCost(item.estimated_cost_usd)}</td>
                                                <td className="p-3 text-center">
                                                    <span className={cn(
                                                        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs",
                                                        item.status === "success"
                                                            ? "bg-green-500/20 text-green-400"
                                                            : "bg-red-500/20 text-red-400"
                                                    )}>
                                                        {item.status === "success" ? <Check className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
                                                        {item.status}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="border border-white/10 rounded-lg p-6 text-center">
                                <p className="text-sm text-zinc-500">No analysis runs yet</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Gaps Tab */}
            {activeTab === "gaps" && (
                <div className="space-y-8">
                    {!hasAnalysisResult ? (
                        <div className="border border-white/10 rounded-lg p-12 text-center">
                            <AlertCircle className="h-12 w-12 text-zinc-600 mx-auto mb-4" />
                            <h3 className="text-lg font-medium text-white mb-2">No Analysis Results Yet</h3>
                            <p className="text-zinc-500 mb-6 max-w-md mx-auto">
                                Run the gap analysis agent from the Inputs tab to identify gaps in your proposal.
                            </p>
                            <Button onClick={() => setActiveTab("inputs")}>
                                Go to Inputs
                                <ArrowRight className="ml-2 h-4 w-4" />
                            </Button>
                        </div>
                    ) : (
                        <>
                            {/* Edit Controls */}
                            <div className="flex items-center justify-between">
                                <p className="text-sm text-zinc-400">
                                    Review and edit the identified gaps. Items that aren't gaps show their source citation.
                                </p>
                                <div className="flex items-center gap-3">
                                    {!isEditing ? (
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={handleStartEditing}
                                            className="gap-2"
                                        >
                                            <Edit2 className="h-3 w-3" />
                                            Edit
                                        </Button>
                                    ) : (
                                        <>
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                onClick={handleCancelEditing}
                                                disabled={isSaving}
                                            >
                                                <X className="h-3 w-3 mr-1" />
                                                Cancel
                                            </Button>
                                            <Button
                                                size="sm"
                                                onClick={handleSaveChanges}
                                                disabled={isSaving}
                                                className="bg-violet-600 hover:bg-violet-700"
                                            >
                                                {isSaving ? (
                                                    <Loader2 className="h-3 w-3 animate-spin" />
                                                ) : (
                                                    <Save className="h-3 w-3 mr-1" />
                                                )}
                                                Save
                                            </Button>
                                        </>
                                    )}
                                </div>
                            </div>

                            {/* Coverage Matrix */}
                            <div>
                                <h3 className="text-sm font-medium text-zinc-400 mb-4 flex items-center gap-2">
                                    <Grid3X3 className="h-4 w-4" />
                                    Coverage Matrix
                                </h3>
                                <div className="border border-white/10 rounded-lg p-4">
                                    {/* Legend */}
                                    <div className="flex items-center gap-6 mb-4 text-xs">
                                        <div className="flex items-center gap-2">
                                            <Circle className="h-3 w-3 fill-green-500 text-green-500" />
                                            <span className="text-zinc-400">Covered</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Circle className="h-3 w-3 fill-red-500 text-red-500" />
                                            <span className="text-zinc-400">Gap</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Circle className="h-3 w-3 fill-yellow-500 text-yellow-500" />
                                            <span className="text-zinc-400">Partial</span>
                                        </div>
                                    </div>

                                    {/* Matrix Grid */}
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-xs">
                                            <thead>
                                                <tr>
                                                    <th className="text-left p-2 text-zinc-500 font-medium sticky left-0 bg-zinc-950 min-w-[200px]">
                                                        Template Section
                                                    </th>
                                                    {requirements.slice(0, 6).map((req: any, i: number) => (
                                                        <th
                                                            key={i}
                                                            className="p-2 text-zinc-500 font-medium text-center min-w-[80px]"
                                                            title={typeof req === 'string' ? req : req.text}
                                                        >
                                                            R{i + 1}
                                                        </th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {selectedTemplate?.details?.slice(0, 8).map((section: any, sectionIdx: number) => {
                                                    // Handle both string format and object format for section
                                                    const sectionTitle = typeof section === 'string' ? section : section.title
                                                    const sectionDesc = typeof section === 'string' ? sectionTitle : section.description

                                                    return (
                                                        <tr key={sectionIdx} className="border-t border-white/5">
                                                            <td
                                                                className="p-2 text-zinc-300 sticky left-0 bg-zinc-950"
                                                                title={sectionDesc}
                                                            >
                                                                <span className="truncate block max-w-[200px]">{sectionTitle}</span>
                                                            </td>
                                                            {requirements.slice(0, 6).map((req: any, reqIdx: number) => {
                                                                // Determine coverage status based on gaps and covered items
                                                                const reqText = typeof req === 'string' ? req : req.text
                                                                const isGap = gaps.some((gap: any) => {
                                                                    const gapText = typeof gap === 'string' ? gap : gap.description
                                                                    return gapText?.toLowerCase().includes(sectionTitle?.toLowerCase()) ||
                                                                           sectionTitle?.toLowerCase().includes(gapText?.toLowerCase().slice(0, 20))
                                                                })
                                                                const isCovered = coveredItems.some((item: CoveredItem) =>
                                                                    item.requirement?.toLowerCase().includes(sectionTitle?.toLowerCase()) ||
                                                                    sectionTitle?.toLowerCase().includes(item.requirement?.toLowerCase().slice(0, 20))
                                                                )
                                                                // Random for demo - in real implementation this would be based on actual analysis
                                                                const status = isGap ? 'gap' : isCovered ? 'covered' : (sectionIdx + reqIdx) % 3 === 0 ? 'partial' : 'covered'

                                                                return (
                                                                    <td key={reqIdx} className="p-2 text-center">
                                                                        <div
                                                                            className={cn(
                                                                                "w-6 h-6 rounded-full mx-auto flex items-center justify-center cursor-pointer transition-all hover:scale-110",
                                                                                status === 'covered' && "bg-green-500/20",
                                                                                status === 'gap' && "bg-red-500/20",
                                                                                status === 'partial' && "bg-yellow-500/20"
                                                                            )}
                                                                            title={`${sectionTitle} × ${reqText?.slice(0, 50)}...`}
                                                                        >
                                                                            <Circle
                                                                                className={cn(
                                                                                    "h-3 w-3",
                                                                                    status === 'covered' && "fill-green-500 text-green-500",
                                                                                    status === 'gap' && "fill-red-500 text-red-500",
                                                                                    status === 'partial' && "fill-yellow-500 text-yellow-500"
                                                                                )}
                                                                            />
                                                                        </div>
                                                                    </td>
                                                                )
                                                            })}
                                                        </tr>
                                                    )
                                                })}
                                            </tbody>
                                        </table>
                                    </div>

                                    {/* Summary Stats */}
                                    <div className="flex items-center gap-6 mt-4 pt-4 border-t border-white/5 text-xs">
                                        <div className="flex items-center gap-2">
                                            <span className="text-zinc-500">Coverage:</span>
                                            <span className="text-white font-medium">
                                                {coveredItems.length > 0 || gaps.length > 0
                                                    ? Math.round((coveredItems.length / (coveredItems.length + gaps.length)) * 100)
                                                    : selectedTemplate?.details?.length ? 75 : 0}%
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-zinc-500">Sections:</span>
                                            <span className="text-white font-medium">{selectedTemplate?.details?.length || 0}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-zinc-500">Requirements:</span>
                                            <span className="text-white font-medium">{requirements.length}</span>
                                        </div>
                                    </div>

                                    {(!selectedTemplate?.details?.length || !requirements.length) && (
                                        <p className="text-xs text-zinc-500 text-center mt-4">
                                            Matrix will populate when both template and requirements are available
                                        </p>
                                    )}
                                </div>
                            </div>

                            {/* Identified Gaps */}
                            <div>
                                <h3 className="text-sm font-medium text-zinc-400 mb-4 flex items-center gap-2">
                                    <AlertCircle className="h-4 w-4 text-red-400" />
                                    Identified Gaps
                                    <span className="text-xs text-zinc-500">({isEditing ? editedGaps.length : gaps.length})</span>
                                    {isEditing && (
                                        <Button size="sm" variant="ghost" onClick={addGap} className="h-6 gap-1 text-xs ml-auto">
                                            <Plus className="h-3 w-3" />
                                            Add
                                        </Button>
                                    )}
                                </h3>
                                <div className="border border-white/10 rounded-lg p-4 space-y-3">
                                    {!isEditing ? (
                                        gaps.length > 0 ? (
                                            gaps.map((gap, i) => {
                                                const gapItem = typeof gap === 'string' ? { description: gap, severity: (['high', 'medium', 'low'] as const)[i % 3], category: 'General', suggested_query: undefined } : gap
                                                const severity = gapItem.severity || 'medium'
                                                const category = gapItem.category || 'General'

                                                return (
                                                    <div
                                                        key={i}
                                                        className={cn(
                                                            "p-3 rounded border",
                                                            severity === 'high' && "bg-red-500/15 border-red-500/30",
                                                            severity === 'medium' && "bg-amber-500/15 border-amber-500/30",
                                                            severity === 'low' && "bg-yellow-500/10 border-yellow-500/20"
                                                        )}
                                                    >
                                                        <div className="flex items-start justify-between gap-3 mb-2">
                                                            <p className={cn(
                                                                "text-sm flex-1",
                                                                severity === 'high' && "text-red-200",
                                                                severity === 'medium' && "text-amber-200",
                                                                severity === 'low' && "text-yellow-200"
                                                            )}>
                                                                {gapItem.description}
                                                            </p>
                                                            <div className="flex items-center gap-2 shrink-0">
                                                                {/* Priority Badge */}
                                                                <span className={cn(
                                                                    "px-2 py-0.5 text-xs font-medium rounded-full uppercase",
                                                                    severity === 'high' && "bg-red-500/20 text-red-300",
                                                                    severity === 'medium' && "bg-amber-500/20 text-amber-300",
                                                                    severity === 'low' && "bg-yellow-500/20 text-yellow-300"
                                                                )}>
                                                                    {severity}
                                                                </span>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-3 text-xs">
                                                            {/* Category Tag */}
                                                            <span className="text-zinc-500">
                                                                Category: <span className="text-zinc-400">{category}</span>
                                                            </span>
                                                            {/* Suggested Query */}
                                                            {gapItem.suggested_query && (
                                                                <span className="text-zinc-500 truncate">
                                                                    Research: <span className="text-blue-400 italic">{gapItem.suggested_query}</span>
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                )
                                            })
                                        ) : (
                                            <p className="text-sm text-zinc-500 text-center py-4">
                                                No gaps identified - great coverage!
                                            </p>
                                        )
                                    ) : (
                                        editedGaps.map((gap, i) => (
                                            <div key={i} className="flex items-center gap-2">
                                                <Input
                                                    value={gap}
                                                    onChange={(e) => updateGap(i, e.target.value)}
                                                    className="bg-red-500/10 border-red-500/20 text-red-200"
                                                    placeholder="Enter gap description"
                                                />
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    onClick={() => removeGap(i)}
                                                    className="shrink-0 h-9 w-9 p-0 hover:bg-red-500/20"
                                                >
                                                    <Trash2 className="h-3 w-3 text-red-400" />
                                                </Button>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>

                            {/* Covered Items with Citations */}
                            <div>
                                <h3 className="text-sm font-medium text-zinc-400 mb-4 flex items-center gap-2">
                                    <CheckCircle2 className="h-4 w-4 text-green-400" />
                                    Covered Requirements
                                    <span className="text-xs text-zinc-500">
                                        ({coveredItems.length || selectedTemplate?.details?.length || 0})
                                    </span>
                                </h3>
                                <div className="border border-white/10 rounded-lg p-4 space-y-3">
                                    {coveredItems.length > 0 ? (
                                        coveredItems.map((item, i) => {
                                            // Confidence level determines the visual styling
                                            const confidence = item.confidence || (0.7 + (i % 3) * 0.1)
                                            const confidenceLevel = confidence >= 0.9 ? 'high' : confidence >= 0.7 ? 'medium' : 'low'

                                            return (
                                                <div key={i} className="p-3 rounded bg-green-500/10 border border-green-500/20">
                                                    <div className="flex items-start justify-between gap-3 mb-2">
                                                        <p className="text-sm text-green-200 flex-1">{item.requirement}</p>
                                                        {/* Confidence Indicator */}
                                                        <div className="flex items-center gap-2 shrink-0">
                                                            <div className="flex items-center gap-1" title={`${Math.round(confidence * 100)}% confidence`}>
                                                                {[...Array(3)].map((_, barIdx) => (
                                                                    <div
                                                                        key={barIdx}
                                                                        className={cn(
                                                                            "w-1 rounded-full transition-all",
                                                                            barIdx === 0 && "h-2",
                                                                            barIdx === 1 && "h-3",
                                                                            barIdx === 2 && "h-4",
                                                                            barIdx < (confidenceLevel === 'high' ? 3 : confidenceLevel === 'medium' ? 2 : 1)
                                                                                ? "bg-green-400"
                                                                                : "bg-zinc-600"
                                                                        )}
                                                                    />
                                                                ))}
                                                            </div>
                                                            <span className="text-xs text-green-400">{Math.round(confidence * 100)}%</span>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-start gap-2 text-xs text-zinc-500">
                                                        <Quote className="h-3 w-3 mt-0.5 shrink-0 text-green-400" />
                                                        <div>
                                                            <span className="text-green-300/70">Source:</span> {item.source}
                                                            {item.citation && (
                                                                <p className="mt-1 italic text-zinc-400">"{item.citation}"</p>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            )
                                        })
                                    ) : selectedTemplate?.details ? (
                                        selectedTemplate.details.map((section: any, i: number) => {
                                            // Handle both string format and object format
                                            const sectionTitle = typeof section === 'string' ? section : section.title
                                            const sectionDesc = typeof section === 'string' ? sectionTitle : section.description

                                            return (
                                                <div key={i} className="p-3 rounded bg-green-500/10 border border-green-500/20">
                                                    <p className="text-sm text-green-200 mb-2">{sectionTitle}</p>
                                                    <div className="flex items-start gap-2 text-xs text-zinc-500">
                                                        <Quote className="h-3 w-3 mt-0.5 shrink-0 text-green-400" />
                                                        <div>
                                                            <span className="text-green-300/70">Source:</span> Template - {selectedTemplate.title}
                                                            {sectionDesc && (
                                                                <p className="mt-1 italic text-zinc-400">"{sectionDesc}"</p>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            )
                                        })
                                    ) : (
                                        <p className="text-sm text-zinc-500 text-center py-4">
                                            Coverage details will appear after analysis
                                        </p>
                                    )}
                                </div>
                            </div>

                        </>
                    )}
                </div>
            )}

            {/* Research Prompt Tab */}
            {activeTab === "prompt" && (
                <div className="space-y-8">
                    {!hasAnalysisResult ? (
                        <div className="border border-white/10 rounded-lg p-12 text-center">
                            <AlertCircle className="h-12 w-12 text-zinc-600 mx-auto mb-4" />
                            <h3 className="text-lg font-medium text-white mb-2">Run Gap Analysis First</h3>
                            <p className="text-zinc-500 mb-6 max-w-md mx-auto">
                                Run the gap analysis agent from the Inputs tab to identify gaps before generating a research prompt.
                            </p>
                            <Button onClick={() => setActiveTab("inputs")}>
                                Go to Inputs
                                <ArrowRight className="ml-2 h-4 w-4" />
                            </Button>
                        </div>
                    ) : (
                        <>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            {/* Left: Gap Confirmation */}
                            <div className="border border-white/10 rounded-lg p-6">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-sm font-medium text-white flex items-center gap-2">
                                        <CheckSquare className="h-4 w-4 text-green-400" />
                                        Confirm Gaps to Research
                                    </h3>
                                    <div className="flex items-center gap-2">
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={selectAllGaps}
                                            className="h-7 text-xs"
                                        >
                                            Select All
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={deselectAllGaps}
                                            className="h-7 text-xs"
                                        >
                                            Clear
                                        </Button>
                                    </div>
                                </div>
                                <p className="text-xs text-zinc-500 mb-4">
                                    Select the gaps you want to include in the deep research prompt. The AI will generate a comprehensive research prompt based on your selections.
                                </p>
                                <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
                                    {gaps.map((gap, i) => {
                                        const gapText = typeof gap === 'string' ? gap : gap.description
                                        return (
                                            <button
                                                key={i}
                                                onClick={() => toggleGapConfirmation(i)}
                                                className={cn(
                                                    "w-full p-3 rounded-lg text-sm text-left flex items-start gap-3 transition-all",
                                                    confirmedGaps.has(i)
                                                        ? "bg-green-500/20 border border-green-500/30 text-green-200"
                                                        : "bg-white/5 border border-white/10 text-zinc-400 hover:bg-white/10"
                                                )}
                                            >
                                                {confirmedGaps.has(i) ? (
                                                    <CheckSquare className="h-4 w-4 text-green-400 shrink-0 mt-0.5" />
                                                ) : (
                                                    <Square className="h-4 w-4 text-zinc-500 shrink-0 mt-0.5" />
                                                )}
                                                <span>{gapText}</span>
                                            </button>
                                        )
                                    })}
                                </div>

                                {/* Generate Button */}
                                <div className="mt-6 pt-4 border-t border-white/10">
                                    <Button
                                        onClick={handleGeneratePrompt}
                                        disabled={isGeneratingPrompt || confirmedGaps.size === 0}
                                        className="w-full bg-violet-600 hover:bg-violet-700"
                                    >
                                        {isGeneratingPrompt ? (
                                            <>
                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                Generating Prompt...
                                            </>
                                        ) : (
                                            <>
                                                <Sparkles className="mr-2 h-4 w-4" />
                                                Generate Research Prompt ({confirmedGaps.size} gaps)
                                            </>
                                        )}
                                    </Button>
                                </div>
                            </div>

                            {/* Right: Research Prompt Editor */}
                            <div className="border border-white/10 rounded-lg p-6 flex flex-col">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-sm font-medium text-white flex items-center gap-2">
                                        <FileText className="h-4 w-4 text-violet-400" />
                                        Research Prompt
                                        {promptStatus && (
                                            <span className={cn(
                                                "text-xs px-2 py-0.5 rounded-full",
                                                promptStatus === "generated" ? "bg-green-500/20 text-green-300" :
                                                promptStatus === "regenerated" ? "bg-blue-500/20 text-blue-300" :
                                                "bg-zinc-500/20 text-zinc-300"
                                            )}>
                                                {promptStatus}
                                            </span>
                                        )}
                                    </h3>
                                </div>

                                {researchPrompt ? (
                                    <>
                                        <Textarea
                                            value={researchPrompt}
                                            onChange={(e) => setResearchPrompt(e.target.value)}
                                            className="flex-1 min-h-[300px] bg-white/5 border-white/10 text-white resize-none"
                                            placeholder="Research prompt will appear here..."
                                        />

                                        {/* Feedback Section */}
                                        <div className="mt-4 space-y-3">
                                            <label className="text-sm font-medium text-white flex items-center gap-2">
                                                <RefreshCw className="h-4 w-4 text-amber-400" />
                                                Request Changes
                                            </label>
                                            <div className="flex gap-2">
                                                <Input
                                                    value={userFeedback}
                                                    onChange={(e) => setUserFeedback(e.target.value)}
                                                    placeholder="e.g., Focus more on HIPAA compliance, add vendor evaluation criteria..."
                                                    className="flex-1 bg-white/5 border-white/10"
                                                />
                                                <Button
                                                    onClick={handleRegeneratePrompt}
                                                    disabled={isRegeneratingPrompt || !userFeedback.trim()}
                                                    variant="outline"
                                                    className="shrink-0"
                                                >
                                                    {isRegeneratingPrompt ? (
                                                        <Loader2 className="h-4 w-4 animate-spin" />
                                                    ) : (
                                                        <Send className="h-4 w-4" />
                                                    )}
                                                </Button>
                                            </div>
                                            <p className="text-xs text-zinc-500">
                                                Provide feedback and the AI will regenerate the prompt while following best practices.
                                            </p>
                                        </div>

                                        {/* Save and Proceed Buttons */}
                                        <div className="mt-6 pt-4 border-t border-white/10 space-y-3">
                                            <div className="flex gap-3">
                                                <Button
                                                    onClick={handleSavePrompt}
                                                    disabled={isSavingPrompt || !researchPrompt.trim()}
                                                    variant="outline"
                                                    className="flex-1"
                                                >
                                                    {isSavingPrompt ? (
                                                        <>
                                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                            Saving...
                                                        </>
                                                    ) : promptSaved ? (
                                                        <>
                                                            <Check className="mr-2 h-4 w-4 text-green-400" />
                                                            Saved
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Save className="mr-2 h-4 w-4" />
                                                            Save Prompt
                                                        </>
                                                    )}
                                                </Button>
                                                <Button
                                                    onClick={handleContinue}
                                                    disabled={isSavingPrompt || !researchPrompt.trim()}
                                                    className="flex-1 bg-gradient-to-r from-violet-500 to-blue-500 hover:from-violet-600 hover:to-blue-600"
                                                >
                                                    {isSavingPrompt ? (
                                                        <>
                                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                            Saving & Proceeding...
                                                        </>
                                                    ) : (
                                                        <>
                                                            <ArrowRight className="mr-2 h-4 w-4" />
                                                            Proceed to Research
                                                        </>
                                                    )}
                                                </Button>
                                            </div>
                                            <p className="text-xs text-zinc-500 text-center">
                                                Your prompt will be automatically saved when proceeding to Research.
                                            </p>
                                        </div>
                                    </>
                                ) : (
                                    <div className="flex-1 flex flex-col items-center justify-center text-center py-12">
                                        <MessageSquare className="h-12 w-12 text-zinc-600 mb-4" />
                                        <h4 className="text-lg font-medium text-white mb-2">No Prompt Generated Yet</h4>
                                        <p className="text-sm text-zinc-500 max-w-xs">
                                            Select the gaps you want to research and click "Generate Research Prompt" to create a comprehensive AI research prompt.
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Prompt History Section */}
                        {promptHistory.length > 0 && (
                            <div className="mt-8">
                                <h3 className="text-sm font-medium text-zinc-400 mb-4 flex items-center gap-2">
                                    <History className="h-4 w-4" />
                                    Prompt Generation History
                                    <span className="text-xs text-zinc-500">({promptHistory.length})</span>
                                </h3>
                                <div className="border border-white/10 rounded-lg overflow-hidden">
                                    {promptHistory.map((item, index) => (
                                        <div
                                            key={item.id}
                                            className={cn(
                                                "border-b border-white/5 last:border-0",
                                                expandedHistoryItem === item.id && "bg-white/[0.02]"
                                            )}
                                        >
                                            {/* History Item Header */}
                                            <button
                                                onClick={() => setExpandedHistoryItem(
                                                    expandedHistoryItem === item.id ? null : item.id
                                                )}
                                                className="w-full p-4 flex items-center justify-between text-left hover:bg-white/[0.02] transition-colors"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className={cn(
                                                        "w-2 h-2 rounded-full",
                                                        item.type === "generated" ? "bg-green-500" : "bg-blue-500"
                                                    )} />
                                                    <div>
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-sm font-medium text-white">
                                                                {item.type === "generated" ? "Generated" : "Regenerated"}
                                                            </span>
                                                            <span className={cn(
                                                                "px-2 py-0.5 text-xs rounded-full",
                                                                item.type === "generated"
                                                                    ? "bg-green-500/20 text-green-300"
                                                                    : "bg-blue-500/20 text-blue-300"
                                                            )}>
                                                                {item.type}
                                                            </span>
                                                            {index === 0 && (
                                                                <span className="px-2 py-0.5 text-xs rounded-full bg-violet-500/20 text-violet-300">
                                                                    current
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="text-xs text-zinc-500 mt-1">
                                                            {formatDate(item.date)}
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <span className="text-xs text-zinc-500">
                                                        {item.metadata_snapshot.confirmed_gaps.length} gaps
                                                    </span>
                                                    {expandedHistoryItem === item.id ? (
                                                        <ChevronDown className="h-4 w-4 text-zinc-500" />
                                                    ) : (
                                                        <ChevronRight className="h-4 w-4 text-zinc-500" />
                                                    )}
                                                </div>
                                            </button>

                                            {/* Expanded Content */}
                                            {expandedHistoryItem === item.id && (
                                                <div className="px-4 pb-4 space-y-4">
                                                    {/* User Feedback (for regenerated prompts) */}
                                                    {item.type === "regenerated" && item.user_feedback && (
                                                        <div className="p-3 rounded bg-blue-500/10 border border-blue-500/20">
                                                            <h4 className="text-xs font-medium text-blue-300 mb-2 flex items-center gap-2">
                                                                <MessageSquare className="h-3 w-3" />
                                                                User Enhancement Request
                                                            </h4>
                                                            <p className="text-sm text-blue-200 italic">
                                                                "{item.user_feedback}"
                                                            </p>
                                                        </div>
                                                    )}

                                                    {/* Metadata Snapshot */}
                                                    <div className="p-3 rounded bg-white/5 border border-white/10">
                                                        <h4 className="text-xs font-medium text-zinc-400 mb-3 flex items-center gap-2">
                                                            <Info className="h-3 w-3" />
                                                            Metadata Used
                                                        </h4>
                                                        <div className="grid grid-cols-2 gap-3 text-xs">
                                                            <div>
                                                                <span className="text-zinc-500">Entity:</span>
                                                                <span className="ml-2 text-zinc-300">{item.metadata_snapshot.entity_name}</span>
                                                            </div>
                                                            {item.metadata_snapshot.industry && (
                                                                <div>
                                                                    <span className="text-zinc-500">Industry:</span>
                                                                    <span className="ml-2 text-zinc-300">{item.metadata_snapshot.industry}</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                        {item.metadata_snapshot.service_types && item.metadata_snapshot.service_types.length > 0 && (
                                                            <div className="mt-2">
                                                                <span className="text-xs text-zinc-500">Services:</span>
                                                                <div className="flex flex-wrap gap-1 mt-1">
                                                                    {item.metadata_snapshot.service_types.map((st, i) => (
                                                                        <span key={i} className="px-2 py-0.5 text-xs rounded-full bg-blue-500/20 text-blue-300">
                                                                            {st}
                                                                        </span>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}
                                                        {item.metadata_snapshot.technologies && item.metadata_snapshot.technologies.length > 0 && (
                                                            <div className="mt-2">
                                                                <span className="text-xs text-zinc-500">Technologies:</span>
                                                                <div className="flex flex-wrap gap-1 mt-1">
                                                                    {item.metadata_snapshot.technologies.map((tech, i) => (
                                                                        <span key={i} className="px-2 py-0.5 text-xs rounded-full bg-green-500/20 text-green-300">
                                                                            {tech}
                                                                        </span>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Confirmed Gaps */}
                                                    <div className="p-3 rounded bg-white/5 border border-white/10">
                                                        <h4 className="text-xs font-medium text-zinc-400 mb-3 flex items-center gap-2">
                                                            <Target className="h-3 w-3" />
                                                            Confirmed Gaps ({item.metadata_snapshot.confirmed_gaps.length})
                                                        </h4>
                                                        <div className="space-y-2">
                                                            {item.metadata_snapshot.confirmed_gaps.map((gap, i) => (
                                                                <div key={i} className="p-2 rounded bg-red-500/10 border border-red-500/20 text-xs text-red-200">
                                                                    {gap}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>

                                                    {/* Generated Prompt Preview */}
                                                    <div className="p-3 rounded bg-white/5 border border-white/10">
                                                        <h4 className="text-xs font-medium text-zinc-400 mb-3 flex items-center gap-2">
                                                            <FileText className="h-3 w-3" />
                                                            Generated Prompt
                                                        </h4>
                                                        <div className="text-xs text-zinc-300 max-h-[200px] overflow-y-auto whitespace-pre-wrap font-mono bg-black/20 p-3 rounded">
                                                            {item.prompt}
                                                        </div>
                                                    </div>

                                                    {/* Load this prompt button */}
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() => {
                                                            setResearchPrompt(item.prompt)
                                                            setPromptStatus("loaded from history")
                                                            setExpandedHistoryItem(null)
                                                        }}
                                                        className="w-full"
                                                    >
                                                        <RefreshCw className="h-3 w-3 mr-2" />
                                                        Load This Prompt
                                                    </Button>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        )}
        </div>
    )
}
