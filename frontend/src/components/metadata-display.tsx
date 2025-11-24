import { Building2, Calendar, DollarSign, FileText, Globe, Layers, Mail, MapPin, User } from "lucide-react"
import { cn } from "@/lib/utils"

interface MetadataDisplayProps {
    data: any
}

export function MetadataDisplay({ data }: MetadataDisplayProps) {
    if (!data) return null

    // Helper to format currency
    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            maximumFractionDigits: 0
        }).format(amount)
    }

    // Helper to format date
    const formatDate = (dateString: string) => {
        if (!dateString) return 'N/A'
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        })
    }

    const hasMetadata = data.industry || (data.service_types && data.service_types.length > 0)

    if (!hasMetadata) {
        return (
            <div className="text-center py-12 bg-white/5 rounded-xl border border-white/10">
                <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                <h3 className="text-lg font-medium text-white mb-2">No Metadata Extracted</h3>
                <p className="text-muted-foreground max-w-sm mx-auto">
                    Upload an RFP document and click "Extract Metadata" to automatically populate this information.
                </p>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Client Information */}
            <div className="grid gap-4 md:grid-cols-2">
                <div className="glass-card p-4 rounded-xl border border-white/10 bg-white/5">
                    <div className="flex items-center gap-2 mb-3 text-muted-foreground">
                        <Building2 className="h-4 w-4" />
                        <span className="text-sm font-medium">Client Details</span>
                    </div>
                    <div className="space-y-3">
                        <div>
                            <div className="text-xs text-muted-foreground">Client Name</div>
                            <div className="text-white font-medium">{data.entity_name || 'N/A'}</div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <div className="text-xs text-muted-foreground">Industry</div>
                                <div className="text-white">{data.industry || 'N/A'}</div>
                            </div>
                            <div>
                                <div className="text-xs text-muted-foreground">Geography</div>
                                <div className="text-white flex items-center gap-1">
                                    <MapPin className="h-3 w-3 text-muted-foreground" />
                                    {data.geography || 'N/A'}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="glass-card p-4 rounded-xl border border-white/10 bg-white/5">
                    <div className="flex items-center gap-2 mb-3 text-muted-foreground">
                        <User className="h-4 w-4" />
                        <span className="text-sm font-medium">Point of Contact</span>
                    </div>
                    <div className="space-y-3">
                        <div>
                            <div className="text-xs text-muted-foreground">Name</div>
                            <div className="text-white font-medium">{data.client_pursuit_owner_name || 'N/A'}</div>
                        </div>
                        <div>
                            <div className="text-xs text-muted-foreground">Email</div>
                            <div className="text-white flex items-center gap-1">
                                <Mail className="h-3 w-3 text-muted-foreground" />
                                {data.client_pursuit_owner_email || 'N/A'}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Project Scope */}
            <div className="glass-card p-6 rounded-xl border border-white/10 bg-white/5">
                <div className="flex items-center gap-2 mb-4 text-muted-foreground">
                    <Layers className="h-4 w-4" />
                    <span className="text-sm font-medium">Project Scope</span>
                </div>

                <div className="grid gap-6 md:grid-cols-3 mb-6">
                    <div className="p-3 bg-black/20 rounded-lg border border-white/5">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                            <Calendar className="h-3 w-3" />
                            Submission Due
                        </div>
                        <div className="text-white font-medium">{formatDate(data.submission_due_date)}</div>
                    </div>
                    <div className="p-3 bg-black/20 rounded-lg border border-white/5">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                            <DollarSign className="h-3 w-3" />
                            Estimated Fees
                        </div>
                        <div className="text-white font-medium">
                            {data.estimated_fees_usd ? formatCurrency(data.estimated_fees_usd) : 'N/A'}
                        </div>
                    </div>
                    <div className="p-3 bg-black/20 rounded-lg border border-white/5">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                            <FileText className="h-3 w-3" />
                            Format
                        </div>
                        <div className="text-white font-medium">{data.expected_format || 'N/A'}</div>
                    </div>
                </div>

                <div className="space-y-4">
                    <div>
                        <div className="text-xs text-muted-foreground mb-2">Service Types</div>
                        <div className="flex flex-wrap gap-2">
                            {data.service_types && data.service_types.length > 0 ? (
                                data.service_types.map((type: string, i: number) => (
                                    <span key={i} className="px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-400 text-xs border border-blue-500/20">
                                        {type}
                                    </span>
                                ))
                            ) : (
                                <span className="text-sm text-muted-foreground italic">None specified</span>
                            )}
                        </div>
                    </div>

                    <div>
                        <div className="text-xs text-muted-foreground mb-2">Technologies</div>
                        <div className="flex flex-wrap gap-2">
                            {data.technologies && data.technologies.length > 0 ? (
                                data.technologies.map((tech: string, i: number) => (
                                    <span key={i} className="px-2.5 py-1 rounded-full bg-purple-500/10 text-purple-400 text-xs border border-purple-500/20">
                                        {tech}
                                    </span>
                                ))
                            ) : (
                                <span className="text-sm text-muted-foreground italic">None specified</span>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Requirements Text */}
            <div className="glass-card p-6 rounded-xl border border-white/10 bg-white/5">
                <div className="flex items-center gap-2 mb-4 text-muted-foreground">
                    <FileText className="h-4 w-4" />
                    <span className="text-sm font-medium">Requirements Summary</span>
                </div>
                <div className="prose prose-invert max-w-none">
                    <div className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap bg-black/20 p-4 rounded-lg border border-white/5 max-h-96 overflow-y-auto">
                        {data.requirements_text || 'No requirements text extracted.'}
                    </div>
                </div>
            </div>
        </div>
    )
}
