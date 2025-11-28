import { Settings } from "lucide-react"
import { PageGuide } from "@/components/PageGuide"

export default function SettingsPage() {
    return (
        <div className="flex flex-col items-center justify-center h-[60vh] text-center space-y-4">
            <div className="p-6 rounded-full bg-white/5 border border-white/10">
                <Settings className="h-12 w-12 text-muted-foreground" />
            </div>
            <div className="flex items-center gap-2 justify-center">
                <h2 className="text-2xl font-bold text-white">Settings Coming Soon</h2>
                <PageGuide
                    title="Settings"
                    description="Configure your user preferences and application settings."
                    guidelines={[
                        "Manage your user profile and account details.",
                        "Configure notification preferences.",
                        "Manage API keys and integrations.",
                        "Customize application appearance and themes."
                    ]}
                />
            </div>
            <p className="text-muted-foreground max-w-md">
                User preferences and system configuration options will be available here.
            </p>
        </div>
    )
}
