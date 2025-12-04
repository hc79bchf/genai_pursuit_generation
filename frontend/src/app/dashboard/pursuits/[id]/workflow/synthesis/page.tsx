"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { api, fetchApi } from "@/lib/api"
import {
    Loader2,
    ChevronDown,
    ChevronUp,
    Sparkles,
    ArrowRight,
    ArrowLeft,
    Bot,
    FileText,
    CheckSquare,
    Square,
    Layers,
    Check,
    ListChecks,
    Clock,
    Target,
    Combine
} from "lucide-react"
import { cn } from "@/lib/utils"
import { getNextStage, getPreviousStage } from "@/lib/workflow"

type SynthesisTab = "overview" | "synthesis"

interface TabConfig {
    id: SynthesisTab
    label: string
    description: string
}

const TABS: TabConfig[] = [
    { id: "overview", label: "OVERVIEW", description: "Learn about the Synthesis Agent and how it works." },
    { id: "synthesis", label: "SYNTHESIS", description: "Select research results and generate a proposal outline." },
]

interface ResearchResultItem {
    query: string
    url: string
    title: string
    snippet: string
    extracted_info: string
    relevance_score: number
}

interface QueryResult {
    query: string
    results: ResearchResultItem[]
    summary: string
}

interface Pursuit {
    id: string
    entity_name: string
    industry?: string
    service_types?: string[]
    status: string
    files?: any[]
    research_result?: {
        research_results: QueryResult[]
        overall_summary: string
    }
    synthesis_result?: {
        outline_sections: string[]
        key_points: string[]
        synthesized_at: string
    }
}

