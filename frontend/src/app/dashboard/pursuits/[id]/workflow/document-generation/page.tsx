"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { api, fetchApi } from "@/lib/api"
import {
    Loader2,
    Download,
    Sparkles,
    ArrowRight,
    ArrowLeft,
    Bot,
    FileText,
    FileOutput,
    CheckCircle2,
    AlertCircle,
    FileType,
    Presentation,
    Clock
} from "lucide-react"
import { cn } from "@/lib/utils"
import { getNextStage, getPreviousStage } from "@/lib/workflow"

type DocGenTab = "overview" | "generator"

interface TabConfig {
    id: DocGenTab
    label: string
    description: string
}

const TABS: TabConfig[] = [
    { id: "overview", label: "OVERVIEW", description: "Learn about the Document Generation Agent and how it works." },
    { id: "generator", label: "GENERATOR", description: "Generate and preview your proposal document in PPTX or DOCX format." },
]

interface PursuitFile {
    id: string
    filename: string
    file_type: string
    mime_type: string
    uploaded_at: string
}

interface Pursuit {
    id: string
    entity_name: string
    industry?: string
    service_types?: string[]
    status: string
    files?: PursuitFile[]
    synthesis_result?: {
        outline: string
        sections: any[]
        generated_at: string
    }
}

type OutputFormat = 'pptx' | 'docx'

