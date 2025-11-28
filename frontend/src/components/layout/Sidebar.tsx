"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useEffect } from "react"
import { cn } from "@/lib/utils"
import {
    LayoutDashboard,
    FileText,
    Settings,
    LogOut,
    PieChart,
    MessageSquare,
    Library,
    SearchCheck
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { usePursuitStore } from "@/store/pursuitStore"

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
        title: "Gap Assessment",
        href: "/dashboard/gap-assessment",
        icon: FileText
    },
    {
        title: "Deep Search",
        href: "/dashboard/deep-search",
        icon: SearchCheck
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
    const router = useRouter()
    const { activePursuitsCount, refreshPursuitsCount } = usePursuitStore()

    useEffect(() => {
        refreshPursuitsCount()
    }, [refreshPursuitsCount])

    const handleSignOut = () => {
        localStorage.removeItem("token")
        router.push("/login")
    }

    return (
        <div className="flex h-screen w-64 flex-col justify-between border-r border-white/10 bg-card/30 backdrop-blur-xl p-4">
            <div className="space-y-8">
                <Link href="/dashboard/welcome" className="flex items-center px-2 hover:opacity-80 transition-opacity cursor-pointer">
                    <div className="h-8 w-8 rounded-lg bg-primary/20 flex items-center justify-center mr-3">
                        <div className="h-4 w-4 rounded-full bg-primary animate-pulse" />
                    </div>
                    <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent">
                        Pursuit AI
                    </h1>
                </Link>

                <nav className="space-y-2">
                    {sidebarItems.map((item) => {
                        const Icon = item.icon

                        // Check if current pathname matches this item
                        // Priority: exact match > starts with (for nested routes)
                        // But avoid false positives when a longer, more specific route exists
                        let isActive = false

                        // Special case: Dashboard should only be active on exact /dashboard path
                        if (item.href === "/dashboard") {
                            isActive = pathname === "/dashboard"
                        } else if (pathname === item.href) {
                            // Exact match - always active
                            isActive = true
                        } else if (pathname?.startsWith(item.href + "/")) {
                            // Starts with this href - check if there's a more specific match
                            const hasMoreSpecificMatch = sidebarItems.some(
                                (otherItem) =>
                                    otherItem.href !== item.href &&
                                    otherItem.href.startsWith(item.href) &&
                                    (pathname === otherItem.href || pathname?.startsWith(otherItem.href + "/"))
                            )
                            isActive = !hasMoreSpecificMatch
                        }

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
                    <p className="text-xs text-muted-foreground mb-3">
                        You have {activePursuitsCount} active {activePursuitsCount === 1 ? 'pursuit' : 'pursuits'}
                    </p>
                    <div className="h-1.5 w-full bg-black/20 rounded-full overflow-hidden mb-3">
                        <div className="h-full w-[60%] bg-primary rounded-full" />
                    </div>
                    <Button size="sm" className="w-full bg-primary/20 hover:bg-primary/30 text-primary border-0">
                        Upgrade
                    </Button>
                </div>

                <Button
                    variant="ghost"
                    className="w-full justify-start text-muted-foreground hover:text-white hover:bg-white/5"
                    onClick={handleSignOut}
                >
                    <LogOut className="mr-2 h-4 w-4" />
                    Sign Out
                </Button>
            </div>
        </div>
    )
}
