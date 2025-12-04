"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"

export default function PursuitDetailPage({ params }: { params: { id: string } }) {
    const router = useRouter()

    useEffect(() => {
        // Redirect to the workflow overview page
        router.replace(`/dashboard/pursuits/${params.id}/workflow/overview`)
    }, [params.id, router])

    return (
        <div className="flex h-[50vh] items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
    )
}
