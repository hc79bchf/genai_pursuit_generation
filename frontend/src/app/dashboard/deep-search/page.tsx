"use client"

import { useEffect, useState, useRef } from "react"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { fetchApi } from "@/lib/api"
import { Loader2, AlertCircle, Search, ExternalLink, CheckCircle, Play, Clock, Zap, RotateCcw, Trash2, CheckSquare, Square, ChevronDown, Briefcase, Check } from "lucide-react"
import { BorderBeam } from "@/components/BorderBeam"
import Link from "next/link"

import { useResearchStore } from "@/store/researchStore"
import { PageGuide } from "@/components/PageGuide"
import { cn } from "@/lib/utils"

interface ResearchResult {
    query: string
    results: SearchResult[]
    summary: string
}

interface SearchResult {
    query: string
    url: string
    title: string
    snippet: string
    extracted_info: string
    relevance_score: number
}

interface Pursuit {
    id: string
    entity_name: string
    gap_analysis_result?: {
        gaps: string[]
        search_queries: string[]
        reasoning: string
    }
    research_result?: {
        research_results: ResearchResult[]
        overall_summary: string
    }
}

interface PursuitListItem {
    id: string
    entity_name: string
    status: string
    selected_template_id?: string
}

export default function DeepSearchPage() {
    const [pursuit, setPursuit] = useState<Pursuit | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [maxSourcesPerQuery, setMaxSourcesPerQuery] = useState(3)
    const [selectedResults, setSelectedResults] = useState<Set<string>>(new Set())

    // Pursuit selector state
    const [pursuits, setPursuits] = useState<PursuitListItem[]>([])
    const [selectedPursuitId, setSelectedPursuitId] = useState<string | null>(null)
    const [dropdownOpen, setDropdownOpen] = useState(false)
    const dropdownRef = useRef<HTMLDivElement>(null)

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
                // Auto-select first pursuit if available
                if (activePursuits.length > 0) {
                    setSelectedPursuitId(activePursuits[0].id)
                }
            } catch (error) {
                console.error("Failed to load pursuits:", error)
            }
        }
        loadPursuits()
    }, [])

    const selectedPursuitListItem = pursuits.find(p => p.id === selectedPursuitId)

    const toggleSelection = (url: string) => {
        const newSelected = new Set(selectedResults)
        if (newSelected.has(url)) {
            newSelected.delete(url)
        } else {
            newSelected.add(url)
        }
        setSelectedResults(newSelected)
    }

    // Get research state from Zustand store
    const {
        pursuitId,
        isResearching,
        researchProgress,
        completedQueries,
        elapsedTime,
        startResearch,
        updateProgress,
        completeResearch,
        resetResearch,
        incrementElapsedTime
    } = useResearchStore()

    // Load pursuit details when selectedPursuitId changes
    useEffect(() => {
        const loadPursuitDetails = async () => {
            if (!selectedPursuitId) {
                setIsLoading(false)
                return
            }

            setIsLoading(true)
            try {
                const fullPursuit = await fetchApi(`/pursuits/${selectedPursuitId}`)
                setPursuit(fullPursuit)

                // If research is ongoing for this pursuit, continue polling
                if (isResearching && pursuitId === selectedPursuitId && !fullPursuit.research_result) {
                    startPolling(selectedPursuitId, fullPursuit?.gap_analysis_result?.search_queries?.length || 0)
                }
            } catch (error) {
                console.error("Failed to load pursuit details:", error)
            } finally {
                setIsLoading(false)
            }
        }

        loadPursuitDetails()
    }, [selectedPursuitId])

    // Timer effect for elapsed time
    useEffect(() => {
        let timer: NodeJS.Timeout
        if (isResearching) {
            timer = setInterval(() => {
                incrementElapsedTime()
            }, 1000)
        }
        return () => clearInterval(timer)
    }, [isResearching, incrementElapsedTime])

    const startPolling = (pursuitId: string, totalQueries: number) => {
        // Simulate progress based on time (rough estimate)
        let pollCount = 0
        const progressInterval = setInterval(() => {
            pollCount++
            // Estimate: each query takes ~10 seconds, so update progress
            const estimatedProgress = Math.min((pollCount * 3000) / (totalQueries * 10000) * 100, 95)
            const completed = Math.floor((estimatedProgress / 100) * totalQueries)
            updateProgress(estimatedProgress, completed)
        }, 3000)

        // Poll for results
        const pollInterval = setInterval(async () => {
            try {
                const updatedPursuit = await fetchApi(`/pursuits/${pursuitId}`)
                if (updatedPursuit.research_result) {
                    clearInterval(pollInterval)
                    clearInterval(progressInterval)
                    updateProgress(100, totalQueries)
                    setPursuit(updatedPursuit)

                    // Small delay before completing
                    setTimeout(() => {
                        completeResearch()
                    }, 1000)
                }
            } catch (error) {
                console.error("Polling error:", error)
            }
        }, 3000)

        // Timeout after 120 seconds
        setTimeout(() => {
            clearInterval(pollInterval)
            clearInterval(progressInterval)
            completeResearch()
        }, 120000)

            // Store intervals in global scope so they can be cleared if component unmounts
            ; (window as any).__researchPollingIntervals = { progressInterval, pollInterval }
    }

    const handleRunResearch = async () => {
        if (!pursuit) return

        const totalQueries = pursuit.gap_analysis_result?.search_queries?.length || 0

        // Start research in store
        startResearch(pursuit.id, totalQueries)

        try {
            await fetchApi(`/pursuits/${pursuit.id}/research?max_results_per_query=5`, {
                method: "POST"
            })

            // Start polling
            startPolling(pursuit.id, totalQueries)

        } catch (error) {
            console.error("Research failed:", error)
            resetResearch()
            alert("Failed to start research")
        }
    }

    const handleClearResults = () => {
        if (!pursuit) return

        // Clear research results from local state
        setPursuit({
            ...pursuit,
            research_result: undefined
        })

        // Reset store
        resetResearch()
    }

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60)
        const secs = seconds % 60
        return `${mins}:${secs.toString().padStart(2, '0')}`
    }

    // Cleanup intervals on unmount
    useEffect(() => {
        return () => {
            const intervals = (window as any).__researchPollingIntervals
            if (intervals) {
                clearInterval(intervals.progressInterval)
                clearInterval(intervals.pollInterval)
            }
        }
    }, [])

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-full">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        )
    }

    if (!pursuit) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-center p-8">
                <AlertCircle className="h-16 w-16 text-muted-foreground mb-4" />
                <h2 className="text-xl font-semibold text-white mb-2">No Pursuit Found</h2>
                <p className="text-muted-foreground mb-6">Create a pursuit to start deep search</p>
                <Button asChild>
                    <Link href="/dashboard/pursuits/new">Create New Pursuit</Link>
                </Button>
            </div>
        )
    }

    if (!pursuit.gap_analysis_result) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-center p-8">
                <AlertCircle className="h-16 w-16 text-muted-foreground mb-4" />
                <h2 className="text-xl font-semibold text-white mb-2">Gap Analysis Required</h2>
                <p className="text-muted-foreground mb-6">Complete gap analysis before running deep search</p>
                <Button asChild>
                    <Link href="/dashboard/gap-assessment">Go to Gap Assessment</Link>
                </Button>
            </div>
        )
    }

    const searchQueries = pursuit.gap_analysis_result.search_queries || []
    const totalQueries = searchQueries.length

    return (
        <div className="space-y-8 max-w-7xl mx-auto pb-10">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2">
                        <h1 className="text-2xl font-bold tracking-tight text-white">Deep Search</h1>
                        <PageGuide
                            title="Deep Search"
                            description="Deep Search uses AI agents to perform autonomous web research, finding evidence and information to address identified gaps."
                            guidelines={[
                                "First, select a pursuit from the dropdown to work on.",
                                "Review the search queries generated from the Gap Assessment.",
                                "Adjust the 'Sources per query' setting to control research depth.",
                                "Click 'Start Deep Search' to initiate the autonomous research agent.",
                                "Monitor progress in real-time as the agent searches and analyzes sources.",
                                "Select specific search results to include in your final proposal."
                            ]}
                        />
                    </div>
                    <p className="text-muted-foreground mt-1">
                        AI-powered web research to fill gaps in your proposal
                    </p>
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
                            <div className="text-xs text-muted-foreground">Working on</div>
                            <div className={cn(
                                "text-sm font-medium truncate",
                                selectedPursuitId ? "text-white" : "text-muted-foreground"
                            )}>
                                {selectedPursuitListItem?.entity_name || "Select a pursuit"}
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
                                pursuits.map((p) => (
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
                                                {p.status?.replace('_', ' ') || 'Draft'}
                                            </div>
                                        </div>
                                        {selectedPursuitId === p.id && (
                                            <Check className="h-4 w-4 text-primary shrink-0" />
                                        )}
                                    </button>
                                ))
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Controls Row */}
            <div className="flex items-center justify-end gap-3">
                {/* Sources per query selector */}
                <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground whitespace-nowrap">
                        Sources per query:
                    </span>
                    <select
                        value={maxSourcesPerQuery}
                        onChange={(e) => setMaxSourcesPerQuery(Number(e.target.value))}
                        disabled={isResearching}
                        className="h-9 rounded-md border border-white/10 bg-white/5 px-3 py-1 text-sm text-white focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {[1, 2, 3, 4, 5].map((num) => (
                            <option key={num} value={num} className="bg-slate-900 text-white">
                                {num}
                            </option>
                        ))}
                    </select>
                </div>
                {pursuit.research_result && !isResearching && (
                    <Button
                        size="lg"
                        variant="outline"
                        onClick={handleClearResults}
                        className="gap-2 border-red-500/30 text-red-400 hover:bg-red-500/10 hover:border-red-500/50"
                    >
                        <Trash2 className="h-4 w-4" />
                        Clear Results
                    </Button>
                )}
                <Button
                    size="lg"
                    onClick={handleRunResearch}
                    disabled={isResearching || searchQueries.length === 0}
                    className="relative overflow-hidden rounded-full bg-primary hover:bg-primary/90 text-white shadow-[0_0_20px_rgba(124,58,237,0.3)] border-0 group"
                >
                    <span className="relative z-10 flex items-center gap-2">
                        {isResearching ? (
                            <>
                                <Loader2 className="h-5 w-5 animate-spin" />
                                Researching...
                            </>
                        ) : (
                            <>
                                {pursuit.research_result ? <RotateCcw className="h-5 w-5" /> : <Play className="h-5 w-5" />}
                                {pursuit.research_result ? "Rerun Deep Search" : "Start Deep Search"}
                            </>
                        )}
                    </span>
                    <BorderBeam
                        size={80}
                        duration={3}
                        delay={0}
                        borderWidth={1.5}
                        colorFrom="#ffffff"
                        colorTo="#a78bfa"
                        className="opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                    />
                </Button>
            </div>

            {/* Progress Tracker */}
            {isResearching && (
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="relative"
                >
                    <Card className="bg-gradient-to-br from-primary/20 to-purple-600/20 border-primary/30 overflow-hidden">
                        {/* Animated background */}
                        <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-purple-600/10 to-primary/10 animate-pulse" />

                        <CardContent className="p-6 relative z-10">
                            <div className="space-y-6">
                                {/* Header Row */}
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="h-12 w-12 rounded-full bg-primary/20 flex items-center justify-center">
                                            <Zap className="h-6 w-6 text-primary animate-pulse" />
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-semibold text-white">Deep Search in Progress</h3>
                                            <p className="text-sm text-white/60">Analyzing web sources to fill knowledge gaps</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-6">
                                        <div className="text-center">
                                            <div className="text-2xl font-bold text-white">{completedQueries}/{totalQueries}</div>
                                            <div className="text-xs text-white/60 uppercase tracking-wider">Queries</div>
                                        </div>
                                        <div className="text-center">
                                            <div className="text-2xl font-bold text-primary flex items-center gap-1">
                                                <Clock className="h-5 w-5" />
                                                {formatTime(elapsedTime)}
                                            </div>
                                            <div className="text-xs text-white/60 uppercase tracking-wider">Elapsed</div>
                                        </div>
                                    </div>
                                </div>

                                {/* Progress Bar */}
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-white/80 font-medium">Overall Progress</span>
                                        <span className="text-primary font-bold">{Math.round(researchProgress)}%</span>
                                    </div>
                                    <div className="relative h-3 bg-black/20 rounded-full overflow-hidden">
                                        <motion.div
                                            initial={{ width: 0 }}
                                            animate={{ width: `${researchProgress}%` }}
                                            transition={{ duration: 0.5 }}
                                            className="absolute inset-y-0 left-0 bg-gradient-to-r from-primary via-purple-500 to-primary bg-[length:200%_100%] animate-[shimmer_2s_linear_infinite] rounded-full shadow-lg shadow-primary/50"
                                        />
                                        {/* Glow effect */}
                                        <motion.div
                                            initial={{ width: 0 }}
                                            animate={{ width: `${researchProgress}%` }}
                                            transition={{ duration: 0.5 }}
                                            className="absolute inset-y-0 left-0 bg-gradient-to-r from-primary/50 to-purple-500/50 blur-sm rounded-full"
                                        />
                                    </div>
                                </div>

                                {/* Query Grid */}
                                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                                    {searchQueries.map((query: string, i: number) => {
                                        const isCompleted = i < completedQueries
                                        const isInProgress = i === completedQueries

                                        return (
                                            <motion.div
                                                key={i}
                                                initial={{ opacity: 0.3 }}
                                                animate={{
                                                    opacity: isCompleted ? 1 : isInProgress ? 0.8 : 0.4,
                                                    scale: isInProgress ? 1.05 : 1
                                                }}
                                                className={`px-3 py-2 rounded-lg text-xs font-medium border transition-all ${isCompleted
                                                    ? "bg-green-500/20 border-green-500/40 text-green-200"
                                                    : isInProgress
                                                        ? "bg-primary/20 border-primary/40 text-primary animate-pulse"
                                                        : "bg-white/5 border-white/10 text-white/40"
                                                    }`}
                                            >
                                                <div className="flex items-center gap-2">
                                                    {isCompleted && <CheckCircle className="h-3 w-3" />}
                                                    {isInProgress && <Loader2 className="h-3 w-3 animate-spin" />}
                                                    <span className="truncate">Query {i + 1}</span>
                                                </div>
                                            </motion.div>
                                        )
                                    })}
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </motion.div>
            )}

            {/* Search Queries */}
            <Card className="bg-white/5 border-white/10">
                <CardContent className="p-6">
                    <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                        <Search className="h-5 w-5 text-primary" />
                        Search Queries ({searchQueries.length})
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {searchQueries.map((query: string, i: number) => (
                            <div
                                key={i}
                                className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-sm text-blue-200"
                            >
                                {query}
                            </div>
                        ))}
                    </div>
                    {searchQueries.length === 0 && (
                        <p className="text-muted-foreground text-sm">No search queries available</p>
                    )}

                    {/* Dynamic sources summary */}
                    {searchQueries.length > 0 && (
                        <div className="mt-4 pt-4 border-t border-white/10 flex items-center justify-between">
                            <div className="text-sm text-muted-foreground">
                                <span className="text-white font-medium">{searchQueries.length}</span> queries × <span className="text-white font-medium">{maxSourcesPerQuery}</span> sources per query
                            </div>
                            <div className="text-sm">
                                <span className="text-muted-foreground">Total sources: </span>
                                <span className="text-primary font-bold">{searchQueries.length * maxSourcesPerQuery}</span>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Research Results */}
            {pursuit.research_result && (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-6"
                >
                    {/* Overall Summary */}
                    <Card className="bg-gradient-to-br from-primary/10 to-purple-600/10 border-primary/20">
                        <CardContent className="p-6">
                            <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                                <CheckCircle className="h-5 w-5 text-primary" />
                                Executive Summary
                            </h2>
                            <p className="text-white/90 leading-relaxed">
                                {pursuit.research_result.overall_summary}
                            </p>
                        </CardContent>
                    </Card>

                    {/* Individual Query Results */}
                    {pursuit.research_result.research_results.map((research: ResearchResult, idx: number) => (
                        <Card key={idx} className="bg-white/5 border-white/10">
                            <CardContent className="p-6">
                                <div className="mb-4">
                                    <h3 className="text-md font-semibold text-white mb-2 flex items-center gap-2">
                                        <Search className="h-4 w-4 text-blue-400" />
                                        {research.query}
                                    </h3>
                                    <p className="text-sm text-muted-foreground">
                                        {research.summary}
                                    </p>
                                </div>

                                {research.results.length > 0 && (
                                    <div className="space-y-3 mt-4">
                                        <h4 className="text-sm font-medium text-white/60 uppercase tracking-wider">
                                            Sources ({Math.min(research.results.length, maxSourcesPerQuery)})
                                        </h4>
                                        {research.results.slice(0, maxSourcesPerQuery).map((result: SearchResult, resultIdx: number) => {
                                            const isSelected = selectedResults.has(result.url)
                                            return (
                                                <div
                                                    key={resultIdx}
                                                    onClick={() => toggleSelection(result.url)}
                                                    className={`p-4 rounded-lg border transition-all cursor-pointer group relative ${isSelected
                                                        ? "bg-primary/10 border-primary/50"
                                                        : "bg-white/5 border-white/10 hover:border-primary/30"
                                                        }`}
                                                >
                                                    <div className="absolute top-4 right-4 text-primary/50 group-hover:text-primary transition-colors">
                                                        {isSelected ? (
                                                            <CheckSquare className="h-5 w-5 text-primary" />
                                                        ) : (
                                                            <Square className="h-5 w-5" />
                                                        )}
                                                    </div>
                                                    <div className="flex items-start justify-between gap-3 mb-2 pr-8">
                                                        <div className="flex-1">
                                                            <a
                                                                href={result.url}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                onClick={(e) => e.stopPropagation()}
                                                                className="text-sm font-medium text-primary hover:underline flex items-center gap-1"
                                                            >
                                                                {result.title}
                                                                <ExternalLink className="h-3 w-3" />
                                                            </a>
                                                            <p className="text-xs text-muted-foreground mt-1">
                                                                {result.snippet}
                                                            </p>
                                                        </div>
                                                        <div className="flex items-center gap-1">
                                                            <div className="text-xs font-medium text-white/60">
                                                                {Math.round(result.relevance_score * 100)}%
                                                            </div>
                                                        </div>
                                                    </div>
                                                    {result.extracted_info && (
                                                        <div className="mt-2 p-3 rounded bg-primary/5 border-l-2 border-primary/30">
                                                            <p className="text-sm text-white/80">
                                                                {result.extracted_info}
                                                            </p>
                                                        </div>
                                                    )}
                                                </div>
                                            )
                                        })}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    ))}
                </motion.div>
            )}
        </div>
    )
}
