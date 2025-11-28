import { MessageSquare } from "lucide-react"
import { PageGuide } from "@/components/PageGuide"

export default function MessagesPage() {
    return (
        <div className="flex flex-col items-center justify-center h-[60vh] text-center space-y-4">
            <div className="p-6 rounded-full bg-white/5 border border-white/10">
                <MessageSquare className="h-12 w-12 text-muted-foreground" />
            </div>
            <div className="flex items-center gap-2 justify-center">
                <h2 className="text-2xl font-bold text-white">Messages Coming Soon</h2>
                <PageGuide
                    title="Messages"
                    description="The Messages center will allow for seamless communication and collaboration within your pursuit team."
                    guidelines={[
                        "Chat with team members in real-time.",
                        "Create channels for specific pursuits.",
                        "Share files and documents securely.",
                        "Receive notifications for important updates."
                    ]}
                />
            </div>
            <p className="text-muted-foreground max-w-md">
                Team collaboration and messaging features are currently under development.
            </p>
        </div>
    )
}
