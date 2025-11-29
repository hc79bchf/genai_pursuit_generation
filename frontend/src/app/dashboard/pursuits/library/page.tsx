"use client"

import { useState, useEffect, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Search, Filter, FileText, ArrowRight, Building2, Globe, Shield, RotateCw, Check, ChevronDown, Briefcase, AlertCircle, X } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { fetchApi } from "@/lib/api"

import { templates, categories } from "@/lib/data"
import { PageGuide } from "@/components/PageGuide"

interface Pursuit {
    id: string
    entity_name: string
    status: string
    selected_template_id?: string
}

function TemplateCard({
    template,
    index,
    selectedPursuitId,
    currentTemplateId,
    onSelectTemplate,
    onShowWarning
}: {
    template: any,
    index: number,
    selectedPursuitId: string | null,
    currentTemplateId: string | null,
    onSelectTemplate: (templateId: string) => Promise<boolean>,
    onShowWarning: () => void
}) {
    const [isFlipped, setIsFlipped] = useState(false)
    const [isSelected, setIsSelected] = useState(false)
    const [isSaving, setIsSaving] = useState(false)

    const isCurrentlySelected = currentTemplateId === template.id

    const handleSelect = async (e: React.MouseEvent) => {
        e.stopPropagation()

        if (!selectedPursuitId) {
            onShowWarning()
            return
        }

        setIsSaving(true)
        const success = await onSelectTemplate(template.id)
        setIsSaving(false)

        if (success) {
            setIsSelected(true)
            // Reset after 2 seconds
            setTimeout(() => setIsSelected(false), 2000)
        }
    }

    return (
        <div className="group relative h-[320px] perspective-1000">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{
                    opacity: 1,
                    y: 0,
                    rotateY: isFlipped ? 180 : 0
                }}
                transition={{
                    duration: 0.5,
                    delay: index * 0.05,
                    rotateY: { duration: 0.6, ease: "easeInOut" }
                }}
                className="relative w-full h-full preserve-3d cursor-pointer"
                onClick={() => setIsFlipped(!isFlipped)}
            >
                {/* Front Face */}
                <div className="absolute inset-0 backface-hidden">
                    <div className={cn(
                        "h-full glass-card rounded-xl p-6 border transition-all duration-300 flex flex-col",
                        isCurrentlySelected
                            ? "border-green-500/50 shadow-[0_0_30px_rgba(34,197,94,0.2)]"
                            : "border-white/10 hover:border-primary/50 hover:shadow-[0_0_30px_rgba(124,58,237,0.15)]"
                    )}>
                        <div className="flex items-start justify-between mb-4">
                            <div className={cn("p-3 rounded-xl bg-opacity-20", template.color.replace('bg-', 'bg-opacity-20 bg-'))}>
                                <template.icon className={cn("h-6 w-6", template.color.replace('bg-', 'text-'))} />
                            </div>
                            <div className="flex items-center gap-2">
                                {isCurrentlySelected && (
                                    <span className="px-2.5 py-1 rounded-full bg-green-500/20 text-xs font-medium text-green-400 border border-green-500/30 flex items-center gap-1">
                                        <Check className="h-3 w-3" />
                                        Selected
                                    </span>
                                )}
                                <span className="px-2.5 py-1 rounded-full bg-white/5 text-xs font-medium text-muted-foreground border border-white/5">
                                    {template.category}
                                </span>
                            </div>
                        </div>

                        <h3 className={cn(
                            "text-lg font-semibold mb-2 transition-colors",
                            isCurrentlySelected ? "text-green-400" : "text-white group-hover:text-primary"
                        )}>
                            {template.title}
                        </h3>
                        <p className="text-sm text-muted-foreground mb-6 flex-1 leading-relaxed">
                            {template.description}
                        </p>

                        <div className="mt-auto flex items-center justify-between text-xs text-muted-foreground">
                            <span>Click to view outline</span>
                            <RotateCw className="h-4 w-4 opacity-50" />
                        </div>
                    </div>
                </div>

                {/* Back Face */}
                <div
                    className={cn(
                        "absolute inset-0 backface-hidden h-full glass-card rounded-xl p-6 border flex flex-col bg-black/80",
                        isCurrentlySelected
                            ? "border-green-500/50 shadow-[0_0_30px_rgba(34,197,94,0.2)]"
                            : "border-white/10"
                    )}
                    style={{ transform: "rotateY(180deg)" }}
                >
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                            <h3 className="text-base font-semibold text-white">Outline Structure</h3>
                            {isCurrentlySelected && (
                                <span className="px-2 py-0.5 rounded-full bg-green-500/20 text-xs font-medium text-green-400 border border-green-500/30">
                                    Current
                                </span>
                            )}
                        </div>
                        <div className={cn("h-2 w-2 rounded-full", template.color)} />
                    </div>

                    <div className="flex-1 overflow-y-auto space-y-2 mb-4 pr-1 custom-scrollbar">
                        {template.details.map((item: string, i: number) => (
                            <div key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                                <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                                <span>{item}</span>
                            </div>
                        ))}
                    </div>

                    <Button
                        className={cn(
                            "w-full transition-all duration-300 shadow-lg",
                            isSelected
                                ? "bg-green-500 hover:bg-green-600 text-white shadow-green-500/20"
                                : isCurrentlySelected
                                    ? "bg-green-500/20 hover:bg-green-500/30 text-green-400 border border-green-500/30 shadow-green-500/10"
                                    : !selectedPursuitId
                                        ? "bg-gray-500 hover:bg-gray-600 text-white shadow-gray-500/20"
                                        : "bg-primary hover:bg-primary/90 text-white shadow-primary/20"
                        )}
                        onClick={handleSelect}
                        disabled={isSaving || isCurrentlySelected}
                    >
                        {isSaving ? (
                            <>
                                Saving...
                                <RotateCw className="ml-2 h-4 w-4 animate-spin" />
                            </>
                        ) : isSelected ? (
                            <>
                                Template Saved
                                <Check className="ml-2 h-4 w-4" />
                            </>
                        ) : isCurrentlySelected ? (
                            <>
                                Currently Selected
                                <Check className="ml-2 h-4 w-4" />
                            </>
                        ) : !selectedPursuitId ? (
                            <>
                                Select a Pursuit First
                            </>
                        ) : (
                            <>
                                Use Template
                                <ArrowRight className="ml-2 h-4 w-4" />
                            </>
                        )}
                    </Button>
                </div>
            </motion.div>
        </div>
    )
}

