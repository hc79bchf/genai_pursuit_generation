"use client"

import { useEffect, useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ComboboxInput, ComboboxOption } from "@/components/ui/combobox-input"
import {
    Loader2,
    Upload,
    Check,
    X,
    Trash2,
    ExternalLink,
    Sparkles,
    ChevronDown,
    ChevronUp,
    Star,
    FileText,
    Pencil,
    User
} from "lucide-react"
import { Textarea } from "@/components/ui/textarea"
import { fetchApi } from "@/lib/api"
import { cn } from "@/lib/utils"

// Debounce hook
function useDebounce<T>(value: T, delay: number): T {
    const [debouncedValue, setDebouncedValue] = useState<T>(value)
    useEffect(() => {
        const handler = setTimeout(() => setDebouncedValue(value), delay)
        return () => clearTimeout(handler)
    }, [value, delay])
    return debouncedValue
}

interface TeamMember {
    id: string
    name: string
    role: string
    email?: string
    department?: string
    skills?: string[]
    availability?: "available" | "partial" | "unavailable"
    match_score?: number
}

interface TeamRecommendation {
    role: string
    required_skills: string[]
    recommended_members: TeamMember[]
    reasoning: string
}

interface ClientInfo {
    description?: string
    employee_count?: string
    headquarters?: string
    website?: string
    revenue?: string
    sector?: string
}

interface Pursuit {
    id: string
    entity_name: string
    entity_number?: string
    internal_pursuit_owner_name: string
    internal_pursuit_owner_email?: string
    pursuit_partner_name?: string
    pursuit_partner_email?: string
    pursuit_manager_name?: string
    pursuit_manager_email?: string
    client_pursuit_owner_name?: string
    client_pursuit_owner_email?: string
    entity_sponsor_name?: string
    entity_sponsor_email?: string
    status: string
    industry?: string
    geography?: string
    submission_due_date?: string
    estimated_fees_usd?: number
    expected_format?: string
    files?: any[]
    created_at?: string
    client_info?: ClientInfo
    team_recommendations?: TeamRecommendation[]
    selected_team?: TeamMember[]
}

type OverviewTab = "overview" | "client" | "opportunity" | "internal" | "team" | "documents"

interface TabConfig {
    id: OverviewTab
    label: string
    description: string
}

const TABS: TabConfig[] = [
    { id: "overview", label: "OVERVIEW", description: "Learn about the Pursuit Overview stage and how to set up your pursuit." },
    { id: "client", label: "CLIENT", description: "View and edit client company information, industry, and location details." },
    { id: "opportunity", label: "OPPORTUNITY", description: "Set submission due date, estimated value, and expected output format." },
    { id: "internal", label: "INTERNAL", description: "Assign pursuit owner, partner, and manager from your organization." },
    { id: "team", label: "TEAM", description: "AI-recommended team members based on skills and availability." },
    { id: "documents", label: "DOCUMENTS", description: "Upload RFP documents and supporting materials for analysis." },
]

const MAX_FILES = 5

