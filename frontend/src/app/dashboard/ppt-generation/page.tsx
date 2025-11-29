"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { api } from "@/lib/api"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { FileText, ArrowRight, AlertCircle } from "lucide-react"
import { cn } from "@/lib/utils"

export default function PPTGenerationListPage() {
    const [pursuits, setPursuits] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    // Filter for active pursuits only (exclude cancelled, stale, lost)
    const isActiveStatus = (status: string) => {
        return !['cancelled', 'stale', 'lost'].includes(status)
    }

    useEffect(() => {
        const fetchPursuits = async () => {
            try {
                const data = await api.getPursuits()
                // Filter to only show active pursuits
                const activePursuits = data.filter((p: any) => isActiveStatus(p.status))
                setPursuits(activePursuits)
            } catch (error) {
                console.error("Failed to fetch pursuits", error)
            } finally {
                setLoading(false)
            }
        }
        fetchPursuits()
    }, [])

    if (loading) {
        return <div className="p-8 text-center">Loading pursuits...</div>
    }

    return (
        <div className="p-8 space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-white">PPT Generation</h1>
                    <p className="text-muted-foreground mt-2">Select a pursuit to generate a presentation.</p>
                </div>
            </div>

            {pursuits.length === 0 ? (
                <Card className="bg-card/50 backdrop-blur border-white/10">
                    <CardContent className="flex flex-col items-center justify-center py-12">
                        <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
                        <h3 className="text-lg font-semibold text-white mb-2">No Active Pursuits</h3>
                        <p className="text-muted-foreground text-center mb-4">
                            Create a new pursuit or activate an existing one to generate presentations.
                        </p>
                        <Link href="/dashboard/pursuits/new">
                            <Button>Create New Pursuit</Button>
                        </Link>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {pursuits.map((pursuit) => (
                        <Card key={pursuit.id} className="bg-card/50 backdrop-blur border-white/10 hover:bg-card/80 transition-colors">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-lg font-medium text-white">
                                    {pursuit.entity_name}
                                </CardTitle>
                                <div className={cn(
                                    "px-2 py-1 rounded-full text-xs font-medium border",
                                    pursuit.status === 'draft' ? 'bg-slate-500/10 text-slate-400 border-slate-500/20' :
                                        pursuit.status === 'in_review' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                                            pursuit.status === 'ready_for_submission' ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' :
                                                pursuit.status === 'submitted' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' :
                                                    pursuit.status === 'won' ? 'bg-green-500/10 text-green-400 border-green-500/20' :
                                                        'bg-slate-500/10 text-slate-400 border-slate-500/20'
                                )}>
                                    {pursuit.status?.replace('_', ' ') || 'Draft'}
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="text-sm text-muted-foreground mb-4">
                                    {pursuit.industry || "No industry specified"}
                                </div>
                                <Link href={`/dashboard/ppt-generation/${pursuit.id}`}>
                                    <Button className="w-full" variant="secondary">
                                        Select
                                        <ArrowRight className="ml-2 h-4 w-4" />
                                    </Button>
                                </Link>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    )
}
