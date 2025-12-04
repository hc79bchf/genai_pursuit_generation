"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { fetchApi } from "@/lib/api"
import {
    Loader2,
    AlertCircle,
    Search,
    ExternalLink,
    CheckCircle,
    Play,
    Clock,
    Zap,
    Trash2,
    CheckSquare,
    ArrowRight,
    ArrowLeft,
    FileText,
    Sparkles,
    Globe,
    GraduationCap,
    ChevronDown,
    ChevronRight,
    Copy,
    Info
} from "lucide-react"
import { cn } from "@/lib/utils"
import { getNextStage, getPreviousStage } from "@/lib/workflow"
import { useResearchStore } from "@/store/researchStore"

// Types
type ResearchTab = "overview" | "prompt" | "results"

interface TabConfig {
    id: ResearchTab
    label: string
    description: string
}

const TABS: TabConfig[] = [
    { id: "overview", label: "OVERVIEW", description: "Learn about the Research Agent and how it works." },
    { id: "prompt", label: "RESEARCH PROMPT", description: "Review and edit the deep research prompt generated from gap analysis." },
    { id: "results", label: "RESULTS", description: "View research findings, key insights, action items, and source citations." },
]

interface ResearchFinding {
    gap: string
    research_area: string
    findings: Array<{
        content: string
        relevance: string
        confidence: number
        source_url?: string
        source_title?: string
    }>
    recommendations: string[]
    sources?: Array<{
        url: string
        title: string
        snippet: string
        source_type: string
    }>
    confidence: number
}

interface Pursuit {
    id: string
    entity_name: string
    industry?: string
    service_types?: string[]
    technologies?: string[]
    gap_analysis_result?: {
        gaps: Array<string | { description: string; requirement: string }>
        search_queries: string[]
        reasoning: string
        deep_research_prompt?: string
        confirmed_gaps?: string[]
    }
    research_result?: {
        findings?: ResearchFinding[]
        overall_summary?: string
        key_insights?: string[]
        action_items?: string[]
        total_sources_evaluated?: number
        total_sources_used?: number
        total_web_sources?: number
        total_academic_sources?: number
        processing_time_ms?: number
    }
}