export default function DocumentGenerationPage({ params }: { params: { id: string } }) {
    const router = useRouter()
    const pursuitId = params.id
    const [pursuit, setPursuit] = useState<Pursuit | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [isGenerating, setIsGenerating] = useState(false)
    const [previewHtml, setPreviewHtml] = useState<string | null>(null)
    const [generatedFileId, setGeneratedFileId] = useState<string | null>(null)
    const [outputFormat, setOutputFormat] = useState<OutputFormat>('pptx')
    const [generationStatus, setGenerationStatus] = useState<'idle' | 'generating' | 'success' | 'error'>('idle')
    const [activeTab, setActiveTab] = useState<DocGenTab>("overview")

    useEffect(() => {
        async function loadPursuit() {
            try {
                const data = await fetchApi(`/pursuits/${pursuitId}`)
                setPursuit(data)

                // Load existing generated document if available
                if (data.files && data.files.length > 0) {
                    const pptxFiles = data.files.filter((f: PursuitFile) => f.file_type === 'output_pptx')
                    if (pptxFiles.length > 0) {
                        pptxFiles.sort((a: PursuitFile, b: PursuitFile) =>
                            new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime()
                        )
                        setGeneratedFileId(pptxFiles[0].id)
                        setGenerationStatus('success')
                    }

                    const htmlFiles = data.files.filter((f: PursuitFile) => f.mime_type === 'text/html')
                    if (htmlFiles.length > 0) {
                        htmlFiles.sort((a: PursuitFile, b: PursuitFile) =>
                            new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime()
                        )
                        try {
                            const blob = await api.downloadFile(pursuitId, htmlFiles[0].id)
                            const text = await blob.text()
                            setPreviewHtml(text)
                        } catch (e) {
                            console.error("Failed to load preview HTML", e)
                        }
                    }
                }
            } catch (error) {
                console.error("Failed to load pursuit", error)
            } finally {
                setIsLoading(false)
            }
        }
        loadPursuit()
    }, [pursuitId])

    const handleGenerate = async () => {
        if (!pursuit) return

        setIsGenerating(true)
        setGenerationStatus('generating')
        setPreviewHtml(null)

        try {
            // Call the PPT generation endpoint
            const response = await api.generatePPTOutline(pursuitId, null)
            setPreviewHtml(response.preview_html)
            setGeneratedFileId(response.pptx_file_id)
            setGenerationStatus('success')
        } catch (error) {
            console.error("Failed to generate document", error)
            setGenerationStatus('error')
        } finally {
            setIsGenerating(false)
        }
    }

    const handleDownload = async () => {
        if (!generatedFileId) return

        try {
            const blob = await api.downloadFile(pursuitId, generatedFileId)
            const url = window.URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `proposal_${pursuit?.entity_name || pursuitId}.pptx`
            document.body.appendChild(a)
            a.click()
            window.URL.revokeObjectURL(url)
            document.body.removeChild(a)
        } catch (error) {
            console.error("Failed to download file", error)
            alert("Failed to download file")
        }
    }

    const handleContinue = () => {
        const nextStage = getNextStage("document-generation")
        if (nextStage) {
            router.push(nextStage.path(pursuitId))
        }
    }

    const handleBack = () => {
        const prevStage = getPreviousStage("document-generation")
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

    const hasGeneratedDocument = !!previewHtml || !!generatedFileId
    const currentTab = TABS.find(t => t.id === activeTab)

    return (
        <div className="max-w-5xl">
            {/* Page Description */}
            <p className="text-sm text-zinc-500 mb-6">
                Generate your final proposal document in PPTX or DOCX format from the synthesized outline.
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
                        {tab.id === "generator" && hasGeneratedDocument && (
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
                        <h3 className="text-lg font-semibold text-white mb-3">Document Generation Agent</h3>
                        <p className="text-sm text-zinc-400 leading-relaxed mb-4">
                            The Document Generation Agent takes the synthesized proposal outline and converts it into a
                            professional document format. It supports PowerPoint (PPTX) and Word (DOCX) formats with
                            live preview and download capabilities.
                        </p>
                        <p className="text-xs text-zinc-500">
                            PPTX Output · DOCX Output · Live Preview · ~30-60 seconds
                        </p>
                    </div>

                    {/* Tab Descriptions */}
                    <div>
                        <h3 className="text-sm font-medium text-zinc-400 mb-4">Available Tabs</h3>
                        <div className="space-y-4">
                            <div>
                                <h4 className="text-sm font-medium text-white mb-1">GENERATOR</h4>
                                <p className="text-xs text-zinc-500">
                                    Select your output format (PPTX or DOCX), generate the document, preview the result,
                                    and download the final file for submission.
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
                                    <p className="text-sm text-white">Select output format in GENERATOR tab</p>
                                    <p className="text-xs text-zinc-500">Choose between PowerPoint or Word format</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-3">
                                <span className="text-xs font-medium text-zinc-500 w-4 flex-shrink-0">2.</span>
                                <div>
                                    <p className="text-sm text-white">Generate Document</p>
                                    <p className="text-xs text-zinc-500">Click "Generate Document" to create the proposal</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-3">
                                <span className="text-xs font-medium text-zinc-500 w-4 flex-shrink-0">3.</span>
                                <div>
                                    <p className="text-sm text-white">Preview and download</p>
                                    <p className="text-xs text-zinc-500">Review the preview and download the final document</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-3">
                                <span className="text-xs font-medium text-zinc-500 w-4 flex-shrink-0">4.</span>
                                <div>
                                    <p className="text-sm text-white">Proceed to Validation</p>
                                    <p className="text-xs text-zinc-500">Continue to review and submit the proposal</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Get Started Button */}
                    <div className="flex justify-end">
                        <Button
                            onClick={() => setActiveTab("generator")}
                            variant="outline"
                            className="border-white/10"
                        >
                            Get Started
                            <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                    </div>
                </div>
            )}

            {/* Generator Tab */}
            {activeTab === "generator" && (
            <div className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-3">
                {/* Main Content */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Document Preview */}
                    <div className="glass-card rounded-xl border border-white/10 overflow-hidden">
                        <div className="flex items-center justify-between p-4 border-b border-white/10">
                            <div className="flex items-center gap-3">
                                <Presentation className="h-5 w-5 text-primary" />
                                <h2 className="text-lg font-semibold text-white">Document Preview</h2>
                            </div>
                            {generatedFileId && (
                                <Button variant="outline" size="sm" onClick={handleDownload}>
                                    <Download className="mr-2 h-4 w-4" />
                                    Download PPTX
                                </Button>
                            )}
                        </div>
                        <div className="bg-white min-h-[500px] max-h-[700px] overflow-auto">
                            {previewHtml ? (
                                <iframe
                                    srcDoc={previewHtml}
                                    className="w-full min-h-[500px] border-0"
                                    title="Document Preview"
                                />
                            ) : (
                                <div className="h-[500px] flex items-center justify-center text-gray-400">
                                    <div className="text-center">
                                        <FileOutput className="h-16 w-16 mx-auto mb-4 opacity-30" />
                                        <p className="text-lg font-medium mb-2">No Document Generated</p>
                                        <p className="text-sm">Click "Generate Document" to create your proposal</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Generation Status */}
                    {generationStatus !== 'idle' && (
                        <div className={cn(
                            "glass-card rounded-xl p-4 border",
                            generationStatus === 'generating' && "border-blue-500/30 bg-blue-500/5",
                            generationStatus === 'success' && "border-green-500/30 bg-green-500/5",
                            generationStatus === 'error' && "border-red-500/30 bg-red-500/5"
                        )}>
                            <div className="flex items-center gap-3">
                                {generationStatus === 'generating' && (
                                    <>
                                        <Loader2 className="h-5 w-5 animate-spin text-blue-400" />
                                        <div>
                                            <p className="font-medium text-blue-400">Generating Document...</p>
                                            <p className="text-xs text-muted-foreground">This may take 30-60 seconds</p>
                                        </div>
                                    </>
                                )}
                                {generationStatus === 'success' && (
                                    <>
                                        <CheckCircle2 className="h-5 w-5 text-green-400" />
                                        <div>
                                            <p className="font-medium text-green-400">Document Generated Successfully</p>
                                            <p className="text-xs text-muted-foreground">Ready for download and validation</p>
                                        </div>
                                    </>
                                )}
                                {generationStatus === 'error' && (
                                    <>
                                        <AlertCircle className="h-5 w-5 text-red-400" />
                                        <div>
                                            <p className="font-medium text-red-400">Generation Failed</p>
                                            <p className="text-xs text-muted-foreground">Please try again or contact support</p>
                                        </div>
                                    </>
                                )}
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

                    {/* Output Format Selection */}
                    <div className="glass-card rounded-xl p-6 border border-white/10">
                        <h3 className="text-md font-medium text-white mb-4">Output Format</h3>
                        <div className="space-y-2">
                            <button
                                onClick={() => setOutputFormat('pptx')}
                                className={cn(
                                    "w-full flex items-center gap-3 p-3 rounded-lg border transition-colors",
                                    outputFormat === 'pptx'
                                        ? "border-primary bg-primary/10 text-white"
                                        : "border-white/10 hover:border-white/20 text-muted-foreground"
                                )}
                            >
                                <Presentation className="h-5 w-5" />
                                <div className="text-left">
                                    <div className="font-medium">PowerPoint (PPTX)</div>
                                    <div className="text-xs opacity-70">Presentation format</div>
                                </div>
                            </button>
                            <button
                                onClick={() => setOutputFormat('docx')}
                                disabled
                                className={cn(
                                    "w-full flex items-center gap-3 p-3 rounded-lg border transition-colors opacity-50 cursor-not-allowed",
                                    outputFormat === 'docx'
                                        ? "border-primary bg-primary/10 text-white"
                                        : "border-white/10 text-muted-foreground"
                                )}
                            >
                                <FileType className="h-5 w-5" />
                                <div className="text-left">
                                    <div className="font-medium">Word (DOCX)</div>
                                    <div className="text-xs opacity-70">Coming soon</div>
                                </div>
                            </button>
                        </div>
                    </div>

                    {/* About This Stage */}
                    <div className="glass-card rounded-xl p-6 border border-white/10">
                        <h3 className="text-lg font-semibold text-white mb-4">About This Stage</h3>
                        <div className="space-y-4 text-sm">
                            <p className="text-muted-foreground">
                                The Document Generation agent creates a professional proposal document using the synthesized outline, metadata, and research findings.
                            </p>
                            <div className="p-3 rounded-lg bg-purple-500/10 border border-purple-500/20">
                                <div className="flex items-center gap-2 text-purple-400 mb-1">
                                    <Bot className="h-4 w-4" />
                                    <span className="font-medium">AI-Powered Generation</span>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    Uses Claude AI to generate styled MARP presentations with professional layouts.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Generate Button */}
                    <Button
                        type="button"
                        onClick={handleGenerate}
                        disabled={isGenerating}
                        className="w-full bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20"
                    >
                        {isGenerating ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Generating...
                            </>
                        ) : hasGeneratedDocument ? (
                            <>
                                <Sparkles className="mr-2 h-4 w-4" />
                                Regenerate Document
                            </>
                        ) : (
                            <>
                                <Sparkles className="mr-2 h-4 w-4" />
                                Generate Document
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
                            disabled={!hasGeneratedDocument}
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
