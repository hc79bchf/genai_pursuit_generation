"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { ComboboxInput, ComboboxOption } from "@/components/ui/combobox-input"
import { ArrowLeft, Loader2, Upload } from "lucide-react"
import Link from "next/link"
import { fetchApi } from "@/lib/api"
import { usePursuitStore } from "@/store/pursuitStore"

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

export default function NewPursuitPage() {
    const router = useRouter()
    const { refreshPursuitsCount } = usePursuitStore()
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState("")

    // Form data
    const [formData, setFormData] = useState({
        entity_name: "",
        internal_pursuit_owner_name: "",
        internal_pursuit_owner_email: "",
        pursuit_partner_name: "",
        pursuit_partner_email: "",
        pursuit_manager_name: "",
        pursuit_manager_email: "",
    })

    // Search states
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

    // Loading states
    const [isLoadingEntities, setIsLoadingEntities] = useState(false)
    const [isLoadingUsers, setIsLoadingUsers] = useState(false)
    const [isLoadingPartners, setIsLoadingPartners] = useState(false)
    const [isLoadingManagers, setIsLoadingManagers] = useState(false)

    // Fetch entities
    useEffect(() => {
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
    }, [debouncedEntitySearch])

    // Fetch users for internal owner
    useEffect(() => {
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
    }, [debouncedOwnerSearch])

    // Fetch team members for partner
    useEffect(() => {
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
    }, [debouncedPartnerSearch])

    // Fetch team members for manager
    useEffect(() => {
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
    }, [debouncedManagerSearch])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsLoading(true)
        setError("")

        try {
            // Only send non-empty fields
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
                router.push(`/dashboard/pursuits/${response.id}`)
            }
        } catch (error: any) {
            console.error("Failed to create pursuit", error)
            setError(error.message || "Failed to create pursuit")
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            <div className="flex items-center space-x-4 mb-8">
                <Button asChild variant="ghost" size="icon" className="hover:bg-white/10 text-muted-foreground hover:text-white">
                    <Link href="/dashboard">
                        <ArrowLeft className="h-5 w-5" />
                    </Link>
                </Button>
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-white">New Pursuit</h1>
                    <p className="text-muted-foreground text-sm">Create a new pursuit to start tracking</p>
                </div>
            </div>

            <Card className="glass-card border-white/10">
                <CardHeader>
                    <CardTitle className="text-white">Pursuit Details</CardTitle>
                    <CardDescription className="text-muted-foreground">
                        Enter the basic information for this pursuit. You can upload files later.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {error && (
                        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center text-red-400">
                            <div className="h-2 w-2 rounded-full bg-red-500 mr-3" />
                            {error}
                        </div>
                    )}
                    <form onSubmit={handleSubmit} className="space-y-6">
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

                        <div className="pt-4 flex justify-end space-x-4">
                            <Button asChild variant="ghost" className="text-muted-foreground hover:text-white hover:bg-white/10">
                                <Link href="/dashboard">Cancel</Link>
                            </Button>
                            <Button
                                type="submit"
                                disabled={isLoading || !formData.entity_name || !formData.internal_pursuit_owner_name}
                                className="bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20"
                            >
                                {isLoading ? (
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
                </CardContent>
            </Card>
        </div>
    )
}
