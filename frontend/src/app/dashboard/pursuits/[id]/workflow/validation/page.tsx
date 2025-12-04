"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { api, fetchApi } from "@/lib/api"
import {
    Loader2,
    ArrowLeft,
    ArrowRight,
    Bot,
    CheckCircle,
    AlertTriangle,
    XCircle,
    FileCheck,
    Download,
    Send,
    RefreshCw,
    Check,
    CircleDot,
    Clock,
    FileText,
    Shield
} from "lucide-react"
import { cn } from "@/lib/utils"
import { getPreviousStage } from "@/lib/workflow"

type ValidationTab = "overview" | "validation"

interface TabConfig {
    id: ValidationTab
    label: string
    description: string
}

const TABS: TabConfig[] = [
    { id: "overview", label: "OVERVIEW", description: "Learn about the Validation stage and final submission process." },
    { id: "validation", label: "VALIDATION", description: "Review validation checks, set status, and submit your proposal." },
]

interface ValidationCheck {
    name: string
    status: "passed" | "warning" | "failed" | "pending"
    message: string
    details?: string[]
}

interface Pursuit {
    id: string
    entity_name: string
    status: string
    files?: any[]
    validation_result?: {
        overall_status: "passed" | "warning" | "failed"
        checks: ValidationCheck[]
        validated_at: string
    }
}

const PURSUIT_STATUSES = [
    { value: 'draft', label: 'Draft', color: 'bg-gray-500' },
    { value: 'in_review', label: 'In Review', color: 'bg-yellow-500' },
    { value: 'ready_for_submission', label: 'Ready for Submission', color: 'bg-blue-500' },
    { value: 'submitted', label: 'Submitted', color: 'bg-purple-500' },
    { value: 'won', label: 'Won', color: 'bg-green-500' },
    { value: 'lost', label: 'Lost', color: 'bg-red-500' },
    { value: 'cancelled', label: 'Cancelled', color: 'bg-gray-400' },
    { value: 'stale', label: 'Stale', color: 'bg-orange-500' },
] as const

type PursuitStatus = typeof PURSUIT_STATUSES[number]['value']

