"use client"

import { cn } from "@/lib/utils"
import { WORKFLOW_STAGES, WorkflowStage, getStageIndex } from "@/lib/workflow"
import { Check } from "lucide-react"
import Link from "next/link"

interface WorkflowNavigationProps {
    pursuitId: string
    currentStage: WorkflowStage
    completedStages?: WorkflowStage[]
    className?: string
}

export function WorkflowNavigation({
    pursuitId,
    currentStage,
    completedStages = [],
    className,
}: WorkflowNavigationProps) {
    const currentIndex = getStageIndex(currentStage)

    return (
        <div className={cn("w-full", className)}>
            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center justify-between">
                {WORKFLOW_STAGES.map((stage, index) => {
                    const isCompleted = completedStages.includes(stage.id) || index < currentIndex
                    const isCurrent = stage.id === currentStage
                    const isUpcoming = index > currentIndex && !completedStages.includes(stage.id)

                    return (
                        <div key={stage.id} className="flex items-center flex-1 relative">
                            <Link
                                href={stage.path(pursuitId)}
                                className={cn(
                                    "flex items-center gap-3 group",
                                    isUpcoming && "opacity-50 pointer-events-none"
                                )}
                            >
                                {/* Step indicator */}
                                <div
                                    className={cn(
                                        "flex items-center justify-center w-10 h-10 rounded-full border-2 transition-all duration-200",
                                        isCompleted && "bg-green-500 border-green-500",
                                        isCurrent && "bg-primary border-primary shadow-[0_0_15px_rgba(124,58,237,0.5)]",
                                        isUpcoming && "bg-transparent border-white/20"
                                    )}
                                >
                                    {isCompleted ? (
                                        <Check className="h-5 w-5 text-white" />
                                    ) : (
                                        <span
                                            className={cn(
                                                "text-sm font-semibold",
                                                isCurrent ? "text-white" : "text-muted-foreground"
                                            )}
                                        >
                                            {index + 1}
                                        </span>
                                    )}
                                </div>

                                {/* Stage info */}
                                <div className="hidden lg:block">
                                    <div
                                        className={cn(
                                            "text-sm font-medium transition-colors",
                                            isCurrent && "text-white",
                                            isCompleted && "text-green-400",
                                            isUpcoming && "text-muted-foreground"
                                        )}
                                    >
                                        {stage.shortName}
                                    </div>
                                </div>
                            </Link>

                            {/* Connector line */}
                            {index < WORKFLOW_STAGES.length - 1 && (
                                <div className="flex-1 mx-2 lg:mx-4">
                                    <div
                                        className={cn(
                                            "h-0.5 transition-all duration-300",
                                            index < currentIndex
                                                ? "bg-green-500"
                                                : "bg-white/10"
                                        )}
                                    />
                                </div>
                            )}
                        </div>
                    )
                })}
            </nav>

            {/* Mobile Navigation */}
            <nav className="md:hidden">
                <div className="flex items-center justify-between mb-4">
                    <div className="text-sm text-muted-foreground">
                        Step {currentIndex + 1} of {WORKFLOW_STAGES.length}
                    </div>
                    <div className="text-sm font-medium text-white">
                        {WORKFLOW_STAGES[currentIndex]?.name}
                    </div>
                </div>

                {/* Progress bar */}
                <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-gradient-to-r from-primary to-purple-500 transition-all duration-300"
                        style={{ width: `${((currentIndex + 1) / WORKFLOW_STAGES.length) * 100}%` }}
                    />
                </div>

                {/* Stage dots */}
                <div className="flex justify-between mt-2">
                    {WORKFLOW_STAGES.map((stage, index) => {
                        const isCompleted = completedStages.includes(stage.id) || index < currentIndex
                        const isCurrent = stage.id === currentStage

                        return (
                            <Link
                                key={stage.id}
                                href={stage.path(pursuitId)}
                                className={cn(
                                    "w-3 h-3 rounded-full transition-all",
                                    isCompleted && "bg-green-500",
                                    isCurrent && "bg-primary ring-2 ring-primary/50",
                                    !isCompleted && !isCurrent && "bg-white/20"
                                )}
                            />
                        )
                    })}
                </div>
            </nav>
        </div>
    )
}
