"use client"

import { useEffect, useState, useRef, useCallback } from "react"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { fetchApi } from "@/lib/api"
import { templates } from "@/lib/data"
import { Loader2, AlertCircle, Check, ArrowRight, Sparkles, FileText, Edit2, Trash2, Plus, X, Save, ChevronDown, Briefcase, CheckSquare, Square, RefreshCw, MessageSquare, Send } from "lucide-react"
import { MetadataDisplay } from "@/components/metadata-display"
import Link from "next/link"
import { PageGuide } from "@/components/PageGuide"
import { BorderBeam } from "@/components/BorderBeam"
import { cn } from "@/lib/utils"

// Helper to manage analyzing state in sessionStorage
const ANALYZING_KEY = "gap_analysis_in_progress"
const SELECTED_PURSUIT_KEY = "gap_assessment_selected_pursuit"

const getAnalyzingPursuitId = (): string | null => {
    if (typeof window === 'undefined') return null
    return sessionStorage.getItem(ANALYZING_KEY)
}
const setAnalyzingPursuitId = (id: string | null) => {
    if (typeof window === 'undefined') return
    if (id) {
        sessionStorage.setItem(ANALYZING_KEY, id)
    } else {
        sessionStorage.removeItem(ANALYZING_KEY)
    }
}
const getSelectedPursuitId = (): string | null => {
    if (typeof window === 'undefined') return null
    return sessionStorage.getItem(SELECTED_PURSUIT_KEY)
}
const saveSelectedPursuitId = (id: string | null) => {
    if (typeof window === 'undefined') return
    if (id) {
        sessionStorage.setItem(SELECTED_PURSUIT_KEY, id)
    } else {
        sessionStorage.removeItem(SELECTED_PURSUIT_KEY)
    }
}

interface PursuitListItem {
    id: string
    entity_name: string
    status: string
    selected_template_id?: string
}

interface Pursuit {
    id: string
    entity_name: string
    internal_pursuit_owner_name: string
    status: string
    files: any[]
    metadata?: any
    created_at?: string
    client_pursuit_owner_name?: string
    client_pursuit_owner_email?: string
    industry?: string
    service_types?: string[]
    technologies?: string[]
    geography?: string
    submission_due_date?: string
    estimated_fees_usd?: number
    expected_format?: string
    requirements_text?: string
    selected_template_id?: string
    gap_analysis_result?: {
        gaps: string[]
        search_queries: string[]
        reasoning: string
        deep_research_prompt?: string
        prompt_status?: string
        confirmed_gaps?: string[]
    }
}

type TabType = "gaps" | "prompt"

