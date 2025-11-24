import { MessageSquare } from "lucide-react"

export default function MessagesPage() {
    return (
        <div className="flex flex-col items-center justify-center h-[60vh] text-center space-y-4">
            <div className="p-6 rounded-full bg-white/5 border border-white/10">
                <MessageSquare className="h-12 w-12 text-muted-foreground" />
            </div>
            <h2 className="text-2xl font-bold text-white">Messages Coming Soon</h2>
            <p className="text-muted-foreground max-w-md">
                Team collaboration and messaging features are currently under development.
            </p>
        </div>
    )
}
