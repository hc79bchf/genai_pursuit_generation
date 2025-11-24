"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import {
    LayoutDashboard,
    FileText,
    Settings,
    LogOut,
    PieChart,
    MessageSquare,
    Library
} from "lucide-react"
import { Button } from "@/components/ui/button"

const sidebarItems = [
    {
        title: "Dashboard",
        href: "/dashboard",
        icon: LayoutDashboard
    },
    {
        title: "Pursuits",
        href: "/dashboard/pursuits",
        icon: FileText
    },
    {
        title: "Outline Library",
        href: "/dashboard/pursuits/library",
        icon: Library
    },
    {
        title: "Analytics",
        href: "/dashboard/analytics",
        icon: PieChart
    },
    {
        title: "Messages",
        href: "/dashboard/messages",
        icon: MessageSquare
    },
    {
        title: "Settings",
        href: "/dashboard/settings",
        icon: Settings
    }
]

export function Sidebar() {
    const pathname = usePathname()

    return (
        <div className="flex h-screen w-64 flex-col justify-between border-r border-white/10 bg-card/30 backdrop-blur-xl p-4">
            <div className="space-y-8">
                <div className="flex items-center px-2">
                    <div className="h-8 w-8 rounded-lg bg-primary/20 flex items-center justify-center mr-3">
                        <div className="h-4 w-4 rounded-full bg-primary animate-pulse" />
                    </div>
                    <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent">
                        Pursuit AI
                    </h1>
                </div>

                <nav className="space-y-2">
                    {sidebarItems.map((item) => {
                        const Icon = item.icon
                        const isActive = pathname === item.href || pathname?.startsWith(item.href + "/")

                        return (
                            <Link key={item.href} href={item.href}>
                                <div className={cn(
                                    "flex items-center space-x-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                                    isActive
                                        ? "bg-primary/20 text-primary shadow-[0_0_20px_rgba(124,58,237,0.3)]"
                                        : "text-muted-foreground hover:bg-white/5 hover:text-white"
                                )}>
                                    <Icon className={cn("h-5 w-5", isActive ? "text-primary" : "text-muted-foreground")} />
                                    <span>{item.title}</span>
                                    {isActive && (
                                        <div className="ml-auto h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_8px_currentColor]" />
                                    )}
                                </div>
                            </Link>
                        )
                    })}
                </nav>
            </div>

            <div className="space-y-4">
                <div className="rounded-xl bg-gradient-to-br from-primary/20 to-purple-600/20 p-4 border border-white/5">
                    <h4 className="text-sm font-medium text-white mb-1">Pro Plan</h4>
                    <p className="text-xs text-muted-foreground mb-3">You have 3 active pursuits</p>
                    <div className="h-1.5 w-full bg-black/20 rounded-full overflow-hidden mb-3">
                        <div className="h-full w-[60%] bg-primary rounded-full" />
                    </div>
                    <Button size="sm" className="w-full bg-primary/20 hover:bg-primary/30 text-primary border-0">
                        Upgrade
                    </Button>
                </div>

                <Button variant="ghost" className="w-full justify-start text-muted-foreground hover:text-white hover:bg-white/5">
                    <LogOut className="mr-2 h-4 w-4" />
                    Sign Out
                </Button>
            </div>
        </div>
    )
}