export default function OutlineLibraryPage() {
    const [searchQuery, setSearchQuery] = useState("")
    const [selectedCategory, setSelectedCategory] = useState("All")
    const [pursuits, setPursuits] = useState<Pursuit[]>([])
    const [selectedPursuitId, setSelectedPursuitId] = useState<string | null>(null)
    const [dropdownOpen, setDropdownOpen] = useState(false)
    const [isLoading, setIsLoading] = useState(true)
    const [showWarning, setShowWarning] = useState(false)
    const dropdownRef = useRef<HTMLDivElement>(null)

    // Auto-hide warning after 4 seconds
    useEffect(() => {
        if (showWarning) {
            const timer = setTimeout(() => setShowWarning(false), 4000)
            return () => clearTimeout(timer)
        }
    }, [showWarning])

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

    // Load pursuits on mount
    useEffect(() => {
        async function loadPursuits() {
            try {
                const data = await fetchApi("/pursuits/")
                // Filter to only active pursuits
                const activePursuits = data.filter((p: Pursuit) =>
                    !['cancelled', 'stale', 'lost', 'won'].includes(p.status)
                )
                setPursuits(activePursuits)
            } catch (error) {
                console.error("Failed to load pursuits", error)
            } finally {
                setIsLoading(false)
            }
        }
        loadPursuits()
    }, [])

    const selectedPursuit = pursuits.find(p => p.id === selectedPursuitId)

    const handleSelectTemplate = async (templateId: string): Promise<boolean> => {
        if (!selectedPursuitId) return false

        try {
            await fetchApi(`/pursuits/${selectedPursuitId}`, {
                method: "PUT",
                body: JSON.stringify({ selected_template_id: templateId })
            })
            // Update local state
            setPursuits(prev => prev.map(p =>
                p.id === selectedPursuitId ? { ...p, selected_template_id: templateId } : p
            ))
            return true
        } catch (error) {
            console.error("Failed to save template selection", error)
            return false
        }
    }

    const filteredTemplates = templates.filter(template => {
        const matchesSearch = template.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            template.description.toLowerCase().includes(searchQuery.toLowerCase())
        const matchesCategory = selectedCategory === "All" || template.category === selectedCategory
        return matchesSearch && matchesCategory
    })

    return (
        <div className="space-y-8 h-[calc(100vh-100px)] flex flex-col">
            {/* Toast Notification */}
            <AnimatePresence>
                {showWarning && (
                    <motion.div
                        initial={{ opacity: 0, y: -20, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -20, scale: 0.95 }}
                        transition={{ duration: 0.2, ease: "easeOut" }}
                        className="fixed top-6 left-1/2 -translate-x-1/2 z-[100]"
                    >
                        <div className="flex items-center gap-3 px-5 py-4 rounded-xl bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/30 shadow-lg shadow-amber-500/10 backdrop-blur-sm">
                            <div className="flex items-center justify-center h-10 w-10 rounded-full bg-amber-500/20">
                                <AlertCircle className="h-5 w-5 text-amber-400" />
                            </div>
                            <div className="flex flex-col">
                                <span className="text-sm font-semibold text-amber-300">Select a Pursuit First</span>
                                <span className="text-xs text-amber-400/80">Choose a pursuit from the dropdown to assign a template</span>
                            </div>
                            <button
                                onClick={() => setShowWarning(false)}
                                className="ml-4 p-1.5 rounded-lg hover:bg-white/10 transition-colors"
                            >
                                <X className="h-4 w-4 text-amber-400/60 hover:text-amber-400" />
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2">
                        <h1 className="text-2xl font-bold tracking-tight text-white">Outline Library</h1>
                        <PageGuide
                            title="Outline Library"
                            description="Browse and select from a collection of pre-built proposal outlines to jumpstart your pursuit response."
                            guidelines={[
                                "First, select a pursuit from the dropdown to assign templates to.",
                                "Use the search bar to find specific templates.",
                                "Filter templates by category using the tabs.",
                                "Click on a card to flip it and view the detailed outline structure.",
                                "Select a template to save it for your chosen pursuit."
                            ]}
                        />
                    </div>
                    <p className="text-muted-foreground mt-1">Browse and select prebuilt RFP outlines to jumpstart your proposal.</p>
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
                                {isLoading ? "Loading..." : selectedPursuit?.entity_name || "Select a pursuit"}
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
                                pursuits.map((pursuit) => {
                                    const currentTemplate = templates.find(t => t.id === pursuit.selected_template_id)
                                    return (
                                        <button
                                            key={pursuit.id}
                                            onClick={() => {
                                                setSelectedPursuitId(pursuit.id)
                                                setDropdownOpen(false)
                                            }}
                                            className={cn(
                                                "w-full px-3 py-3 text-left hover:bg-white/5 flex items-center gap-3 transition-colors",
                                                selectedPursuitId === pursuit.id && "bg-primary/10"
                                            )}
                                        >
                                            <Briefcase className="h-4 w-4 text-muted-foreground shrink-0" />
                                            <div className="flex-1 min-w-0">
                                                <div className="text-sm text-white truncate">{pursuit.entity_name}</div>
                                                <div className="text-xs text-muted-foreground truncate">
                                                    {currentTemplate ? `Template: ${currentTemplate.title}` : "No template selected"}
                                                </div>
                                            </div>
                                            {selectedPursuitId === pursuit.id && (
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

            {/* Search and Filter */}
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                <div className="relative w-full md:w-96">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search templates..."
                        className="pl-10 bg-white/5 border-white/10 text-white placeholder:text-muted-foreground focus:ring-primary"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
                <div className="flex gap-2 overflow-x-auto pb-2 w-full md:w-auto no-scrollbar">
                    {categories.map(category => (
                        <button
                            key={category}
                            onClick={() => setSelectedCategory(category)}
                            className={cn(
                                "px-4 py-2 rounded-full text-sm font-medium transition-all whitespace-nowrap",
                                selectedCategory === category
                                    ? "bg-primary text-white shadow-lg shadow-primary/25"
                                    : "bg-white/5 text-muted-foreground hover:bg-white/10 hover:text-white"
                            )}
                        >
                            {category}
                        </button>
                    ))}
                </div>
            </div>

            {/* Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 overflow-y-auto pb-8 pr-2">
                {filteredTemplates.map((template, index) => (
                    <TemplateCard
                        key={template.id}
                        template={template}
                        index={index}
                        selectedPursuitId={selectedPursuitId}
                        currentTemplateId={selectedPursuit?.selected_template_id || null}
                        onSelectTemplate={handleSelectTemplate}
                        onShowWarning={() => setShowWarning(true)}
                    />
                ))}
            </div>
        </div>
    )
}
