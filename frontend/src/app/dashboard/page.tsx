"use client"

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Plus, Clock, Loader2, TrendingUp, Users, Target, ArrowUpRight } from "lucide-react"
import { fetchApi } from "@/lib/api"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { PageGuide } from "@/components/PageGuide"
import { ScrollAnimation } from "@/components/ScrollAnimation"
import { BorderBeam } from "@/components/BorderBeam"
import { Spotlight } from "@/components/Spotlight"
import { Marquee } from "@/components/Marquee"

interface Pursuit {
    id: string
    entity_name: string
    internal_pursuit_owner_name: string
    status: string
    created_at: string
    progress?: number
}

export default function DashboardPage() {
    const [pursuits, setPursuits] = useState<Pursuit[]>([])
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        async function loadPursuits() {
            try {
                const data = await fetchApi("/pursuits/")
                setPursuits(data)
            } catch (error) {
                console.error("Failed to load pursuits", error)
            } finally {
                setIsLoading(false)
            }
        }
        loadPursuits()
    }, [])

    if (isLoading) {
        return (
            <div className="flex h-[50vh] items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        )
    }

    const stats = [
        { title: "Active Pursuits", value: pursuits.length.toString(), icon: Target, trend: "+12%", color: "text-blue-400" },
        { title: "Win Rate", value: "68%", icon: TrendingUp, trend: "+5%", color: "text-green-400" },
        { title: "Team Members", value: "12", icon: Users, trend: "+2", color: "text-purple-400" },
    ]

    return (
        <div className="space-y-8">
            {/* Header Section */}
            <div className="flex justify-between items-end">
                <div>
                    <div className="flex items-center gap-2">
                        <h2 className="text-3xl font-bold tracking-tight text-white">Dashboard</h2>
                        <PageGuide
                            title="Dashboard Overview"
                            description="The Dashboard provides a high-level view of your pursuit pipeline, key performance metrics, and recent activity."
                            guidelines={[
                                "Monitor active pursuits and their progress status.",
                                "Track win rates and team engagement metrics.",
                                "Quickly access recent pursuits or create new ones.",
                                "Stay updated with the latest team activities and proposal changes."
                            ]}
                        />
                    </div>
                    <p className="text-muted-foreground mt-1">Overview of your pursuit pipeline</p>
                </div>
                <Button asChild className="relative overflow-hidden rounded-full bg-primary hover:bg-primary/90 shadow-[0_0_20px_rgba(124,58,237,0.3)] border-0 group">
                    <Link href="/dashboard/pursuits/new">
                        <span className="relative z-10 flex items-center">
                            <Plus className="mr-2 h-4 w-4" />
                            New Pursuit
                        </span>
                        <BorderBeam
                            size={60}
                            duration={3}
                            delay={0}
                            borderWidth={1.5}
                            colorFrom="#ffffff"
                            colorTo="#a78bfa"
                            className="opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                        />
                    </Link>
                </Button>
            </div>

            {/* Stats Grid */}
            <div className="relative flex h-[200px] w-full flex-col items-center justify-center overflow-hidden rounded-lg bg-background md:shadow-xl">
                <Marquee pauseOnHover className="[--duration:20s]">
                    {stats.map((stat, i) => (
                        <div key={stat.title} className="mx-4 w-[300px]">
                            <Spotlight className="h-full p-6 group">
                                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                    <stat.icon className="h-24 w-24" />
                                </div>
                                <div className="flex justify-between items-start mb-4">
                                    <div className={cn("p-2 rounded-lg bg-white/5", stat.color)}>
                                        <stat.icon className="h-5 w-5" />
                                    </div>
                                    <div className="flex items-center text-xs font-medium text-green-400 bg-green-400/10 px-2 py-1 rounded-full">
                                        {stat.trend} <ArrowUpRight className="h-3 w-3 ml-1" />
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <h3 className="text-2xl font-bold text-white">{stat.value}</h3>
                                    <p className="text-sm text-muted-foreground">{stat.title}</p>
                                </div>
                            </Spotlight>
                        </div>
                    ))}
                </Marquee>
                <div className="pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-background dark:from-background"></div>
                <div className="pointer-events-none absolute inset-y-0 right-0 w-1/3 bg-gradient-to-l from-background dark:from-background"></div>
            </div>

            {/* Main Content Grid */}
            <div className="grid gap-8 lg:grid-cols-3">
                {/* Pursuits List */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold text-white">Recent Pursuits</h3>
                        <Button variant="ghost" size="sm" className="text-primary hover:text-primary/80">View All</Button>
                    </div>

                    <div className="grid gap-4">
                        {pursuits.map((pursuit, index) => (
                            <ScrollAnimation key={pursuit.id} delay={0.2 + index * 0.1} animation="fade-in-left">
                                <Link href={`/dashboard/pursuits/${pursuit.id}`}>
                                    <Spotlight className="p-4 flex items-center justify-between group cursor-pointer transition-all duration-300 hover:shadow-lg hover:shadow-primary/5">
                                        <div className="flex items-center space-x-4">
                                            <div className="h-12 w-12 rounded-full bg-gradient-to-br from-primary/20 to-blue-500/20 flex items-center justify-center text-primary font-bold text-lg">
                                                {pursuit.entity_name.charAt(0)}
                                            </div>
                                            <div>
                                                <h4 className="font-semibold text-white group-hover:text-primary transition-colors">
                                                    {pursuit.entity_name}
                                                </h4>
                                                <div className="flex items-center text-sm text-muted-foreground mt-1 space-x-3">
                                                    <span className="flex items-center">
                                                        <Users className="h-3 w-3 mr-1" />
                                                        {pursuit.internal_pursuit_owner_name}
                                                    </span>
                                                    <span className="flex items-center">
                                                        <Clock className="h-3 w-3 mr-1" />
                                                        {new Date(pursuit.created_at).toISOString().split('T')[0]}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center space-x-6">
                                            <div className="text-right hidden sm:block">
                                                <div className="text-sm font-medium text-white mb-1">Progress</div>
                                                <div className="w-24 h-1.5 bg-white/10 rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full bg-gradient-to-r from-primary to-blue-400"
                                                        style={{ width: `${pursuit.progress || 0}%` }}
                                                    />
                                                </div>
                                            </div>

                                            <div className={cn(
                                                "px-3 py-1 rounded-full text-xs font-medium border",
                                                pursuit.status === 'In Progress' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                                                    pursuit.status === 'Review' ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' :
                                                        'bg-slate-500/10 text-slate-400 border-slate-500/20'
                                            )}>
                                                {pursuit.status || 'Draft'}
                                            </div>
                                        </div>
                                    </Spotlight>
                                </Link>
                            </ScrollAnimation>
                        ))}
                    </div>
                </div>

                {/* Analytics / Activity Feed */}
                <ScrollAnimation delay={0.4} animation="fade-in-right" className="space-y-6">
                    <h3 className="text-lg font-semibold text-white">Activity</h3>
                    <Spotlight className="p-6 h-full min-h-[400px]">
                        <div className="space-y-6">
                            {[1, 2, 3].map((_, i) => (
                                <div key={i} className="flex space-x-3 relative">
                                    {i !== 2 && <div className="absolute left-[15px] top-8 bottom-[-24px] w-0.5 bg-white/10" />}
                                    <div className="h-8 w-8 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center shrink-0 z-10">
                                        <div className="h-2 w-2 rounded-full bg-primary" />
                                    </div>
                                    <div>
                                        <p className="text-sm text-white">
                                            <span className="font-semibold">Sarah</span> updated the proposal for <span className="text-primary">Acme Corp</span>
                                        </p>
                                        <p className="text-xs text-muted-foreground mt-1">2 hours ago</p>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="mt-8 pt-8 border-t border-white/10">
                            <h4 className="text-sm font-medium text-white mb-4">Weekly Activity</h4>
                            {/* Simple CSS Bar Chart */}
                            <div className="flex items-end justify-between h-32 space-x-2">
                                {[40, 70, 45, 90, 60, 80, 50].map((h, i) => (
                                    <div key={i} className="w-full bg-white/5 rounded-t-sm relative group hover:bg-white/10 transition-colors">
                                        <div
                                            className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-primary to-purple-500 rounded-t-sm transition-all duration-500"
                                            style={{ height: `${h}%` }}
                                        />
                                    </div>
                                ))}
                            </div>
                            <div className="flex justify-between mt-2 text-xs text-muted-foreground">
                                <span>M</span><span>T</span><span>W</span><span>T</span><span>F</span><span>S</span><span>S</span>
                            </div>
                        </div>
                    </Spotlight>
                </ScrollAnimation>
            </div>
        </div>
    )
}
