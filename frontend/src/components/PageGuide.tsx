"use client"

import { useState } from "react"
import { HelpCircle, X } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface PageGuideProps {
    title: string
    description: string
    guidelines: string[]
}

export function PageGuide({ title, description, guidelines }: PageGuideProps) {
    const [isOpen, setIsOpen] = useState(false)

    return (
        <div className="relative">
            <Button
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:text-primary"
                onClick={() => setIsOpen(!isOpen)}
            >
                <HelpCircle className="h-5 w-5" />
                <span className="sr-only">Page Guide</span>
            </Button>

            <AnimatePresence>
                {isOpen && (
                    <>
                        {/* Backdrop */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 bg-black/50 z-40"
                            onClick={() => setIsOpen(false)}
                        />

                        {/* Guide Card */}
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 10 }}
                            className="absolute left-0 top-12 z-50 w-80 md:w-96"
                        >
                            <Card className="bg-slate-900 border-slate-800 shadow-xl">
                                <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                                    <CardTitle className="text-lg font-bold text-white">
                                        {title}
                                    </CardTitle>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6 text-slate-400 hover:text-white -mt-1 -mr-2"
                                        onClick={() => setIsOpen(false)}
                                    >
                                        <X className="h-4 w-4" />
                                    </Button>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <p className="text-sm text-slate-300 leading-relaxed">
                                        {description}
                                    </p>

                                    <div className="space-y-2">
                                        <h4 className="text-xs font-semibold text-primary uppercase tracking-wider">
                                            Operation Guidelines
                                        </h4>
                                        <ul className="space-y-2">
                                            {guidelines.map((guide, index) => (
                                                <li key={index} className="text-sm text-slate-400 flex gap-2">
                                                    <span className="text-primary/50">•</span>
                                                    {guide}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                </CardContent>
                            </Card>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    )
}
