"use client"

import { useEffect, useState, useMemo, useCallback } from "react"
import { motion } from "framer-motion"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { FilterDropdown } from "@/components/ui/filter-dropdown"
import { ComboboxInput, ComboboxOption } from "@/components/ui/combobox-input"
import { Plus, Clock, Loader2, TrendingUp, Users, Target, Search, ChevronUp, ChevronDown, X, Upload } from "lucide-react"
import { fetchApi, api } from "@/lib/api"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { PageGuide } from "@/components/PageGuide"
import { ScrollAnimation } from "@/components/ScrollAnimation"
import { BorderBeam } from "@/components/BorderBeam"
import { Spotlight } from "@/components/Spotlight"
import { Marquee } from "@/components/Marquee"
import { usePursuitStore } from "@/store/pursuitStore"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog"

// Debounce hook for search
function useDebounce<T>(value: T, delay: number): T {
    const [debouncedValue, setDebouncedValue] = useState<T>(value)

    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedValue(value)
        }, delay)

        return () => {
            clearTimeout(handler)
        }
    }, [value, delay])

    return debouncedValue
}

interface Pursuit {
    id: string
    entity_name: string
    internal_pursuit_owner_name: string
    pursuit_partner_name?: string
    pursuit_manager_name?: string
    status: string
    created_at: string
    updated_at?: string
    submission_due_date?: string
    progress_percentage?: number
    industry?: string
}

interface Activity {
    id: string
    user_id: string | null
    pursuit_id: string | null
    action: string
    entity_type: string
    entity_id: string | null
    details: Record<string, any> | null
    created_at: string
    user_name: string | null
    user_email: string | null
    pursuit_name: string | null
}

interface DashboardStats {
    active_pursuits: number
    total_pursuits: number
    won_pursuits: number
    lost_pursuits: number
    win_rate: number
    team_members: number
}

type SortField = "entity_name" | "status" | "internal_pursuit_owner_name" | "created_at" | "submission_due_date"
type SortDirection = "asc" | "desc"

const STATUS_OPTIONS = [
    { value: "draft", label: "Draft" },
    { value: "in_review", label: "In Review" },
    { value: "ready_for_submission", label: "Ready for Submission" },
    { value: "submitted", label: "Submitted" },
    { value: "won", label: "Won" },
    { value: "lost", label: "Lost" },
    { value: "cancelled", label: "Cancelled" },
    { value: "stale", label: "Stale" },
]

const STATUS_COLORS: Record<string, string> = {
    draft: "bg-slate-500/10 text-slate-400 border-slate-500/20",
    in_review: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
    ready_for_submission: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    submitted: "bg-purple-500/10 text-purple-400 border-purple-500/20",
    won: "bg-green-500/10 text-green-400 border-green-500/20",
    lost: "bg-red-500/10 text-red-400 border-red-500/20",
    cancelled: "bg-gray-500/10 text-gray-400 border-gray-500/20",
    stale: "bg-orange-500/10 text-orange-400 border-orange-500/20",
}