export default function GapAssessmentPage() {
    // Check for in-progress analysis and saved selection on initial render
    const initialAnalyzingId = typeof window !== 'undefined' ? sessionStorage.getItem(ANALYZING_KEY) : null
    const initialSelectedId = typeof window !== 'undefined' ? (initialAnalyzingId || sessionStorage.getItem(SELECTED_PURSUIT_KEY)) : null

    const [pursuit, setPursuit] = useState<Pursuit | null>(null)
    const [pursuits, setPursuits] = useState<PursuitListItem[]>([])
    const [selectedPursuitId, setSelectedPursuitId] = useState<string | null>(initialSelectedId)
    const [dropdownOpen, setDropdownOpen] = useState(false)
    const [selectedTemplate, setSelectedTemplate] = useState<any>(null)
    const [isLoadingList, setIsLoadingList] = useState(true)
    const [isLoadingDetails, setIsLoadingDetails] = useState(false)
    const [isAnalyzing, setIsAnalyzing] = useState(!!initialAnalyzingId)
    const [isEditing, setIsEditing] = useState(false)
    const [isSaving, setIsSaving] = useState(false)
    const [editedGaps, setEditedGaps] = useState<string[]>([])
    const [editedQueries, setEditedQueries] = useState<string[]>([])
    const [editedReasoning, setEditedReasoning] = useState("")
    const dropdownRef = useRef<HTMLDivElement>(null)
    const pollIntervalRef = useRef<NodeJS.Timeout | null>(null)
    const hasRestoredAnalysis = useRef(false)

    // New states for Research Prompt tab
    const [activeTab, setActiveTab] = useState<TabType>("gaps")
    const [confirmedGaps, setConfirmedGaps] = useState<Set<number>>(new Set())
    const [researchPrompt, setResearchPrompt] = useState("")
    const [isGeneratingPrompt, setIsGeneratingPrompt] = useState(false)
    const [isRegeneratingPrompt, setIsRegeneratingPrompt] = useState(false)
    const [userFeedback, setUserFeedback] = useState("")
    const [promptStatus, setPromptStatus] = useState<string>("")

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setDropdownOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    // Cleanup polling on unmount
    useEffect(() => {
        return () => {
            if (pollIntervalRef.current) {
                clearInterval(pollIntervalRef.current)
            }
        }
    }, [])

    // Start polling for a pursuit that's being analyzed
    const startPolling = useCallback((pursuitId: string) => {
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
                    setIsAnalyzing(false)
                    setAnalyzingPursuitId(null)
                }
            } catch (error) {
                console.error("Polling failed:", error)
            }
        }, 2000)

        // Timeout after 60 seconds
        setTimeout(() => {
            if (pollIntervalRef.current) {
                clearInterval(pollIntervalRef.current)
                pollIntervalRef.current = null
            }
            setIsAnalyzing(false)
            setAnalyzingPursuitId(null)
        }, 60000)
    }, [])

    // Restore polling immediately if analysis was in progress
    useEffect(() => {
        if (initialAnalyzingId && !hasRestoredAnalysis.current) {
            hasRestoredAnalysis.current = true
            startPolling(initialAnalyzingId)
        }
    }, [initialAnalyzingId, startPolling])

    // Save selected pursuit ID whenever it changes
    useEffect(() => {
        saveSelectedPursuitId(selectedPursuitId)
    }, [selectedPursuitId])

    // Load pursuits list on mount
    useEffect(() => {
        const loadPursuits = async () => {
            try {
                const data = await fetchApi("/pursuits/")
                // Filter to only active pursuits
                const activePursuits = data.filter((p: PursuitListItem) =>
                    !['cancelled', 'stale', 'lost', 'won'].includes(p.status)
                )
                setPursuits(activePursuits)

                // Only auto-select if we don't already have a selection (from initialAnalyzingId)
                if (!selectedPursuitId && activePursuits.length > 0) {
                    setSelectedPursuitId(activePursuits[0].id)
                }
            } catch (error) {
                console.error("Failed to load pursuits:", error)
            } finally {
                setIsLoadingList(false)
            }
        }
        loadPursuits()
    }, []) // Remove startPolling dependency since we handle it separately

    // Load full pursuit details when selection changes
    useEffect(() => {
        const loadPursuitDetails = async () => {
            if (!selectedPursuitId) {
                setPursuit(null)
                setSelectedTemplate(null)
                return
            }

            setIsLoadingDetails(true)
            try {
                const fullPursuit = await fetchApi(`/pursuits/${selectedPursuitId}`)
                setPursuit(fullPursuit)

                // Set template from pursuit's selected_template_id
                if (fullPursuit.selected_template_id) {
                    const template = templates.find(t => t.id === fullPursuit.selected_template_id)
                    setSelectedTemplate(template || null)
                } else {
                    setSelectedTemplate(null)
                }

                // If this pursuit was being analyzed but now has results, clear the state
                const analyzingId = getAnalyzingPursuitId()
                if (analyzingId === selectedPursuitId && fullPursuit.gap_analysis_result) {
                    setIsAnalyzing(false)
                    setAnalyzingPursuitId(null)
                    if (pollIntervalRef.current) {
                        clearInterval(pollIntervalRef.current)
                        pollIntervalRef.current = null
                    }
                }
            } catch (error) {
                console.error("Failed to load pursuit details:", error)
            } finally {
                setIsLoadingDetails(false)
            }
        }
        loadPursuitDetails()
    }, [selectedPursuitId])

    const selectedPursuitListItem = pursuits.find(p => p.id === selectedPursuitId)

    const handleRunAnalysis = async () => {
        if (!pursuit || !selectedTemplate) return

        setIsAnalyzing(true)
        setAnalyzingPursuitId(pursuit.id)

        try {
            // Trigger analysis
            await fetchApi(`/pursuits/${pursuit.id}/gap-analysis`, {
                method: "POST",
                body: JSON.stringify(selectedTemplate)
            })

            // Start polling for results
            startPolling(pursuit.id)

        } catch (error) {
            console.error("Analysis failed:", error)
            setIsAnalyzing(false)
            setAnalyzingPursuitId(null)
            alert("Failed to start analysis")
        }
    }

    const handleStartEditing = () => {
        if (!pursuit?.gap_analysis_result) return
        setEditedGaps([...pursuit.gap_analysis_result.gaps])
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

    const addGap = () => {
        setEditedGaps([...editedGaps, ""])
    }

    const updateGap = (index: number, value: string) => {
        const newGaps = [...editedGaps]
        newGaps[index] = value
        setEditedGaps(newGaps)
    }

    const removeGap = (index: number) => {
        setEditedGaps(editedGaps.filter((_, i) => i !== index))
    }

    const addQuery = () => {
        setEditedQueries([...editedQueries, ""])
    }

    const updateQuery = (index: number, value: string) => {
        const newQueries = [...editedQueries]
        newQueries[index] = value
        setEditedQueries(newQueries)
    }

    const removeQuery = (index: number) => {
        setEditedQueries(editedQueries.filter((_, i) => i !== index))
    }

    // Toggle gap confirmation
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

    // Select/deselect all gaps
    const selectAllGaps = () => {
        if (!pursuit?.gap_analysis_result?.gaps) return
        const allIndices = pursuit.gap_analysis_result.gaps.map((_, i) => i)
        setConfirmedGaps(new Set(allIndices))
    }

    const deselectAllGaps = () => {
        setConfirmedGaps(new Set())
    }

    // Generate research prompt from confirmed gaps
    const handleGeneratePrompt = async () => {
        if (!pursuit?.gap_analysis_result?.gaps) return

        const selectedGaps = pursuit.gap_analysis_result.gaps.filter((_, i) => confirmedGaps.has(i))
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
                requirements_met: [], // Could be populated from extraction results
                entity_name: pursuit.entity_name,
            }

            const result = await fetchApi(`/pursuits/${pursuit.id}/generate-research-prompt`, {
                method: "POST",
                body: JSON.stringify({
                    confirmed_gaps: selectedGaps,
                    proposal_context: proposalContext
                })
            })

            setResearchPrompt(result.deep_research_prompt || "")
            setPromptStatus(result.prompt_status || "generated")

            // Refresh pursuit data to get updated gap_analysis_result
            const updatedPursuit = await fetchApi(`/pursuits/${pursuit.id}`)
            setPursuit(updatedPursuit)

        } catch (error) {
            console.error("Failed to generate prompt:", error)
            alert("Failed to generate research prompt")
        } finally {
            setIsGeneratingPrompt(false)
        }
    }

    // Regenerate prompt with user feedback
    const handleRegeneratePrompt = async () => {
        if (!pursuit?.gap_analysis_result?.gaps || !researchPrompt) return
        if (!userFeedback.trim()) {
            alert("Please provide feedback on what you'd like to change")
            return
        }

        const selectedGaps = pursuit.gap_analysis_result.gaps.filter((_, i) => confirmedGaps.has(i))

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

            setResearchPrompt(result.deep_research_prompt || "")
            setPromptStatus(result.prompt_status || "regenerated")
            setUserFeedback("")

            // Refresh pursuit data
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
            setPromptStatus(pursuit.gap_analysis_result.prompt_status || "")
            // Restore confirmed gaps if available
            if (pursuit.gap_analysis_result.confirmed_gaps) {
                const gapIndices = pursuit.gap_analysis_result.gaps
                    .map((gap, i) => pursuit.gap_analysis_result!.confirmed_gaps!.includes(gap) ? i : -1)
                    .filter(i => i !== -1)
                setConfirmedGaps(new Set(gapIndices))
            }
        } else {
            setResearchPrompt("")
            setPromptStatus("")
        }
    }, [pursuit?.id, pursuit?.gap_analysis_result?.deep_research_prompt])

    // Only show full page loading for initial pursuits list load (not when we have a saved selection)
    if (isLoadingList && pursuits.length === 0 && !selectedPursuitId) {
        return (
            <div className="flex items-center justify-center h-full">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        )
    }

    return (
        <div className="space-y-8 max-w-7xl mx-auto pb-10">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2">
                        <h1 className="text-2xl font-bold tracking-tight text-white">Gap Assessment</h1>
                        <PageGuide
                            title="Gap Assessment"
                            description="The Gap Assessment page helps you identify missing information in your pursuit by comparing extracted RFP data against a selected proposal template."
                            guidelines={[
                                "First, select a pursuit from the dropdown to analyze.",
                                "Review the extracted RFP metadata in the left column.",
                                "The target template is loaded from the pursuit's selected template.",
                                "Run the AI Gap Analysis Agent to identify missing requirements.",
                                "Review identified gaps and recommended search queries.",
                                "Edit the analysis results if needed before proceeding to Deep Search."
                            ]}
                        />
                    </div>
                    <p className="text-muted-foreground mt-1">Analyze the gap between your extracted RFP data and the selected proposal outline.</p>
                </div>

                {/* Pursuit Selector */}
                <div className="relative" ref={dropdownRef}>
                    <button
                        onClick={() => setDropdownOpen(!dropdownOpen)}
                        className={cn(
                            "flex items-center gap-3 px-4 py-3 rounded-xl border transition-all min-w-[280px]",
                            selectedPursuitId
                                ? "bg-primary/10 border-primary/30 hover:border-primary/50"
                                : "bg-white/5 border-white/10 hover:border-white/20"
                        )}
                    >
                        <Briefcase className={cn(
                            "h-5 w-5",
                            selectedPursuitId ? "text-primary" : "text-muted-foreground"
                        )} />
                        <div className="flex-1 text-left">
                            <div className="text-xs text-muted-foreground">Analyzing</div>
                            <div className={cn(
                                "text-sm font-medium truncate",
                                selectedPursuitId ? "text-white" : "text-muted-foreground"
                            )}>
                                {isLoadingList ? "Loading..." : selectedPursuitListItem?.entity_name || "Select a pursuit"}
                            </div>
                        </div>
                        <ChevronDown className={cn(
                            "h-4 w-4 text-muted-foreground transition-transform",
                            dropdownOpen && "rotate-180"
                        )} />
                    </button>

                    {dropdownOpen && (
                        <div className="absolute top-full right-0 mt-2 w-80 bg-card border border-white/10 rounded-xl shadow-xl z-50 py-2 max-h-80 overflow-y-auto">
                            <div className="px-3 py-2 text-xs font-medium text-muted-foreground border-b border-white/10 mb-1">
                                Active Pursuits
                            </div>
                            {pursuits.length === 0 ? (
                                <div className="px-3 py-4 text-sm text-muted-foreground text-center">
                                    No active pursuits found
                                </div>
                            ) : (
                                pursuits.map((p) => {
                                    const currentTemplate = templates.find(t => t.id === p.selected_template_id)
                                    return (
                                        <button
                                            key={p.id}
                                            onClick={() => {
                                                setSelectedPursuitId(p.id)
                                                setDropdownOpen(false)
                                            }}
                                            className={cn(
                                                "w-full px-3 py-3 text-left hover:bg-white/5 flex items-center gap-3 transition-colors",
                                                selectedPursuitId === p.id && "bg-primary/10"
                                            )}
                                        >
                                            <Briefcase className="h-4 w-4 text-muted-foreground shrink-0" />
                                            <div className="flex-1 min-w-0">
                                                <div className="text-sm text-white truncate">{p.entity_name}</div>
                                                <div className="text-xs text-muted-foreground truncate">
                                                    {currentTemplate ? `Template: ${currentTemplate.title}` : "No template selected"}
                                                </div>
                                            </div>
                                            {selectedPursuitId === p.id && (
                                                <Check className="h-4 w-4 text-primary shrink-0" />
                                            )}
                                        </button>
                                    )
                                })
                            )}
                        </div>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Left Column: Extracted Metadata */}
                <div className="space-y-6">
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-semibold text-white">RFP Metadata</h2>
                        {pursuit && (
                            <Link href={`/dashboard/pursuits/${pursuit.id}`} className="text-xs text-primary hover:underline">
                                View Pursuit Details
                            </Link>
                        )}
                    </div>

                    {isLoadingDetails ? (
                        <div className="glass-card rounded-xl p-6 border border-white/10 flex items-center justify-center min-h-[200px]">
                            <Loader2 className="h-6 w-6 animate-spin text-primary" />
                        </div>
                    ) : pursuit ? (
                        <div className="glass-card rounded-xl p-6 border border-white/10">
                            <MetadataDisplay data={pursuit} />
                        </div>
                    ) : (
                        <Card className="bg-white/5 border-white/10">
                            <CardContent className="flex flex-col items-center justify-center py-10 text-center">
                                <AlertCircle className="h-10 w-10 text-muted-foreground mb-4" />
                                <p className="text-muted-foreground mb-4">No pursuit found.</p>
                                <Button asChild variant="outline">
                                    <Link href="/dashboard/pursuits/new">Create New Pursuit</Link>
                                </Button>
                            </CardContent>
                        </Card>
                    )}
                </div>

                {/* Right Column: Selected Template & Action */}
                <div className="space-y-6">
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-semibold text-white">Target Outline</h2>
                        <Link href="/dashboard/pursuits/library" className="text-xs text-primary hover:underline">
                            Change Template
                        </Link>
                    </div>

                    {selectedTemplate ? (
                        <div className="glass-card rounded-xl p-6 border border-white/10 h-[600px] flex flex-col">
                            <div className="flex items-start justify-between mb-6 flex-shrink-0">
                                <div>
                                    <h3 className="text-xl font-semibold text-white mb-2">{selectedTemplate.title}</h3>
                                    <p className="text-sm text-muted-foreground">{selectedTemplate.description}</p>
                                </div>
                                <div className={`p-3 rounded-xl bg-opacity-20 ${selectedTemplate.color.replace('bg-', 'bg-opacity-20 bg-')}`}>
                                    <selectedTemplate.icon className={`h-6 w-6 ${selectedTemplate.color.replace('bg-', 'text-')}`} />
                                </div>
                            </div>

                            <div className="space-y-3 mb-6 flex-1 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                                <h4 className="text-sm font-medium text-white/80 uppercase tracking-wider mb-3">Structure</h4>
                                {selectedTemplate.details.map((item: string, i: number) => (
                                    <div key={i} className="flex items-start gap-3 text-sm text-muted-foreground bg-white/5 p-3 rounded-lg">
                                        <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                                        <span>{item}</span>
                                    </div>
                                ))}
                            </div>

                            <div className="pt-6 border-t border-white/10 flex-shrink-0">
                                <Button
                                    size="lg"
                                    className="w-full relative overflow-hidden rounded-full bg-primary hover:bg-primary/90 text-white shadow-[0_0_20px_rgba(124,58,237,0.3)] border-0 group"
                                    onClick={handleRunAnalysis}
                                    disabled={isAnalyzing || !pursuit}
                                >
                                    <span className="relative z-10 flex items-center justify-center">
                                        {isAnalyzing ? (
                                            <>
                                                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                                Analyzing Gaps...
                                            </>
                                        ) : (
                                            <>
                                                <Sparkles className="mr-2 h-5 w-5" />
                                                Run Gap Analysis Agent
                                            </>
                                        )}
                                    </span>
                                    <BorderBeam
                                        size={100}
                                        duration={3}
                                        delay={0}
                                        borderWidth={1.5}
                                        colorFrom="#ffffff"
                                        colorTo="#a78bfa"
                                        className="opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                                    />
                                </Button>
                                <p className="text-xs text-center text-muted-foreground mt-3">
                                    AI will compare extracted requirements against the template structure.
                                </p>
                            </div>
                        </div>
                    ) : (
                        <Card className="bg-white/5 border-white/10 h-full">
                            <CardContent className="flex flex-col items-center justify-center py-20 text-center h-full">
                                <FileText className="h-12 w-12 text-muted-foreground mb-4 opacity-50" />
                                <h3 className="text-lg font-medium text-white mb-2">No Template Selected</h3>
                                <p className="text-muted-foreground mb-6 max-w-xs mx-auto">
                                    Select a proposal outline template to compare against your RFP requirements.
                                </p>
                                <Button asChild>
                                    <Link href="/dashboard/pursuits/library">
                                        Go to Library
                                        <ArrowRight className="ml-2 h-4 w-4" />
                                    </Link>
                                </Button>
                            </CardContent>
                        </Card>
                    )}
                </div>
            </div>

            {/* Analysis Results with Tabs */}
            {pursuit?.gap_analysis_result && (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-6 mt-12 pt-8 border-t border-white/10"
                >
                    {/* Tab Navigation */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1 bg-white/5 p-1 rounded-lg">
                            <button
                                onClick={() => setActiveTab("gaps")}
                                className={cn(
                                    "px-4 py-2 rounded-md text-sm font-medium transition-all",
                                    activeTab === "gaps"
                                        ? "bg-primary text-white"
                                        : "text-muted-foreground hover:text-white hover:bg-white/10"
                                )}
                            >
                                <span className="flex items-center gap-2">
                                    <AlertCircle className="h-4 w-4" />
                                    Gap Analysis
                                </span>
                            </button>
                            <button
                                onClick={() => setActiveTab("prompt")}
                                className={cn(
                                    "px-4 py-2 rounded-md text-sm font-medium transition-all",
                                    activeTab === "prompt"
                                        ? "bg-primary text-white"
                                        : "text-muted-foreground hover:text-white hover:bg-white/10"
                                )}
                            >
                                <span className="flex items-center gap-2">
                                    <MessageSquare className="h-4 w-4" />
                                    Research Prompt
                                    {researchPrompt && (
                                        <span className="w-2 h-2 bg-green-400 rounded-full" />
                                    )}
                                </span>
                            </button>
                        </div>

                        {/* Action Buttons for Gap Analysis Tab */}
                        {activeTab === "gaps" && (
                            <div className="flex items-center gap-3 relative z-10">
                                {!isEditing ? (
                                    <>
                                        <span className="text-xs text-muted-foreground">Generated by AI Agent</span>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={handleStartEditing}
                                            className="gap-2"
                                        >
                                            <Edit2 className="h-3 w-3" />
                                            Edit Results
                                        </Button>
                                    </>
                                ) : (
                                    <>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={handleCancelEditing}
                                            disabled={isSaving}
                                            className="gap-2"
                                        >
                                            <X className="h-3 w-3" />
                                            Cancel
                                        </Button>
                                        <Button
                                            size="sm"
                                            onClick={handleSaveChanges}
                                            disabled={isSaving}
                                            className="gap-2 bg-primary hover:bg-primary/90"
                                        >
                                            {isSaving ? (
                                                <Loader2 className="h-3 w-3 animate-spin" />
                                            ) : (
                                                <Save className="h-3 w-3" />
                                            )}
                                            Save Changes
                                        </Button>
                                    </>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Gap Analysis Tab Content */}
                    {activeTab === "gaps" && (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            {/* Gaps */}
                            <div className="glass-card rounded-xl p-6 border border-white/10">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-md font-medium text-white flex items-center gap-2">
                                        <AlertCircle className="h-4 w-4 text-red-400" />
                                        Identified Gaps
                                    </h3>
                                    {isEditing && (
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={addGap}
                                            className="h-8 gap-1 text-xs"
                                        >
                                            <Plus className="h-3 w-3" />
                                            Add Gap
                                        </Button>
                                    )}
                                </div>
                                <div className="space-y-3">
                                    {!isEditing ? (
                                        pursuit.gap_analysis_result.gaps.map((gap: string, i: number) => (
                                            <div key={i} className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-200">
                                                {gap}
                                            </div>
                                        ))
                                    ) : (
                                        editedGaps.map((gap: string, i: number) => (
                                            <div key={i} className="flex items-center gap-2">
                                                <Input
                                                    value={gap}
                                                    onChange={(e) => updateGap(i, e.target.value)}
                                                    className="bg-red-500/10 border-red-500/20 text-red-200 focus:border-red-500/40"
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

                            {/* Search Queries */}
                            <div className="glass-card rounded-xl p-6 border border-white/10">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-md font-medium text-white flex items-center gap-2">
                                        <Sparkles className="h-4 w-4 text-blue-400" />
                                        Recommended Search Queries
                                    </h3>
                                    {isEditing && (
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={addQuery}
                                            className="h-8 gap-1 text-xs"
                                        >
                                            <Plus className="h-3 w-3" />
                                            Add Query
                                        </Button>
                                    )}
                                </div>
                                <div className="space-y-3">
                                    {!isEditing ? (
                                        pursuit.gap_analysis_result.search_queries.map((query: string, i: number) => (
                                            <div key={i} className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-sm text-blue-200 flex items-center justify-between group cursor-pointer hover:bg-blue-500/20 transition-colors">
                                                <span>{query}</span>
                                                <ArrowRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                                            </div>
                                        ))
                                    ) : (
                                        editedQueries.map((query: string, i: number) => (
                                            <div key={i} className="flex items-center gap-2">
                                                <Input
                                                    value={query}
                                                    onChange={(e) => updateQuery(i, e.target.value)}
                                                    className="bg-blue-500/10 border-blue-500/20 text-blue-200 focus:border-blue-500/40"
                                                    placeholder="Enter search query"
                                                />
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    onClick={() => removeQuery(i)}
                                                    className="shrink-0 h-9 w-9 p-0 hover:bg-blue-500/20"
                                                >
                                                    <Trash2 className="h-3 w-3 text-blue-400" />
                                                </Button>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Research Prompt Tab Content */}
                    {activeTab === "prompt" && (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            {/* Left: Gap Confirmation */}
                            <div className="glass-card rounded-xl p-6 border border-white/10">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-md font-medium text-white flex items-center gap-2">
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
                                <p className="text-xs text-muted-foreground mb-4">
                                    Select the gaps you want to include in the deep research prompt. The AI will generate a comprehensive research prompt based on your selections.
                                </p>
                                <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
                                    {pursuit.gap_analysis_result.gaps.map((gap: string, i: number) => (
                                        <button
                                            key={i}
                                            onClick={() => toggleGapConfirmation(i)}
                                            className={cn(
                                                "w-full p-3 rounded-lg text-sm text-left flex items-start gap-3 transition-all",
                                                confirmedGaps.has(i)
                                                    ? "bg-green-500/20 border border-green-500/30 text-green-200"
                                                    : "bg-white/5 border border-white/10 text-muted-foreground hover:bg-white/10"
                                            )}
                                        >
                                            {confirmedGaps.has(i) ? (
                                                <CheckSquare className="h-4 w-4 text-green-400 shrink-0 mt-0.5" />
                                            ) : (
                                                <Square className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                                            )}
                                            <span>{gap}</span>
                                        </button>
                                    ))}
                                </div>

                                {/* Generate Button */}
                                <div className="mt-6 pt-4 border-t border-white/10">
                                    <Button
                                        onClick={handleGeneratePrompt}
                                        disabled={isGeneratingPrompt || confirmedGaps.size === 0}
                                        className="w-full bg-primary hover:bg-primary/90"
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
                            <div className="glass-card rounded-xl p-6 border border-white/10 flex flex-col">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-md font-medium text-white flex items-center gap-2">
                                        <FileText className="h-4 w-4 text-purple-400" />
                                        Research Prompt
                                        {promptStatus && (
                                            <span className={cn(
                                                "text-xs px-2 py-0.5 rounded-full",
                                                promptStatus === "generated" ? "bg-green-500/20 text-green-300" :
                                                promptStatus === "regenerated" ? "bg-blue-500/20 text-blue-300" :
                                                "bg-gray-500/20 text-gray-300"
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
                                                <RefreshCw className="h-4 w-4 text-yellow-400" />
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
                                            <p className="text-xs text-muted-foreground">
                                                Provide feedback and the AI will regenerate the prompt while following best practices.
                                            </p>
                                        </div>

                                        {/* Proceed to Research Button */}
                                        <div className="mt-6 pt-4 border-t border-white/10">
                                            <Button
                                                asChild
                                                className="w-full bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600"
                                            >
                                                <Link href="/dashboard/deep-search">
                                                    <ArrowRight className="mr-2 h-4 w-4" />
                                                    Proceed to Deep Search
                                                </Link>
                                            </Button>
                                        </div>
                                    </>
                                ) : (
                                    <div className="flex-1 flex flex-col items-center justify-center text-center py-12">
                                        <MessageSquare className="h-12 w-12 text-muted-foreground/50 mb-4" />
                                        <h4 className="text-lg font-medium text-white mb-2">No Prompt Generated Yet</h4>
                                        <p className="text-sm text-muted-foreground max-w-xs">
                                            Select the gaps you want to research and click "Generate Research Prompt" to create a comprehensive AI research prompt.
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </motion.div>
            )}
        </div>
    )
}
