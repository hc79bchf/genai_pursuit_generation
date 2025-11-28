import { PieChart } from "lucide-react"
import { PageGuide } from "@/components/PageGuide"

export default function AnalyticsPage() {
    return (
        <div className="flex flex-col items-center justify-center h-[60vh] text-center space-y-4">
            <div className="p-6 rounded-full bg-white/5 border border-white/10">
                <PieChart className="h-12 w-12 text-muted-foreground" />
            </div>
            <div className="flex items-center gap-2 justify-center">
                <h2 className="text-2xl font-bold text-white">Analytics Coming Soon</h2>
                <PageGuide
                    title="Analytics"
                    description="The Analytics dashboard will provide insights into your pursuit performance and win rates."
                    guidelines={[
                        "Track win/loss ratios over time.",
                        "Analyze pursuit velocity and cycle times.",
                        "Identify bottlenecks in your proposal process.",
                        "View team performance metrics."
                    ]}
                />
            </div>
            <p className="text-muted-foreground max-w-md">
                We are building advanced analytics to help you track your win rates and pursuit performance.
            </p>
        </div>
    )
}
