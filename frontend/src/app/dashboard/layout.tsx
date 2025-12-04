"use client"

import { useEffect } from "react"
import { Sidebar } from "@/components/layout/Sidebar"
import { Bell, User, Loader2 } from "lucide-react"
import { useUserStore } from "@/store/userStore"
import { initTokenRefresh } from "@/lib/api"

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const { user, isLoading, fetchUser } = useUserStore()

    useEffect(() => {
        fetchUser()
    }, [fetchUser])

    // Initialize activity-based token refresh
    useEffect(() => {
        const cleanup = initTokenRefresh()
        return cleanup
    }, [])

    // Get initials from full name
    const getInitials = (name: string) => {
        return name
            .split(' ')
            .map(n => n[0])
            .join('')
            .toUpperCase()
            .slice(0, 2)
    }

    return (
        <div className="flex h-screen bg-background overflow-hidden">
            <Sidebar />

            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                {/* Top Bar */}
                <header className="h-16 border-b border-white/5 bg-card/30 backdrop-blur-xl flex items-center justify-end px-8 shrink-0">
                    <div className="flex items-center space-x-4">
                        <button className="h-10 w-10 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors">
                            <Bell className="h-5 w-5 text-muted-foreground" />
                        </button>
                        <div className="flex items-center space-x-3 pl-4 border-l border-white/10">
                            {isLoading ? (
                                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                            ) : user ? (
                                <>
                                    <div className="h-8 w-8 rounded-full bg-gradient-to-br from-primary to-purple-400 flex items-center justify-center text-white text-xs font-medium">
                                        {getInitials(user.full_name)}
                                    </div>
                                    <div className="text-sm">
                                        <div className="font-medium">{user.full_name}</div>
                                        <div className="text-xs text-muted-foreground">{user.email}</div>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="h-8 w-8 rounded-full bg-gradient-to-br from-primary to-purple-400 flex items-center justify-center">
                                        <User className="h-4 w-4 text-white" />
                                    </div>
                                    <div className="text-sm">
                                        <div className="font-medium">Guest</div>
                                        <div className="text-xs text-muted-foreground">Not logged in</div>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </header>

                {/* Main Content */}
                <main className="flex-1 overflow-y-auto p-8 scrollbar-hide">
                    {children}
                </main>
            </div>
        </div>
    )
}
