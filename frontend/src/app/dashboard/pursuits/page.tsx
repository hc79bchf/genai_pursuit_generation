"use client"

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Plus, Loader2, Search, Filter, FileText, Clock, Users } from "lucide-react"
import { Input } from "@/components/ui/input"
import { fetchApi } from "@/lib/api"
import Link from "next/link"
import { cn } from "@/lib/utils"

interface Pursuit {
    id: string
    entity_name: string
    internal_pursuit_owner_name: string
    status: string
    created_at: string
    progress?: number
}

export default function PursuitsPage() {
    const [pursuits, setPursuits] = useState<Pursuit[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState("")

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

    const filteredPursuits = pursuits.filter(p =>
        p.entity_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.internal_pursuit_owner_name.toLowerCase().includes(searchQuery.toLowerCase())
    )

    if (isLoading) {
        return (
            <div className="flex h-[50vh] items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        )
    }

    return (
        <div className="space-y-8">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight text-white">Pursuits</h2>
                    <p className="text-muted-foreground mt-1">Manage and track all your active pursuits</p>
                </div>
                <Button asChild className="bg-primary hover:bg-primary/90 shadow-[0_0_20px_rgba(124,58,237,0.3)] border border-white/10">
                    <Link href="/dashboard/pursuits/new">
                        <Plus className="mr-2 h-4 w-4" />
                        New Pursuit
                    </Link>
                </Button>
            </div>

            {/* Filters */}
            <div className="flex items-center space-x-4 bg-white/5 p-4 rounded-xl border border-white/10">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search pursuits..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10 bg-black/20 border-white/10 text-white placeholder:text-muted-foreground focus:ring-primary"
                    />
                </div>
                <Button variant="outline" className="border-white/10 text-muted-foreground hover:text-white hover:bg-white/5">
                    <Filter className="mr-2 h-4 w-4" />
                    Filter
                </Button>
            </div>

            {/* List */}
            <div className="grid gap-4">
                {filteredPursuits.map((pursuit, index) => (
                    <motion.div
                        key={pursuit.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                    >
                        <Link href={`/dashboard/pursuits/${pursuit.id}`}>
                            <div className="glass-card rounded-xl p-6 flex items-center justify-between group cursor-pointer border border-white/5 hover:border-primary/50 transition-all">
                                <div className="flex items-center space-x-6">
                                    <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-primary/20 to-blue-500/20 flex items-center justify-center text-primary font-bold text-lg group-hover:scale-110 transition-transform">
                                        <FileText className="h-6 w-6" />
                                    </div>
                                    <div>
                                        <h4 className="text-lg font-semibold text-white group-hover:text-primary transition-colors">
                                            {pursuit.entity_name}
                                        </h4>
                                        <div className="flex items-center text-sm text-muted-foreground mt-1 space-x-4">
                                            <span className="flex items-center">
                                                <Users className="h-3 w-3 mr-1" />
                                                {pursuit.internal_pursuit_owner_name}
                                            </span>
                                            <span className="flex items-center">
                                                <Clock className="h-3 w-3 mr-1" />
                                                {new Date(pursuit.created_at).toLocaleDateString()}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center space-x-8">
                                    <div className="text-right hidden md:block">
                                        <div className="text-sm font-medium text-white mb-1">Status</div>
                                        <div className={cn(
                                            "px-3 py-1 rounded-full text-xs font-medium border inline-block",
                                            pursuit.status === 'In Progress' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                                                pursuit.status === 'Review' ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' :
                                                    'bg-slate-500/10 text-slate-400 border-slate-500/20'
                                        )}>
                                            {pursuit.status || 'Draft'}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </Link>
                    </motion.div>
                ))}

                {filteredPursuits.length === 0 && (
                    <div className="text-center py-12 text-muted-foreground">
                        No pursuits found matching your search.
                    </div>
                )}
            </div>
        </div>
    )
}