export default function ResearchPage({ params }: { params: { id: string } }) {
    const router = useRouter()
    const [pursuit, setPursuit] = useState<Pursuit | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [activeTab, setActiveTab] = useState<ResearchTab>("overview")
    const [researchPrompt, setResearchPrompt] = useState("")
    const [expandedFindings, setExpandedFindings] = useState<Set<number>>(new Set([0]))

    const {
        pursuitId,
        isResearching,
        researchProgress,
        elapsedTime,
        startResearch,
        updateProgress,
        completeResearch,
        resetResearch,
        incrementElapsedTime
    } = useResearchStore()

    useEffect(() => {
        async function loadPursuit() {
            try {
                const data = await fetchApi(`/pursuits/${params.id}`)
                setPursuit(data)

                // Load research prompt from gap analysis
                if (data.gap_analysis_result?.deep_research_prompt) {
                    setResearchPrompt(data.gap_analysis_result.deep_research_prompt)
                }

                // If research result exists, switch to results tab
                if (data.research_result) {
                    setActiveTab("results")
                }

                if (isResearching && pursuitId === params.id && !data.research_result) {
                    startPolling(params.id)
                }
            } catch (error) {
                console.error("Failed to load pursuit", error)
            } finally {
                setIsLoading(false)
            }
        }
        loadPursuit()
    }, [params.id])

    useEffect(() => {
        let timer: NodeJS.Timeout
        if (isResearching) {
            timer = setInterval(() => {
                incrementElapsedTime()
            }, 1000)
        }
        return () => clearInterval(timer)
    }, [isResearching, incrementElapsedTime])

    const startPolling = (pursuitId: string) => {
        let pollCount = 0
        const progressInterval = setInterval(() => {
            pollCount++
            // Simulate progress over ~2 minutes (120 seconds)
            const estimatedProgress = Math.min((pollCount * 3) / 120 * 100, 95)
            updateProgress(estimatedProgress, pollCount)
        }, 3000)

        const pollInterval = setInterval(async () => {
            try {
                const updatedPursuit = await fetchApi(`/pursuits/${pursuitId}`)
                if (updatedPursuit.research_result) {
                    clearInterval(pollInterval)
                    clearInterval(progressInterval)
                    updateProgress(100, 100)
                    setPursuit(updatedPursuit)
                    setTimeout(() => completeResearch(), 1000)
                }
            } catch (error) {
                console.error("Polling error:", error)
            }
        }, 3000)

        setTimeout(() => {
            clearInterval(pollInterval)
            clearInterval(progressInterval)
            completeResearch()
        }, 150000) // 2.5 minutes timeout

        ;(window as any).__researchPollingIntervals = { progressInterval, pollInterval }
    }

    useEffect(() => {
        return () => {
            const intervals = (window as any).__researchPollingIntervals
            if (intervals) {
                clearInterval(intervals.progressInterval)
                clearInterval(intervals.pollInterval)
            }
        }
    }, [])

    const handleRunResearch = async () => {
        if (!pursuit) return

        startResearch(pursuit.id, 1)

        try {
            // Pass the deep research prompt to the backend
            await fetchApi(`/pursuits/${pursuit.id}/research`, {
                method: "POST",
                body: JSON.stringify({
                    deep_research_prompt: researchPrompt
                })
            })
            startPolling(pursuit.id)
            // Switch to results tab to show progress
            setActiveTab("results")
        } catch (error) {
            console.error("Research failed:", error)
            resetResearch()
            alert("Failed to start research")
        }
    }

    const toggleFinding = (index: number) => {
        setExpandedFindings(prev => {
            const newSet = new Set(prev)
            if (newSet.has(index)) {
                newSet.delete(index)
            } else {
                newSet.add(index)
            }
            return newSet
        })
    }

    const copyPromptToClipboard = () => {
        navigator.clipboard.writeText(researchPrompt)
    }

    const getGapText = (gap: string | { description: string; requirement: string }) => {
        return typeof gap === 'string' ? gap : gap.description
    }

    const handleClearResults = async () => {
        if (!pursuit) return
        setPursuit({ ...pursuit, research_result: undefined })
        resetResearch()
        setActiveTab("prompt")
    }

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60)
        const secs = seconds % 60
        return `${mins}:${secs.toString().padStart(2, '0')}`
    }

    const handleContinue = () => {
        const nextStage = getNextStage("research")
        if (nextStage) {
            router.push(nextStage.path(params.id))
        }
    }

    const handleBack = () => {
        const prevStage = getPreviousStage("research")
        if (prevStage) {
            router.push(prevStage.path(params.id))
        }
    }

    if (isLoading || !pursuit) {
        return (
            <div className="flex h-[50vh] items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        )
    }

    const hasResearchResult = !!pursuit.research_result
    const isCurrentlyResearching = isResearching && pursuitId === params.id
    const gaps = pursuit?.gap_analysis_result?.gaps || []

    if (!pursuit.gap_analysis_result) {
        return (
            <div className="max-w-5xl">
                <div className="border border-white/10 rounded-xl p-8 text-center">
                    <AlertCircle className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                    <h2 className="text-xl font-semibold text-white mb-2">Gap Analysis Required</h2>
                    <p className="text-muted-foreground mb-6">
                        Complete gap analysis before running research
                    </p>
                    <Button onClick={handleBack}>
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Go to Gap Analysis
                    </Button>
                </div>
            </div>
        )
    }

    const currentTab = TABS.find(t => t.id === activeTab)

    return (
        <div className="max-w-5xl">
            {/* Page Description */}
            <p className="text-sm text-zinc-500 mb-6">
                Conduct web and academic research using the deep research prompt to gather information for identified gaps.
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
                        {tab.id === "results" && hasResearchResult && (
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
                        <h3 className="text-lg font-semibold text-white mb-3">Research Agent</h3>
                        <p className="text-sm text-zinc-400 leading-relaxed mb-4">
                            The Research Agent uses the deep research prompt to conduct live web searches and find academic papers
                            relevant to the identified gaps. It synthesizes findings into actionable insights and recommendations
                            with source citations and confidence scores.
                        </p>
                        <p className="text-xs text-zinc-500">
                            Web Search · arXiv Papers · AI Synthesis · ~1-2 minutes
                        </p>
                    </div>

                    {/* Tab Descriptions */}
                    <div>
                        <h3 className="text-sm font-medium text-zinc-400 mb-4">Available Tabs</h3>
                        <div className="space-y-4">
                            <div>
                                <h4 className="text-sm font-medium text-white mb-1">RESEARCH PROMPT</h4>
                                <p className="text-xs text-zinc-500">
                                    View and edit the deep research prompt generated from gap analysis. This prompt guides the
                                    Research Agent's web and academic searches. See a preview of gaps to be researched.
                                </p>
                            </div>
                            <div>
                                <h4 className="text-sm font-medium text-white mb-1">RESULTS</h4>
                                <p className="text-xs text-zinc-500">
                                    View research findings organized by gap, including executive summary, key insights, action items,
                                    and detailed findings with source URLs. Track progress during research and see statistics on
                                    sources used.
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
                                    <p className="text-sm text-white">Review research prompt in RESEARCH PROMPT tab</p>
                                    <p className="text-xs text-zinc-500">Edit the prompt if needed before running research</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-3">
                                <span className="text-xs font-medium text-zinc-500 w-4 flex-shrink-0">2.</span>
                                <div>
                                    <p className="text-sm text-white">Start Research Agent</p>
                                    <p className="text-xs text-zinc-500">Click "Start Research Agent" to begin web and academic searches</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-3">
                                <span className="text-xs font-medium text-zinc-500 w-4 flex-shrink-0">3.</span>
                                <div>
                                    <p className="text-sm text-white">Monitor progress in RESULTS tab</p>
                                    <p className="text-xs text-zinc-500">Watch real-time progress as the agent searches and synthesizes</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-3">
                                <span className="text-xs font-medium text-zinc-500 w-4 flex-shrink-0">4.</span>
                                <div>
                                    <p className="text-sm text-white">Review findings and continue to Synthesis</p>
                                    <p className="text-xs text-zinc-500">Review key insights and action items, then proceed</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Get Started Button */}
                    <div className="flex justify-end">
                        <Button
                            onClick={() => setActiveTab("prompt")}
                            variant="outline"
                            className="border-white/10"
                        >
                            Get Started
                            <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                    </div>
                </div>
            )}

            {/* Research Prompt Tab */}
            {activeTab === "prompt" && (
                <div className="space-y-8">
                    {/* About Section */}
                    <div className="border border-white/10 rounded-xl p-6">
                        <div className="flex items-start gap-4">
                            <div className="h-10 w-10 rounded-lg bg-violet-500/20 flex items-center justify-center flex-shrink-0">
                                <Search className="h-5 w-5 text-violet-400" />
                            </div>
                            <div>
                                <h3 className="text-lg font-semibold text-white mb-2">Research Agent</h3>
                                <p className="text-sm text-zinc-400 leading-relaxed">
                                    The Research Agent uses the deep research prompt to conduct live web searches and find academic papers
                                    relevant to the identified gaps. It synthesizes findings into actionable insights and recommendations.
                                </p>
                                <div className="flex gap-4 mt-4">
                                    <div className="flex items-center gap-2 text-xs text-zinc-500">
                                        <Globe className="h-4 w-4 text-blue-400" />
                                        <span>Web Search</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-xs text-zinc-500">
                                        <GraduationCap className="h-4 w-4 text-violet-400" />
                                        <span>arXiv Papers</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-xs text-zinc-500">
                                        <Clock className="h-4 w-4" />
                                        <span>~1-2 minutes</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Deep Research Prompt */}
                    <div className="border border-white/10 rounded-xl p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-sm font-medium text-white flex items-center gap-2">
                                <Sparkles className="h-4 w-4 text-violet-400" />
                                Deep Research Prompt
                            </h3>
                            {researchPrompt && (
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={copyPromptToClipboard}
                                    className="gap-2 text-zinc-400 hover:text-white"
                                >
                                    <Copy className="h-3 w-3" />
                                    Copy
                                </Button>
                            )}
                        </div>

                        {researchPrompt ? (
                            <>
                                <Textarea
                                    value={researchPrompt}
                                    onChange={(e) => setResearchPrompt(e.target.value)}
                                    className="min-h-[300px] bg-white/5 border-white/10 text-white resize-none font-mono text-sm"
                                    placeholder="Research prompt will appear here..."
                                />
                                <p className="text-xs text-zinc-500 mt-2">
                                    This prompt guides the Research Agent. You can edit it before running research.
                                </p>
                            </>
                        ) : (
                            <div className="border border-dashed border-white/20 rounded-lg p-8 text-center">
                                <FileText className="h-12 w-12 text-zinc-600 mx-auto mb-4" />
                                <h4 className="text-lg font-medium text-white mb-2">No Research Prompt</h4>
                                <p className="text-sm text-zinc-500 mb-4">
                                    Generate a research prompt in the Gap Analysis stage first.
                                </p>
                                <Button variant="outline" onClick={handleBack}>
                                    <ArrowLeft className="mr-2 h-4 w-4" />
                                    Go to Gap Analysis
                                </Button>
                            </div>
                        )}
                    </div>

                    {/* Gaps Overview */}
                    {gaps.length > 0 && (
                        <div className="border border-white/10 rounded-xl p-6">
                            <h3 className="text-sm font-medium text-white flex items-center gap-2 mb-4">
                                <AlertCircle className="h-4 w-4 text-red-400" />
                                Gaps to Research ({gaps.length})
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {gaps.slice(0, 6).map((gap, i) => (
                                    <div key={i} className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-200">
                                        {getGapText(gap)}
                                    </div>
                                ))}
                                {gaps.length > 6 && (
                                    <div className="p-3 rounded-lg bg-white/5 border border-white/10 text-sm text-zinc-400 flex items-center justify-center">
                                        +{gaps.length - 6} more gaps
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Run Research Button */}
                    <div className="flex items-center justify-between p-6 border border-white/10 rounded-xl bg-gradient-to-r from-violet-500/5 to-blue-500/5">
                        <div>
                            <h3 className="text-sm font-medium text-white mb-1">Ready to Research</h3>
                            <p className="text-xs text-zinc-500">
                                The agent will search the web and academic sources based on your prompt.
                            </p>
                        </div>
                        <Button
                            onClick={handleRunResearch}
                            disabled={isCurrentlyResearching || !researchPrompt}
                            className="bg-gradient-to-r from-violet-500 to-blue-500 hover:from-violet-600 hover:to-blue-600"
                        >
                            {isCurrentlyResearching ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Researching...
                                </>
                            ) : (
                                <>
                                    <Play className="mr-2 h-4 w-4" />
                                    Start Research Agent
                                </>
                            )}
                        </Button>
                    </div>

                    {/* Navigation */}
                    <div className="flex gap-3">
                        <Button
                            variant="ghost"
                            onClick={handleBack}
                            className="border border-white/10"
                        >
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back
                        </Button>
                    </div>
                </div>
            )}

            {/* Results Tab */}
            {activeTab === "results" && (
                <div className="space-y-8">
                    {/* Progress Tracker */}
                    {isCurrentlyResearching && (
                        <motion.div
                            initial={{ opacity: 0, y: -20 }}
                            animate={{ opacity: 1, y: 0 }}
                        >
                            <Card className="bg-gradient-to-br from-violet-500/20 to-blue-500/20 border-violet-500/30 overflow-hidden">
                                <CardContent className="p-6">
                                    <div className="space-y-6">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="h-12 w-12 rounded-full bg-violet-500/20 flex items-center justify-center">
                                                    <Zap className="h-6 w-6 text-violet-400 animate-pulse" />
                                                </div>
                                                <div>
                                                    <h3 className="text-lg font-semibold text-white">Research in Progress</h3>
                                                    <p className="text-sm text-white/60">Searching web and academic sources...</p>
                                                </div>
                                            </div>
                                            <div className="text-center">
                                                <div className="text-2xl font-bold text-violet-400 flex items-center gap-1">
                                                    <Clock className="h-5 w-5" />
                                                    {formatTime(elapsedTime)}
                                                </div>
                                                <div className="text-xs text-white/60 uppercase">Elapsed</div>
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <div className="flex justify-between text-sm">
                                                <span className="text-white/80">Progress</span>
                                                <span className="text-violet-400 font-bold">{Math.round(researchProgress)}%</span>
                                            </div>
                                            <div className="h-3 bg-black/20 rounded-full overflow-hidden">
                                                <motion.div
                                                    initial={{ width: 0 }}
                                                    animate={{ width: `${researchProgress}%` }}
                                                    className="h-full bg-gradient-to-r from-violet-500 to-blue-500 rounded-full"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </motion.div>
                    )}

                    {/* No Results Yet */}
                    {!hasResearchResult && !isCurrentlyResearching && (
                        <div className="border border-white/10 rounded-xl p-8 text-center">
                            <Search className="h-16 w-16 text-zinc-600 mx-auto mb-4" />
                            <h2 className="text-xl font-semibold text-white mb-2">No Research Results Yet</h2>
                            <p className="text-muted-foreground mb-6">
                                Go to the Research Prompt tab to start the Research Agent.
                            </p>
                            <Button onClick={() => setActiveTab("prompt")}>
                                <FileText className="mr-2 h-4 w-4" />
                                Go to Research Prompt
                            </Button>
                        </div>
                    )}

                    {/* Research Results */}
                    {hasResearchResult && (
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="space-y-6"
                        >
                            {/* Stats Row */}
                            <div className="grid grid-cols-4 gap-4">
                                <div className="border border-white/10 rounded-lg p-4 text-center">
                                    <div className="text-2xl font-bold text-white">
                                        {pursuit.research_result?.total_sources_used || pursuit.research_result?.findings?.length || 0}
                                    </div>
                                    <div className="text-xs text-zinc-500">Sources Used</div>
                                </div>
                                <div className="border border-blue-500/20 rounded-lg p-4 text-center bg-blue-500/5">
                                    <div className="text-2xl font-bold text-blue-400">
                                        {pursuit.research_result?.total_web_sources || 0}
                                    </div>
                                    <div className="text-xs text-zinc-500">Web Sources</div>
                                </div>
                                <div className="border border-violet-500/20 rounded-lg p-4 text-center bg-violet-500/5">
                                    <div className="text-2xl font-bold text-violet-400">
                                        {pursuit.research_result?.total_academic_sources || 0}
                                    </div>
                                    <div className="text-xs text-zinc-500">Academic</div>
                                </div>
                                <div className="border border-white/10 rounded-lg p-4 text-center">
                                    <div className="text-2xl font-bold text-white">
                                        {pursuit.research_result?.processing_time_ms
                                            ? `${(pursuit.research_result.processing_time_ms / 1000).toFixed(1)}s`
                                            : '-'
                                        }
                                    </div>
                                    <div className="text-xs text-zinc-500">Duration</div>
                                </div>
                            </div>

                            {/* Executive Summary */}
                            <div className="border border-primary/20 rounded-xl p-6 bg-gradient-to-br from-primary/10 to-purple-600/10">
                                <h3 className="text-md font-medium text-white flex items-center gap-2 mb-3">
                                    <CheckCircle className="h-4 w-4 text-primary" />
                                    Executive Summary
                                </h3>
                                <p className="text-white/90 leading-relaxed">
                                    {pursuit.research_result?.overall_summary || "No summary available."}
                                </p>
                            </div>

                            {/* Key Insights */}
                            {pursuit.research_result?.key_insights && pursuit.research_result.key_insights.length > 0 && (
                                <div className="border border-violet-500/20 rounded-xl p-6 bg-gradient-to-br from-violet-500/5 to-purple-600/5">
                                    <h3 className="text-md font-medium text-white flex items-center gap-2 mb-4">
                                        <Sparkles className="h-4 w-4 text-violet-400" />
                                        Key Insights ({pursuit.research_result.key_insights.length})
                                    </h3>
                                    <div className="space-y-2">
                                        {pursuit.research_result.key_insights.map((insight, idx) => (
                                            <div key={idx} className="flex items-start gap-3 p-3 rounded-lg bg-violet-500/10 border border-violet-500/20">
                                                <span className="text-violet-400 font-bold text-sm">{idx + 1}.</span>
                                                <p className="text-sm text-white/90">{insight}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Action Items */}
                            {pursuit.research_result?.action_items && pursuit.research_result.action_items.length > 0 && (
                                <div className="border border-blue-500/20 rounded-xl p-6 bg-gradient-to-br from-blue-500/5 to-cyan-600/5">
                                    <h3 className="text-md font-medium text-white flex items-center gap-2 mb-4">
                                        <CheckSquare className="h-4 w-4 text-blue-400" />
                                        Action Items ({pursuit.research_result.action_items.length})
                                    </h3>
                                    <div className="space-y-2">
                                        {pursuit.research_result.action_items.map((item, idx) => (
                                            <div key={idx} className="flex items-start gap-3 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                                                <CheckCircle className="h-4 w-4 text-blue-400 mt-0.5 flex-shrink-0" />
                                                <p className="text-sm text-white/90">{item}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Detailed Findings by Gap */}
                            {pursuit.research_result?.findings && pursuit.research_result.findings.length > 0 && (
                                <div className="border border-white/10 rounded-xl p-6">
                                    <h3 className="text-md font-medium text-white flex items-center gap-2 mb-4">
                                        <Search className="h-4 w-4 text-primary" />
                                        Detailed Findings ({pursuit.research_result.findings.length})
                                    </h3>
                                    <div className="space-y-3">
                                        {pursuit.research_result.findings.map((finding, idx) => (
                                            <div key={idx} className="border border-white/10 rounded-lg overflow-hidden">
                                                {/* Gap Header - Clickable */}
                                                <button
                                                    onClick={() => toggleFinding(idx)}
                                                    className="w-full p-4 bg-white/5 hover:bg-white/10 transition-colors flex items-center justify-between"
                                                >
                                                    <div className="flex items-center gap-3">
                                                        {expandedFindings.has(idx) ? (
                                                            <ChevronDown className="h-4 w-4 text-zinc-400" />
                                                        ) : (
                                                            <ChevronRight className="h-4 w-4 text-zinc-400" />
                                                        )}
                                                        <div className="text-left">
                                                            <h4 className="text-sm font-medium text-white">{finding.gap}</h4>
                                                            <p className="text-xs text-zinc-500 mt-0.5">{finding.research_area}</p>
                                                        </div>
                                                    </div>
                                                    <span className={cn(
                                                        "text-xs px-2 py-1 rounded",
                                                        finding.confidence >= 0.8 ? "bg-green-500/20 text-green-400" :
                                                        finding.confidence >= 0.5 ? "bg-yellow-500/20 text-yellow-400" :
                                                        "bg-red-500/20 text-red-400"
                                                    )}>
                                                        {Math.round(finding.confidence * 100)}% confidence
                                                    </span>
                                                </button>

                                                {/* Expanded Content */}
                                                {expandedFindings.has(idx) && (
                                                    <div className="p-4 border-t border-white/10 space-y-4">
                                                        {/* Findings */}
                                                        {finding.findings && finding.findings.length > 0 && (
                                                            <div>
                                                                <h5 className="text-xs font-medium text-zinc-400 uppercase mb-2">Findings</h5>
                                                                <div className="space-y-2">
                                                                    {finding.findings.map((f, fIdx) => (
                                                                        <div key={fIdx} className="p-3 rounded bg-white/5 border-l-2 border-violet-500/50">
                                                                            <p className="text-sm text-white/90">{f.content}</p>
                                                                            {f.source_url && (
                                                                                <a
                                                                                    href={f.source_url}
                                                                                    target="_blank"
                                                                                    rel="noopener noreferrer"
                                                                                    className="text-xs text-blue-400 hover:underline mt-1 inline-flex items-center gap-1"
                                                                                >
                                                                                    {f.source_title || f.source_url}
                                                                                    <ExternalLink className="h-3 w-3" />
                                                                                </a>
                                                                            )}
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}

                                                        {/* Recommendations */}
                                                        {finding.recommendations && finding.recommendations.length > 0 && (
                                                            <div>
                                                                <h5 className="text-xs font-medium text-zinc-400 uppercase mb-2">Recommendations</h5>
                                                                <div className="space-y-2">
                                                                    {finding.recommendations.map((rec, rIdx) => (
                                                                        <div key={rIdx} className="flex items-start gap-2 p-2 rounded bg-blue-500/10">
                                                                            <ArrowRight className="h-3 w-3 text-blue-400 mt-1 flex-shrink-0" />
                                                                            <p className="text-sm text-white/80">{rec}</p>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}

                                                        {/* Sources */}
                                                        {finding.sources && finding.sources.length > 0 && (
                                                            <div>
                                                                <h5 className="text-xs font-medium text-zinc-400 uppercase mb-2">Sources</h5>
                                                                <div className="space-y-2">
                                                                    {finding.sources.map((source, sIdx) => (
                                                                        <a
                                                                            key={sIdx}
                                                                            href={source.url}
                                                                            target="_blank"
                                                                            rel="noopener noreferrer"
                                                                            className="flex items-start gap-2 p-2 rounded bg-white/5 hover:bg-white/10 transition-colors"
                                                                        >
                                                                            {source.source_type === 'academic' ? (
                                                                                <GraduationCap className="h-4 w-4 text-violet-400 mt-0.5 flex-shrink-0" />
                                                                            ) : (
                                                                                <Globe className="h-4 w-4 text-blue-400 mt-0.5 flex-shrink-0" />
                                                                            )}
                                                                            <div className="flex-1 min-w-0">
                                                                                <p className="text-sm text-blue-400 truncate">{source.title}</p>
                                                                                <p className="text-xs text-zinc-500 truncate">{source.snippet}</p>
                                                                            </div>
                                                                            <ExternalLink className="h-3 w-3 text-zinc-500 flex-shrink-0" />
                                                                        </a>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Actions */}
                            <div className="flex items-center justify-between">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleClearResults}
                                    className="gap-2 border-red-500/30 text-red-400 hover:bg-red-500/10"
                                >
                                    <Trash2 className="h-4 w-4" />
                                    Clear Results
                                </Button>
                                <Button
                                    onClick={handleContinue}
                                    className="bg-primary hover:bg-primary/90"
                                >
                                    Continue to Synthesis
                                    <ArrowRight className="ml-2 h-4 w-4" />
                                </Button>
                            </div>
                        </motion.div>
                    )}
                </div>
            )}
        </div>
    )
}
