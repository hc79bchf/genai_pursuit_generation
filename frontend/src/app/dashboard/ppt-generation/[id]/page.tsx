"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { api } from "@/lib/api"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { Check, Download, Loader2, ChevronDown, ChevronUp, ArrowLeft, Sparkles, CircleDot } from "lucide-react"
import { BorderBeam } from "@/components/BorderBeam"
import { PageGuide } from "@/components/PageGuide"

interface ResearchResultItem {
    query: string;
    url: string;
    title: string;
    snippet: string;
    extracted_info: string;
    relevance_score: number;
}

interface QueryResult {
    query: string;
    results: ResearchResultItem[];
    summary: string;
}

// Proposal lifecycle statuses
const PURSUIT_STATUSES = [
    { value: 'draft', label: 'Draft', color: 'bg-gray-500' },
    { value: 'in_review', label: 'In Review', color: 'bg-yellow-500' },
    { value: 'ready_for_submission', label: 'Ready for Submission', color: 'bg-blue-500' },
    { value: 'submitted', label: 'Submitted', color: 'bg-purple-500' },
    { value: 'won', label: 'Won', color: 'bg-green-500' },
    { value: 'lost', label: 'Lost', color: 'bg-red-500' },
    { value: 'cancelled', label: 'Cancelled', color: 'bg-gray-400' },
    { value: 'stale', label: 'Stale', color: 'bg-orange-500' },
] as const;

type PursuitStatus = typeof PURSUIT_STATUSES[number]['value'];

