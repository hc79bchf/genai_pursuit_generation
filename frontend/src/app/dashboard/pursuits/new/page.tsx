"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { ArrowLeft, Loader2, Upload } from "lucide-react"
import Link from "next/link"
import { fetchApi } from "@/lib/api"

export default function NewPursuitPage() {
    const router = useRouter()
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState("")
    const [formData, setFormData] = useState({
        entity_name: "",
        internal_pursuit_owner_name: "",
    })

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsLoading(true)
        setError("")

        try {
            const response = await fetchApi("/pursuits/", {
                method: "POST",
                body: JSON.stringify(formData),
            })

            if (response.id) {
                router.push(`/dashboard/pursuits/${response.id}`)
            }
        } catch (error: any) {
            console.error("Failed to create pursuit", error)
            setError(error.message || "Failed to create pursuit")
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            <div className="flex items-center space-x-4 mb-8">
                <Button asChild variant="ghost" size="icon" className="hover:bg-white/10 text-muted-foreground hover:text-white">
                    <Link href="/dashboard">
                        <ArrowLeft className="h-5 w-5" />
                    </Link>
                </Button>
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-white">New Pursuit</h1>
                    <p className="text-muted-foreground text-sm">Create a new pursuit to start tracking</p>
                </div>
            </div>

            <Card className="glass-card border-white/10">
                <CardHeader>
                    <CardTitle className="text-white">Pursuit Details</CardTitle>
                    <CardDescription className="text-muted-foreground">
                        Enter the basic information for this pursuit. You can upload files later.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {error && (
                        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center text-red-400">
                            <div className="h-2 w-2 rounded-full bg-red-500 mr-3" />
                            {error}
                        </div>
                    )}
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-white">Entity Name</label>
                            <Input
                                required
                                placeholder="e.g. Acme Corp"
                                value={formData.entity_name}
                                onChange={(e) => setFormData({ ...formData, entity_name: e.target.value })}
                                className="bg-black/20 border-white/10 text-white placeholder:text-muted-foreground focus:ring-primary"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-white">Internal Owner</label>
                            <Input
                                required
                                placeholder="e.g. Sarah Lee"
                                value={formData.internal_pursuit_owner_name}
                                onChange={(e) => setFormData({ ...formData, internal_pursuit_owner_name: e.target.value })}
                                className="bg-black/20 border-white/10 text-white placeholder:text-muted-foreground focus:ring-primary"
                            />
                        </div>

                        <div className="pt-4 flex justify-end space-x-4">
                            <Button asChild variant="ghost" className="text-muted-foreground hover:text-white hover:bg-white/10">
                                <Link href="/dashboard">Cancel</Link>
                            </Button>
                            <Button
                                type="submit"
                                disabled={isLoading}
                                className="bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20"
                            >
                                {isLoading ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Creating...
                                    </>
                                ) : (
                                    <>
                                        <Upload className="mr-2 h-4 w-4" />
                                        Create Pursuit
                                    </>
                                )}
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </div>
    )
}
