"use client"

import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
    Upload,
    Search,
    FileText,
    Sparkles,
    ArrowRight,
    CheckCircle2,
    Zap,
    Target,
    TrendingUp
} from "lucide-react"
import Link from "next/link"
import { BorderBeam } from "@/components/BorderBeam"

const features = [
    {
        icon: Upload,
        title: "Upload RFP",
        description: "Upload your RFP documents and let AI extract key metadata automatically",
        color: "from-blue-500 to-cyan-500",
        href: "/dashboard/pursuits/new"
    },
    {
        icon: Target,
        title: "Gap Analysis",
        description: "Compare RFP requirements against proposal templates to identify coverage gaps",
        color: "from-purple-500 to-pink-500",
        href: "/dashboard/gap-assessment"
    },
    {
        icon: Search,
        title: "Deep Research",
        description: "AI-powered web research to find information and fill knowledge gaps",
        color: "from-orange-500 to-red-500",
        href: "/dashboard/deep-search"
    },
    {
        icon: FileText,
        title: "Outline Library",
        description: "Browse and select from pre-built proposal outline templates",
        color: "from-green-500 to-emerald-500",
        href: "/dashboard/pursuits/library"
    }
]

const benefits = [
    "5-minute AI-powered proposal generation",
    "Automated metadata extraction from RFPs",
    "Intelligent gap analysis and research",
    "Professional document generation (PPTX/DOCX)",
    "Historical pursuit data integration",
    "Real-time progress tracking"
]

