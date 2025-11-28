"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { api } from "@/lib/api"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { FileText, ArrowRight } from "lucide-react"

export default function PPTGenerationListPage() {
    const [pursuits, setPursuits] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const fetchPursuits = async () => {
            try {
                const data = await api.getPursuits()
                setPursuits(data)
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

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {pursuits.map((pursuit) => (
                    <Card key={pursuit.id} className="bg-card/50 backdrop-blur border-white/10 hover:bg-card/80 transition-colors">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-lg font-medium text-white">
                                {pursuit.entity_name}
                            </CardTitle>
                            <FileText className="h-4 w-4 text-muted-foreground" />
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
        </div>
    )
}
