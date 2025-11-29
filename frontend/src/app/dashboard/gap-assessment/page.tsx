"use client"

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { fetchApi } from "@/lib/api"
import { templates } from "@/lib/data"
import { Loader2, AlertCircle, Check, ArrowRight, Sparkles, FileText, Edit2, Trash2, Plus, X, Save } from "lucide-react"
import { MetadataDisplay } from "@/components/metadata-display"
import Link from "next/link"
import { PageGuide } from "@/components/PageGuide"
import { BorderBeam } from "@/components/BorderBeam"

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
    gap_analysis_result?: {
        gaps: string[]
        search_queries: string[]
        reasoning: string
    }
}

export default function GapAssessmentPage() {
    const [pursuit, setPursuit] = useState<Pursuit | null>(null)
    const [selectedTemplate, setSelectedTemplate] = useState<any>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [isAnalyzing, setIsAnalyzing] = useState(false)
    const [isEditing, setIsEditing] = useState(false)
    const [isSaving, setIsSaving] = useState(false)
    const [editedGaps, setEditedGaps] = useState<string[]>([])
    const [editedQueries, setEditedQueries] = useState<string[]>([])
    const [editedReasoning, setEditedReasoning] = useState("")

    useEffect(() => {
        const loadData = async () => {
            try {
                // 1. Fetch latest pursuit
                // Ideally we'd have an endpoint for "latest" or pass ID via query param
                // For now, fetch all and take the first one (assuming sorted by date desc or we sort client side)
                const pursuits = await fetchApi("/pursuits/")
                if (pursuits && pursuits.length > 0) {
                    // Sort by created_at desc just in case
                    const sorted = pursuits.sort((a: any, b: any) =>
                        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
                    )
                    // We need full details for the pursuit, so fetch individual
                    const latestId = sorted[0].id
                    const fullPursuit = await fetchApi(`/pursuits/${latestId}`)
                    setPursuit(fullPursuit)
                }

                // 2. Get selected template
                const templateId = localStorage.getItem("selectedTemplateId")
                if (templateId) {
                    const template = templates.find(t => t.id === templateId)
                    setSelectedTemplate(template || null)
                }
            } catch (error) {
                console.error("Failed to load data:", error)
            } finally {
                setIsLoading(false)
            }
        }

        loadData()
    }, [])

    const handleRunAnalysis = async () => {
        if (!pursuit || !selectedTemplate) return

        setIsAnalyzing(true)
        try {
            // Trigger analysis
            await fetchApi(`/pursuits/${pursuit.id}/gap-analysis`, {
                method: "POST",
                body: JSON.stringify(selectedTemplate)
            })

            // Poll for results
            const pollInterval = setInterval(async () => {
                const updatedPursuit = await fetchApi(`/pursuits/${pursuit.id}`)
                if (updatedPursuit.gap_analysis_result) {
                    clearInterval(pollInterval)
                    setPursuit(updatedPursuit)
                    setIsAnalyzing(false)
                }
            }, 2000)

            // Timeout after 60 seconds
            setTimeout(() => {
                clearInterval(pollInterval)
                setIsAnalyzing(false)
            }, 60000)

        } catch (error) {
            console.error("Analysis failed:", error)
            setIsAnalyzing(false)
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

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-full">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        )
    }

    return (
        <div className="space-y-8 max-w-7xl mx-auto pb-10">
            {/* Header */}
            <div>
                <div className="flex items-center gap-2">
                    <h1 className="text-2xl font-bold tracking-tight text-white">Gap Assessment</h1>
                    <PageGuide
                        title="Gap Assessment"
                        description="The Gap Assessment page helps you identify missing information in your pursuit by comparing extracted RFP data against a selected proposal template."
                        guidelines={[
                            "Review the extracted RFP metadata in the left column.",
                            "Select a target proposal outline template from the library.",
                            "Run the AI Gap Analysis Agent to identify missing requirements.",
                            "Review identified gaps and recommended search queries.",
                            "Edit the analysis results if needed before proceeding to Deep Search."
                        ]}
                    />
                </div>
                <p className="text-muted-foreground mt-1">Analyze the gap between your extracted RFP data and the selected proposal outline.</p>
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

                    {pursuit ? (
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

            {/* Analysis Results */}
            {pursuit?.gap_analysis_result && (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-6 mt-12 pt-8 border-t border-white/10"
                >
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-semibold text-white">Analysis Results</h2>
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
                    </div>

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
                </motion.div>
            )}
        </div>
    )
}
