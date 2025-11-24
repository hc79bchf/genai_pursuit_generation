import { Settings } from "lucide-react"

export default function SettingsPage() {
    return (
        <div className="flex flex-col items-center justify-center h-[60vh] text-center space-y-4">
            <div className="p-6 rounded-full bg-white/5 border border-white/10">
                <Settings className="h-12 w-12 text-muted-foreground" />
            </div>
            <h2 className="text-2xl font-bold text-white">Settings Coming Soon</h2>
            <p className="text-muted-foreground max-w-md">
                User preferences and system configuration options will be available here.
            </p>
        </div>
    )
}