export default function PPTGenerationPage() {
    const params = useParams()
    const id = params?.id as string

    const [pursuit, setPursuit] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [generating, setGenerating] = useState(false)
    const [selectedResults, setSelectedResults] = useState<Record<string, boolean>>({})
    const [generatedMarkdown, setGeneratedMarkdown] = useState<string | null>(null)
    const [previewHtml, setPreviewHtml] = useState<string | null>(null)
    const [generatedFileId, setGeneratedFileId] = useState<string | null>(null)
    const [expandedQueries, setExpandedQueries] = useState<Record<number, boolean>>({})
    const [statusDropdownOpen, setStatusDropdownOpen] = useState(false)
    const [updatingStatus, setUpdatingStatus] = useState(false)

    useEffect(() => {
        const fetchPursuit = async () => {
            try {
                const data = await api.getPursuit(id)
                setPursuit(data)

                // Check for existing generated files
                console.log("Files found:", data.files)
                if (data.files && data.files.length > 0) {
                    // Find latest PPTX
                    const pptxFiles = data.files.filter((f: any) => f.file_type === 'output_pptx')
                    console.log("PPTX Files:", pptxFiles)
                    if (pptxFiles.length > 0) {
                        // Sort by uploaded_at desc
                        pptxFiles.sort((a: any, b: any) => new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime())
                        setGeneratedFileId(pptxFiles[0].id)
                    }

                    // Find latest HTML preview
                    const htmlFiles = data.files.filter((f: any) => f.mime_type === 'text/html')
                    console.log("HTML Files:", htmlFiles)
                    if (htmlFiles.length > 0) {
                        htmlFiles.sort((a: any, b: any) => new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime())
                        const latestHtml = htmlFiles[0]
                        console.log("Loading HTML preview from:", latestHtml.id)
                        try {
                            const blob = await api.downloadFile(id, latestHtml.id)
                            const text = await blob.text()
                            console.log("HTML content loaded, length:", text.length)
                            setPreviewHtml(text)
                        } catch (e) {
                            console.error("Failed to load preview HTML", e)
                        }
                    }
                }

                // Initialize selected results (default to all selected)
                if (data.research_result && data.research_result.research_results) {
                    const initialSelection: Record<string, boolean> = {}
                    const initialExpanded: Record<number, boolean> = {}
                    data.research_result.research_results.forEach((q: QueryResult, qIdx: number) => {
                        initialExpanded[qIdx] = true
                        q.results.forEach((r: ResearchResultItem, rIdx: number) => {
                            initialSelection[`${qIdx}-${rIdx}`] = true
                        })
                    })
                    setSelectedResults(initialSelection)
                    setExpandedQueries(initialExpanded)
                }
            } catch (error) {
                console.error("Failed to fetch pursuit", error)
            } finally {
                setLoading(false)
            }
        }
        fetchPursuit()
    }, [id])

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

    const handleGenerate = async () => {
        setGenerating(true)
        setGeneratedMarkdown(null)
        setPreviewHtml(null)
        try {
            // Construct filtered research result
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

            const response = await api.generatePPTOutline(id, customResearch)
            setGeneratedMarkdown(response.markdown)
            setPreviewHtml(response.preview_html)
            setGeneratedFileId(response.pptx_file_id)
        } catch (error) {
            console.error("Failed to generate PPT", error)
        } finally {
            setGenerating(false)
        }
    }

    const handleDownload = async () => {
        if (!generatedFileId) return
        try {
            const blob = await api.downloadFile(id, generatedFileId)
            const url = window.URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `presentation_${id}.pptx` // Default name, can be improved if header exposed
            document.body.appendChild(a)
            a.click()
            window.URL.revokeObjectURL(url)
            document.body.removeChild(a)
        } catch (error) {
            console.error("Failed to download file", error)
            alert("Failed to download file")
        }
    }

    const handleStatusChange = async (newStatus: PursuitStatus) => {
        setUpdatingStatus(true)
        setStatusDropdownOpen(false)
        try {
            const updatedPursuit = await api.updatePursuit(id, { status: newStatus })
            setPursuit(updatedPursuit)
        } catch (error) {
            console.error("Failed to update status", error)
            alert("Failed to update status")
        } finally {
            setUpdatingStatus(false)
        }
    }

    const getCurrentStatusInfo = () => {
        const currentStatus = pursuit?.status || 'draft'
        return PURSUIT_STATUSES.find(s => s.value === currentStatus) || PURSUIT_STATUSES[0]
    }

    if (loading) return <div className="p-8 text-center">Loading...</div>
    if (!pursuit) return <div className="p-8 text-center">Pursuit not found</div>

    return (
        <div className="p-8 h-full flex flex-col">
            <div className="mb-6 flex items-center justify-between">
                <div>
                    <div className="flex items-center gap-2">
                        <h1 className="text-3xl font-bold tracking-tight text-white">PPT Generation Agent</h1>
                        <PageGuide
                            title="Generate Presentation"
                            description="Create a professional PowerPoint presentation using AI-powered content generation based on your pursuit data."
                            guidelines={[
                                "Review the pursuit metadata on the left panel.",
                                "Select which deep search findings to include in the presentation.",
                                "Click 'Generate Presentation' to create your slides.",
                                "Preview the generated content in the right panel.",
                                "Download the PPTX file when satisfied with the preview."
                            ]}
                        />
                    </div>
                    <p className="text-muted-foreground">Generate a presentation for {pursuit.entity_name}</p>
                </div>
                <div className="flex items-center gap-4">
                    {/* Status Dropdown */}
                    <div className="relative">
                        <Button
                            variant="outline"
                            className="min-w-[180px] justify-between"
                            onClick={() => setStatusDropdownOpen(!statusDropdownOpen)}
                            disabled={updatingStatus}
                        >
                            <span className="flex items-center gap-2">
                                {updatingStatus ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                    <CircleDot className={`h-3 w-3 ${getCurrentStatusInfo().color.replace('bg-', 'text-')}`} />
                                )}
                                {getCurrentStatusInfo().label}
                            </span>
                            <ChevronDown className={`h-4 w-4 transition-transform ${statusDropdownOpen ? 'rotate-180' : ''}`} />
                        </Button>
                        {statusDropdownOpen && (
                            <>
                                <div
                                    className="fixed inset-0 z-40"
                                    onClick={() => setStatusDropdownOpen(false)}
                                />
                                <div className="absolute right-0 top-full mt-1 z-50 min-w-[180px] bg-card border border-white/10 rounded-lg shadow-lg overflow-hidden">
                                    {PURSUIT_STATUSES.map((status) => (
                                        <button
                                            key={status.value}
                                            className={`w-full px-4 py-2 text-left text-sm hover:bg-white/10 flex items-center gap-2 ${
                                                pursuit?.status === status.value ? 'bg-white/5' : ''
                                            }`}
                                            onClick={() => handleStatusChange(status.value)}
                                        >
                                            <span className={`h-2 w-2 rounded-full ${status.color}`} />
                                            {status.label}
                                            {pursuit?.status === status.value && (
                                                <Check className="h-3 w-3 ml-auto text-primary" />
                                            )}
                                        </button>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>
                    <Link href="/dashboard/ppt-generation">
                        <Button variant="outline">
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Select Another Pursuit
                        </Button>
                    </Link>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 min-h-0">
                {/* Left Panel: Inputs */}
                <div className="lg:col-span-5 flex flex-col gap-6 overflow-y-auto pr-2">
                    {/* Metadata Card */}
                    <Card className="bg-card/50 backdrop-blur border-white/10">
                        <CardHeader>
                            <CardTitle className="text-lg">Pursuit Metadata</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <div className="text-sm font-medium text-muted-foreground">Client</div>
                                <div className="text-white">{pursuit.entity_name}</div>
                            </div>
                            <div>
                                <div className="text-sm font-medium text-muted-foreground">Industry</div>
                                <div className="text-white">{pursuit.industry || 'N/A'}</div>
                            </div>
                            <div>
                                <div className="text-sm font-medium text-muted-foreground">Services</div>
                                <div className="text-white">{pursuit.service_types?.join(', ') || 'N/A'}</div>
                            </div>
                            <div>
                                <div className="text-sm font-medium text-muted-foreground">Status</div>
                                <div className="flex items-center gap-2 text-white">
                                    <span className={`h-2 w-2 rounded-full ${getCurrentStatusInfo().color}`} />
                                    {getCurrentStatusInfo().label}
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Research Selection Card */}
                    <Card className="bg-card/50 backdrop-blur border-white/10 flex-1">
                        <CardHeader>
                            <CardTitle className="text-lg">Deep Search Results</CardTitle>
                            <p className="text-xs text-muted-foreground">Select findings to include in context.</p>
                        </CardHeader>
                        <CardContent>
                            {!pursuit.research_result ? (
                                <div className="text-sm text-yellow-500">No research results found. Run Deep Search first.</div>
                            ) : (
                                <div className="space-y-4">
                                    {pursuit.research_result.research_results.map((q: QueryResult, qIdx: number) => (
                                        <div key={qIdx} className="border border-white/10 rounded-lg overflow-hidden">
                                            <div
                                                className="bg-white/5 p-3 flex justify-between items-center cursor-pointer hover:bg-white/10"
                                                onClick={() => toggleQuery(qIdx)}
                                            >
                                                <span className="font-medium text-sm text-white">{q.query}</span>
                                                {expandedQueries[qIdx] ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                            </div>

                                            {expandedQueries[qIdx] && (
                                                <div className="p-3 space-y-2 bg-black/20">
                                                    {q.results.length === 0 ? (
                                                        <div className="text-xs text-muted-foreground">No results.</div>
                                                    ) : (
                                                        q.results.map((r, rIdx) => (
                                                            <div key={rIdx} className="flex items-start gap-3 p-2 rounded hover:bg-white/5">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={!!selectedResults[`${qIdx}-${rIdx}`]}
                                                                    onChange={() => handleToggleResult(qIdx, rIdx)}
                                                                    className="mt-1"
                                                                />
                                                                <div className="flex-1 min-w-0">
                                                                    <div className="text-sm font-medium text-white truncate">{r.title}</div>
                                                                    <div className="text-xs text-muted-foreground line-clamp-2">{r.snippet}</div>
                                                                </div>
                                                            </div>
                                                        ))
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <Button
                        size="lg"
                        className="w-full relative overflow-hidden rounded-full bg-primary hover:bg-primary/90 text-white font-bold py-6 text-lg shadow-[0_0_20px_rgba(124,58,237,0.3)] border-0 group"
                        onClick={handleGenerate}
                        disabled={generating}
                    >
                        <span className="relative z-10 flex items-center justify-center">
                            {generating ? (
                                <>
                                    <Loader2 className="mr-3 h-6 w-6 animate-spin" />
                                    Generating Presentation...
                                </>
                            ) : (
                                <>
                                    <Sparkles className="mr-3 h-6 w-6" />
                                    Generate Presentation
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
                </div>

                {/* Right Panel: Preview */}
                <div className="lg:col-span-7 flex flex-col h-full min-h-[600px]">
                    <Card className="bg-card/50 backdrop-blur border-white/10 h-full flex flex-col">
                        <CardHeader className="flex flex-row items-center justify-between border-b border-white/10">
                            <CardTitle className="text-lg">Preview</CardTitle>
                            {generatedFileId && (
                                <Button variant="outline" size="sm" onClick={handleDownload}>
                                    <Download className="mr-2 h-4 w-4" />
                                    Download PPTX
                                </Button>
                            )}
                        </CardHeader>
                        <CardContent className="flex-1 overflow-hidden p-0 bg-white text-black relative">
                            {previewHtml ? (
                                <div className="w-full h-full flex flex-col">
                                    <div className="bg-gray-100 p-1 text-xs text-gray-500 border-b">
                                        Preview HTML Length: {previewHtml.length} chars
                                    </div>
                                    <iframe
                                        srcDoc={previewHtml}
                                        className="w-full flex-1 border-0"
                                        title="Presentation Preview"
                                        style={{ minHeight: '500px' }}
                                    />
                                </div>
                            ) : generatedMarkdown ? (
                                <div className="p-6 prose max-w-none overflow-auto h-full">
                                    <pre className="whitespace-pre-wrap font-mono text-sm">
                                        {generatedMarkdown}
                                    </pre>
                                </div>
                            ) : (
                                <div className="h-full flex items-center justify-center text-muted-foreground p-6">
                                    Generated content will appear here.
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    )
}