export default function DashboardPage() {
    const router = useRouter()
    const { refreshPursuitsCount } = usePursuitStore()
    const [pursuits, setPursuits] = useState<Pursuit[]>([])
    const [activities, setActivities] = useState<Activity[]>([])
    const [stats, setStats] = useState<DashboardStats | null>(null)
    const [isLoading, setIsLoading] = useState(true)

    // Filter states
    const [searchQuery, setSearchQuery] = useState("")
    const [statusFilter, setStatusFilter] = useState<string[]>([])
    const [ownerFilter, setOwnerFilter] = useState<string[]>([])
    const [partnerFilter, setPartnerFilter] = useState<string[]>([])
    const [managerFilter, setManagerFilter] = useState<string[]>([])
    const [entityFilter, setEntityFilter] = useState<string[]>([])

    // Sort states
    const [sortField, setSortField] = useState<SortField>("created_at")
    const [sortDirection, setSortDirection] = useState<SortDirection>("desc")

    // New Pursuit Modal states
    const [showNewPursuitModal, setShowNewPursuitModal] = useState(false)
    const [isCreating, setIsCreating] = useState(false)
    const [createError, setCreateError] = useState("")
    const [formData, setFormData] = useState({
        entity_name: "",
        internal_pursuit_owner_name: "",
        internal_pursuit_owner_email: "",
        pursuit_partner_name: "",
        pursuit_partner_email: "",
        pursuit_manager_name: "",
        pursuit_manager_email: "",
    })

    // Search states for comboboxes
    const [entitySearch, setEntitySearch] = useState("")
    const [ownerSearch, setOwnerSearch] = useState("")
    const [partnerSearch, setPartnerSearch] = useState("")
    const [managerSearch, setManagerSearch] = useState("")

    // Debounced search values
    const debouncedEntitySearch = useDebounce(entitySearch, 300)
    const debouncedOwnerSearch = useDebounce(ownerSearch, 300)
    const debouncedPartnerSearch = useDebounce(partnerSearch, 300)
    const debouncedManagerSearch = useDebounce(managerSearch, 300)

    // Options states
    const [entityOptions, setEntityOptions] = useState<ComboboxOption[]>([])
    const [userOptions, setUserOptions] = useState<ComboboxOption[]>([])
    const [partnerOptions, setPartnerOptions] = useState<ComboboxOption[]>([])
    const [managerOptions, setManagerOptions] = useState<ComboboxOption[]>([])

    // Loading states for comboboxes
    const [isLoadingEntities, setIsLoadingEntities] = useState(false)
    const [isLoadingUsers, setIsLoadingUsers] = useState(false)
    const [isLoadingPartners, setIsLoadingPartners] = useState(false)
    const [isLoadingManagers, setIsLoadingManagers] = useState(false)

    useEffect(() => {
        async function loadData() {
            try {
                const [pursuitsData, activitiesData, statsData] = await Promise.all([
                    fetchApi("/pursuits/"),
                    api.getActivities(5).catch(() => []),
                    api.getDashboardStats().catch(() => null)
                ])
                setPursuits(pursuitsData)
                setActivities(activitiesData)
                setStats(statsData)
            } catch (error) {
                console.error("Failed to load data", error)
            } finally {
                setIsLoading(false)
            }
        }
        loadData()
    }, [])

    // Fetch entities for new pursuit modal
    useEffect(() => {
        if (!showNewPursuitModal) return
        const fetchEntities = async () => {
            setIsLoadingEntities(true)
            try {
                const response = await fetchApi(`/lookup/entities?q=${encodeURIComponent(debouncedEntitySearch)}&limit=20`)
                setEntityOptions(response)
            } catch (error) {
                console.error("Failed to fetch entities", error)
            } finally {
                setIsLoadingEntities(false)
            }
        }
        fetchEntities()
    }, [debouncedEntitySearch, showNewPursuitModal])

    // Fetch users for internal owner
    useEffect(() => {
        if (!showNewPursuitModal) return
        const fetchUsers = async () => {
            setIsLoadingUsers(true)
            try {
                const response = await fetchApi(`/lookup/users?q=${encodeURIComponent(debouncedOwnerSearch)}&limit=20`)
                setUserOptions(response)
            } catch (error) {
                console.error("Failed to fetch users", error)
            } finally {
                setIsLoadingUsers(false)
            }
        }
        fetchUsers()
    }, [debouncedOwnerSearch, showNewPursuitModal])

    // Fetch team members for partner
    useEffect(() => {
        if (!showNewPursuitModal) return
        const fetchPartners = async () => {
            setIsLoadingPartners(true)
            try {
                const response = await fetchApi(`/lookup/team-members?q=${encodeURIComponent(debouncedPartnerSearch)}&role=partner&limit=20`)
                setPartnerOptions(response)
            } catch (error) {
                console.error("Failed to fetch partners", error)
            } finally {
                setIsLoadingPartners(false)
            }
        }
        fetchPartners()
    }, [debouncedPartnerSearch, showNewPursuitModal])

    // Fetch team members for manager
    useEffect(() => {
        if (!showNewPursuitModal) return
        const fetchManagers = async () => {
            setIsLoadingManagers(true)
            try {
                const response = await fetchApi(`/lookup/team-members?q=${encodeURIComponent(debouncedManagerSearch)}&role=manager&limit=20`)
                setManagerOptions(response)
            } catch (error) {
                console.error("Failed to fetch managers", error)
            } finally {
                setIsLoadingManagers(false)
            }
        }
        fetchManagers()
    }, [debouncedManagerSearch, showNewPursuitModal])

    // Reset form when modal closes
    const resetForm = () => {
        setFormData({
            entity_name: "",
            internal_pursuit_owner_name: "",
            internal_pursuit_owner_email: "",
            pursuit_partner_name: "",
            pursuit_partner_email: "",
            pursuit_manager_name: "",
            pursuit_manager_email: "",
        })
        setEntitySearch("")
        setOwnerSearch("")
        setPartnerSearch("")
        setManagerSearch("")
        setCreateError("")
    }

    // Handle create pursuit
    const handleCreatePursuit = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsCreating(true)
        setCreateError("")

        try {
            const payload: Record<string, string> = {
                entity_name: formData.entity_name,
                internal_pursuit_owner_name: formData.internal_pursuit_owner_name,
            }

            if (formData.internal_pursuit_owner_email) {
                payload.internal_pursuit_owner_email = formData.internal_pursuit_owner_email
            }
            if (formData.pursuit_partner_name) {
                payload.pursuit_partner_name = formData.pursuit_partner_name
            }
            if (formData.pursuit_partner_email) {
                payload.pursuit_partner_email = formData.pursuit_partner_email
            }
            if (formData.pursuit_manager_name) {
                payload.pursuit_manager_name = formData.pursuit_manager_name
            }
            if (formData.pursuit_manager_email) {
                payload.pursuit_manager_email = formData.pursuit_manager_email
            }

            const response = await fetchApi("/pursuits/", {
                method: "POST",
                body: JSON.stringify(payload),
            })

            if (response.id) {
                await refreshPursuitsCount()
                setShowNewPursuitModal(false)
                resetForm()
                router.push(`/dashboard/pursuits/${response.id}/workflow/overview`)
            }
        } catch (error: any) {
            console.error("Failed to create pursuit", error)
            setCreateError(error.message || "Failed to create pursuit")
        } finally {
            setIsCreating(false)
        }
    }

    // Extract unique values for filter options
    const filterOptions = useMemo(() => {
        const entities = new Set<string>()
        const owners = new Set<string>()
        const partners = new Set<string>()
        const managers = new Set<string>()

        pursuits.forEach((p) => {
            if (p.entity_name) entities.add(p.entity_name)
            if (p.internal_pursuit_owner_name) owners.add(p.internal_pursuit_owner_name)
            if (p.pursuit_partner_name) partners.add(p.pursuit_partner_name)
            if (p.pursuit_manager_name) managers.add(p.pursuit_manager_name)
        })

        return {
            entities: Array.from(entities).sort().map((v) => ({ value: v, label: v })),
            owners: Array.from(owners).sort().map((v) => ({ value: v, label: v })),
            partners: Array.from(partners).sort().map((v) => ({ value: v, label: v })),
            managers: Array.from(managers).sort().map((v) => ({ value: v, label: v })),
        }
    }, [pursuits])

    // Filter and sort pursuits
    const filteredPursuits = useMemo(() => {
        let result = [...pursuits]

        // Apply search filter
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase()
            result = result.filter((p) =>
                p.entity_name.toLowerCase().includes(query) ||
                p.internal_pursuit_owner_name?.toLowerCase().includes(query) ||
                p.pursuit_partner_name?.toLowerCase().includes(query) ||
                p.pursuit_manager_name?.toLowerCase().includes(query)
            )
        }

        // Apply status filter
        if (statusFilter.length > 0) {
            result = result.filter((p) => statusFilter.includes(p.status))
        }

        // Apply entity filter
        if (entityFilter.length > 0) {
            result = result.filter((p) => entityFilter.includes(p.entity_name))
        }

        // Apply owner filter
        if (ownerFilter.length > 0) {
            result = result.filter((p) => ownerFilter.includes(p.internal_pursuit_owner_name))
        }

        // Apply partner filter
        if (partnerFilter.length > 0) {
            result = result.filter((p) => p.pursuit_partner_name && partnerFilter.includes(p.pursuit_partner_name))
        }

        // Apply manager filter
        if (managerFilter.length > 0) {
            result = result.filter((p) => p.pursuit_manager_name && managerFilter.includes(p.pursuit_manager_name))
        }

        // Apply sorting
        result.sort((a, b) => {
            let aVal: any = a[sortField]
            let bVal: any = b[sortField]

            // Handle null/undefined values
            if (aVal == null) aVal = ""
            if (bVal == null) bVal = ""

            // String comparison
            if (typeof aVal === "string") {
                aVal = aVal.toLowerCase()
                bVal = bVal.toLowerCase()
            }

            if (aVal < bVal) return sortDirection === "asc" ? -1 : 1
            if (aVal > bVal) return sortDirection === "asc" ? 1 : -1
            return 0
        })

        return result
    }, [pursuits, searchQuery, statusFilter, entityFilter, ownerFilter, partnerFilter, managerFilter, sortField, sortDirection])

    const handleSort = (field: SortField) => {
        if (sortField === field) {
            setSortDirection(sortDirection === "asc" ? "desc" : "asc")
        } else {
            setSortField(field)
            setSortDirection("asc")
        }
    }

    const SortIcon = ({ field }: { field: SortField }) => {
        if (sortField !== field) return null
        return sortDirection === "asc" ? (
            <ChevronUp className="h-4 w-4 inline ml-1" />
        ) : (
            <ChevronDown className="h-4 w-4 inline ml-1" />
        )
    }

    const formatStatus = (status: string) => {
        return status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
    }

    const formatDate = (dateString?: string) => {
        if (!dateString) return "-"
        return new Date(dateString).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric"
        })
    }

    // Format action text for display
    const formatAction = (action: string, entityType: string) => {
        const actionMap: Record<string, string> = {
            'create': 'created',
            'update': 'updated',
            'delete': 'deleted',
            'upload': 'uploaded a file',
            'extract': 'extracted metadata',
            'gap_analysis': 'ran gap analysis',
            'research': 'completed research',
            'generate_ppt': 'generated presentation',
        }
        const formattedAction = actionMap[action.toLowerCase()] || action
        const formattedEntity = entityType.replace(/_/g, ' ')
        return `${formattedAction} ${formattedEntity}`
    }

    // Format time ago
    const formatTimeAgo = (dateString: string) => {
        const date = new Date(dateString)
        const now = new Date()
        const diffMs = now.getTime() - date.getTime()
        const diffMins = Math.floor(diffMs / 60000)
        const diffHours = Math.floor(diffMs / 3600000)
        const diffDays = Math.floor(diffMs / 86400000)

        if (diffMins < 1) return 'Just now'
        if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`
        if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`
        if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`
        return date.toLocaleDateString()
    }

    const clearAllFilters = () => {
        setSearchQuery("")
        setStatusFilter([])
        setEntityFilter([])
        setOwnerFilter([])
        setPartnerFilter([])
        setManagerFilter([])
    }

    const hasActiveFilters = searchQuery || statusFilter.length > 0 || entityFilter.length > 0 || ownerFilter.length > 0 || partnerFilter.length > 0 || managerFilter.length > 0

    if (isLoading) {
        return (
            <div className="flex h-[50vh] items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        )
    }

    const statsData = [
        {
            title: "Active Pursuits",
            value: (stats?.active_pursuits ?? pursuits.filter(p => !["won", "lost", "cancelled", "stale"].includes(p.status)).length).toString(),
            icon: Target,
            color: "text-blue-400"
        },
        {
            title: "Win Rate",
            value: `${stats?.win_rate ?? 0}%`,
            icon: TrendingUp,
            color: "text-green-400"
        },
        {
            title: "Team Members",
            value: (stats?.team_members ?? 1).toString(),
            icon: Users,
            color: "text-purple-400"
        },
    ]

    return (
        <div className="space-y-8">
            {/* Header Section */}
            <div className="flex justify-between items-end">
                <div>
                    <div className="flex items-center gap-2">
                        <h1 className="text-3xl font-bold tracking-wide text-white uppercase" style={{ fontFamily: "'Inter', 'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif", letterSpacing: '0.05em' }}>Dashboard</h1>
                        <PageGuide
                            title="Dashboard Overview"
                            description="The Dashboard provides a high-level view of your pursuit pipeline, key performance metrics, and recent activity."
                            guidelines={[
                                "Monitor active pursuits and their progress status.",
                                "Track win rates and team engagement metrics.",
                                "Use filters to find specific pursuits quickly.",
                                "Click on any pursuit to view details and take action."
                            ]}
                        />
                    </div>
                    <p className="text-muted-foreground mt-1">Overview of your pursuit pipeline</p>
                </div>
                <Button
                    onClick={() => setShowNewPursuitModal(true)}
                    className="relative overflow-hidden rounded-full bg-primary hover:bg-primary/90 shadow-[0_0_20px_rgba(124,58,237,0.3)] border-0 group"
                >
                    <span className="relative z-10 flex items-center">
                        <Plus className="mr-2 h-4 w-4" />
                        New Pursuit
                    </span>
                    <BorderBeam
                        size={60}
                        duration={3}
                        delay={0}
                        borderWidth={1.5}
                        colorFrom="#ffffff"
                        colorTo="#a78bfa"
                        className="opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                    />
                </Button>
            </div>

            {/* Stats Grid */}
            <div className="relative flex h-[200px] w-full flex-col items-center justify-center overflow-hidden rounded-lg bg-background md:shadow-xl">
                <Marquee pauseOnHover className="[--duration:20s]">
                    {statsData.map((stat) => (
                        <div key={stat.title} className="mx-4 w-[300px]">
                            <Spotlight className="h-full p-6 group">
                                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                    <stat.icon className="h-24 w-24" />
                                </div>
                                <div className="flex justify-between items-start mb-4">
                                    <div className={cn("p-2 rounded-lg bg-white/5", stat.color)}>
                                        <stat.icon className="h-5 w-5" />
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <h3 className="text-2xl font-bold text-white">{stat.value}</h3>
                                    <p className="text-sm text-muted-foreground">{stat.title}</p>
                                </div>
                            </Spotlight>
                        </div>
                    ))}
                </Marquee>
                <div className="pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-background dark:from-background"></div>
                <div className="pointer-events-none absolute inset-y-0 right-0 w-1/3 bg-gradient-to-l from-background dark:from-background"></div>
            </div>

            {/* Main Content Grid */}
            <div className="grid gap-8 lg:grid-cols-3">
                {/* Pursuits Table */}
                <div className="lg:col-span-2 space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold text-white">My Pursuits</h3>
                        <span className="text-sm text-muted-foreground">
                            {filteredPursuits.length} of {pursuits.length} pursuits
                        </span>
                    </div>

                    {/* Search and Filters */}
                    <div className="space-y-3">
                        {/* Search Bar */}
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <input
                                type="text"
                                placeholder="Search pursuits..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className={cn(
                                    "w-full h-10 pl-10 pr-4 rounded-lg text-sm",
                                    "border border-white/10 bg-white/5 text-white",
                                    "placeholder:text-muted-foreground",
                                    "focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                                )}
                            />
                        </div>

                        {/* Filter Row */}
                        <div className="flex items-center gap-2 w-full">
                            <div className="flex-1">
                                <FilterDropdown
                                    label="Entity"
                                    options={filterOptions.entities}
                                    value={entityFilter}
                                    onChange={setEntityFilter}
                                />
                            </div>
                            <div className="flex-1">
                                <FilterDropdown
                                    label="Status"
                                    options={STATUS_OPTIONS}
                                    value={statusFilter}
                                    onChange={setStatusFilter}
                                />
                            </div>
                            <div className="flex-1">
                                <FilterDropdown
                                    label="Owner"
                                    options={filterOptions.owners}
                                    value={ownerFilter}
                                    onChange={setOwnerFilter}
                                />
                            </div>
                            <div className="flex-1">
                                <FilterDropdown
                                    label="Partner"
                                    options={filterOptions.partners}
                                    value={partnerFilter}
                                    onChange={setPartnerFilter}
                                />
                            </div>
                            <div className="flex-1">
                                <FilterDropdown
                                    label="Manager"
                                    options={filterOptions.managers}
                                    value={managerFilter}
                                    onChange={setManagerFilter}
                                />
                            </div>
                            {hasActiveFilters && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={clearAllFilters}
                                    className="text-muted-foreground hover:text-white shrink-0"
                                >
                                    Clear all
                                </Button>
                            )}
                        </div>
                    </div>

                    {/* Pursuits Table */}
                    <div className="rounded-lg border border-white/10 overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b border-white/10 bg-white/5">
                                        <th
                                            className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider cursor-pointer hover:text-white transition-colors"
                                            onClick={() => handleSort("entity_name")}
                                        >
                                            Entity Name <SortIcon field="entity_name" />
                                        </th>
                                        <th
                                            className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider cursor-pointer hover:text-white transition-colors"
                                            onClick={() => handleSort("status")}
                                        >
                                            Status <SortIcon field="status" />
                                        </th>
                                        <th
                                            className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider cursor-pointer hover:text-white transition-colors"
                                            onClick={() => handleSort("internal_pursuit_owner_name")}
                                        >
                                            Owner <SortIcon field="internal_pursuit_owner_name" />
                                        </th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                            Partner
                                        </th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                            Manager
                                        </th>
                                        <th
                                            className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider cursor-pointer hover:text-white transition-colors"
                                            onClick={() => handleSort("created_at")}
                                        >
                                            Created <SortIcon field="created_at" />
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {filteredPursuits.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                                                {hasActiveFilters ? (
                                                    <div>
                                                        <p>No pursuits match your filters</p>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={clearAllFilters}
                                                            className="mt-2 text-primary"
                                                        >
                                                            Clear filters
                                                        </Button>
                                                    </div>
                                                ) : (
                                                    <div>
                                                        <p>No pursuits yet</p>
                                                        <Button asChild variant="ghost" size="sm" className="mt-2 text-primary">
                                                            <Link href="/dashboard/pursuits/new">Create your first pursuit</Link>
                                                        </Button>
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredPursuits.map((pursuit) => (
                                            <tr
                                                key={pursuit.id}
                                                className="hover:bg-white/5 transition-colors cursor-pointer"
                                                onClick={() => window.location.href = `/dashboard/pursuits/${pursuit.id}`}
                                            >
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center gap-3">
                                                        <div className="h-8 w-8 rounded-full bg-gradient-to-br from-primary/20 to-blue-500/20 flex items-center justify-center text-primary font-semibold text-sm shrink-0">
                                                            {pursuit.entity_name.charAt(0).toUpperCase()}
                                                        </div>
                                                        <span className="font-medium text-white truncate max-w-[200px]">
                                                            {pursuit.entity_name}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span className={cn(
                                                        "px-2 py-1 rounded-full text-xs font-medium border",
                                                        STATUS_COLORS[pursuit.status] || STATUS_COLORS.draft
                                                    )}>
                                                        {formatStatus(pursuit.status)}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-sm text-muted-foreground">
                                                    {pursuit.internal_pursuit_owner_name || "-"}
                                                </td>
                                                <td className="px-4 py-3 text-sm text-muted-foreground">
                                                    {pursuit.pursuit_partner_name || "-"}
                                                </td>
                                                <td className="px-4 py-3 text-sm text-muted-foreground">
                                                    {pursuit.pursuit_manager_name || "-"}
                                                </td>
                                                <td className="px-4 py-3 text-sm text-muted-foreground">
                                                    {formatDate(pursuit.created_at)}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* Activity Feed */}
                <ScrollAnimation delay={0.4} animation="fade-in-right" className="space-y-6">
                    <h3 className="text-lg font-semibold text-white">Activity</h3>
                    <Spotlight className="p-6 h-full min-h-[400px]">
                        <div className="space-y-6">
                            {activities.length > 0 ? (
                                activities.map((activity, i) => (
                                    <div key={activity.id} className="flex space-x-3 relative">
                                        {i !== activities.length - 1 && <div className="absolute left-[15px] top-8 bottom-[-24px] w-0.5 bg-white/10" />}
                                        <div className="h-8 w-8 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center shrink-0 z-10">
                                            <div className="h-2 w-2 rounded-full bg-primary" />
                                        </div>
                                        <div>
                                            <p className="text-sm text-white">
                                                <span className="font-semibold">{activity.user_name?.split(' ')[0] || 'User'}</span>{' '}
                                                {formatAction(activity.action, activity.entity_type)}
                                                {activity.pursuit_name && (
                                                    <> for <span className="text-primary">{activity.pursuit_name}</span></>
                                                )}
                                            </p>
                                            <p className="text-xs text-muted-foreground mt-1">{formatTimeAgo(activity.created_at)}</p>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="text-center text-muted-foreground py-8">
                                    <p className="text-sm">No recent activity</p>
                                    <p className="text-xs mt-1">Activities will appear here as you work on pursuits</p>
                                </div>
                            )}
                        </div>

                        <div className="mt-8 pt-8 border-t border-white/10">
                            <h4 className="text-sm font-medium text-white mb-4">Weekly Activity</h4>
                            {/* Simple CSS Bar Chart */}
                            <div className="flex items-end justify-between h-32 space-x-2">
                                {[40, 70, 45, 90, 60, 80, 50].map((h, i) => (
                                    <div key={i} className="w-full bg-white/5 rounded-t-sm relative group hover:bg-white/10 transition-colors">
                                        <div
                                            className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-primary to-purple-500 rounded-t-sm transition-all duration-500"
                                            style={{ height: `${h}%` }}
                                        />
                                    </div>
                                ))}
                            </div>
                            <div className="flex justify-between mt-2 text-xs text-muted-foreground">
                                <span>M</span><span>T</span><span>W</span><span>T</span><span>F</span><span>S</span><span>S</span>
                            </div>
                        </div>
                    </Spotlight>
                </ScrollAnimation>
            </div>

            {/* New Pursuit Modal */}
            <Dialog open={showNewPursuitModal} onOpenChange={(open) => {
                setShowNewPursuitModal(open)
                if (!open) resetForm()
            }}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle>New Pursuit</DialogTitle>
                        <DialogDescription>
                            Enter the basic information for this pursuit. You can upload files after creation.
                        </DialogDescription>
                    </DialogHeader>

                    {createError && (
                        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center text-red-400">
                            <div className="h-2 w-2 rounded-full bg-red-500 mr-3" />
                            {createError}
                        </div>
                    )}

                    <form onSubmit={handleCreatePursuit} className="space-y-4">
                        {/* Entity Name */}
                        <ComboboxInput
                            label="Entity Name"
                            required
                            placeholder="Search or enter entity name..."
                            value={formData.entity_name}
                            onChange={(value) => setFormData({ ...formData, entity_name: value })}
                            options={entityOptions}
                            onSearch={setEntitySearch}
                            isLoading={isLoadingEntities}
                            allowCustomValue={true}
                        />

                        {/* Internal Owner */}
                        <ComboboxInput
                            label="Internal Owner"
                            required
                            placeholder="Search or enter owner name..."
                            value={formData.internal_pursuit_owner_name}
                            onChange={(value, email) => setFormData({
                                ...formData,
                                internal_pursuit_owner_name: value,
                                internal_pursuit_owner_email: email || formData.internal_pursuit_owner_email
                            })}
                            options={userOptions}
                            onSearch={setOwnerSearch}
                            isLoading={isLoadingUsers}
                            allowCustomValue={true}
                        />

                        {/* Pursuit Partner (optional) */}
                        <ComboboxInput
                            label="Pursuit Partner"
                            placeholder="Search or enter partner name..."
                            value={formData.pursuit_partner_name}
                            onChange={(value, email) => setFormData({
                                ...formData,
                                pursuit_partner_name: value,
                                pursuit_partner_email: email || formData.pursuit_partner_email
                            })}
                            options={partnerOptions}
                            onSearch={setPartnerSearch}
                            isLoading={isLoadingPartners}
                            allowCustomValue={true}
                        />

                        {/* Pursuit Manager (optional) */}
                        <ComboboxInput
                            label="Pursuit Manager"
                            placeholder="Search or enter manager name..."
                            value={formData.pursuit_manager_name}
                            onChange={(value, email) => setFormData({
                                ...formData,
                                pursuit_manager_name: value,
                                pursuit_manager_email: email || formData.pursuit_manager_email
                            })}
                            options={managerOptions}
                            onSearch={setManagerSearch}
                            isLoading={isLoadingManagers}
                            allowCustomValue={true}
                        />

                        <div className="pt-4 flex justify-end space-x-3">
                            <Button
                                type="button"
                                variant="ghost"
                                onClick={() => setShowNewPursuitModal(false)}
                                className="text-muted-foreground hover:text-white hover:bg-white/10"
                            >
                                Cancel
                            </Button>
                            <Button
                                type="submit"
                                disabled={isCreating || !formData.entity_name || !formData.internal_pursuit_owner_name}
                                className="bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20"
                            >
                                {isCreating ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Creating...
                                    </>
                                ) : (
                                    <>
                                        <Upload className="mr-2 h-4 w-4" />
                                        Create Pursuit
                                    </>
                                )}
                            </Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    )
}
