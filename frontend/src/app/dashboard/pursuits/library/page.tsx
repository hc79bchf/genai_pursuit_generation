"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Search, Filter, FileText, ArrowRight, Building2, Globe, Shield, RotateCw, Check } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

import { templates, categories } from "@/lib/data"

function TemplateCard({ template, index }: { template: any, index: number }) {
    const [isFlipped, setIsFlipped] = useState(false)
    const [isSelected, setIsSelected] = useState(false)

    const handleSelect = (e: React.MouseEvent) => {
        e.stopPropagation()
        setIsSelected(true)
        // Store selected template
        localStorage.setItem("selectedTemplateId", template.id)
        // Reset after 2 seconds
        setTimeout(() => setIsSelected(false), 2000)
        console.log("Selected template:", template.id)
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
                    <div className="h-full glass-card rounded-xl p-6 border border-white/10 hover:border-primary/50 transition-all duration-300 hover:shadow-[0_0_30px_rgba(124,58,237,0.15)] flex flex-col">
                        <div className="flex items-start justify-between mb-4">
                            <div className={cn("p-3 rounded-xl bg-opacity-20", template.color.replace('bg-', 'bg-opacity-20 bg-'))}>
                                <template.icon className={cn("h-6 w-6", template.color.replace('bg-', 'text-'))} />
                            </div>
                            <span className="px-2.5 py-1 rounded-full bg-white/5 text-xs font-medium text-muted-foreground border border-white/5">
                                {template.category}
                            </span>
                        </div>

                        <h3 className="text-lg font-semibold text-white mb-2 group-hover:text-primary transition-colors">
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
                    className="absolute inset-0 backface-hidden h-full glass-card rounded-xl p-6 border border-white/10 flex flex-col bg-black/80"
                    style={{ transform: "rotateY(180deg)" }}
                >
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-base font-semibold text-white">Outline Structure</h3>
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
                                : "bg-primary hover:bg-primary/90 text-white shadow-primary/20"
                        )}
                        onClick={handleSelect}
                    >
                        {isSelected ? (
                            <>
                                Template Selected
                                <Check className="ml-2 h-4 w-4" />
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

    const filteredTemplates = templates.filter(template => {
        const matchesSearch = template.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            template.description.toLowerCase().includes(searchQuery.toLowerCase())
        const matchesCategory = selectedCategory === "All" || template.category === selectedCategory
        return matchesSearch && matchesCategory
    })

    return (
        <div className="space-y-8 h-[calc(100vh-100px)] flex flex-col">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold tracking-tight text-white">Outline Library</h1>
                <p className="text-muted-foreground mt-1">Browse and select prebuilt RFP outlines to jumpstart your proposal.</p>
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
                    <TemplateCard key={template.id} template={template} index={index} />
                ))}
            </div>
        </div>
    )
}