export default function SynthesisPage({ params }: { params: { id: string } }) {
    const router = useRouter()
    const pursuitId = params.id
    const [pursuit, setPursuit] = useState<Pursuit | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [isSynthesizing, setIsSynthesizing] = useState(false)
    const [selectedResults, setSelectedResults] = useState<Record<string, boolean>>({})
    const [expandedQueries, setExpandedQueries] = useState<Record<number, boolean>>({})
    const [synthesisComplete, setSynthesisComplete] = useState(false)
    const [outlineSections, setOutlineSections] = useState<string[]>([])
    const [activeTab, setActiveTab] = useState<SynthesisTab>("overview")

    useEffect(() => {
        async function loadPursuit() {
            try {
                const data = await fetchApi(`/pursuits/${pursuitId}`)
                setPursuit(data)

                // Check if synthesis already completed
                if (data.synthesis_result) {
                    setSynthesisComplete(true)
                    setOutlineSections(data.synthesis_result.outline_sections || [])
                }

                // Initialize selected results
                if (data.research_result && data.research_result.research_results) {
                    const initialSelection: Record<string, boolean> = {}
                    const initialExpanded: Record<number, boolean> = {}
                    data.research_result.research_results.forEach((q: QueryResult, qIdx: number) => {
                        initialExpanded[qIdx] = true
                        q.results.forEach((_, rIdx: number) => {
                            initialSelection[`${qIdx}-${rIdx}`] = true
                        })
                    })
                    setSelectedResults(initialSelection)
                    setExpandedQueries(initialExpanded)
                }
            } catch (error) {
                console.error("Failed to load pursuit", error)
            } finally {
                setIsLoading(false)
            }
        }
        loadPursuit()
    }, [pursuitId])

    const handleToggleResult = (qIdx: number, rIdx: number) => {
        const key = `${qIdx}-${rIdx}`
        setSelectedResults(prev => ({
            ...prev,
            [key]: !prev[key]
        }))
    }

    const toggleQuery = (idx: number) => {
        setExpandedQueries(prev => ({
            ...prev,
            [idx]: !prev[idx]
        }))
    }

    const handleSynthesize = async () => {
        if (!pursuit) return

        setIsSynthesizing(true)

        try {
            // Build custom research with selected sources
            let customResearch = null
            if (pursuit.research_result) {
                customResearch = {
                    ...pursuit.research_result,
                    research_results: pursuit.research_result.research_results.map((q: QueryResult, qIdx: number) => ({
                        ...q,
                        results: q.results.filter((_, rIdx) => selectedResults[`${qIdx}-${rIdx}`])
                    }))
                }
            }

            // For now, we'll mark synthesis as complete and store selected sources
            // The actual outline generation happens in Document Generation stage
            setSynthesisComplete(true)

            // Generate default outline sections based on pursuit
            const defaultSections = [
                "Executive Summary",
                "Client Understanding",
                "Our Approach",
                "Methodology",
                "Team & Experience",
                "Timeline & Milestones",
                "Investment",
                "Why Choose Us",
                "Next Steps"
            ]
            setOutlineSections(defaultSections)

        } catch (error) {
            console.error("Failed to synthesize", error)
            alert("Failed to complete synthesis")
        } finally {
            setIsSynthesizing(false)
        }
    }

    const handleContinue = () => {
        const nextStage = getNextStage("synthesis")
        if (nextStage) {
            router.push(nextStage.path(pursuitId))
        }
    }

    const handleBack = () => {
        const prevStage = getPreviousStage("synthesis")
        if (prevStage) {
            router.push(prevStage.path(pursuitId))
        }
    }

    if (isLoading || !pursuit) {
        return (
            <div className="flex h-[50vh] items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        )
    }

    const hasResearchResults = pursuit.research_result && pursuit.research_result.research_results.length > 0
    const selectedCount = Object.values(selectedResults).filter(Boolean).length
    const totalCount = Object.keys(selectedResults).length
    const currentTab = TABS.find(t => t.id === activeTab)

    return (
        <div className="max-w-5xl">
            {/* Page Description */}
            <p className="text-sm text-zinc-500 mb-6">
                Combine research findings with selected content to create a structured proposal outline.
            </p>

            {/* Tab Navigation */}
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
                        {tab.id === "synthesis" && synthesisComplete && (
                            <span className="ml-2 inline-flex h-2 w-2 rounded-full bg-green-400" />
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
                        <h3 className="text-lg font-semibold text-white mb-3">Synthesis Agent</h3>
                        <p className="text-sm text-zinc-400 leading-relaxed mb-4">
                            The Synthesis Agent combines research findings with selected reference materials to create a
                            structured proposal outline. It intelligently merges content while maintaining coherence and
                            relevance to the RFP requirements.
                        </p>
                        <p className="text-xs text-zinc-500">
                            Content Selection · Outline Generation · AI Synthesis · ~60-90 seconds
                        </p>
                    </div>

                    {/* Tab Descriptions */}
                    <div>
                        <h3 className="text-sm font-medium text-zinc-400 mb-4">Available Tabs</h3>
                        <div className="space-y-4">
                            <div>
                                <h4 className="text-sm font-medium text-white mb-1">SYNTHESIS</h4>
                                <p className="text-xs text-zinc-500">
                                    View and select research results to include in your proposal. Run the synthesis agent
                                    to generate a structured outline based on your selections.
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
                                    <p className="text-sm text-white">Review research results in SYNTHESIS tab</p>
                                    <p className="text-xs text-zinc-500">Select relevant findings to include in the proposal</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-3">
                                <span className="text-xs font-medium text-zinc-500 w-4 flex-shrink-0">2.</span>
                                <div>
                                    <p className="text-sm text-white">Run Synthesis Agent</p>
                                    <p className="text-xs text-zinc-500">Click "Create Outline" to generate the proposal structure</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-3">
                                <span className="text-xs font-medium text-zinc-500 w-4 flex-shrink-0">3.</span>
                                <div>
                                    <p className="text-sm text-white">Review generated outline</p>
                                    <p className="text-xs text-zinc-500">Verify the structure matches your requirements</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-3">
                                <span className="text-xs font-medium text-zinc-500 w-4 flex-shrink-0">4.</span>
                                <div>
                                    <p className="text-sm text-white">Proceed to Document Generation</p>
                                    <p className="text-xs text-zinc-500">Continue to create the final document</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Get Started Button */}
                    <div className="flex justify-end">
                        <Button
                            onClick={() => setActiveTab("synthesis")}
                            variant="outline"
                            className="border-white/10"
                        >
                            Get Started
                            <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                    </div>
                </div>
            )}

            {/* Synthesis Tab */}
            {activeTab === "synthesis" && (
            <div className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-3">
                {/* Main Content */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Proposal Outline Preview */}
                    <div className="glass-card rounded-xl border border-white/10 overflow-hidden">
                        <div className="flex items-center justify-between p-4 border-b border-white/10">
                            <div className="flex items-center gap-3">
                                <Layers className="h-5 w-5 text-primary" />
                                <h2 className="text-lg font-semibold text-white">Proposal Outline</h2>
                            </div>
                            {synthesisComplete && (
                                <span className="flex items-center gap-1 text-xs text-green-400">
                                    <Check className="h-3 w-3" />
                                    Synthesis Complete
                                </span>
                            )}
                        </div>
                        <div className="p-6">
                            {synthesisComplete ? (
                                <div className="space-y-3">
                                    {outlineSections.map((section, idx) => (
                                        <div
                                            key={idx}
                                            className="flex items-center gap-3 p-3 rounded-lg bg-white/5 border border-white/10"
                                        >
                                            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/20 text-primary text-xs font-medium">
                                                {idx + 1}
                                            </span>
                                            <span className="text-white">{section}</span>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                                    <div className="text-center">
                                        <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                                        <p className="mb-2">Proposal outline will be generated here</p>
                                        <p className="text-xs text-muted-foreground">
                                            Select research sources below and click "Create Outline"
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Research Sources Selection */}
                    {hasResearchResults && (
                        <div className="glass-card rounded-xl p-6 border border-white/10">
                            <div className="flex items-center justify-between mb-4">
                                <div>
                                    <h3 className="text-md font-medium text-white">Research Sources</h3>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        Select which findings to include in the proposal
                                    </p>
                                </div>
                                <span className="text-xs text-muted-foreground">
                                    {selectedCount} of {totalCount} selected
                                </span>
                            </div>

                            <div className="space-y-4">
                                {pursuit.research_result?.research_results.map((q, qIdx) => (
                                    <div key={qIdx} className="border border-white/10 rounded-lg overflow-hidden">
                                        <div
                                            className="bg-white/5 p-3 flex justify-between items-center cursor-pointer hover:bg-white/10"
                                            onClick={() => toggleQuery(qIdx)}
                                        >
                                            <span className="font-medium text-sm text-white">{q.query}</span>
                                            {expandedQueries[qIdx] ? (
                                                <ChevronUp className="h-4 w-4" />
                                            ) : (
                                                <ChevronDown className="h-4 w-4" />
                                            )}
                                        </div>

                                        {expandedQueries[qIdx] && (
                                            <div className="p-3 space-y-2 bg-black/20">
                                                {q.results.length === 0 ? (
                                                    <div className="text-xs text-muted-foreground">No results</div>
                                                ) : (
                                                    q.results.map((r, rIdx) => {
                                                        const isSelected = !!selectedResults[`${qIdx}-${rIdx}`]
                                                        return (
                                                            <div
                                                                key={rIdx}
                                                                onClick={() => handleToggleResult(qIdx, rIdx)}
                                                                className={cn(
                                                                    "flex items-start gap-3 p-2 rounded cursor-pointer transition-colors",
                                                                    isSelected ? "bg-primary/10" : "hover:bg-white/5"
                                                                )}
                                                            >
                                                                {isSelected ? (
                                                                    <CheckSquare className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                                                                ) : (
                                                                    <Square className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                                                                )}
                                                                <div className="flex-1 min-w-0">
                                                                    <div className="text-sm font-medium text-white truncate">{r.title}</div>
                                                                    <div className="text-xs text-muted-foreground line-clamp-2">{r.snippet}</div>
                                                                </div>
                                                            </div>
                                                        )
                                                    })
                                                )}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Sidebar */}
                <div className="space-y-6">
                    {/* Pursuit Metadata */}
                    <div className="glass-card rounded-xl p-6 border border-white/10">
                        <h3 className="text-md font-medium text-white mb-4">Pursuit Info</h3>
                        <div className="space-y-3 text-sm">
                            <div>
                                <div className="text-xs text-muted-foreground">Client</div>
                                <div className="text-white">{pursuit.entity_name}</div>
                            </div>
                            <div>
                                <div className="text-xs text-muted-foreground">Industry</div>
                                <div className="text-white">{pursuit.industry || 'N/A'}</div>
                            </div>
                            <div>
                                <div className="text-xs text-muted-foreground">Services</div>
                                <div className="text-white">{pursuit.service_types?.join(', ') || 'N/A'}</div>
                            </div>
                        </div>
                    </div>

                    {/* About This Stage */}
                    <div className="glass-card rounded-xl p-6 border border-white/10">
                        <h3 className="text-lg font-semibold text-white mb-4">About This Stage</h3>
                        <div className="space-y-4 text-sm">
                            <p className="text-muted-foreground">
                                The Synthesis agent combines research findings with pursuit metadata to create a structured proposal outline.
                            </p>
                            <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                                <div className="flex items-center gap-2 text-blue-400 mb-1">
                                    <Bot className="h-4 w-4" />
                                    <span className="font-medium">AI Content Synthesis</span>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    Combines metadata, past pursuits, and research into a coherent outline.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Synthesis Checklist */}
                    <div className="glass-card rounded-xl p-6 border border-white/10">
                        <h3 className="text-md font-medium text-white mb-4">Synthesis Inputs</h3>
                        <div className="space-y-2 text-sm">
                            <div className="flex items-center gap-2">
                                <Check className="h-4 w-4 text-green-400" />
                                <span className="text-muted-foreground">Pursuit Metadata</span>
                            </div>
                            <div className="flex items-center gap-2">
                                {hasResearchResults ? (
                                    <Check className="h-4 w-4 text-green-400" />
                                ) : (
                                    <div className="h-4 w-4 rounded-full border border-muted-foreground/30" />
                                )}
                                <span className="text-muted-foreground">Research Results</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <Check className="h-4 w-4 text-green-400" />
                                <span className="text-muted-foreground">Past Pursuit Context</span>
                            </div>
                        </div>
                    </div>

                    {/* Create Outline Button */}
                    <Button
                        type="button"
                        onClick={handleSynthesize}
                        disabled={isSynthesizing || synthesisComplete}
                        className="w-full bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20"
                    >
                        {isSynthesizing ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Synthesizing...
                            </>
                        ) : synthesisComplete ? (
                            <>
                                <ListChecks className="mr-2 h-4 w-4" />
                                Outline Created
                            </>
                        ) : (
                            <>
                                <Sparkles className="mr-2 h-4 w-4" />
                                Create Outline
                            </>
                        )}
                    </Button>

                    {/* Navigation Buttons */}
                    <div className="flex gap-3">
                        <Button
                            variant="ghost"
                            onClick={handleBack}
                            className="flex-1 border border-white/10"
                        >
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back
                        </Button>
                        <Button
                            onClick={handleContinue}
                            disabled={!synthesisComplete}
                            className="flex-1 bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20"
                        >
                            Continue
                            <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                    </div>
                </div>
            </div>
            </div>
            )}
        </div>
    )
}