export default function WelcomePage() {
    return (
        <div className="space-y-12 max-w-6xl mx-auto pb-10">
            {/* Hero Section */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="text-center space-y-6 pt-8"
            >
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20">
                    <Sparkles className="h-4 w-4 text-primary" />
                    <span className="text-sm text-primary font-medium">AI-Powered RFP Response Platform</span>
                </div>

                <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-white">
                    Welcome to <span className="bg-gradient-to-r from-primary to-purple-400 bg-clip-text text-transparent">Pursuit AI</span>
                </h1>

                <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                    Generate comprehensive proposal responses in under 5 minutes using our 5-agent AI system
                </p>

                <div className="flex items-center justify-center gap-4 pt-4">
                    <Button asChild size="lg" className="relative overflow-hidden rounded-full bg-primary hover:bg-primary/90 text-white shadow-[0_0_20px_rgba(124,58,237,0.3)] border-0 group">
                        <Link href="/dashboard/pursuits/new">
                            <span className="relative z-10 flex items-center">
                                Get Started
                                <ArrowRight className="ml-2 h-5 w-5" />
                            </span>
                            <BorderBeam
                                size={70}
                                duration={3}
                                delay={0}
                                borderWidth={1.5}
                                colorFrom="#ffffff"
                                colorTo="#a78bfa"
                                className="opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                            />
                        </Link>
                    </Button>
                    <Button asChild size="lg" variant="outline" className="border-white/10 hover:bg-white/5">
                        <Link href="/dashboard/pursuits">
                            View Pursuits
                        </Link>
                    </Button>
                </div>
            </motion.div>

            {/* Features Grid */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.2 }}
            >
                <h2 className="text-2xl font-bold text-white mb-6 text-center">Core Features</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {features.map((feature, index) => (
                        <motion.div
                            key={feature.title}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.5, delay: 0.1 * index }}
                        >
                            <Link href={feature.href}>
                                <Card className="glass-card border-white/10 hover:border-primary/30 transition-all duration-300 group cursor-pointer h-full">
                                    <CardContent className="p-6">
                                        <div className="flex items-start gap-4">
                                            <div className={`p-3 rounded-xl bg-gradient-to-br ${feature.color} bg-opacity-10`}>
                                                <feature.icon className="h-6 w-6 text-white" />
                                            </div>
                                            <div className="flex-1">
                                                <h3 className="text-lg font-semibold text-white mb-2 flex items-center justify-between">
                                                    {feature.title}
                                                    <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                                                </h3>
                                                <p className="text-sm text-muted-foreground">
                                                    {feature.description}
                                                </p>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            </Link>
                        </motion.div>
                    ))}
                </div>
            </motion.div>

            {/* Benefits Section */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.4 }}
                className="grid grid-cols-1 md:grid-cols-2 gap-8"
            >
                <div className="space-y-6">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-primary/20">
                            <Zap className="h-6 w-6 text-primary" />
                        </div>
                        <h2 className="text-2xl font-bold text-white">Why Choose Pursuit AI?</h2>
                    </div>
                    <div className="space-y-3">
                        {benefits.map((benefit, index) => (
                            <motion.div
                                key={benefit}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ duration: 0.3, delay: 0.5 + (0.1 * index) }}
                                className="flex items-start gap-3 p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                            >
                                <CheckCircle2 className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                                <span className="text-sm text-muted-foreground">{benefit}</span>
                            </motion.div>
                        ))}
                    </div>
                </div>

                <div className="space-y-6">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-purple-500/20">
                            <TrendingUp className="h-6 w-6 text-purple-400" />
                        </div>
                        <h2 className="text-2xl font-bold text-white">How It Works</h2>
                    </div>
                    <div className="space-y-4">
                        <div className="flex gap-4 p-4 rounded-xl bg-gradient-to-r from-primary/10 to-purple-500/10 border border-white/10">
                            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/20 text-primary font-bold shrink-0">1</div>
                            <div>
                                <h4 className="font-semibold text-white mb-1">Upload & Extract</h4>
                                <p className="text-sm text-muted-foreground">Upload RFP documents and extract metadata using AI</p>
                            </div>
                        </div>
                        <div className="flex gap-4 p-4 rounded-xl bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-white/10">
                            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-purple-500/20 text-purple-400 font-bold shrink-0">2</div>
                            <div>
                                <h4 className="font-semibold text-white mb-1">Analyze Gaps</h4>
                                <p className="text-sm text-muted-foreground">Compare requirements against templates to find gaps</p>
                            </div>
                        </div>
                        <div className="flex gap-4 p-4 rounded-xl bg-gradient-to-r from-orange-500/10 to-red-500/10 border border-white/10">
                            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-orange-500/20 text-orange-400 font-bold shrink-0">3</div>
                            <div>
                                <h4 className="font-semibold text-white mb-1">Research & Fill</h4>
                                <p className="text-sm text-muted-foreground">AI conducts web research to fill knowledge gaps</p>
                            </div>
                        </div>
                        <div className="flex gap-4 p-4 rounded-xl bg-gradient-to-r from-green-500/10 to-emerald-500/10 border border-white/10">
                            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-green-500/20 text-green-400 font-bold shrink-0">4</div>
                            <div>
                                <h4 className="font-semibold text-white mb-1">Generate Proposal</h4>
                                <p className="text-sm text-muted-foreground">Create professional PPTX/DOCX documents automatically</p>
                            </div>
                        </div>
                    </div>
                </div>
            </motion.div>

            {/* CTA Section */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.6 }}
                className="text-center p-8 rounded-2xl bg-gradient-to-r from-primary/20 to-purple-600/20 border border-white/10"
            >
                <h2 className="text-2xl font-bold text-white mb-3">Ready to Transform Your RFP Process?</h2>
                <p className="text-muted-foreground mb-6 max-w-2xl mx-auto">
                    Start creating winning proposals in minutes with our AI-powered platform
                </p>
                <Button asChild size="lg" className="relative overflow-hidden rounded-full bg-primary hover:bg-primary/90 text-white shadow-[0_0_20px_rgba(124,58,237,0.3)] border-0 group">
                    <Link href="/dashboard/pursuits/new">
                        <span className="relative z-10 flex items-center">
                            <Upload className="mr-2 h-5 w-5" />
                            Create Your First Pursuit
                        </span>
                        <BorderBeam
                            size={90}
                            duration={3}
                            delay={0}
                            borderWidth={1.5}
                            colorFrom="#ffffff"
                            colorTo="#a78bfa"
                            className="opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                        />
                    </Link>
                </Button>
            </motion.div>
        </div>
    )
}
