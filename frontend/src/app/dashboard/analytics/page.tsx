import { PieChart } from "lucide-react"

export default function AnalyticsPage() {
    return (
        <div className="flex flex-col items-center justify-center h-[60vh] text-center space-y-4">
            <div className="p-6 rounded-full bg-white/5 border border-white/10">
                <PieChart className="h-12 w-12 text-muted-foreground" />
            </div>
            <h2 className="text-2xl font-bold text-white">Analytics Coming Soon</h2>
            <p className="text-muted-foreground max-w-md">
                We are building advanced analytics to help you track your win rates and pursuit performance.
            </p>
        </div>
    )
}
