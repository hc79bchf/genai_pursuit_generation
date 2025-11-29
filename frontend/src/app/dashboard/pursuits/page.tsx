"use client"

import { useEffect, useState, memo } from "react"
import { Button } from "@/components/ui/button"
import { Plus, Loader2, Search, Filter, FileText, Clock, Users, Play, Pause } from "lucide-react"
import { Input } from "@/components/ui/input"
import { fetchApi } from "@/lib/api"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { usePursuitStore } from "@/store/pursuitStore"
import { PageGuide } from "@/components/PageGuide"
import { BorderBeam } from "@/components/BorderBeam"

interface Pursuit {
    id: string
    entity_name: string
    internal_pursuit_owner_name: string
    status: string
    created_at: string
    progress?: number
    is_deleted?: boolean
}

interface PursuitCardProps {
    pursuit: Pursuit
    updatingId: string | null
    onStatusChange: (id: string, status: string) => void
    isActiveStatus: (status: string) => boolean
}

const PursuitCard = memo(function PursuitCard({ pursuit, updatingId, onStatusChange, isActiveStatus }: PursuitCardProps) {
    const isActive = isActiveStatus(pursuit.status)
    const isUpdating = updatingId === pursuit.id

    const handleClick = () => {
        console.log('Button clicked for pursuit:', pursuit.id, pursuit.entity_name)
        const newStatus = isActive ? 'cancelled' : 'draft'
        onStatusChange(pursuit.id, newStatus)
    }

    return (
        <div className="glass-card rounded-xl p-6 flex items-center justify-between group cursor-pointer border border-white/5 hover:border-primary/50 transition-all">
            <Link href={`/dashboard/pursuits/${pursuit.id}`} className="flex items-center space-x-6 flex-1">
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
            </Link>

            <div className="flex items-center space-x-4">
                <Link href={`/dashboard/pursuits/${pursuit.id}`} className="text-right hidden md:block">
                    <div className="text-sm font-medium text-white mb-1">Status</div>
                    <div className={cn(
                        "px-3 py-1 rounded-full text-xs font-medium border inline-block",
                        pursuit.status === 'draft' ? 'bg-slate-500/10 text-slate-400 border-slate-500/20' :
                            pursuit.status === 'in_review' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                                pursuit.status === 'ready_for_submission' ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' :
                                    pursuit.status === 'submitted' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' :
                                        pursuit.status === 'won' ? 'bg-green-500/10 text-green-400 border-green-500/20' :
                                            pursuit.status === 'lost' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                                                pursuit.status === 'cancelled' ? 'bg-gray-500/10 text-gray-400 border-gray-500/20' :
                                                    pursuit.status === 'stale' ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' :
                                                        'bg-slate-500/10 text-slate-400 border-slate-500/20'
                    )}>
                        {pursuit.status?.replace('_', ' ') || 'Draft'}
                    </div>
                </Link>

                {/* Activate/Deactivate Button */}
                <Button
                    size="sm"
                    variant="outline"
                    className={isActive
                        ? "border-orange-500/30 text-orange-400 hover:bg-orange-500/10 hover:text-orange-300"
                        : "border-green-500/30 text-green-400 hover:bg-green-500/10 hover:text-green-300"
                    }
                    onClick={handleClick}
                    disabled={isUpdating}
                >
                    {isUpdating ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                    ) : isActive ? (
                        <>
                            <Pause className="h-4 w-4 mr-1" />
                            Deactivate
                        </>
                    ) : (
                        <>
                            <Play className="h-4 w-4 mr-1" />
                            Activate
                        </>
                    )}
                </Button>
            </div>
        </div>
    )
})

export default function PursuitsPage() {
    const [pursuits, setPursuits] = useState<Pursuit[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState("")
    const [updatingId, setUpdatingId] = useState<string | null>(null)
    const { refreshPursuitsCount } = usePursuitStore()

    const loadPursuits = async () => {
        try {
            const data = await fetchApi("/pursuits/")
            setPursuits(data)
        } catch (error) {
            console.error("Failed to load pursuits", error)
        } finally {
            setIsLoading(false)
        }
    }

    useEffect(() => {
        loadPursuits()
    }, [])

    const handleStatusChange = async (pursuitId: string, newStatus: string) => {
        setUpdatingId(pursuitId)
        try {
            await fetchApi(`/pursuits/${pursuitId}`, {
                method: "PUT",
                body: JSON.stringify({ status: newStatus })
            })
            // Reload pursuits and refresh count
            await loadPursuits()
            await refreshPursuitsCount()
        } catch (error) {
            console.error("Failed to update pursuit status", error)
        } finally {
            setUpdatingId(null)
        }
    }

    const isActiveStatus = (status: string) => {
        return !['cancelled', 'stale', 'lost'].includes(status)
    }

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
                    <div className="flex items-center gap-2">
                        <h2 className="text-3xl font-bold tracking-tight text-white">Pursuits</h2>
                        <PageGuide
                            title="Pursuits Management"
                            description="The Pursuits page is your central hub for managing all sales opportunities and proposals."
                            guidelines={[
                                "View a list of all active and inactive pursuits.",
                                "Use the search bar to find specific pursuits by name or owner.",
                                "Quickly change the status of a pursuit (e.g., Activate/Deactivate).",
                                "Click on a pursuit card to view its detailed information and manage tasks."
                            ]}
                        />
                    </div>
                    <p className="text-muted-foreground mt-1">Manage and track all your active pursuits</p>
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
                {filteredPursuits.map((pursuit) => (
                    <PursuitCard
                        key={pursuit.id}
                        pursuit={pursuit}
                        updatingId={updatingId}
                        onStatusChange={handleStatusChange}
                        isActiveStatus={isActiveStatus}
                    />
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