export default function ValidationPage({ params }: { params: { id: string } }) {
    const router = useRouter()
    const [pursuit, setPursuit] = useState<Pursuit | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [isValidating, setIsValidating] = useState(false)
    const [statusDropdownOpen, setStatusDropdownOpen] = useState(false)
    const [updatingStatus, setUpdatingStatus] = useState(false)
    const [generatedFileId, setGeneratedFileId] = useState<string | null>(null)
    const [activeTab, setActiveTab] = useState<ValidationTab>("overview")

    useEffect(() => {
        async function loadPursuit() {
            try {
                const data = await fetchApi(`/pursuits/${params.id}`)
                setPursuit(data)

                // Find PPTX file for download
                if (data.files && data.files.length > 0) {
                    const pptxFiles = data.files.filter((f: any) => f.file_type === 'output_pptx')
                    if (pptxFiles.length > 0) {
                        pptxFiles.sort((a: any, b: any) => new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime())
                        setGeneratedFileId(pptxFiles[0].id)
                    }
                }
            } catch (error) {
                console.error("Failed to load pursuit", error)
            } finally {
                setIsLoading(false)
            }
        }
        loadPursuit()
    }, [params.id])

    const handleRunValidation = async () => {
        if (!pursuit) return

        setIsValidating(true)
        try {
            const result = await fetchApi(`/pursuits/${pursuit.id}/validate`, {
                method: "POST"
            })
            setPursuit({ ...pursuit, validation_result: result })
        } catch (error) {
            console.error("Validation failed:", error)
            alert("Failed to run validation")
        } finally {
            setIsValidating(false)
        }
    }

    const handleStatusChange = async (newStatus: PursuitStatus) => {
        if (!pursuit) return

        setUpdatingStatus(true)
        setStatusDropdownOpen(false)

        try {
            const updatedPursuit = await api.updatePursuit(pursuit.id, { status: newStatus })
            setPursuit(updatedPursuit)
        } catch (error) {
            console.error("Failed to update status:", error)
            alert("Failed to update status")
        } finally {
            setUpdatingStatus(false)
        }
    }

    const handleDownload = async () => {
        if (!generatedFileId) return

        try {
            const blob = await api.downloadFile(params.id, generatedFileId)
            const url = window.URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `presentation_${params.id}.pptx`
            document.body.appendChild(a)
            a.click()
            window.URL.revokeObjectURL(url)
            document.body.removeChild(a)
        } catch (error) {
            console.error("Failed to download file", error)
            alert("Failed to download file")
        }
    }

    const handleBack = () => {
        const prevStage = getPreviousStage("validation")
        if (prevStage) {
            router.push(prevStage.path(params.id))
        }
    }

    const getCurrentStatusInfo = () => {
        const currentStatus = pursuit?.status || 'draft'
        return PURSUIT_STATUSES.find(s => s.value === currentStatus) || PURSUIT_STATUSES[0]
    }

    const getStatusIcon = (status: ValidationCheck["status"]) => {
        switch (status) {
            case "passed":
                return <CheckCircle className="h-5 w-5 text-green-400" />
            case "warning":
                return <AlertTriangle className="h-5 w-5 text-yellow-400" />
            case "failed":
                return <XCircle className="h-5 w-5 text-red-400" />
            default:
                return <CircleDot className="h-5 w-5 text-muted-foreground" />
        }
    }

    const getStatusColor = (status: ValidationCheck["status"]) => {
        switch (status) {
            case "passed":
                return "border-green-500/20 bg-green-500/10"
            case "warning":
                return "border-yellow-500/20 bg-yellow-500/10"
            case "failed":
                return "border-red-500/20 bg-red-500/10"
            default:
                return "border-white/10 bg-white/5"
        }
    }

    if (isLoading || !pursuit) {
        return (
            <div className="flex h-[50vh] items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        )
    }

    const hasValidation = !!pursuit.validation_result
    const overallStatus = pursuit.validation_result?.overall_status
    const currentTab = TABS.find(t => t.id === activeTab)

    return (
        <div className="max-w-5xl">
            {/* Page Description */}
            <p className="text-sm text-zinc-500 mb-6">
                Run final validation checks, set proposal status, and prepare for submission.
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
                        {tab.id === "validation" && hasValidation && overallStatus === "passed" && (
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
                    {/* Stage Overview */}
                    <div>
                        <h3 className="text-lg font-semibold text-white mb-3">Validation & Submission</h3>
                        <p className="text-sm text-zinc-400 leading-relaxed mb-4">
                            The final stage of the workflow. Run quality checks to validate your proposal meets all
                            requirements, update the pursuit status, and download the final document for submission
                            to the client.
                        </p>
                        <p className="text-xs text-zinc-500">
                            Quality Checks · Status Management · Final Download · ~5-10 seconds
                        </p>
                    </div>

                    {/* Tab Descriptions */}
                    <div>
                        <h3 className="text-sm font-medium text-zinc-400 mb-4">Available Tabs</h3>
                        <div className="space-y-4">
                            <div>
                                <h4 className="text-sm font-medium text-white mb-1">VALIDATION</h4>
                                <p className="text-xs text-zinc-500">
                                    Run validation checks against the proposal, review results for any issues, update the
                                    pursuit status (Draft, In Review, Ready, Submitted, Won/Lost), and download the final document.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Workflow */}
                    <div>
                        <h3 className="text-sm font-medium text-zinc-400 mb-4">Final Steps</h3>
                        <div className="space-y-3">
                            <div className="flex items-start gap-3">
                                <span className="text-xs font-medium text-zinc-500 w-4 flex-shrink-0">1.</span>
                                <div>
                                    <p className="text-sm text-white">Run Validation in VALIDATION tab</p>
                                    <p className="text-xs text-zinc-500">Click "Run Validation" to check for issues</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-3">
                                <span className="text-xs font-medium text-zinc-500 w-4 flex-shrink-0">2.</span>
                                <div>
                                    <p className="text-sm text-white">Review validation results</p>
                                    <p className="text-xs text-zinc-500">Address any warnings or failed checks</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-3">
                                <span className="text-xs font-medium text-zinc-500 w-4 flex-shrink-0">3.</span>
                                <div>
                                    <p className="text-sm text-white">Update pursuit status</p>
                                    <p className="text-xs text-zinc-500">Set status to Ready for Submission when approved</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-3">
                                <span className="text-xs font-medium text-zinc-500 w-4 flex-shrink-0">4.</span>
                                <div>
                                    <p className="text-sm text-white">Download and submit</p>
                                    <p className="text-xs text-zinc-500">Download the final document for client submission</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Get Started Button */}
                    <div className="flex justify-end">
                        <Button
                            onClick={() => setActiveTab("validation")}
                            variant="outline"
                            className="border-white/10"
                        >
                            Get Started
                            <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                    </div>
                </div>
            )}

            {/* Validation Tab */}
            {activeTab === "validation" && (
            <div className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-3">
                {/* Main Content */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Validation Results */}
                    {!hasValidation ? (
                        <div className="glass-card rounded-xl p-8 border border-white/10 text-center">
                            <div className="max-w-md mx-auto">
                                <div className="p-4 bg-primary/10 rounded-full w-fit mx-auto mb-4">
                                    <FileCheck className="h-8 w-8 text-primary" />
                                </div>
                                <h2 className="text-xl font-semibold text-white mb-2">
                                    Validate Your Proposal
                                </h2>
                                <p className="text-muted-foreground mb-6">
                                    Run final quality checks to ensure your proposal meets all requirements and best practices.
                                </p>
                                <Button
                                    onClick={handleRunValidation}
                                    disabled={isValidating}
                                    className="bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20"
                                >
                                    {isValidating ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Validating...
                                        </>
                                    ) : (
                                        <>
                                            <FileCheck className="mr-2 h-4 w-4" />
                                            Run Validation
                                        </>
                                    )}
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {/* Overall Status */}
                            <div className={cn(
                                "glass-card rounded-xl p-6 border",
                                overallStatus === "passed" && "border-green-500/30 bg-green-500/5",
                                overallStatus === "warning" && "border-yellow-500/30 bg-yellow-500/5",
                                overallStatus === "failed" && "border-red-500/30 bg-red-500/5"
                            )}>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        {overallStatus === "passed" && (
                                            <div className="p-3 bg-green-500/20 rounded-full">
                                                <CheckCircle className="h-8 w-8 text-green-400" />
                                            </div>
                                        )}
                                        {overallStatus === "warning" && (
                                            <div className="p-3 bg-yellow-500/20 rounded-full">
                                                <AlertTriangle className="h-8 w-8 text-yellow-400" />
                                            </div>
                                        )}
                                        {overallStatus === "failed" && (
                                            <div className="p-3 bg-red-500/20 rounded-full">
                                                <XCircle className="h-8 w-8 text-red-400" />
                                            </div>
                                        )}
                                        <div>
                                            <h2 className="text-lg font-semibold text-white">
                                                {overallStatus === "passed" && "Validation Passed"}
                                                {overallStatus === "warning" && "Validation Passed with Warnings"}
                                                {overallStatus === "failed" && "Validation Failed"}
                                            </h2>
                                            <p className="text-sm text-muted-foreground">
                                                {pursuit.validation_result?.validated_at && (
                                                    <>Validated {new Date(pursuit.validation_result.validated_at).toLocaleString()}</>
                                                )}
                                            </p>
                                        </div>
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={handleRunValidation}
                                        disabled={isValidating}
                                        className="text-muted-foreground hover:text-white"
                                    >
                                        <RefreshCw className={cn("h-4 w-4 mr-2", isValidating && "animate-spin")} />
                                        Revalidate
                                    </Button>
                                </div>
                            </div>

                            {/* Validation Checks */}
                            <div className="space-y-4">
                                <h3 className="text-md font-medium text-white">Validation Checks</h3>
                                {pursuit.validation_result?.checks.map((check, index) => (
                                    <div
                                        key={index}
                                        className={cn(
                                            "p-4 rounded-lg border transition-colors",
                                            getStatusColor(check.status)
                                        )}
                                    >
                                        <div className="flex items-start gap-3">
                                            {getStatusIcon(check.status)}
                                            <div className="flex-1">
                                                <div className="font-medium text-white">{check.name}</div>
                                                <div className="text-sm text-muted-foreground mt-1">
                                                    {check.message}
                                                </div>
                                                {check.details && check.details.length > 0 && (
                                                    <ul className="mt-2 space-y-1">
                                                        {check.details.map((detail, i) => (
                                                            <li key={i} className="text-xs text-muted-foreground flex items-start gap-2">
                                                                <span className="text-muted-foreground">•</span>
                                                                {detail}
                                                            </li>
                                                        ))}
                                                    </ul>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Sidebar */}
                <div className="space-y-6">
                    {/* Status Dropdown */}
                    <div className="glass-card rounded-xl p-6 border border-white/10">
                        <h3 className="text-md font-medium text-white mb-4">Pursuit Status</h3>
                        <div className="relative">
                            <Button
                                variant="outline"
                                className="w-full justify-between"
                                onClick={() => setStatusDropdownOpen(!statusDropdownOpen)}
                                disabled={updatingStatus}
                            >
                                <span className="flex items-center gap-2">
                                    {updatingStatus ? (
                                        <Loader2 className="h-3 w-3 animate-spin" />
                                    ) : (
                                        <span className={cn("h-2 w-2 rounded-full", getCurrentStatusInfo().color)} />
                                    )}
                                    {getCurrentStatusInfo().label}
                                </span>
                                <CircleDot className="h-4 w-4" />
                            </Button>
                            {statusDropdownOpen && (
                                <>
                                    <div
                                        className="fixed inset-0 z-40"
                                        onClick={() => setStatusDropdownOpen(false)}
                                    />
                                    <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-card border border-white/10 rounded-lg shadow-lg overflow-hidden">
                                        {PURSUIT_STATUSES.map((status) => (
                                            <button
                                                key={status.value}
                                                className={cn(
                                                    "w-full px-4 py-2 text-left text-sm hover:bg-white/10 flex items-center gap-2",
                                                    pursuit?.status === status.value && "bg-white/5"
                                                )}
                                                onClick={() => handleStatusChange(status.value)}
                                            >
                                                <span className={cn("h-2 w-2 rounded-full", status.color)} />
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
                    </div>

                    {/* About This Stage */}
                    <div className="glass-card rounded-xl p-6 border border-white/10">
                        <h3 className="text-lg font-semibold text-white mb-4">About This Stage</h3>
                        <div className="space-y-4 text-sm">
                            <p className="text-muted-foreground">
                                The Validation agent performs final quality checks on your generated proposal, ensuring completeness and accuracy.
                            </p>
                            <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                                <div className="flex items-center gap-2 text-blue-400 mb-1">
                                    <Bot className="h-4 w-4" />
                                    <span className="font-medium">Final Review</span>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    Checks for completeness, formatting, and compliance with requirements.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Action Buttons */}
                    {generatedFileId && (
                        <Button
                            onClick={handleDownload}
                            variant="outline"
                            className="w-full"
                        >
                            <Download className="mr-2 h-4 w-4" />
                            Download Final Document
                        </Button>
                    )}

                    {hasValidation && overallStatus !== "failed" && (
                        <Button
                            onClick={() => handleStatusChange("ready_for_submission")}
                            disabled={updatingStatus}
                            className="w-full bg-green-600 hover:bg-green-500"
                        >
                            <Send className="mr-2 h-4 w-4" />
                            Mark Ready for Submission
                        </Button>
                    )}

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
                            onClick={() => router.push("/dashboard")}
                            className="flex-1 bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20"
                        >
                            Finish
                            <CheckCircle className="ml-2 h-4 w-4" />
                        </Button>
                    </div>
                </div>
            </div>
            </div>
            )}
        </div>
    )
}