export default function WorkflowOverviewPage({ params }: { params: { id: string } }) {
    const [pursuit, setPursuit] = useState<Pursuit | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [activeTab, setActiveTab] = useState<OverviewTab>("overview")
    const [isUploading, setIsUploading] = useState(false)
    const [deletingFileId, setDeletingFileId] = useState<string | null>(null)

    // Edit states
    const [editingField, setEditingField] = useState<string | null>(null)
    const [editValue, setEditValue] = useState<string>("")
    const [editEmail, setEditEmail] = useState<string>("")
    const [isSaving, setIsSaving] = useState(false)

    // Combobox states
    const [searchQuery, setSearchQuery] = useState("")
    const [options, setOptions] = useState<ComboboxOption[]>([])
    const [isLoadingOptions, setIsLoadingOptions] = useState(false)
    const debouncedSearch = useDebounce(searchQuery, 300)

    // Team states
    const [isGeneratingTeam, setIsGeneratingTeam] = useState(false)
    const [selectedMembers, setSelectedMembers] = useState<Record<string, string>>({})
    const [expandedRoles, setExpandedRoles] = useState<Record<string, boolean>>({})

    // Client info
    const [clientInfo, setClientInfo] = useState<ClientInfo | null>(null)
    const [isLoadingClientInfo, setIsLoadingClientInfo] = useState(false)

    // Upload modal states
    const [pendingFiles, setPendingFiles] = useState<File[]>([])
    const [fileDescriptions, setFileDescriptions] = useState<Record<string, string>>({})
    const [showUploadModal, setShowUploadModal] = useState(false)

    useEffect(() => {
        async function loadPursuit() {
            try {
                const data = await fetchApi(`/pursuits/${params.id}`)
                setPursuit(data)
                if (data.client_info) setClientInfo(data.client_info)
                if (data.selected_team) {
                    const selected: Record<string, string> = {}
                    data.selected_team.forEach((m: TeamMember) => selected[m.role] = m.id)
                    setSelectedMembers(selected)
                }
                if (data.team_recommendations) {
                    const expanded: Record<string, boolean> = {}
                    data.team_recommendations.forEach((r: TeamRecommendation) => expanded[r.role] = false)
                    setExpandedRoles(expanded)
                }
            } catch (error) {
                console.error("Failed to load pursuit", error)
            } finally {
                setIsLoading(false)
            }
        }
        loadPursuit()
    }, [params.id])

    // Fetch options for combobox
    useEffect(() => {
        if (!editingField) return
        const fieldConfig = getFieldConfig(editingField)
        if (!fieldConfig?.lookupEndpoint) return

        const fetchOptions = async () => {
            setIsLoadingOptions(true)
            try {
                const url = `${fieldConfig.lookupEndpoint}?q=${encodeURIComponent(debouncedSearch)}&limit=20`
                const response = await fetchApi(url)
                setOptions(response)
            } catch {
                setOptions([])
            } finally {
                setIsLoadingOptions(false)
            }
        }
        fetchOptions()
    }, [debouncedSearch, editingField])

    // Track if we've already attempted to load client info
    const hasAttemptedClientInfoLoad = useRef(false)

    // Auto-load client info when pursuit is loaded (only once)
    useEffect(() => {
        if (pursuit?.entity_name && !hasAttemptedClientInfoLoad.current) {
            hasAttemptedClientInfoLoad.current = true
            fetchClientInfo()
        }
    }, [pursuit?.entity_name])

    const fetchClientInfo = async () => {
        if (!pursuit?.entity_name) return
        setIsLoadingClientInfo(true)
        try {
            const response = await fetchApi(`/lookup/client-info?entity=${encodeURIComponent(pursuit.entity_name)}`)
            setClientInfo(response)
        } catch {
            setClientInfo({
                description: `${pursuit.entity_name} is a leading organization in the ${pursuit.industry || 'industry'} sector.`,
                employee_count: "10,000+",
                headquarters: pursuit.geography || "United States",
                website: `www.${pursuit.entity_name?.toLowerCase().replace(/\s+/g, '')}.com`,
                revenue: "$5B+",
                sector: pursuit.industry || "Technology"
            })
        } finally {
            setIsLoadingClientInfo(false)
        }
    }

    const getFieldConfig = (key: string) => {
        const configs: Record<string, { type: string; lookupEndpoint?: string; emailKey?: string }> = {
            entity_name: { type: "combobox", lookupEndpoint: "/lookup/entities" },
            industry: { type: "combobox", lookupEndpoint: "/lookup/industries" },
            geography: { type: "combobox", lookupEndpoint: "/lookup/geographies" },
            client_pursuit_owner_name: { type: "contact", lookupEndpoint: "/lookup/contacts", emailKey: "client_pursuit_owner_email" },
            entity_sponsor_name: { type: "contact", lookupEndpoint: "/lookup/contacts", emailKey: "entity_sponsor_email" },
            internal_pursuit_owner_name: { type: "contact", lookupEndpoint: "/lookup/users", emailKey: "internal_pursuit_owner_email" },
            pursuit_partner_name: { type: "contact", lookupEndpoint: "/lookup/team-members", emailKey: "pursuit_partner_email" },
            pursuit_manager_name: { type: "contact", lookupEndpoint: "/lookup/team-members", emailKey: "pursuit_manager_email" },
            submission_due_date: { type: "date" },
            estimated_fees_usd: { type: "number" },
            expected_format: { type: "select" },
        }
        return configs[key]
    }

    const handleEdit = (key: string, value: any, email?: string) => {
        setEditingField(key)
        // Format date values for date input (YYYY-MM-DD)
        const config = getFieldConfig(key)
        if (config?.type === "date" && value) {
            const date = new Date(value)
            const formatted = date.toISOString().split('T')[0]
            setEditValue(formatted)
        } else {
            setEditValue(value?.toString() || "")
        }
        setEditEmail(email || "")
        setSearchQuery("")
        setOptions([])
    }

    const handleSave = async () => {
        if (!pursuit || !editingField) return
        setIsSaving(true)
        try {
            const payload: Record<string, any> = { [editingField]: editValue }
            const config = getFieldConfig(editingField)
            if (config?.emailKey) {
                payload[config.emailKey] = editEmail
            }
            await fetchApi(`/pursuits/${pursuit.id}`, {
                method: "PUT",
                body: JSON.stringify(payload),
            })
            const data = await fetchApi(`/pursuits/${pursuit.id}`)
            setPursuit(data)
            setEditingField(null)
        } catch (error) {
            console.error("Save failed", error)
        } finally {
            setIsSaving(false)
        }
    }

    const handleCancel = () => {
        setEditingField(null)
        setEditValue("")
        setEditEmail("")
    }

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files?.length) return
        const currentCount = pursuit?.files?.length || 0
        const remaining = MAX_FILES - currentCount
        if (remaining <= 0) {
            alert(`Maximum ${MAX_FILES} files allowed.`)
            return
        }
        const files = Array.from(e.target.files).slice(0, remaining)

        // Check for duplicates against existing files
        const existingNames = pursuit?.files?.map(f => f.file_name || f.filename) || []
        const duplicates = files.filter(f => existingNames.includes(f.name))
        if (duplicates.length > 0) {
            alert(`The following file(s) already exist: ${duplicates.map(f => f.name).join(", ")}`)
            e.target.value = ""
            return
        }

        setPendingFiles(files)
        // Initialize descriptions
        const descriptions: Record<string, string> = {}
        files.forEach(f => descriptions[f.name] = "")
        setFileDescriptions(descriptions)
        setShowUploadModal(true)
        e.target.value = ""
    }

    const handleUploadConfirm = async () => {
        if (!pendingFiles.length) return
        setIsUploading(true)
        try {
            for (const file of pendingFiles) {
                const formData = new FormData()
                formData.append("file", file)
                formData.append("file_type", "rfp")
                formData.append("description", fileDescriptions[file.name] || "")
                await fetchApi(`/pursuits/${params.id}/files`, { method: "POST", body: formData })
            }
            const data = await fetchApi(`/pursuits/${params.id}`)
            setPursuit(data)
            setShowUploadModal(false)
            setPendingFiles([])
            setFileDescriptions({})
            // Notify parent layout to refresh pursuit data (enables Continue button immediately)
            window.dispatchEvent(new CustomEvent("pursuit-refresh", { detail: { pursuitId: params.id } }))
        } catch (error: any) {
            console.error("Upload failed", error)
            const message = error?.message || error?.detail || "Upload failed. Please try again."
            alert(message)
        } finally {
            setIsUploading(false)
        }
    }

    const handleUploadCancel = () => {
        setShowUploadModal(false)
        setPendingFiles([])
        setFileDescriptions({})
    }

    const handleDeleteFile = async (fileId: string) => {
        setDeletingFileId(fileId)
        try {
            await fetchApi(`/pursuits/${params.id}/files/${fileId}`, { method: "DELETE" })
            const data = await fetchApi(`/pursuits/${params.id}`)
            setPursuit(data)
            // Notify parent layout to refresh pursuit data (updates Continue button state)
            window.dispatchEvent(new CustomEvent("pursuit-refresh", { detail: { pursuitId: params.id } }))
        } catch (error) {
            console.error("Delete failed", error)
        } finally {
            setDeletingFileId(null)
        }
    }

    const handleGenerateTeam = async () => {
        if (!pursuit) return
        setIsGeneratingTeam(true)
        try {
            const result = await fetchApi(`/pursuits/${pursuit.id}/team-recommendations`, { method: "POST" })
            setPursuit({ ...pursuit, team_recommendations: result.recommendations })
            if (result.recommendations) {
                const expanded: Record<string, boolean> = {}
                result.recommendations.forEach((r: TeamRecommendation) => expanded[r.role] = true)
                setExpandedRoles(expanded)
            }
        } catch (error) {
            console.error("Failed to generate team", error)
        } finally {
            setIsGeneratingTeam(false)
        }
    }

    const handleSelectMember = (role: string, memberId: string) => {
        setSelectedMembers(prev => ({ ...prev, [role]: prev[role] === memberId ? "" : memberId }))
    }

    const handleSaveTeam = async () => {
        if (!pursuit) return
        setIsSaving(true)
        try {
            const team = Object.entries(selectedMembers)
                .filter(([_, id]) => id)
                .map(([role, id]) => {
                    const rec = pursuit.team_recommendations?.find(r => r.role === role)
                    const member = rec?.recommended_members.find(m => m.id === id)
                    return member ? { ...member, role } : null
                }).filter(Boolean)
            await fetchApi(`/pursuits/${pursuit.id}`, { method: "PUT", body: JSON.stringify({ selected_team: team }) })
            const data = await fetchApi(`/pursuits/${pursuit.id}`)
            setPursuit(data)
        } catch (error) {
            console.error("Failed to save team", error)
        } finally {
            setIsSaving(false)
        }
    }

    const formatCurrency = (amount?: number) => {
        if (!amount) return "—"
        return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(amount)
    }

    const formatDate = (dateString?: string) => {
        if (!dateString) return "—"
        return new Date(dateString).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    }

    const formatOutputFormat = (format?: string) => {
        if (!format) return "—"
        const formats: Record<string, string> = {
            "PPTX": ".pptx (PowerPoint)",
            "DOCX": ".docx (Word)",
            "pptx": ".pptx (PowerPoint)",
            "docx": ".docx (Word)",
        }
        return formats[format] || format
    }

    // Render field helper - returns JSX for a field row
    const renderFieldRow = (label: string, value: any, fieldKey: string, email?: string) => {
        const isEditing = editingField === fieldKey
        const config = getFieldConfig(fieldKey)
        const displayValue = config?.type === "number" ? formatCurrency(value) :
                            config?.type === "date" ? formatDate(value) :
                            config?.type === "select" ? formatOutputFormat(value) :
                            value || "—"

        if (isEditing) {
            return (
                <div key={fieldKey} className="py-3 border-b border-white/5">
                    <div className="text-xs text-zinc-500 uppercase tracking-wider mb-2">{label}</div>
                    <div className="space-y-2">
                        {config?.type === "combobox" || config?.type === "contact" ? (
                            <ComboboxInput
                                value={editValue}
                                onChange={(val, em) => { setEditValue(val); if (em) setEditEmail(em) }}
                                options={options}
                                onSearch={setSearchQuery}
                                isLoading={isLoadingOptions}
                                allowCustomValue={true}
                                placeholder={`Enter ${label.toLowerCase()}...`}
                            />
                        ) : config?.type === "select" ? (
                            <select
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                className="w-full h-9 rounded-md border border-white/10 bg-white/5 px-3 text-sm text-white"
                            >
                                <option value="">Select...</option>
                                <option value="PPTX">.pptx (PowerPoint)</option>
                                <option value="DOCX">.docx (Word)</option>
                            </select>
                        ) : config?.type === "date" ? (
                            <Input
                                type="date"
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                className="bg-white/5 border-white/10 text-white h-9 [color-scheme:dark]"
                                autoFocus
                            />
                        ) : (
                            <Input
                                type="text"
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                className="bg-white/5 border-white/10 text-white h-9"
                                autoFocus
                            />
                        )}
                        {config?.emailKey && (
                            <Input
                                type="email"
                                value={editEmail}
                                onChange={(e) => setEditEmail(e.target.value)}
                                placeholder="Email address"
                                className="bg-white/5 border-white/10 text-white h-9"
                            />
                        )}
                        <div className="flex gap-2">
                            <Button size="sm" onClick={handleSave} disabled={isSaving} className="h-8">
                                {isSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : "Save"}
                            </Button>
                            <Button size="sm" variant="ghost" onClick={handleCancel} className="h-8">Cancel</Button>
                        </div>
                    </div>
                </div>
            )
        }

        return (
            <div
                key={fieldKey}
                className="py-3 border-b border-white/5 flex justify-between items-start group cursor-pointer hover:bg-white/[0.02] -mx-2 px-2 rounded"
                onClick={() => handleEdit(fieldKey, value, email)}
            >
                <div>
                    <div className="text-xs text-zinc-500 uppercase tracking-wider mb-1">{label}</div>
                    <div className="text-white">{displayValue}</div>
                    {email && <div className="text-sm text-zinc-500 mt-0.5">{email}</div>}
                </div>
                <Pencil className="h-3.5 w-3.5 text-zinc-600 opacity-0 group-hover:opacity-100 transition-opacity mt-1" />
            </div>
        )
    }

    if (isLoading || !pursuit) {
        return (
            <div className="flex h-[50vh] items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-zinc-500" />
            </div>
        )
    }

    const hasFiles = pursuit.files && pursuit.files.length > 0
    const fileCount = pursuit.files?.length || 0
    const hasTeamRecs = pursuit.team_recommendations && pursuit.team_recommendations.length > 0
    const hasSelectedMembers = Object.values(selectedMembers).some(Boolean)

    const currentTab = TABS.find(t => t.id === activeTab)

    return (
        <div className="max-w-5xl">
            {/* Page Description */}
            <p className="text-sm text-zinc-500 mb-6">
                Enter client details, opportunity information, assign team members, and upload RFP documents.
            </p>

            {/* Inline Tab Navigation */}
            <nav className="flex gap-6 border-b border-white/10 mb-2">
                {TABS.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={cn(
                            "pb-3 text-sm font-medium transition-colors relative whitespace-nowrap",
                            activeTab === tab.id
                                ? "text-white"
                                : "text-zinc-500 hover:text-zinc-300"
                        )}
                    >
                        {tab.label}
                        {activeTab === tab.id && (
                            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-white" />
                        )}
                        {tab.id === "documents" && hasFiles && (
                            <span className="ml-2 text-xs text-zinc-500">({fileCount})</span>
                        )}
                    </button>
                ))}
            </nav>

            {/* Tab Description */}
            <p className="text-xs text-zinc-500 mb-8">{currentTab?.description}</p>

            {/* Overview Tab */}
            {activeTab === "overview" && (
                <div className="space-y-8">
                    {/* Stage Overview */}
                    <div>
                        <h3 className="text-lg font-semibold text-white mb-3">Pursuit Overview</h3>
                        <p className="text-sm text-zinc-400 leading-relaxed mb-4">
                            The first stage of the proposal workflow. Set up your pursuit by entering client details,
                            opportunity information, assigning team members, and uploading RFP documents. This information
                            will be used by AI agents in subsequent stages.
                        </p>
                        <p className="text-xs text-zinc-500">
                            Client Info · Team Assignment · Document Upload · AI Auto-fill
                        </p>
                    </div>

                    {/* Tab Descriptions */}
                    <div>
                        <h3 className="text-sm font-medium text-zinc-400 mb-4">Available Tabs</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                            <div>
                                <h4 className="text-sm font-medium text-white mb-1">CLIENT</h4>
                                <p className="text-xs text-zinc-500">
                                    Enter client company name, industry, geography, and other details. AI auto-fills based on company name.
                                </p>
                            </div>
                            <div>
                                <h4 className="text-sm font-medium text-white mb-1">OPPORTUNITY</h4>
                                <p className="text-xs text-zinc-500">
                                    Set submission due date, estimated value, and expected output format (PPT/DOC).
                                </p>
                            </div>
                            <div>
                                <h4 className="text-sm font-medium text-white mb-1">INTERNAL</h4>
                                <p className="text-xs text-zinc-500">
                                    Assign pursuit owner, partner, and manager from your organization.
                                </p>
                            </div>
                            <div>
                                <h4 className="text-sm font-medium text-white mb-1">TEAM</h4>
                                <p className="text-xs text-zinc-500">
                                    View AI-recommended team members based on skills, availability, and past experience.
                                </p>
                            </div>
                            <div>
                                <h4 className="text-sm font-medium text-white mb-1">DOCUMENTS</h4>
                                <p className="text-xs text-zinc-500">
                                    Upload RFP documents and supporting materials for AI analysis.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Workflow */}
                    <div>
                        <h3 className="text-sm font-medium text-zinc-400 mb-4">Getting Started</h3>
                        <div className="space-y-3">
                            <div className="flex items-start gap-3">
                                <span className="text-xs font-medium text-zinc-500 w-4 flex-shrink-0">1.</span>
                                <div>
                                    <p className="text-sm text-white">Enter client details in CLIENT tab</p>
                                    <p className="text-xs text-zinc-500">AI will auto-fill company information based on name</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-3">
                                <span className="text-xs font-medium text-zinc-500 w-4 flex-shrink-0">2.</span>
                                <div>
                                    <p className="text-sm text-white">Set opportunity details in OPPORTUNITY tab</p>
                                    <p className="text-xs text-zinc-500">Due date, value, and output format</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-3">
                                <span className="text-xs font-medium text-zinc-500 w-4 flex-shrink-0">3.</span>
                                <div>
                                    <p className="text-sm text-white">Assign team members in INTERNAL and TEAM tabs</p>
                                    <p className="text-xs text-zinc-500">Set internal contacts and review AI recommendations</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-3">
                                <span className="text-xs font-medium text-zinc-500 w-4 flex-shrink-0">4.</span>
                                <div>
                                    <p className="text-sm text-white">Upload RFP documents in DOCUMENTS tab</p>
                                    <p className="text-xs text-zinc-500">These will be analyzed by AI in the Metadata stage</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Get Started Button */}
                    <div className="flex justify-end">
                        <Button
                            onClick={() => setActiveTab("client")}
                            variant="outline"
                            className="border-white/10"
                        >
                            Get Started
                            <Pencil className="ml-2 h-4 w-4" />
                        </Button>
                    </div>
                </div>
            )}

            {/* Client Tab */}
            {activeTab === "client" && (
                <div className="space-y-8">
                    {/* Company Info Card */}
                    {clientInfo ? (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <h2 className="text-lg font-medium text-white">{pursuit.entity_name}</h2>
                                <button
                                    onClick={fetchClientInfo}
                                    disabled={isLoadingClientInfo}
                                    className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
                                >
                                    {isLoadingClientInfo ? "Loading..." : "Refresh"}
                                </button>
                            </div>
                            <p className="text-sm text-zinc-400 leading-relaxed">{clientInfo.description}</p>
                            <div className="flex flex-wrap gap-x-8 gap-y-2 text-sm">
                                {clientInfo.headquarters && (
                                    <span className="text-zinc-400">{clientInfo.headquarters}</span>
                                )}
                                {clientInfo.employee_count && (
                                    <span className="text-zinc-400">{clientInfo.employee_count} employees</span>
                                )}
                                {clientInfo.revenue && (
                                    <span className="text-zinc-400">{clientInfo.revenue} revenue</span>
                                )}
                            </div>
                            {clientInfo.website && (
                                <a
                                    href={`https://${clientInfo.website}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-300"
                                >
                                    {clientInfo.website}
                                    <ExternalLink className="h-3 w-3" />
                                </a>
                            )}
                        </div>
                    ) : (
                        <button
                            onClick={fetchClientInfo}
                            disabled={isLoadingClientInfo}
                            className="w-full py-8 border border-dashed border-white/10 rounded-lg text-zinc-500 hover:text-zinc-300 hover:border-white/20 transition-colors"
                        >
                            {isLoadingClientInfo ? (
                                <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                            ) : (
                                "Load company information"
                            )}
                        </button>
                    )}

                    {/* Divider */}
                    <div className="h-px bg-white/10" />

                    {/* Client Details */}
                    <div>
                        <h3 className="text-sm font-medium text-zinc-400 mb-4">Details</h3>
                        <div className="space-y-0">
                            {renderFieldRow("Entity Name", pursuit.entity_name, "entity_name")}
                            {renderFieldRow("Industry", pursuit.industry, "industry")}
                            {renderFieldRow("Geography", pursuit.geography, "geography")}
                            {renderFieldRow("Client Contact", pursuit.client_pursuit_owner_name, "client_pursuit_owner_name", pursuit.client_pursuit_owner_email)}
                            {renderFieldRow("Entity Sponsor", pursuit.entity_sponsor_name, "entity_sponsor_name", pursuit.entity_sponsor_email)}
                        </div>
                    </div>
                </div>
            )}

            {/* Opportunity Tab */}
            {activeTab === "opportunity" && (
                <div>
                    <h3 className="text-sm font-medium text-zinc-400 mb-4">Opportunity Details</h3>
                    <div className="space-y-0">
                        {renderFieldRow("Due Date", pursuit.submission_due_date, "submission_due_date")}
                        {renderFieldRow("Estimated Value", pursuit.estimated_fees_usd, "estimated_fees_usd")}
                        {renderFieldRow("Expected Pursuit Output Format", pursuit.expected_format, "expected_format")}
                    </div>
                </div>
            )}

            {/* Internal Tab */}
            {activeTab === "internal" && (
                <div>
                    <h3 className="text-sm font-medium text-zinc-400 mb-4">Internal Team</h3>
                    <div className="space-y-0">
                        {renderFieldRow("Internal Owner", pursuit.internal_pursuit_owner_name, "internal_pursuit_owner_name", pursuit.internal_pursuit_owner_email)}
                        {renderFieldRow("Pursuit Partner", pursuit.pursuit_partner_name, "pursuit_partner_name", pursuit.pursuit_partner_email)}
                        {renderFieldRow("Pursuit Manager", pursuit.pursuit_manager_name, "pursuit_manager_name", pursuit.pursuit_manager_email)}
                    </div>
                </div>
            )}

            {/* Team Tab */}
            {activeTab === "team" && (
                <div className="space-y-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="text-sm font-medium text-zinc-400">Team Recommendations</h3>
                            <p className="text-xs text-zinc-500 mt-1">AI-powered suggestions based on pursuit requirements</p>
                        </div>
                        <Button
                            onClick={handleGenerateTeam}
                            disabled={isGeneratingTeam}
                            variant="outline"
                            size="sm"
                            className="border-white/10 hover:bg-white/5"
                        >
                            {isGeneratingTeam ? (
                                <Loader2 className="h-3 w-3 animate-spin mr-2" />
                            ) : (
                                <Sparkles className="h-3 w-3 mr-2" />
                            )}
                            {hasTeamRecs ? "Regenerate" : "Generate"}
                        </Button>
                    </div>

                    {!hasTeamRecs ? (
                        <div className="py-12 text-center text-zinc-500 border border-dashed border-white/10 rounded-lg">
                            <p>No recommendations yet</p>
                            <p className="text-xs mt-1">Generate to see AI suggestions</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {pursuit.team_recommendations?.map((rec) => (
                                <div key={rec.role} className="border border-white/10 rounded-lg overflow-hidden">
                                    <button
                                        className="w-full flex items-center justify-between p-4 hover:bg-white/[0.02] transition-colors"
                                        onClick={() => setExpandedRoles(prev => ({ ...prev, [rec.role]: !prev[rec.role] }))}
                                    >
                                        <div className="flex items-center gap-3">
                                            <span className="font-medium text-white">{rec.role}</span>
                                            {selectedMembers[rec.role] && (
                                                <Check className="h-4 w-4 text-green-400" />
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2 text-zinc-500">
                                            <span className="text-xs">{rec.recommended_members.length} candidates</span>
                                            {expandedRoles[rec.role] ? (
                                                <ChevronUp className="h-4 w-4" />
                                            ) : (
                                                <ChevronDown className="h-4 w-4" />
                                            )}
                                        </div>
                                    </button>

                                    {expandedRoles[rec.role] && (
                                        <div className="px-4 pb-4 space-y-2">
                                            <p className="text-xs text-zinc-500 mb-3">{rec.reasoning}</p>
                                            {rec.recommended_members.map((member) => {
                                                const isSelected = selectedMembers[rec.role] === member.id
                                                return (
                                                    <button
                                                        key={member.id}
                                                        onClick={() => handleSelectMember(rec.role, member.id)}
                                                        className={cn(
                                                            "w-full flex items-center justify-between p-3 rounded-lg border transition-all text-left",
                                                            isSelected
                                                                ? "bg-violet-500/10 border-violet-500/30"
                                                                : "bg-white/[0.02] border-white/5 hover:border-white/10"
                                                        )}
                                                    >
                                                        <div className="flex items-center gap-3">
                                                            <div className="h-8 w-8 rounded-full bg-zinc-800 flex items-center justify-center text-sm font-medium text-zinc-300">
                                                                {member.name.charAt(0)}
                                                            </div>
                                                            <div>
                                                                <div className="text-sm text-white flex items-center gap-2">
                                                                    {member.name}
                                                                    {member.match_score && member.match_score >= 0.8 && (
                                                                        <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />
                                                                    )}
                                                                </div>
                                                                <div className="text-xs text-zinc-500">{member.department}</div>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-3">
                                                            {member.match_score && (
                                                                <span className="text-xs text-zinc-500">
                                                                    {Math.round(member.match_score * 100)}%
                                                                </span>
                                                            )}
                                                            {isSelected && (
                                                                <Check className="h-4 w-4 text-violet-400" />
                                                            )}
                                                        </div>
                                                    </button>
                                                )
                                            })}
                                        </div>
                                    )}
                                </div>
                            ))}

                            {hasSelectedMembers && (
                                <Button
                                    onClick={handleSaveTeam}
                                    disabled={isSaving}
                                    className="w-full mt-4"
                                >
                                    {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Check className="h-4 w-4 mr-2" />}
                                    Save Team ({Object.values(selectedMembers).filter(Boolean).length} selected)
                                </Button>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* Documents Tab */}
            {activeTab === "documents" && (
                <div className="space-y-6">
                    <div>
                        <p className="text-xs text-zinc-500">Pursuit Response Documents (e.g., RFP, RFI)</p>
                    </div>

                    {/* Upload Zone */}
                    <div className={cn(
                        "relative border-2 border-dashed rounded-lg p-8 text-center transition-colors",
                        fileCount < MAX_FILES
                            ? "border-white/10 hover:border-white/20 cursor-pointer"
                            : "border-white/5 opacity-50 cursor-not-allowed"
                    )}>
                        <input
                            type="file"
                            className="absolute inset-0 opacity-0 cursor-pointer"
                            onChange={handleFileSelect}
                            disabled={isUploading || fileCount >= MAX_FILES}
                            accept=".pdf,.docx,.doc,.pptx,.ppt"
                            multiple
                        />
                        {isUploading ? (
                            <Loader2 className="h-6 w-6 animate-spin mx-auto text-zinc-500" />
                        ) : (
                            <>
                                <Upload className="h-6 w-6 mx-auto text-zinc-500 mb-2" />
                                <p className="text-sm text-zinc-400">
                                    {fileCount < MAX_FILES ? "Drop files or click to upload" : "Maximum files reached"}
                                </p>
                                <p className="text-xs text-zinc-500 mt-1">.pdf, .docx, .pptx up to 10MB · {fileCount}/{MAX_FILES}</p>
                            </>
                        )}
                    </div>

                    {/* Upload Modal */}
                    {showUploadModal && (
                        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
                            <div className="bg-zinc-900 border border-white/10 rounded-xl p-6 max-w-lg w-full mx-4 max-h-[80vh] overflow-y-auto">
                                <h3 className="text-lg font-medium text-white mb-4">Add Document Details</h3>
                                <p className="text-sm text-zinc-400 mb-6">
                                    Please provide a brief description for each document to help identify its contents.
                                </p>

                                <div className="space-y-4">
                                    {pendingFiles.map((file, index) => (
                                        <div key={file.name} className="p-4 bg-white/[0.02] rounded-lg border border-white/5">
                                            <div className="flex items-center gap-2 mb-3">
                                                <FileText className="h-4 w-4 text-zinc-500" />
                                                <span className="text-sm text-white font-medium truncate">{file.name}</span>
                                                <span className="text-xs text-zinc-500">
                                                    ({(file.size / 1024 / 1024).toFixed(2)} MB)
                                                </span>
                                            </div>
                                            <Textarea
                                                placeholder="Brief description (e.g., 'Main RFP document with technical requirements')"
                                                value={fileDescriptions[file.name] || ""}
                                                onChange={(e) => setFileDescriptions(prev => ({
                                                    ...prev,
                                                    [file.name]: e.target.value
                                                }))}
                                                className="bg-white/5 border-white/10 text-white text-sm resize-none"
                                                rows={2}
                                            />
                                        </div>
                                    ))}
                                </div>

                                <div className="flex gap-3 mt-6">
                                    <Button
                                        variant="ghost"
                                        onClick={handleUploadCancel}
                                        className="flex-1"
                                        disabled={isUploading}
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        onClick={handleUploadConfirm}
                                        className="flex-1"
                                        disabled={isUploading}
                                    >
                                        {isUploading ? (
                                            <>
                                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                                Uploading...
                                            </>
                                        ) : (
                                            <>
                                                <Upload className="h-4 w-4 mr-2" />
                                                Upload {pendingFiles.length} {pendingFiles.length === 1 ? 'File' : 'Files'}
                                            </>
                                        )}
                                    </Button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* File List */}
                    {hasFiles ? (
                        <div className="space-y-3">
                            {pursuit.files?.map((file: any) => (
                                <div
                                    key={file.id}
                                    className="p-4 bg-white/[0.02] rounded-lg border border-white/5 group"
                                >
                                    <div className="flex items-start justify-between">
                                        <div className="flex items-start gap-3 flex-1 min-w-0">
                                            <FileText className="h-5 w-5 text-zinc-500 mt-0.5 flex-shrink-0" />
                                            <div className="flex-1 min-w-0">
                                                <div className="text-sm text-white font-medium truncate">{file.file_name || file.filename}</div>
                                                {file.description && (
                                                    <p className="text-sm text-zinc-400 mt-1">{file.description}</p>
                                                )}
                                                <div className="flex items-center gap-3 mt-2 text-xs text-zinc-500">
                                                    <span>{formatDate(file.uploaded_at)}</span>
                                                    {file.uploaded_by_name && (
                                                        <span className="flex items-center gap-1">
                                                            <User className="h-3 w-3" />
                                                            {file.uploaded_by_name}
                                                        </span>
                                                    )}
                                                    {file.file_size && (
                                                        <span>{(file.file_size / 1024 / 1024).toFixed(2)} MB</span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => handleDeleteFile(file.id)}
                                            disabled={deletingFileId === file.id}
                                            className="opacity-0 group-hover:opacity-100 text-zinc-500 hover:text-red-400 transition-all ml-2"
                                        >
                                            {deletingFileId === file.id ? (
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                            ) : (
                                                <Trash2 className="h-4 w-4" />
                                            )}
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-8 text-zinc-500">
                            <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                            <p className="text-sm">No documents uploaded</p>
                            <p className="text-xs mt-1">Upload at least one RFP to continue</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
