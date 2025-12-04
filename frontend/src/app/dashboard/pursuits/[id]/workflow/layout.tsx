"use client"

import { useEffect, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Loader2, Calendar, User, Mail } from "lucide-react"
import Link from "next/link"
import { fetchApi } from "@/lib/api"
import { WorkflowNavigation } from "@/components/workflow/WorkflowNavigation"
import { WorkflowStage, mapPursuitStageToWorkflow, WORKFLOW_STAGES, getNextStage } from "@/lib/workflow"
import { Save, ArrowRight } from "lucide-react"

interface Pursuit {
    id: string
    entity_name: string
    internal_pursuit_owner_name: string
    internal_pursuit_owner_email?: string
    status: string
    current_stage?: string
    progress_percentage?: number
    created_at?: string
    files?: any[]
}

export default function WorkflowLayout({
    children,
    params,
}: {
    children: React.ReactNode
    params: { id: string }
}) {
    const pathname = usePathname()
    const router = useRouter()
    const [pursuit, setPursuit] = useState<Pursuit | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [isSaving, setIsSaving] = useState(false)
    const [lastSaved, setLastSaved] = useState<Date | null>(null)

    // Determine current stage from URL
    const currentStageFromUrl = pathname?.split("/workflow/")[1]?.split("/")[0] as WorkflowStage || "overview"

    const loadPursuit = async () => {
        try {
            const data = await fetchApi(`/pursuits/${params.id}`)
            setPursuit(data)
        } catch (error) {
            console.error("Failed to load pursuit", error)
        } finally {
            setIsLoading(false)
        }
    }

    useEffect(() => {
        loadPursuit()
    }, [params.id])

    // Listen for pursuit refresh events (e.g., after file upload in child pages)
    useEffect(() => {
        const handlePursuitRefresh = (event: CustomEvent) => {
            if (event.detail?.pursuitId === params.id) {
                loadPursuit()
            }
        }
        window.addEventListener("pursuit-refresh" as any, handlePursuitRefresh)
        return () => window.removeEventListener("pursuit-refresh" as any, handlePursuitRefresh)
    }, [params.id])

    // Refresh pursuit data when window gains focus (only on overview page to avoid interference with extraction)
    useEffect(() => {
        if (currentStageFromUrl !== "overview") return
        const handleFocus = () => {
            if (pursuit) loadPursuit()
        }
        window.addEventListener("focus", handleFocus)
        return () => window.removeEventListener("focus", handleFocus)
    }, [params.id, pursuit, currentStageFromUrl])

    // Refresh when returning to overview page (not on other pages to avoid interference)
    useEffect(() => {
        if (currentStageFromUrl !== "overview") return
        const interval = setInterval(() => {
            if (pursuit) loadPursuit()
        }, 5000) // Refresh every 5 seconds only on overview
        return () => clearInterval(interval)
    }, [params.id, pursuit, currentStageFromUrl])

    // Save handler
    const handleSave = async () => {
        if (!pursuit) return
        setIsSaving(true)
        try {
            await fetchApi(`/pursuits/${pursuit.id}`, {
                method: "PUT",
                body: JSON.stringify({ status: pursuit.status })
            })
            setLastSaved(new Date())
        } catch (error) {
            console.error("Failed to save:", error)
        } finally {
            setIsSaving(false)
        }
    }

    // Continue to next stage
    const handleContinue = () => {
        const nextStage = getNextStage(currentStageFromUrl)
        if (nextStage) {
            router.push(nextStage.path(params.id))
        }
    }

    // Format relative time for last saved
    const formatLastSaved = () => {
        if (!lastSaved) return null
        const now = new Date()
        const diff = Math.floor((now.getTime() - lastSaved.getTime()) / 1000)
        if (diff < 60) return "Saved just now"
        if (diff < 3600) return `Saved ${Math.floor(diff / 60)} min ago`
        return `Saved ${Math.floor(diff / 3600)} hr ago`
    }

    // Get next stage label
    const getNextStageLabel = () => {
        const nextStage = getNextStage(currentStageFromUrl)
        return nextStage ? nextStage.shortName : "Complete"
    }

    // Check if can continue (for overview, need files)
    const canContinue = () => {
        if (currentStageFromUrl === "overview") {
            return pursuit?.files && pursuit.files.length > 0
        }
        return true
    }

    // Determine completed stages based on pursuit progress
    const getCompletedStages = (): WorkflowStage[] => {
        if (!pursuit) return []

        const completed: WorkflowStage[] = []
        const currentPursuitStage = mapPursuitStageToWorkflow(pursuit.current_stage)
        const currentIndex = WORKFLOW_STAGES.findIndex((s) => s.id === currentPursuitStage)

        for (let i = 0; i < currentIndex; i++) {
            completed.push(WORKFLOW_STAGES[i].id)
        }

        return completed
    }

    if (isLoading) {
        return (
            <div className="flex h-[50vh] items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        )
    }

    if (!pursuit) {
        return (
            <div className="flex h-[50vh] items-center justify-center flex-col gap-4">
                <p className="text-muted-foreground">Pursuit not found</p>
                <Button asChild variant="ghost">
                    <Link href="/dashboard">Return to Dashboard</Link>
                </Button>
            </div>
        )
    }

    // Format date helper
    const formatDate = (dateString?: string) => {
        if (!dateString) return null
        return new Date(dateString).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
        })
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-start justify-between">
                <div className="flex items-center space-x-4">
                    <Button
                        asChild
                        variant="ghost"
                        size="icon"
                        className="hover:bg-white/10 text-muted-foreground hover:text-white"
                    >
                        <Link href="/dashboard">
                            <ArrowLeft className="h-5 w-5" />
                        </Link>
                    </Button>
                    <div>
                        <h1 className="text-3xl font-bold tracking-wide text-white uppercase" style={{ fontFamily: "'Inter', 'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif", letterSpacing: '0.05em' }}>
                            {pursuit.entity_name}
                        </h1>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-sm text-muted-foreground">
                            {/* Status Badge */}
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
                                {pursuit.status}
                            </span>

                            {/* Owner */}
                            <span className="inline-flex items-center gap-1">
                                <User className="h-3.5 w-3.5" />
                                {pursuit.internal_pursuit_owner_name}
                            </span>

                            {/* Created Date */}
                            {pursuit.created_at && (
                                <span className="inline-flex items-center gap-1">
                                    <Calendar className="h-3.5 w-3.5" />
                                    {formatDate(pursuit.created_at)}
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                {/* Save and Continue buttons */}
                <div className="flex items-center gap-3">
                    {formatLastSaved() && (
                        <span className="text-xs text-muted-foreground">
                            {formatLastSaved()}
                        </span>
                    )}
                    <Button
                        onClick={handleSave}
                        disabled={isSaving}
                        variant="outline"
                        size="sm"
                        className="border-white/20"
                    >
                        {isSaving ? (
                            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                        ) : (
                            <Save className="mr-1.5 h-4 w-4" />
                        )}
                        Save
                    </Button>
                    <Button
                        onClick={handleContinue}
                        disabled={!canContinue()}
                        size="sm"
                        className="bg-primary hover:bg-primary/90"
                    >
                        {getNextStageLabel()}
                        <ArrowRight className="ml-1.5 h-4 w-4" />
                    </Button>
                </div>
            </div>

            {/* Workflow Navigation */}
            <div className="glass-card rounded-xl p-4 border border-white/10">
                <WorkflowNavigation
                    pursuitId={params.id}
                    currentStage={currentStageFromUrl}
                    completedStages={getCompletedStages()}
                />
            </div>

            {/* Page Content */}
            <div className="min-h-[60vh]">
                {children}
            </div>
        </div>
    )
}
