"use client"

import { useEffect, useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
    Bot,
    Loader2,
    Check,
    AlertCircle,
    Edit2,
    Save,
    X,
    Plus,
    Trash2,
    Clock,
    FileText,
    Target,
    CheckCircle2,
    Info,
    Play,
    History,
    DollarSign,
    Zap,
    User,
    Search,
    Filter,
    ChevronDown,
    ChevronRight,
    Trophy,
    Building2,
    Calendar,
    Layers,
    Eye,
    ArrowRight
} from "lucide-react"
import { fetchApi } from "@/lib/api"
import { cn } from "@/lib/utils"
import { templates, categories } from "@/lib/data"

interface ExtractedField {
    value: any
    confidence: number
    source: string
}

interface ValidationResults {
    status: "valid" | "warning" | "error"
    errors: { field: string; message: string }[]
    warnings: string[]
    fields_requiring_review: string[]
}

interface MetadataExtraction {
    extracted_fields: Record<string, ExtractedField>
    validation_results: ValidationResults
    processing_time_ms: number
    memory_enhanced: boolean
    input_tokens: number
    output_tokens: number
    estimated_cost_usd: number
}

interface ExtractionHistoryItem {
    id: string
    ran_by: string
    date: string
    processing_time_ms: number
    input_tokens: number
    output_tokens: number
    estimated_cost_usd: number
    status: "success" | "failed"
    documents: string[] // Document names that were processed
}

interface CitedItem {
    text: string
    citation: string
    confidence: number
}

interface FieldConflict {
    field: string
    label: string
    overviewValue: any
    extractedValue: any
}

// Similar Pursuit Types
interface ComponentDetail {
    word_count: number
    relevance_score: number
    preview: string
}

interface SlideMapping {
    start_slide: number
    end_slide: number
}

interface SectionMapping {
    heading: string
    start_page: number
    end_page?: number
}

interface SimilarPursuit {
    pursuit_id: string
    pursuit_name: string
    similarity_score: number
    match_explanation: string
    industry: string
    service_types: string[]
    technologies: string[]
    win_status: string
    quality_tag?: string
    created_at: string
    estimated_fees?: number
    available_components: string[]
    component_details: Record<string, ComponentDetail>
    content_preview: Record<string, string>
    key_matching_content: string[]
    component_coverage_score: number
    document_type?: string
    slide_mappings?: Record<string, SlideMapping>
    section_mappings?: Record<string, SectionMapping>
}

interface SimilarPursuitFilters {
    industries?: string[]
    service_types?: string[]
    technologies?: string[]
    win_status?: string[]
    min_fees?: number
    max_fees?: number
}

// Scoring weights (from agent)
const SCORING_WEIGHTS = {
    semantic: 0.60,
    metadata: 0.12,
    component: 0.10,
    quality: 0.08,
    win_status: 0.05,
    recency: 0.05
}

interface Pursuit {
    id: string
    entity_name: string
    industry?: string
    client_pursuit_owner_name?: string
    client_pursuit_owner_email?: string
    service_types?: string[]
    technologies?: string[]
    geography?: string
    submission_due_date?: string
    estimated_fees_usd?: number
    expected_format?: string
    requirements_text?: string
    selected_template_id?: string
    outline_json?: {
        metadata_extraction?: MetadataExtraction
        extracted_objectives?: (string | CitedItem)[]
        extracted_requirements?: (string | CitedItem)[]
        extraction_history?: ExtractionHistoryItem[]
        overview_snapshot?: {
            entity_name?: string
            industry?: string
            geography?: string
            submission_due_date?: string
            estimated_fees_usd?: number
            service_types?: string[]
            technologies?: string[]
        }
    }
}

type MetadataTab = "overview" | "metadata" | "objectives" | "requirements" | "similar-pursuits" | "outline-templates"

interface TabConfig {
    id: MetadataTab
    label: string
    description: string
}

const TABS: TabConfig[] = [
    { id: "overview", label: "OVERVIEW", description: "Snapshot of pursuit details from the Overview page." },
    { id: "metadata", label: "METADATA", description: "AI-extracted fields from RFP documents with confidence scores." },
    { id: "objectives", label: "OBJECTIVES", description: "Client objectives extracted from RFP with source citations." },
    { id: "requirements", label: "REQUIREMENTS", description: "Technical and business requirements extracted from RFP." },
    { id: "similar-pursuits", label: "REFERENCES", description: "Find past proposals with similar content to use as references." },
    { id: "outline-templates", label: "OUTLINES", description: "Select a proposal structure template for document generation." },
]

// Industry to template mapping for recommendations
const INDUSTRY_TEMPLATE_MAP: Record<string, string[]> = {
    "Government": ["federal-rfp", "state-local"],
    "Federal Government": ["federal-rfp"],
    "State Government": ["state-local"],
    "Local Government": ["state-local"],
    "Technology": ["enterprise-saas"],
    "Software": ["enterprise-saas"],
    "SaaS": ["enterprise-saas"],
    "Healthcare": ["healthcare-it"],
    "Health": ["healthcare-it"],
    "Medical": ["healthcare-it"],
    "Finance": ["fintech-integration"],
    "Financial Services": ["fintech-integration"],
    "Banking": ["fintech-integration"],
    "Fintech": ["fintech-integration"],
    "Security": ["cybersecurity-audit"],
    "Cybersecurity": ["cybersecurity-audit"],
    "Insurance": ["fintech-integration"],
}

// Mock similar pursuits data (would come from backend API)
const MOCK_SIMILAR_PURSUITS: SimilarPursuit[] = [
    {
        pursuit_id: "pursuit-001",
        pursuit_name: "Healthcare Data Migration - Blue Cross",
        similarity_score: 0.92,
        match_explanation: "Same industry (Healthcare). Matching services: Data Migration, Cloud Architecture. Shared technologies: Azure, HIPAA. Won pursuit with proven approach.",
        industry: "Healthcare",
        service_types: ["Data Migration", "Cloud Architecture", "System Integration"],
        technologies: ["Azure", "HIPAA", "FHIR API"],
        win_status: "won",
        quality_tag: "high",
        created_at: "2024-06-15T10:00:00Z",
        estimated_fees: 2500000,
        available_components: ["Executive Summary", "Technical Approach", "Team Qualifications", "Case Studies", "Pricing"],
        component_details: {
            "Executive Summary": { word_count: 450, relevance_score: 0.95, preview: "Comprehensive healthcare data migration strategy..." },
            "Technical Approach": { word_count: 1200, relevance_score: 0.88, preview: "HIPAA-compliant EHR integration with Epic..." },
            "Team Qualifications": { word_count: 800, relevance_score: 0.82, preview: "Our team includes certified healthcare IT specialists..." },
            "Case Studies": { word_count: 600, relevance_score: 0.90, preview: "Successfully migrated 5M patient records for..." },
            "Pricing": { word_count: 300, relevance_score: 0.75, preview: "Fixed-price engagement with milestone deliverables..." }
        },
        content_preview: {
            "Executive Summary": "Comprehensive healthcare data migration strategy leveraging Azure cloud services...",
            "Technical Approach": "HIPAA-compliant EHR integration with Epic using FHIR API implementation..."
        },
        key_matching_content: [
            "Executive Summary: Comprehensive healthcare data migration strategy...",
            "Technical Approach: HIPAA-compliant EHR integration with Epic...",
            "Case Studies: Successfully migrated 5M patient records..."
        ],
        component_coverage_score: 0.85,
        document_type: "pptx",
        slide_mappings: {
            "Executive Summary": { start_slide: 1, end_slide: 3 },
            "Technical Approach": { start_slide: 4, end_slide: 8 },
            "Team Qualifications": { start_slide: 9, end_slide: 12 }
        }
    },
    {
        pursuit_id: "pursuit-002",
        pursuit_name: "Financial Services Cloud Transformation - JP Morgan",
        similarity_score: 0.78,
        match_explanation: "Matching services: Cloud Architecture, System Integration. Shared technologies: Azure. Recently submitted, current content.",
        industry: "Financial Services",
        service_types: ["Cloud Architecture", "System Integration", "Security"],
        technologies: ["Azure", "Kubernetes", "Terraform"],
        win_status: "submitted",
        quality_tag: undefined,
        created_at: "2024-09-20T14:30:00Z",
        estimated_fees: 4200000,
        available_components: ["Executive Summary", "Technical Approach", "Security Framework", "Team Qualifications"],
        component_details: {
            "Executive Summary": { word_count: 500, relevance_score: 0.72, preview: "Enterprise cloud transformation roadmap..." },
            "Technical Approach": { word_count: 1500, relevance_score: 0.85, preview: "Multi-cloud architecture with Azure as primary..." },
            "Security Framework": { word_count: 900, relevance_score: 0.78, preview: "Zero-trust security model implementation..." },
            "Team Qualifications": { word_count: 700, relevance_score: 0.80, preview: "Azure-certified architects with financial sector experience..." }
        },
        content_preview: {
            "Executive Summary": "Enterprise cloud transformation roadmap for financial services...",
            "Technical Approach": "Multi-cloud architecture with Azure as primary provider..."
        },
        key_matching_content: [
            "Technical Approach: Multi-cloud architecture with Azure...",
            "Security Framework: Zero-trust security model..."
        ],
        component_coverage_score: 0.72,
        document_type: "docx",
        section_mappings: {
            "Executive Summary": { heading: "1. Executive Summary", start_page: 1, end_page: 3 },
            "Technical Approach": { heading: "2. Technical Approach", start_page: 4, end_page: 12 }
        }
    },
    {
        pursuit_id: "pursuit-003",
        pursuit_name: "Manufacturing IoT Implementation - Siemens",
        similarity_score: 0.65,
        match_explanation: "Matching services: System Integration. Shared technologies: Azure. Tagged as high quality by reviewers.",
        industry: "Manufacturing",
        service_types: ["IoT Implementation", "System Integration", "Data Analytics"],
        technologies: ["Azure IoT Hub", "Power BI", "Databricks"],
        win_status: "won",
        quality_tag: "high",
        created_at: "2024-03-10T09:00:00Z",
        estimated_fees: 1800000,
        available_components: ["Executive Summary", "Technical Approach", "Implementation Plan", "ROI Analysis"],
        component_details: {
            "Executive Summary": { word_count: 400, relevance_score: 0.60, preview: "Smart factory transformation initiative..." },
            "Technical Approach": { word_count: 1100, relevance_score: 0.65, preview: "IoT sensor network with edge computing..." },
            "Implementation Plan": { word_count: 800, relevance_score: 0.55, preview: "Phased rollout across 12 manufacturing sites..." },
            "ROI Analysis": { word_count: 500, relevance_score: 0.70, preview: "Projected 23% efficiency improvement..." }
        },
        content_preview: {
            "Executive Summary": "Smart factory transformation initiative leveraging Azure IoT...",
            "Technical Approach": "IoT sensor network with edge computing capabilities..."
        },
        key_matching_content: [
            "Technical Approach: IoT sensor network with edge computing...",
            "ROI Analysis: Projected 23% efficiency improvement..."
        ],
        component_coverage_score: 0.58,
        document_type: "pptx",
        slide_mappings: {
            "Executive Summary": { start_slide: 1, end_slide: 2 },
            "Technical Approach": { start_slide: 3, end_slide: 7 }
        }
    }
]

const OUTPUT_FORMAT_OPTIONS = [
    { value: "PPTX", label: ".pptx (PowerPoint)" },
    { value: "DOCX", label: ".docx (Word)" },
]

const METADATA_FIELDS = [
    { key: "entity_name", label: "Entity Name", type: "text", required: true },
    { key: "industry", label: "Industry", type: "text", required: true },
    { key: "client_pursuit_owner_name", label: "Client Contact", type: "text" },
    { key: "client_pursuit_owner_email", label: "Client Email", type: "email" },
    { key: "geography", label: "Geography", type: "text" },
    { key: "submission_due_date", label: "Due Date", type: "date" },
    { key: "estimated_fees_usd", label: "Estimated Fees (USD)", type: "number" },
    { key: "expected_format", label: "Output Format", type: "select", options: OUTPUT_FORMAT_OPTIONS },
]

const formatOutputFormat = (format?: string) => {
    if (!format) return "—"
    const found = OUTPUT_FORMAT_OPTIONS.find(opt => opt.value === format || opt.value.toLowerCase() === format?.toLowerCase())
    return found ? found.label : format
}

export default function MetadataExtractionPage({ params }: { params: { id: string } }) {
    const pursuitId = params.id
    const router = useRouter()
    const [pursuit, setPursuit] = useState<Pursuit | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [isExtracting, setIsExtracting] = useState(false)
    const [extractionComplete, setExtractionComplete] = useState(false)
    const [activeTab, setActiveTab] = useState<MetadataTab>("overview")

    // Edit states
    const [editingField, setEditingField] = useState<string | null>(null)
    const [editValues, setEditValues] = useState<Record<string, any>>({})
    const [isSaving, setIsSaving] = useState(false)

    // Objectives and Requirements
    const [objectives, setObjectives] = useState<CitedItem[]>([])
    const [requirements, setRequirements] = useState<CitedItem[]>([])
    const [newObjective, setNewObjective] = useState("")
    const [newRequirement, setNewRequirement] = useState("")
    const [editingObjectiveIndex, setEditingObjectiveIndex] = useState<number | null>(null)
    const [editingRequirementIndex, setEditingRequirementIndex] = useState<number | null>(null)

    // Service Types and Technologies
    const [serviceTypes, setServiceTypes] = useState<string[]>([])
    const [technologies, setTechnologies] = useState<string[]>([])
    const [newServiceType, setNewServiceType] = useState("")
    const [newTechnology, setNewTechnology] = useState("")

    // Conflicts
    const [conflicts, setConflicts] = useState<FieldConflict[]>([])

    // Extraction history (mock for now, would come from backend)
    const [extractionHistory, setExtractionHistory] = useState<ExtractionHistoryItem[]>([])

    // Similar Pursuits state
    const [similarPursuits, setSimilarPursuits] = useState<SimilarPursuit[]>([])
    const [isSearching, setIsSearching] = useState(false)
    const [searchComplete, setSearchComplete] = useState(false)
    const [selectedPursuits, setSelectedPursuits] = useState<Set<string>>(new Set())
    const [selectedComponents, setSelectedComponents] = useState<Record<string, Set<string>>>({})
    const [expandedPursuits, setExpandedPursuits] = useState<Set<string>>(new Set())
    const [showFilters, setShowFilters] = useState(false)
    const [filters, setFilters] = useState<SimilarPursuitFilters>({})
    const [isSavingSelections, setIsSavingSelections] = useState(false)
    const [selectionsSaved, setSelectionsSaved] = useState(false)

    // Outline Templates state
    const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null)
    const [templateFilter, setTemplateFilter] = useState<string>("All")
    const [isSavingTemplate, setIsSavingTemplate] = useState(false)

    const isExtractingRef = useRef(false)

    const normalizeToCitedItem = (item: string | CitedItem): CitedItem => {
        if (typeof item === "string") {
            return { text: item, citation: "", confidence: 1.0 }
        }
        return item
    }

    const detectConflicts = (data: Pursuit) => {
        const newConflicts: FieldConflict[] = []
        const snapshot = data.outline_json?.overview_snapshot
        if (!snapshot) return newConflicts

        const fieldsToCompare = [
            { field: "entity_name", label: "Entity Name" },
            { field: "industry", label: "Industry" },
            { field: "geography", label: "Geography" },
            { field: "submission_due_date", label: "Due Date" },
            { field: "estimated_fees_usd", label: "Estimated Fees" },
        ]

        fieldsToCompare.forEach(({ field, label }) => {
            const overviewValue = snapshot[field as keyof typeof snapshot]
            const extractedValue = data[field as keyof Pursuit]
            if (overviewValue && extractedValue && overviewValue !== extractedValue) {
                newConflicts.push({ field, label, overviewValue, extractedValue })
            }
        })

        const compareArrays = (arr1?: string[], arr2?: string[]) => {
            if (!arr1 || !arr2) return false
            if (arr1.length !== arr2.length) return true
            return !arr1.every(item => arr2.includes(item))
        }

        if (compareArrays(snapshot.service_types, data.service_types)) {
            newConflicts.push({
                field: "service_types",
                label: "Service Types",
                overviewValue: snapshot.service_types,
                extractedValue: data.service_types
            })
        }

        if (compareArrays(snapshot.technologies, data.technologies)) {
            newConflicts.push({
                field: "technologies",
                label: "Technologies",
                overviewValue: snapshot.technologies,
                extractedValue: data.technologies
            })
        }

        return newConflicts
    }

    // Reset extraction state when pursuit changes
    useEffect(() => {
        isExtractingRef.current = false
        setIsExtracting(false)
    }, [pursuitId])

    useEffect(() => {
        async function loadPursuit() {
            try {
                const data = await fetchApi(`/pursuits/${pursuitId}`)
                setPursuit(data)

                if (data.outline_json?.extracted_objectives) {
                    setObjectives(data.outline_json.extracted_objectives.map(normalizeToCitedItem))
                }
                if (data.outline_json?.extracted_requirements) {
                    setRequirements(data.outline_json.extracted_requirements.map(normalizeToCitedItem))
                }

                setServiceTypes(data.service_types || [])
                setTechnologies(data.technologies || [])

                if (data.outline_json?.overview_snapshot) {
                    const detectedConflicts = detectConflicts(data)
                    setConflicts(detectedConflicts)
                }

                if (data.outline_json?.extraction_history) {
                    setExtractionHistory(data.outline_json.extraction_history)
                }

                if (data.outline_json?.metadata_extraction || data.industry) {
                    setExtractionComplete(true)
                }

                // Set selected template from pursuit
                if (data.selected_template_id) {
                    setSelectedTemplateId(data.selected_template_id)
                }

                // Load saved pursuit selections for gap analysis
                if (data.outline_json?.selected_reference_pursuits) {
                    const savedSelections = data.outline_json.selected_reference_pursuits
                    setSelectedPursuits(new Set(savedSelections.pursuit_ids || []))
                    // Convert saved components back to Set format
                    const componentMap: Record<string, Set<string>> = {}
                    if (savedSelections.components) {
                        Object.entries(savedSelections.components).forEach(([pid, comps]) => {
                            componentMap[pid] = new Set(comps as string[])
                        })
                    }
                    setSelectedComponents(componentMap)
                    if (savedSelections.pursuit_ids?.length > 0) {
                        setSelectionsSaved(true)
                    }
                }
            } catch (error) {
                console.error("Failed to load pursuit", error)
            } finally {
                setIsLoading(false)
            }
        }
        loadPursuit()
    }, [pursuitId])

    const handleExtract = async () => {
        // Prevent multiple clicks - use ref as primary lock since it's synchronous
        if (isExtractingRef.current) {
            console.log("Extraction already in progress (ref check), ignoring click")
            return
        }

        // Set lock immediately (synchronously via ref)
        isExtractingRef.current = true
        // State update for UI feedback
        setIsExtracting(true)

        console.log("Starting extraction...")

        try {
            await fetchApi(`/pursuits/${pursuitId}/extract`, { method: "POST" })
            console.log("Extraction API call complete, fetching updated data...")
            const data = await fetchApi(`/pursuits/${pursuitId}`)
            setPursuit(data)

            if (data.outline_json?.extracted_objectives) {
                setObjectives(data.outline_json.extracted_objectives.map(normalizeToCitedItem))
            }
            if (data.outline_json?.extracted_requirements) {
                setRequirements(data.outline_json.extracted_requirements.map(normalizeToCitedItem))
            }

            setServiceTypes(data.service_types || [])
            setTechnologies(data.technologies || [])

            if (data.outline_json?.overview_snapshot) {
                const detectedConflicts = detectConflicts(data)
                setConflicts(detectedConflicts)
            }

            // Add to history (mock - in real app this would come from backend)
            // Get document names that were processed (RFP files)
            const processedDocuments = (data.files || [])
                .filter((f: any) => f.file_type === "rfp" && !f.is_deleted)
                .map((f: any) => f.file_name)

            const newHistoryItem: ExtractionHistoryItem = {
                id: Date.now().toString(),
                ran_by: "Current User",
                date: new Date().toISOString(),
                processing_time_ms: data.outline_json?.metadata_extraction?.processing_time_ms || 0,
                input_tokens: data.outline_json?.metadata_extraction?.input_tokens || 0,
                output_tokens: data.outline_json?.metadata_extraction?.output_tokens || 0,
                estimated_cost_usd: data.outline_json?.metadata_extraction?.estimated_cost_usd || 0,
                status: "success",
                documents: processedDocuments
            }

            // Get existing history and add new item
            const existingHistory = data.outline_json?.extraction_history || []
            const updatedHistory = [newHistoryItem, ...existingHistory]
            setExtractionHistory(updatedHistory)

            // Persist extraction history to database
            await fetchApi(`/pursuits/${pursuitId}`, {
                method: "PUT",
                body: JSON.stringify({
                    outline_json: {
                        ...data.outline_json,
                        extraction_history: updatedHistory
                    }
                })
            })

            setExtractionComplete(true)
            console.log("Extraction complete!")
        } catch (error: any) {
            console.error("Extraction failed", error)
            // Show error to user
            alert(error?.message || "Extraction failed. Please try again.")
        } finally {
            // Release lock after completion - always runs
            isExtractingRef.current = false
            setIsExtracting(false)
        }
    }

    const handleEdit = (fieldKey: string) => {
        setEditingField(fieldKey)
        setEditValues({
            ...editValues,
            [fieldKey]: pursuit?.[fieldKey as keyof Pursuit] || "",
        })
    }

    const handleSave = async (fieldKey: string) => {
        setIsSaving(true)
        try {
            await fetchApi(`/pursuits/${pursuitId}`, {
                method: "PUT",
                body: JSON.stringify({ [fieldKey]: editValues[fieldKey] }),
            })
            const data = await fetchApi(`/pursuits/${pursuitId}`)
            setPursuit(data)
            setEditingField(null)
        } catch (error) {
            console.error("Save failed", error)
        } finally {
            setIsSaving(false)
        }
    }

    const handleCancelEdit = () => {
        setEditingField(null)
    }

    // Objectives management
    const handleAddObjective = async () => {
        if (!newObjective.trim()) return
        const newItem: CitedItem = { text: newObjective.trim(), citation: "User added", confidence: 1.0 }
        const updatedObjectives = [...objectives, newItem]
        setObjectives(updatedObjectives)
        setNewObjective("")
        await saveObjectivesAndRequirements(updatedObjectives, requirements)
    }

    const handleRemoveObjective = async (index: number) => {
        const updatedObjectives = objectives.filter((_, i) => i !== index)
        setObjectives(updatedObjectives)
        await saveObjectivesAndRequirements(updatedObjectives, requirements)
    }

    const handleUpdateObjective = async (index: number, value: string) => {
        const updatedObjectives = [...objectives]
        updatedObjectives[index] = { ...updatedObjectives[index], text: value }
        setObjectives(updatedObjectives)
        setEditingObjectiveIndex(null)
        await saveObjectivesAndRequirements(updatedObjectives, requirements)
    }

    // Requirements management
    const handleAddRequirement = async () => {
        if (!newRequirement.trim()) return
        const newItem: CitedItem = { text: newRequirement.trim(), citation: "User added", confidence: 1.0 }
        const updatedRequirements = [...requirements, newItem]
        setRequirements(updatedRequirements)
        setNewRequirement("")
        await saveObjectivesAndRequirements(objectives, updatedRequirements)
    }

    const handleRemoveRequirement = async (index: number) => {
        const updatedRequirements = requirements.filter((_, i) => i !== index)
        setRequirements(updatedRequirements)
        await saveObjectivesAndRequirements(objectives, updatedRequirements)
    }

    const handleUpdateRequirement = async (index: number, value: string) => {
        const updatedRequirements = [...requirements]
        updatedRequirements[index] = { ...updatedRequirements[index], text: value }
        setRequirements(updatedRequirements)
        setEditingRequirementIndex(null)
        await saveObjectivesAndRequirements(objectives, updatedRequirements)
    }

    const saveObjectivesAndRequirements = async (objs: CitedItem[], reqs: CitedItem[]) => {
        try {
            const currentOutlineJson = pursuit?.outline_json || {}
            await fetchApi(`/pursuits/${pursuitId}`, {
                method: "PUT",
                body: JSON.stringify({
                    outline_json: {
                        ...currentOutlineJson,
                        extracted_objectives: objs,
                        extracted_requirements: reqs,
                    }
                }),
            })
        } catch (error) {
            console.error("Failed to save objectives/requirements", error)
        }
    }

    // Service Types management
    const handleAddServiceType = async () => {
        if (!newServiceType.trim()) return
        const updatedServiceTypes = [...serviceTypes, newServiceType.trim()]
        setServiceTypes(updatedServiceTypes)
        setNewServiceType("")
        await saveServiceTypesAndTechnologies(updatedServiceTypes, technologies)
    }

    const handleRemoveServiceType = async (index: number) => {
        const updatedServiceTypes = serviceTypes.filter((_, i) => i !== index)
        setServiceTypes(updatedServiceTypes)
        await saveServiceTypesAndTechnologies(updatedServiceTypes, technologies)
    }

    // Technologies management
    const handleAddTechnology = async () => {
        if (!newTechnology.trim()) return
        const updatedTechnologies = [...technologies, newTechnology.trim()]
        setTechnologies(updatedTechnologies)
        setNewTechnology("")
        await saveServiceTypesAndTechnologies(serviceTypes, updatedTechnologies)
    }

    const handleRemoveTechnology = async (index: number) => {
        const updatedTechnologies = technologies.filter((_, i) => i !== index)
        setTechnologies(updatedTechnologies)
        await saveServiceTypesAndTechnologies(serviceTypes, updatedTechnologies)
    }

    const saveServiceTypesAndTechnologies = async (types: string[], techs: string[]) => {
        try {
            await fetchApi(`/pursuits/${pursuitId}`, {
                method: "PUT",
                body: JSON.stringify({ service_types: types, technologies: techs }),
            })
            if (pursuit) {
                setPursuit({ ...pursuit, service_types: types, technologies: techs })
            }
        } catch (error) {
            console.error("Failed to save service types/technologies", error)
        }
    }

    const handleResolveConflict = async (conflict: FieldConflict, useExtracted: boolean) => {
        const valueToUse = useExtracted ? conflict.extractedValue : conflict.overviewValue
        try {
            await fetchApi(`/pursuits/${pursuitId}`, {
                method: "PUT",
                body: JSON.stringify({ [conflict.field]: valueToUse }),
            })
            const data = await fetchApi(`/pursuits/${pursuitId}`)
            setPursuit(data)
            setConflicts(conflicts.filter(c => c.field !== conflict.field))

            if (conflict.field === "service_types") {
                setServiceTypes(valueToUse || [])
            } else if (conflict.field === "technologies") {
                setTechnologies(valueToUse || [])
            }
        } catch (error) {
            console.error("Failed to resolve conflict", error)
        }
    }

    const getConfidenceColor = (confidence: number) => {
        if (confidence >= 0.8) return "text-green-400"
        if (confidence >= 0.5) return "text-yellow-400"
        return "text-red-400"
    }

    const getConfidenceBg = (confidence: number) => {
        if (confidence >= 0.8) return "bg-green-500/10 border-green-500/20"
        if (confidence >= 0.5) return "bg-yellow-500/10 border-yellow-500/20"
        return "bg-red-500/10 border-red-500/20"
    }

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit"
        })
    }

    const formatCurrency = (amount?: number) => {
        if (!amount) return "$0.00"
        return `$${amount.toFixed(4)}`
    }

    const formatFeesDisplay = (fees?: number) => {
        if (!fees) return "—"
        return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(fees)
    }

    // Similar Pursuits functions
    const handleSearchSimilarPursuits = async () => {
        setIsSearching(true)
        try {
            // In production, this would call the API
            // const results = await fetchApi(`/pursuits/${pursuitId}/similar`, { method: "POST" })
            await new Promise(resolve => setTimeout(resolve, 2000)) // Simulate API delay
            setSimilarPursuits(MOCK_SIMILAR_PURSUITS)
            setSearchComplete(true)
        } catch (error) {
            console.error("Failed to search similar pursuits", error)
        } finally {
            setIsSearching(false)
        }
    }

    const togglePursuitSelection = (pursuitId: string) => {
        const newSelected = new Set(selectedPursuits)
        if (newSelected.has(pursuitId)) {
            newSelected.delete(pursuitId)
            // Also remove component selections for this pursuit
            const newComponents = { ...selectedComponents }
            delete newComponents[pursuitId]
            setSelectedComponents(newComponents)
        } else {
            newSelected.add(pursuitId)
        }
        setSelectedPursuits(newSelected)
        setSelectionsSaved(false) // Mark as unsaved when selections change
    }

    const handleSaveSelections = async () => {
        if (!pursuit) return
        setIsSavingSelections(true)
        try {
            // Convert Sets to arrays for JSON serialization
            const selectionsToSave = {
                pursuit_ids: Array.from(selectedPursuits),
                components: Object.fromEntries(
                    Object.entries(selectedComponents).map(([pid, comps]) => [pid, Array.from(comps)])
                ),
                // Also save pursuit details for display in Gap Analysis
                pursuit_details: Array.from(selectedPursuits).map(pid => {
                    const p = similarPursuits.find(sp => sp.pursuit_id === pid)
                    return p ? {
                        pursuit_id: p.pursuit_id,
                        pursuit_name: p.pursuit_name,
                        industry: p.industry,
                        win_status: p.win_status,
                        overall_score: p.similarity_score,
                        components: Array.from(selectedComponents[pid] || [])
                    } : null
                }).filter(Boolean)
            }

            await fetchApi(`/pursuits/${pursuitId}`, {
                method: "PUT",
                body: JSON.stringify({
                    outline_json: {
                        ...pursuit.outline_json,
                        selected_reference_pursuits: selectionsToSave
                    }
                })
            })
            setSelectionsSaved(true)
        } catch (error) {
            console.error("Failed to save selections", error)
        } finally {
            setIsSavingSelections(false)
        }
    }

    const togglePursuitExpansion = (pursuitId: string) => {
        const newExpanded = new Set(expandedPursuits)
        if (newExpanded.has(pursuitId)) {
            newExpanded.delete(pursuitId)
        } else {
            newExpanded.add(pursuitId)
        }
        setExpandedPursuits(newExpanded)
    }

    const toggleComponentSelection = (pursuitId: string, component: string) => {
        const currentComponents = selectedComponents[pursuitId] || new Set()
        const newComponents = new Set(currentComponents)
        if (newComponents.has(component)) {
            newComponents.delete(component)
        } else {
            newComponents.add(component)
        }
        setSelectedComponents({
            ...selectedComponents,
            [pursuitId]: newComponents
        })
        // Auto-select the pursuit if selecting a component
        if (!selectedPursuits.has(pursuitId)) {
            const newPursuits = new Set(Array.from(selectedPursuits))
            newPursuits.add(pursuitId)
            setSelectedPursuits(newPursuits)
        }
        setSelectionsSaved(false)
    }

    const selectAllComponents = (pursuitId: string, components: string[]) => {
        setSelectedComponents({
            ...selectedComponents,
            [pursuitId]: new Set(components)
        })
        if (!selectedPursuits.has(pursuitId)) {
            const newPursuits = new Set(Array.from(selectedPursuits))
            newPursuits.add(pursuitId)
            setSelectedPursuits(newPursuits)
        }
        setSelectionsSaved(false)
    }

    const getWinStatusColor = (status: string) => {
        switch (status) {
            case "won": return "text-green-400 bg-green-500/10"
            case "lost": return "text-red-400 bg-red-500/10"
            case "submitted": return "text-blue-400 bg-blue-500/10"
            default: return "text-zinc-400 bg-zinc-500/10"
        }
    }

    const getScoreColor = (score: number) => {
        if (score >= 0.8) return "text-green-400"
        if (score >= 0.6) return "text-yellow-400"
        return "text-orange-400"
    }

    // Template selection helpers
    const getRecommendedTemplates = () => {
        if (!pursuit?.industry) return []
        const industry = pursuit.industry
        const recommendedIds = INDUSTRY_TEMPLATE_MAP[industry] || []
        // Also check for partial matches
        for (const [key, ids] of Object.entries(INDUSTRY_TEMPLATE_MAP)) {
            if (industry.toLowerCase().includes(key.toLowerCase()) || key.toLowerCase().includes(industry.toLowerCase())) {
                recommendedIds.push(...ids)
            }
        }
        return Array.from(new Set(recommendedIds))
    }

    const handleSelectTemplate = async (templateId: string) => {
        setIsSavingTemplate(true)
        try {
            await fetchApi(`/pursuits/${pursuitId}`, {
                method: "PUT",
                body: JSON.stringify({ selected_template_id: templateId })
            })
            setSelectedTemplateId(templateId)
        } catch (error) {
            console.error("Failed to save template selection", error)
        } finally {
            setIsSavingTemplate(false)
        }
    }

    const filteredTemplates = templates.filter(t =>
        templateFilter === "All" || t.category === templateFilter
    )

    const recommendedTemplateIds = getRecommendedTemplates()

    // Calculate totals for history
    const totalProcessingTime = extractionHistory.reduce((sum, item) => sum + item.processing_time_ms, 0)
    const totalTokens = extractionHistory.reduce((sum, item) => sum + item.input_tokens + item.output_tokens, 0)
    const totalCost = extractionHistory.reduce((sum, item) => sum + item.estimated_cost_usd, 0)

    const metadataExtraction = pursuit?.outline_json?.metadata_extraction

    // Get conflicts for specific tabs
    const metadataConflicts = conflicts.filter(c =>
        ["entity_name", "industry", "geography", "submission_due_date", "estimated_fees_usd", "service_types", "technologies"].includes(c.field)
    )

    if (isLoading || !pursuit) {
        return (
            <div className="flex h-[50vh] items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-zinc-500" />
            </div>
        )
    }

    const currentTab = TABS.find(t => t.id === activeTab)

    return (
        <div className="max-w-5xl">
            {/* Page Description */}
            <p className="text-sm text-zinc-500 mb-6">
                Review AI-extracted metadata, select similar past pursuits as references, and choose an outline template.
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
                        {tab.id === "objectives" && objectives.length > 0 && (
                            <span className="ml-2 text-xs text-zinc-500">({objectives.length})</span>
                        )}
                        {tab.id === "requirements" && requirements.length > 0 && (
                            <span className="ml-2 text-xs text-zinc-500">({requirements.length})</span>
                        )}
                    </button>
                ))}
            </nav>

            {/* Tab Description */}
            <p className="text-xs text-zinc-500 mb-8">{currentTab?.description}</p>

            {/* Overview Tab */}
            {activeTab === "overview" && (
                <div className="space-y-8">
                    {/* Agent Overview */}
                    <div>
                        <h3 className="text-lg font-semibold text-white mb-3">Metadata Extraction Agent</h3>
                        <p className="text-sm text-zinc-400 leading-relaxed mb-4">
                            The Metadata Extraction Agent uses Claude AI to analyze your uploaded RFP documents
                            and extract structured information including entity details, contacts, objectives,
                            and requirements. It identifies similar past pursuits for reference.
                        </p>
                        <p className="text-xs text-zinc-500">
                            Document Analysis · Requirement Extraction · Reference Matching · ~15-30 seconds
                        </p>
                    </div>

                    {/* Tab Descriptions */}
                    <div>
                        <h3 className="text-sm font-medium text-zinc-400 mb-4">Available Tabs</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                            <div>
                                <h4 className="text-sm font-medium text-white mb-1">METADATA</h4>
                                <p className="text-xs text-zinc-500">
                                    AI-extracted fields from RFP documents with confidence scores and source citations.
                                </p>
                            </div>
                            <div>
                                <h4 className="text-sm font-medium text-white mb-1">OBJECTIVES</h4>
                                <p className="text-xs text-zinc-500">
                                    Client objectives extracted from RFP with source citations and confidence levels.
                                </p>
                            </div>
                            <div>
                                <h4 className="text-sm font-medium text-white mb-1">REQUIREMENTS</h4>
                                <p className="text-xs text-zinc-500">
                                    Technical and business requirements extracted from RFP documents.
                                </p>
                            </div>
                            <div>
                                <h4 className="text-sm font-medium text-white mb-1">REFERENCES</h4>
                                <p className="text-xs text-zinc-500">
                                    Search and select similar past pursuits to use as reference material.
                                </p>
                            </div>
                            <div>
                                <h4 className="text-sm font-medium text-white mb-1">OUTLINES</h4>
                                <p className="text-xs text-zinc-500">
                                    Select a proposal outline template for document generation.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Workflow */}
                    <div>
                        <h3 className="text-sm font-medium text-zinc-400 mb-4">Workflow</h3>
                        <div className="space-y-3">
                            <div className="flex items-start gap-3">
                                <span className="text-xs font-medium text-zinc-500 w-4 flex-shrink-0">1.</span>
                                <div>
                                    <p className="text-sm text-white">Run AI Extraction</p>
                                    <p className="text-xs text-zinc-500">Click the button below to extract metadata from documents</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-3">
                                <span className="text-xs font-medium text-zinc-500 w-4 flex-shrink-0">2.</span>
                                <div>
                                    <p className="text-sm text-white">Review extracted data in METADATA tab</p>
                                    <p className="text-xs text-zinc-500">Edit fields with low confidence scores</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-3">
                                <span className="text-xs font-medium text-zinc-500 w-4 flex-shrink-0">3.</span>
                                <div>
                                    <p className="text-sm text-white">Select reference pursuits in REFERENCES tab</p>
                                    <p className="text-xs text-zinc-500">Choose similar past proposals to use as source material</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-3">
                                <span className="text-xs font-medium text-zinc-500 w-4 flex-shrink-0">4.</span>
                                <div>
                                    <p className="text-sm text-white">Select outline template in OUTLINES tab</p>
                                    <p className="text-xs text-zinc-500">Choose a structure for document generation</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Get Started Button */}
                    <div className="flex justify-end">
                        <Button
                            onClick={() => setActiveTab("metadata")}
                            variant="outline"
                            className="border-white/10"
                        >
                            Get Started
                            <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                    </div>
                </div>
            )}

            {/* Metadata Tab */}
            {activeTab === "metadata" && (
                <div className="space-y-6">
                    <p className="text-xs text-zinc-500">
                        {extractionComplete
                            ? "Extracted metadata from RFP documents. Fields with conflicts show both values side-by-side."
                            : "Run AI Extraction to populate these fields from your RFP documents."}
                    </p>

                    {/* AI Extraction Button */}
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="text-sm font-medium text-white">AI Extraction</h3>
                            <p className="text-xs text-zinc-500">
                                {extractionComplete ? "Re-run to update extracted data" : "Extract metadata from uploaded RFP documents"}
                            </p>
                        </div>
                        <Button
                            type="button"
                            onClick={handleExtract}
                            disabled={isExtracting}
                            size="sm"
                            className="bg-violet-600 hover:bg-violet-700"
                        >
                            {isExtracting ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                    Extracting...
                                </>
                            ) : (
                                <>
                                    <Play className="h-4 w-4 mr-2" />
                                    {extractionComplete ? "Re-extract" : "Start Extraction"}
                                </>
                            )}
                        </Button>
                    </div>

                    {/* Metadata Fields */}
                    <div className="space-y-0">
                        {METADATA_FIELDS.map((field) => {
                            const value = pursuit[field.key as keyof Pursuit]
                            const isEditing = editingField === field.key
                            const extractedField = metadataExtraction?.extracted_fields?.[field.key]
                            const confidence = extractedField?.confidence ?? 1
                            const conflict = metadataConflicts.find(c => c.field === field.key)

                            return (
                                <div
                                    key={field.key}
                                        className={cn(
                                            "py-4 border-b border-white/5 group",
                                            conflict && "bg-orange-500/5 -mx-4 px-4 border-l-2 border-l-orange-500/50"
                                        )}
                                    >
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className="text-xs text-zinc-500 uppercase tracking-wider">
                                                {field.label}
                                                {field.required && <span className="text-red-400 ml-1">*</span>}
                                            </span>
                                            {extractedField && (
                                                <span className={cn(
                                                    "text-xs px-1.5 py-0.5 rounded",
                                                    getConfidenceBg(confidence),
                                                    getConfidenceColor(confidence)
                                                )}>
                                                    {Math.round(confidence * 100)}%
                                                </span>
                                            )}
                                            {conflict && (
                                                <span className="text-xs px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-400 flex items-center gap-1">
                                                    <AlertCircle className="h-3 w-3" />
                                                    Conflict
                                                </span>
                                            )}
                                        </div>

                                        {conflict ? (
                                            // Side-by-side conflict display
                                            <div className="grid grid-cols-2 gap-4">
                                                {/* Current Value */}
                                                <div className="p-3 bg-white/5 rounded-lg border border-white/10">
                                                    <div className="text-xs text-zinc-500 mb-1">Current Value</div>
                                                    <div className="text-white text-sm">
                                                        {field.type === "number" && typeof conflict.overviewValue === "number"
                                                            ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(conflict.overviewValue)
                                                            : Array.isArray(conflict.overviewValue)
                                                            ? conflict.overviewValue.join(", ") || "—"
                                                            : String(conflict.overviewValue || "—")}
                                                    </div>
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        onClick={() => handleResolveConflict(conflict, false)}
                                                        className="h-7 text-xs mt-2 text-zinc-400 hover:text-white"
                                                    >
                                                        <Check className="h-3 w-3 mr-1" />
                                                        Keep Current
                                                    </Button>
                                                </div>
                                                {/* Extracted Value */}
                                                <div className="p-3 bg-violet-500/10 rounded-lg border border-violet-500/20">
                                                    <div className="text-xs text-violet-400 mb-1">AI Extracted</div>
                                                    <div className="text-white text-sm">
                                                        {field.type === "number" && typeof conflict.extractedValue === "number"
                                                            ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(conflict.extractedValue)
                                                            : Array.isArray(conflict.extractedValue)
                                                            ? conflict.extractedValue.join(", ") || "—"
                                                            : String(conflict.extractedValue || "—")}
                                                    </div>
                                                    <Button
                                                        size="sm"
                                                        onClick={() => handleResolveConflict(conflict, true)}
                                                        className="h-7 text-xs mt-2 bg-violet-600 hover:bg-violet-700"
                                                    >
                                                        <ArrowRight className="h-3 w-3 mr-1" />
                                                        Use Extracted
                                                    </Button>
                                                </div>
                                            </div>
                                        ) : isEditing ? (
                                            <div className="flex items-center gap-2">
                                                {field.type === "select" ? (
                                                    <select
                                                        value={editValues[field.key] || ""}
                                                        onChange={(e) =>
                                                            setEditValues({ ...editValues, [field.key]: e.target.value })
                                                        }
                                                        className="flex-1 bg-white/5 border border-white/10 text-white h-9 rounded-md px-3 text-sm"
                                                    >
                                                        <option value="">Select...</option>
                                                        {field.options?.map((opt: { value: string; label: string }) => (
                                                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                                                        ))}
                                                    </select>
                                                ) : (
                                                    <Input
                                                        type={field.type}
                                                        value={editValues[field.key] || ""}
                                                        onChange={(e) =>
                                                            setEditValues({ ...editValues, [field.key]: e.target.value })
                                                        }
                                                        className="bg-white/5 border-white/10 text-white h-9"
                                                        autoFocus
                                                    />
                                                )}
                                                <Button size="sm" onClick={() => handleSave(field.key)} disabled={isSaving} className="h-9">
                                                    {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                                                </Button>
                                                <Button size="sm" variant="ghost" onClick={handleCancelEdit} className="h-9">
                                                    <X className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        ) : (
                                            <div className="flex justify-between items-start">
                                                <div className="text-white">
                                                    {field.type === "number" && typeof value === "number"
                                                        ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value)
                                                        : field.type === "select"
                                                        ? formatOutputFormat(value as string)
                                                        : Array.isArray(value)
                                                        ? value.join(", ")
                                                        : String(value || "—")}
                                                </div>
                                                <button
                                                    onClick={() => handleEdit(field.key)}
                                                    className="opacity-0 group-hover:opacity-100 text-zinc-600 hover:text-white transition-opacity"
                                                >
                                                    <Edit2 className="h-3.5 w-3.5" />
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )
                            })}

                        {/* Service Types */}
                        <div className="py-4 border-b border-white/5">
                            <div className="text-xs text-zinc-500 uppercase tracking-wider mb-2">
                                Service Types ({serviceTypes.length})
                            </div>
                            <div className="flex flex-wrap gap-2 mb-3">
                                {serviceTypes.map((type, i) => (
                                    <span
                                        key={i}
                                        className="px-2 py-1 bg-violet-500/10 text-violet-400 text-sm rounded-full flex items-center gap-1 group"
                                    >
                                        {type}
                                        <button
                                            onClick={() => handleRemoveServiceType(i)}
                                            className="ml-1 opacity-0 group-hover:opacity-100 transition-opacity hover:text-red-400"
                                        >
                                            <X className="h-3 w-3" />
                                        </button>
                                    </span>
                                ))}
                                {serviceTypes.length === 0 && (
                                    <span className="text-sm text-zinc-500 italic">None</span>
                                )}
                            </div>
                            <div className="flex gap-2">
                                <Input
                                    value={newServiceType}
                                    onChange={(e) => setNewServiceType(e.target.value)}
                                    placeholder="Add service type..."
                                    className="flex-1 bg-white/5 border-white/10 text-white h-8 text-sm"
                                    onKeyDown={(e) => e.key === "Enter" && handleAddServiceType()}
                                />
                                <Button size="sm" onClick={handleAddServiceType} disabled={!newServiceType.trim()} className="h-8">
                                    <Plus className="h-3 w-3" />
                                </Button>
                            </div>
                        </div>

                        {/* Technologies */}
                        <div className="py-4">
                            <div className="text-xs text-zinc-500 uppercase tracking-wider mb-2">
                                Technologies ({technologies.length})
                            </div>
                            <div className="flex flex-wrap gap-2 mb-3">
                                {technologies.map((tech, i) => (
                                    <span
                                        key={i}
                                        className="px-2 py-1 bg-blue-500/10 text-blue-400 text-sm rounded-full flex items-center gap-1 group"
                                    >
                                        {tech}
                                        <button
                                            onClick={() => handleRemoveTechnology(i)}
                                            className="ml-1 opacity-0 group-hover:opacity-100 transition-opacity hover:text-red-400"
                                        >
                                            <X className="h-3 w-3" />
                                        </button>
                                    </span>
                                ))}
                                {technologies.length === 0 && (
                                    <span className="text-sm text-zinc-500 italic">None</span>
                                )}
                            </div>
                            <div className="flex gap-2">
                                <Input
                                    value={newTechnology}
                                    onChange={(e) => setNewTechnology(e.target.value)}
                                    placeholder="Add technology..."
                                    className="flex-1 bg-white/5 border-white/10 text-white h-8 text-sm"
                                    onKeyDown={(e) => e.key === "Enter" && handleAddTechnology()}
                                />
                                <Button size="sm" onClick={handleAddTechnology} disabled={!newTechnology.trim()} className="h-8">
                                    <Plus className="h-3 w-3" />
                                </Button>
                            </div>
                        </div>
                    </div>

                    {/* Extraction History */}
                    <div>
                        <h3 className="text-sm font-medium text-zinc-400 mb-4 flex items-center gap-2">
                            <History className="h-4 w-4" />
                            Extraction History
                        </h3>
                        {extractionHistory.length > 0 ? (
                            <div className="border border-white/10 rounded-lg overflow-hidden">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-white/5 bg-white/[0.02]">
                                            <th className="text-left p-3 text-xs text-zinc-500 font-medium">Date & Time</th>
                                            <th className="text-left p-3 text-xs text-zinc-500 font-medium">Documents</th>
                                            <th className="text-left p-3 text-xs text-zinc-500 font-medium">Ran By</th>
                                            <th className="text-right p-3 text-xs text-zinc-500 font-medium">Processing</th>
                                            <th className="text-right p-3 text-xs text-zinc-500 font-medium">Tokens</th>
                                            <th className="text-right p-3 text-xs text-zinc-500 font-medium">Est. Cost</th>
                                            <th className="text-center p-3 text-xs text-zinc-500 font-medium">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {extractionHistory.map((item) => (
                                            <tr key={item.id} className="border-b border-white/5">
                                                <td className="p-3 text-white">{formatDate(item.date)}</td>
                                                <td className="p-3">
                                                    <div className="flex flex-col gap-1">
                                                        {item.documents && item.documents.length > 0 ? (
                                                            item.documents.map((doc, i) => (
                                                                <div key={i} className="flex items-center gap-1.5 text-zinc-400">
                                                                    <FileText className="h-3 w-3 text-zinc-500 flex-shrink-0" />
                                                                    <span className="text-xs truncate max-w-[150px]" title={doc}>
                                                                        {doc}
                                                                    </span>
                                                                </div>
                                                            ))
                                                        ) : (
                                                            <span className="text-xs text-zinc-500 italic">No documents</span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="p-3 text-zinc-400">
                                                    <div className="flex items-center gap-2">
                                                        <User className="h-3 w-3" />
                                                        {item.ran_by}
                                                    </div>
                                                </td>
                                                <td className="p-3 text-zinc-400 text-right">
                                                    {(item.processing_time_ms / 1000).toFixed(1)}s
                                                </td>
                                                <td className="p-3 text-zinc-400 text-right">
                                                    {(item.input_tokens + item.output_tokens).toLocaleString()}
                                                </td>
                                                <td className="p-3 text-zinc-400 text-right">
                                                    {formatCurrency(item.estimated_cost_usd)}
                                                </td>
                                                <td className="p-3 text-center">
                                                    <span className={cn(
                                                        "px-2 py-0.5 rounded-full text-xs",
                                                        item.status === "success"
                                                            ? "bg-green-500/10 text-green-400"
                                                            : "bg-red-500/10 text-red-400"
                                                    )}>
                                                        {item.status}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="text-center py-8 text-zinc-500 border border-dashed border-white/10 rounded-lg">
                                <History className="h-6 w-6 mx-auto mb-2 opacity-50" />
                                <p className="text-sm">No extraction history</p>
                                <p className="text-xs mt-1">Run an extraction to see history</p>
                            </div>
                        )}
                    </div>

                    {/* Totals & Legend */}
                    <div className="grid grid-cols-2 gap-6">
                        {/* Totals */}
                        <div>
                            <h3 className="text-sm font-medium text-zinc-400 mb-4">Totals</h3>
                            <div className="space-y-3">
                                <div className="flex items-center justify-between p-3 bg-white/[0.02] rounded-lg border border-white/5">
                                    <span className="text-sm text-zinc-400 flex items-center gap-2">
                                        <Clock className="h-4 w-4" />
                                        Processing Time
                                    </span>
                                    <span className="text-sm text-white font-medium">
                                        {(totalProcessingTime / 1000).toFixed(1)}s
                                    </span>
                                </div>
                                <div className="flex items-center justify-between p-3 bg-white/[0.02] rounded-lg border border-white/5">
                                    <span className="text-sm text-zinc-400 flex items-center gap-2">
                                        <Zap className="h-4 w-4" />
                                        Tokens Used
                                    </span>
                                    <span className="text-sm text-white font-medium">
                                        {totalTokens.toLocaleString()}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between p-3 bg-white/[0.02] rounded-lg border border-white/5">
                                    <span className="text-sm text-zinc-400 flex items-center gap-2">
                                        <DollarSign className="h-4 w-4" />
                                        Est. Cost
                                    </span>
                                    <span className="text-sm text-white font-medium">
                                        {formatCurrency(totalCost)}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Confidence Legend */}
                        <div>
                            <h3 className="text-sm font-medium text-zinc-400 mb-4 flex items-center gap-2">
                                <Info className="h-4 w-4" />
                                Confidence Levels
                            </h3>
                            <div className="space-y-3">
                                <div className="flex items-center gap-3 p-3 bg-white/[0.02] rounded-lg border border-white/5">
                                    <span className="w-3 h-3 rounded-full bg-green-500"></span>
                                    <span className="text-sm text-zinc-400">80%+ High confidence</span>
                                </div>
                                <div className="flex items-center gap-3 p-3 bg-white/[0.02] rounded-lg border border-white/5">
                                    <span className="w-3 h-3 rounded-full bg-yellow-500"></span>
                                    <span className="text-sm text-zinc-400">50-79% Medium confidence</span>
                                </div>
                                <div className="flex items-center gap-3 p-3 bg-white/[0.02] rounded-lg border border-white/5">
                                    <span className="w-3 h-3 rounded-full bg-red-500"></span>
                                    <span className="text-sm text-zinc-400">&lt;50% Low - Review needed</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Objectives Tab */}
            {activeTab === "objectives" && (
                <div className="space-y-6">
                    <p className="text-xs text-zinc-500">Proposal objectives extracted from RFP documents</p>

                    {!extractionComplete ? (
                        <div className="text-center py-12 text-zinc-500 border border-dashed border-white/10 rounded-lg">
                            <Target className="h-8 w-8 mx-auto mb-2 opacity-50" />
                            <p className="text-sm">No objectives extracted yet</p>
                            <p className="text-xs mt-1">Go to Overview tab to start extraction</p>
                        </div>
                    ) : (
                        <>
                            <div className="space-y-2">
                                {objectives.map((obj, index) => (
                                    <div
                                        key={index}
                                        className="p-4 bg-white/[0.02] rounded-lg border border-white/5 group"
                                    >
                                        {editingObjectiveIndex === index ? (
                                            <div className="flex items-center gap-2">
                                                <Input
                                                    value={obj.text}
                                                    onChange={(e) => {
                                                        const updated = [...objectives]
                                                        updated[index] = { ...updated[index], text: e.target.value }
                                                        setObjectives(updated)
                                                    }}
                                                    className="flex-1 bg-white/5 border-white/10 text-white"
                                                    autoFocus
                                                />
                                                <Button size="sm" onClick={() => handleUpdateObjective(index, objectives[index].text)}>
                                                    <Save className="h-4 w-4" />
                                                </Button>
                                                <Button size="sm" variant="ghost" onClick={() => setEditingObjectiveIndex(null)}>
                                                    <X className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        ) : (
                                            <div className="flex items-start gap-3">
                                                <CheckCircle2 className="h-5 w-5 text-green-400 flex-shrink-0 mt-0.5" />
                                                <div className="flex-1">
                                                    <span className="text-sm text-white">{obj.text}</span>
                                                    {obj.citation && (
                                                        <div className="mt-1 text-xs text-zinc-500 italic flex items-center gap-1">
                                                            <FileText className="h-3 w-3" />
                                                            {obj.citation}
                                                        </div>
                                                    )}
                                                </div>
                                                {obj.confidence < 1.0 && (
                                                    <span className={cn(
                                                        "text-xs px-1.5 py-0.5 rounded",
                                                        getConfidenceBg(obj.confidence),
                                                        getConfidenceColor(obj.confidence)
                                                    )}>
                                                        {Math.round(obj.confidence * 100)}%
                                                    </span>
                                                )}
                                                <button
                                                    onClick={() => setEditingObjectiveIndex(index)}
                                                    className="opacity-0 group-hover:opacity-100 text-zinc-600 hover:text-white transition-opacity"
                                                >
                                                    <Edit2 className="h-4 w-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleRemoveObjective(index)}
                                                    className="opacity-0 group-hover:opacity-100 text-zinc-600 hover:text-red-400 transition-opacity"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                ))}

                                {objectives.length === 0 && (
                                    <div className="text-center py-8 text-zinc-500">
                                        <p className="text-sm">No objectives found</p>
                                    </div>
                                )}
                            </div>

                            <div className="flex gap-2 pt-4 border-t border-white/10">
                                <Input
                                    value={newObjective}
                                    onChange={(e) => setNewObjective(e.target.value)}
                                    placeholder="Add a new objective..."
                                    className="flex-1 bg-white/5 border-white/10 text-white"
                                    onKeyDown={(e) => e.key === "Enter" && handleAddObjective()}
                                />
                                <Button onClick={handleAddObjective} disabled={!newObjective.trim()}>
                                    <Plus className="h-4 w-4 mr-2" />
                                    Add
                                </Button>
                            </div>
                        </>
                    )}
                </div>
            )}

            {/* Requirements Tab */}
            {activeTab === "requirements" && (
                <div className="space-y-6">
                    <p className="text-xs text-zinc-500">Requirements extracted from RFP documents</p>

                    {!extractionComplete ? (
                        <div className="text-center py-12 text-zinc-500 border border-dashed border-white/10 rounded-lg">
                            <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                            <p className="text-sm">No requirements extracted yet</p>
                            <p className="text-xs mt-1">Go to Overview tab to start extraction</p>
                        </div>
                    ) : (
                        <>
                            <div className="space-y-2">
                                {requirements.map((req, index) => (
                                    <div
                                        key={index}
                                        className="p-4 bg-white/[0.02] rounded-lg border border-white/5 group"
                                    >
                                        {editingRequirementIndex === index ? (
                                            <div className="flex items-center gap-2">
                                                <Input
                                                    value={req.text}
                                                    onChange={(e) => {
                                                        const updated = [...requirements]
                                                        updated[index] = { ...updated[index], text: e.target.value }
                                                        setRequirements(updated)
                                                    }}
                                                    className="flex-1 bg-white/5 border-white/10 text-white"
                                                    autoFocus
                                                />
                                                <Button size="sm" onClick={() => handleUpdateRequirement(index, requirements[index].text)}>
                                                    <Save className="h-4 w-4" />
                                                </Button>
                                                <Button size="sm" variant="ghost" onClick={() => setEditingRequirementIndex(null)}>
                                                    <X className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        ) : (
                                            <div className="flex items-start gap-3">
                                                <Check className="h-5 w-5 text-blue-400 flex-shrink-0 mt-0.5" />
                                                <div className="flex-1">
                                                    <span className="text-sm text-white">{req.text}</span>
                                                    {req.citation && (
                                                        <div className="mt-1 text-xs text-zinc-500 italic flex items-center gap-1">
                                                            <FileText className="h-3 w-3" />
                                                            {req.citation}
                                                        </div>
                                                    )}
                                                </div>
                                                {req.confidence < 1.0 && (
                                                    <span className={cn(
                                                        "text-xs px-1.5 py-0.5 rounded",
                                                        getConfidenceBg(req.confidence),
                                                        getConfidenceColor(req.confidence)
                                                    )}>
                                                        {Math.round(req.confidence * 100)}%
                                                    </span>
                                                )}
                                                <button
                                                    onClick={() => setEditingRequirementIndex(index)}
                                                    className="opacity-0 group-hover:opacity-100 text-zinc-600 hover:text-white transition-opacity"
                                                >
                                                    <Edit2 className="h-4 w-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleRemoveRequirement(index)}
                                                    className="opacity-0 group-hover:opacity-100 text-zinc-600 hover:text-red-400 transition-opacity"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                ))}

                                {requirements.length === 0 && (
                                    <div className="text-center py-8 text-zinc-500">
                                        <p className="text-sm">No requirements found</p>
                                    </div>
                                )}
                            </div>

                            <div className="flex gap-2 pt-4 border-t border-white/10">
                                <Input
                                    value={newRequirement}
                                    onChange={(e) => setNewRequirement(e.target.value)}
                                    placeholder="Add a new requirement..."
                                    className="flex-1 bg-white/5 border-white/10 text-white"
                                    onKeyDown={(e) => e.key === "Enter" && handleAddRequirement()}
                                />
                                <Button onClick={handleAddRequirement} disabled={!newRequirement.trim()}>
                                    <Plus className="h-4 w-4 mr-2" />
                                    Add
                                </Button>
                            </div>
                        </>
                    )}
                </div>
            )}

            {/* Similar Pursuits Tab */}
            {activeTab === "similar-pursuits" && (
                <div className="space-y-6">
                    {/* Description */}
                    <p className="text-sm text-zinc-400 leading-relaxed">
                        Search for similar past pursuits using vector similarity and weighted scoring.
                        Select pursuits and specific components to use as reference material for your proposal.
                    </p>

                    {/* Scoring Weights Info */}
                    <div className="p-4 bg-white/[0.02] rounded-lg border border-white/5">
                        <h4 className="text-xs text-zinc-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                            <Info className="h-3.5 w-3.5" />
                            Scoring Algorithm Weights
                        </h4>
                        <div className="grid grid-cols-3 gap-3 text-xs">
                            <div className="flex items-center justify-between">
                                <span className="text-zinc-400">Semantic</span>
                                <span className="text-white font-medium">{(SCORING_WEIGHTS.semantic * 100).toFixed(0)}%</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-zinc-400">Metadata</span>
                                <span className="text-white font-medium">{(SCORING_WEIGHTS.metadata * 100).toFixed(0)}%</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-zinc-400">Component</span>
                                <span className="text-white font-medium">{(SCORING_WEIGHTS.component * 100).toFixed(0)}%</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-zinc-400">Quality</span>
                                <span className="text-white font-medium">{(SCORING_WEIGHTS.quality * 100).toFixed(0)}%</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-zinc-400">Win Status</span>
                                <span className="text-white font-medium">{(SCORING_WEIGHTS.win_status * 100).toFixed(0)}%</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-zinc-400">Recency</span>
                                <span className="text-white font-medium">{(SCORING_WEIGHTS.recency * 100).toFixed(0)}%</span>
                            </div>
                        </div>
                    </div>

                    {/* Search Button */}
                    {!searchComplete ? (
                        <div className="p-6 border border-white/10 rounded-lg">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-blue-500/10 rounded-lg">
                                        <Search className="h-5 w-5 text-blue-400" />
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-medium text-white">Search Similar Pursuits</h3>
                                        <p className="text-xs text-zinc-500">
                                            {extractionComplete
                                                ? "Uses extracted metadata to find relevant past pursuits"
                                                : "Run metadata extraction first for best results"}
                                        </p>
                                    </div>
                                </div>
                                <Button
                                    onClick={handleSearchSimilarPursuits}
                                    disabled={isSearching}
                                    size="sm"
                                    className="bg-blue-600 hover:bg-blue-700"
                                >
                                    {isSearching ? (
                                        <>
                                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                            Searching...
                                        </>
                                    ) : (
                                        <>
                                            <Search className="h-4 w-4 mr-2" />
                                            Search
                                        </>
                                    )}
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <>
                            {/* Results Header */}
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <h3 className="text-sm font-medium text-white">
                                        Found {similarPursuits.length} Similar Pursuits
                                    </h3>
                                    {selectedPursuits.size > 0 && (
                                        <span className="px-2 py-0.5 bg-blue-500/10 text-blue-400 text-xs rounded-full">
                                            {selectedPursuits.size} selected
                                        </span>
                                    )}
                                </div>
                                <div className="flex gap-2">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setShowFilters(!showFilters)}
                                        className="text-zinc-400"
                                    >
                                        <Filter className="h-4 w-4 mr-1" />
                                        Filters
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={handleSearchSimilarPursuits}
                                        disabled={isSearching}
                                        className="text-zinc-400"
                                    >
                                        <Search className="h-4 w-4 mr-1" />
                                        Re-search
                                    </Button>
                                </div>
                            </div>

                            {/* Results List */}
                            <div className="space-y-3">
                                {similarPursuits.map((pursuit) => {
                                    const isSelected = selectedPursuits.has(pursuit.pursuit_id)
                                    const isExpanded = expandedPursuits.has(pursuit.pursuit_id)
                                    const pursuitComponents = selectedComponents[pursuit.pursuit_id] || new Set()

                                    return (
                                        <div
                                            key={pursuit.pursuit_id}
                                            className={cn(
                                                "border rounded-lg overflow-hidden transition-colors",
                                                isSelected
                                                    ? "border-blue-500/50 bg-blue-500/5"
                                                    : "border-white/10 bg-white/[0.02]"
                                            )}
                                        >
                                            {/* Pursuit Header */}
                                            <div className="p-4">
                                                <div className="flex items-start gap-3">
                                                    {/* Selection Checkbox */}
                                                    <button
                                                        onClick={() => togglePursuitSelection(pursuit.pursuit_id)}
                                                        className={cn(
                                                            "mt-1 w-5 h-5 rounded border flex items-center justify-center flex-shrink-0",
                                                            isSelected
                                                                ? "bg-blue-500 border-blue-500"
                                                                : "border-white/20 hover:border-white/40"
                                                        )}
                                                    >
                                                        {isSelected && <Check className="h-3.5 w-3.5 text-white" />}
                                                    </button>

                                                    {/* Main Content */}
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            <h4 className="text-sm font-medium text-white truncate">
                                                                {pursuit.pursuit_name}
                                                            </h4>
                                                            <span className={cn(
                                                                "px-1.5 py-0.5 rounded text-xs capitalize",
                                                                getWinStatusColor(pursuit.win_status)
                                                            )}>
                                                                {pursuit.win_status}
                                                            </span>
                                                            {pursuit.quality_tag && (
                                                                <span className="px-1.5 py-0.5 bg-amber-500/10 text-amber-400 rounded text-xs flex items-center gap-1">
                                                                    <Trophy className="h-3 w-3" />
                                                                    {pursuit.quality_tag}
                                                                </span>
                                                            )}
                                                        </div>

                                                        {/* Metadata Row */}
                                                        <div className="flex items-center gap-3 mt-2 text-xs text-zinc-500">
                                                            <span className="flex items-center gap-1">
                                                                <Building2 className="h-3 w-3" />
                                                                {pursuit.industry}
                                                            </span>
                                                            <span className="flex items-center gap-1">
                                                                <Calendar className="h-3 w-3" />
                                                                {new Date(pursuit.created_at).toLocaleDateString()}
                                                            </span>
                                                            <span className="flex items-center gap-1">
                                                                <DollarSign className="h-3 w-3" />
                                                                {formatFeesDisplay(pursuit.estimated_fees)}
                                                            </span>
                                                            <span className="flex items-center gap-1">
                                                                <Layers className="h-3 w-3" />
                                                                {pursuit.document_type?.toUpperCase()}
                                                            </span>
                                                        </div>

                                                        {/* Match Explanation */}
                                                        <p className="mt-2 text-xs text-zinc-400 line-clamp-2">
                                                            {pursuit.match_explanation}
                                                        </p>

                                                        {/* Tags */}
                                                        <div className="flex flex-wrap gap-1.5 mt-2">
                                                            {pursuit.service_types.slice(0, 3).map((svc, i) => (
                                                                <span key={i} className="px-1.5 py-0.5 bg-violet-500/10 text-violet-400 text-xs rounded">
                                                                    {svc}
                                                                </span>
                                                            ))}
                                                            {pursuit.technologies.slice(0, 3).map((tech, i) => (
                                                                <span key={i} className="px-1.5 py-0.5 bg-blue-500/10 text-blue-400 text-xs rounded">
                                                                    {tech}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    </div>

                                                    {/* Score */}
                                                    <div className="text-right flex-shrink-0">
                                                        <div className={cn("text-xl font-bold", getScoreColor(pursuit.similarity_score))}>
                                                            {Math.round(pursuit.similarity_score * 100)}%
                                                        </div>
                                                        <div className="text-xs text-zinc-500">match</div>
                                                    </div>
                                                </div>

                                                {/* Expand Button */}
                                                <button
                                                    onClick={() => togglePursuitExpansion(pursuit.pursuit_id)}
                                                    className="mt-3 flex items-center gap-1 text-xs text-zinc-400 hover:text-white transition-colors"
                                                >
                                                    {isExpanded ? (
                                                        <>
                                                            <ChevronDown className="h-4 w-4" />
                                                            Hide components
                                                        </>
                                                    ) : (
                                                        <>
                                                            <ChevronRight className="h-4 w-4" />
                                                            Select specific components ({pursuit.available_components.length} available)
                                                        </>
                                                    )}
                                                </button>
                                            </div>

                                            {/* Expanded Components */}
                                            {isExpanded && (
                                                <div className="border-t border-white/5 p-4 bg-black/20">
                                                    <div className="flex items-center justify-between mb-3">
                                                        <h5 className="text-xs text-zinc-500 uppercase tracking-wider">
                                                            Available Components
                                                        </h5>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => selectAllComponents(pursuit.pursuit_id, pursuit.available_components)}
                                                            className="text-xs h-6 px-2"
                                                        >
                                                            Select All
                                                        </Button>
                                                    </div>

                                                    <div className="space-y-2">
                                                        {pursuit.available_components.map((component) => {
                                                            const detail = pursuit.component_details[component]
                                                            const isCompSelected = pursuitComponents.has(component)
                                                            const slideMap = pursuit.slide_mappings?.[component]
                                                            const sectionMap = pursuit.section_mappings?.[component]

                                                            return (
                                                                <div
                                                                    key={component}
                                                                    onClick={() => toggleComponentSelection(pursuit.pursuit_id, component)}
                                                                    className={cn(
                                                                        "p-3 rounded-lg border cursor-pointer transition-colors",
                                                                        isCompSelected
                                                                            ? "border-blue-500/50 bg-blue-500/10"
                                                                            : "border-white/5 bg-white/[0.02] hover:bg-white/[0.04]"
                                                                    )}
                                                                >
                                                                    <div className="flex items-start gap-3">
                                                                        <div className={cn(
                                                                            "mt-0.5 w-4 h-4 rounded border flex items-center justify-center flex-shrink-0",
                                                                            isCompSelected
                                                                                ? "bg-blue-500 border-blue-500"
                                                                                : "border-white/20"
                                                                        )}>
                                                                            {isCompSelected && <Check className="h-3 w-3 text-white" />}
                                                                        </div>

                                                                        <div className="flex-1 min-w-0">
                                                                            <div className="flex items-center gap-2">
                                                                                <span className="text-sm text-white">{component}</span>
                                                                                {detail && (
                                                                                    <span className={cn(
                                                                                        "text-xs px-1.5 py-0.5 rounded",
                                                                                        getConfidenceBg(detail.relevance_score),
                                                                                        getConfidenceColor(detail.relevance_score)
                                                                                    )}>
                                                                                        {Math.round(detail.relevance_score * 100)}%
                                                                                    </span>
                                                                                )}
                                                                            </div>

                                                                            {detail?.preview && (
                                                                                <p className="text-xs text-zinc-500 mt-1 line-clamp-1">
                                                                                    {detail.preview}
                                                                                </p>
                                                                            )}

                                                                            <div className="flex items-center gap-3 mt-1.5 text-xs text-zinc-600">
                                                                                {detail?.word_count && (
                                                                                    <span>{detail.word_count} words</span>
                                                                                )}
                                                                                {slideMap && (
                                                                                    <span>Slides {slideMap.start_slide}-{slideMap.end_slide}</span>
                                                                                )}
                                                                                {sectionMap && (
                                                                                    <span>Pages {sectionMap.start_page}-{sectionMap.end_page || "..."}</span>
                                                                                )}
                                                                            </div>
                                                                        </div>

                                                                        <Button
                                                                            variant="ghost"
                                                                            size="sm"
                                                                            className="h-7 px-2"
                                                                            onClick={(e) => {
                                                                                e.stopPropagation()
                                                                                // Preview would open a modal
                                                                            }}
                                                                        >
                                                                            <Eye className="h-3.5 w-3.5" />
                                                                        </Button>
                                                                    </div>
                                                                </div>
                                                            )
                                                        })}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )
                                })}
                            </div>

                            {/* Selection Summary */}
                            {selectedPursuits.size > 0 && (
                                <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                                    <div className="flex items-center justify-between mb-3">
                                        <h4 className="text-sm font-medium text-white">
                                            Selection Summary ({selectedPursuits.size} pursuit{selectedPursuits.size !== 1 ? "s" : ""})
                                        </h4>
                                        <div className="flex items-center gap-2">
                                            {selectionsSaved ? (
                                                <span className="text-xs text-green-400 flex items-center gap-1">
                                                    <Check className="h-3 w-3" />
                                                    Saved
                                                </span>
                                            ) : (
                                                <span className="text-xs text-amber-400">Unsaved changes</span>
                                            )}
                                            <Button
                                                size="sm"
                                                onClick={handleSaveSelections}
                                                disabled={isSavingSelections || selectionsSaved}
                                                className="bg-blue-600 hover:bg-blue-700 h-7 text-xs"
                                            >
                                                {isSavingSelections ? (
                                                    <Loader2 className="h-3 w-3 animate-spin mr-1" />
                                                ) : (
                                                    <Save className="h-3 w-3 mr-1" />
                                                )}
                                                {selectionsSaved ? "Saved" : "Save for Gap Analysis"}
                                            </Button>
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        {Array.from(selectedPursuits).map(pid => {
                                            const p = similarPursuits.find(sp => sp.pursuit_id === pid)
                                            const comps = selectedComponents[pid]
                                            return (
                                                <div key={pid} className="text-xs text-zinc-400">
                                                    <span className="text-white">{p?.pursuit_name}</span>
                                                    {comps && comps.size > 0 && (
                                                        <span className="ml-2">
                                                            ({comps.size} component{comps.size !== 1 ? "s" : ""}: {Array.from(comps).join(", ")})
                                                        </span>
                                                    )}
                                                </div>
                                            )
                                        })}
                                    </div>
                                    <p className="text-xs text-zinc-500 mt-3">
                                        Selected pursuits will be used as reference material in Gap Analysis.
                                    </p>
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}

            {/* Outline Templates Tab */}
            {activeTab === "outline-templates" && (
                <div className="space-y-6">
                    <p className="text-xs text-zinc-500">
                        Select a proposal outline template to structure your response. Templates recommended for your industry are highlighted.
                    </p>

                    {/* Current Selection */}
                    {selectedTemplateId && (
                        <div className="p-4 bg-violet-500/10 border border-violet-500/20 rounded-lg">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-violet-500/20 rounded-lg">
                                        <CheckCircle2 className="h-5 w-5 text-violet-400" />
                                    </div>
                                    <div>
                                        <h4 className="text-sm font-medium text-white">
                                            Selected: {templates.find(t => t.id === selectedTemplateId)?.title}
                                        </h4>
                                        <p className="text-xs text-zinc-500">
                                            {templates.find(t => t.id === selectedTemplateId)?.category} template
                                        </p>
                                    </div>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleSelectTemplate("")}
                                    className="text-zinc-400 hover:text-white"
                                >
                                    <X className="h-4 w-4 mr-1" />
                                    Clear
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* Industry Recommendation */}
                    {pursuit?.industry && recommendedTemplateIds.length > 0 && (
                        <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                            <div className="flex items-center gap-2 mb-2">
                                <Zap className="h-4 w-4 text-blue-400" />
                                <h4 className="text-sm font-medium text-white">
                                    Recommended for {pursuit.industry}
                                </h4>
                            </div>
                            <p className="text-xs text-zinc-400">
                                Based on your industry, we recommend the following template{recommendedTemplateIds.length > 1 ? "s" : ""}:
                                {" "}
                                {recommendedTemplateIds.map(id => templates.find(t => t.id === id)?.title).filter(Boolean).join(", ")}
                            </p>
                        </div>
                    )}

                    {/* Category Filter */}
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-zinc-500">Filter by category:</span>
                        <div className="flex gap-1">
                            {categories.map(cat => (
                                <button
                                    key={cat}
                                    onClick={() => setTemplateFilter(cat)}
                                    className={cn(
                                        "px-3 py-1 text-xs rounded-full transition-colors",
                                        templateFilter === cat
                                            ? "bg-white/10 text-white"
                                            : "text-zinc-500 hover:text-white hover:bg-white/5"
                                    )}
                                >
                                    {cat}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Template Grid */}
                    <div className="grid grid-cols-2 gap-4">
                        {filteredTemplates.map(template => {
                            const isSelected = selectedTemplateId === template.id
                            const isRecommended = recommendedTemplateIds.includes(template.id)
                            const IconComponent = template.icon

                            return (
                                <div
                                    key={template.id}
                                    onClick={() => !isSavingTemplate && handleSelectTemplate(template.id)}
                                    className={cn(
                                        "p-4 rounded-lg border cursor-pointer transition-all relative",
                                        isSelected
                                            ? "border-violet-500 bg-violet-500/10"
                                            : isRecommended
                                            ? "border-blue-500/50 bg-blue-500/5 hover:bg-blue-500/10"
                                            : "border-white/10 bg-white/[0.02] hover:bg-white/[0.04]"
                                    )}
                                >
                                    {/* Recommended Badge */}
                                    {isRecommended && !isSelected && (
                                        <div className="absolute -top-2 -right-2 px-2 py-0.5 bg-blue-500 text-white text-xs rounded-full">
                                            Recommended
                                        </div>
                                    )}

                                    {/* Selected Badge */}
                                    {isSelected && (
                                        <div className="absolute -top-2 -right-2 px-2 py-0.5 bg-violet-500 text-white text-xs rounded-full flex items-center gap-1">
                                            <Check className="h-3 w-3" />
                                            Selected
                                        </div>
                                    )}

                                    <div className="flex items-start gap-3">
                                        <div className={cn("p-2 rounded-lg", template.color + "/20")}>
                                            <IconComponent className={cn("h-5 w-5", template.color.replace("bg-", "text-"))} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h4 className="text-sm font-medium text-white">{template.title}</h4>
                                            <p className="text-xs text-zinc-500 mt-0.5">{template.category}</p>
                                            <p className="text-xs text-zinc-400 mt-2 line-clamp-2">{template.description}</p>
                                        </div>
                                    </div>

                                    {/* Template Sections */}
                                    <div className="mt-4 pt-3 border-t border-white/5">
                                        <h5 className="text-xs text-zinc-500 uppercase tracking-wider mb-2">Sections</h5>
                                        <div className="space-y-1">
                                            {template.details.map((section, i) => (
                                                <div key={i} className="text-xs text-zinc-400 flex items-center gap-2">
                                                    <div className="w-1 h-1 rounded-full bg-zinc-600" />
                                                    {section}
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Select Button */}
                                    <div className="mt-4">
                                        <Button
                                            size="sm"
                                            variant={isSelected ? "default" : "outline"}
                                            disabled={isSavingTemplate}
                                            className={cn(
                                                "w-full",
                                                isSelected && "bg-violet-600 hover:bg-violet-700"
                                            )}
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                handleSelectTemplate(isSelected ? "" : template.id)
                                            }}
                                        >
                                            {isSavingTemplate ? (
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                            ) : isSelected ? (
                                                <>
                                                    <Check className="h-4 w-4 mr-1" />
                                                    Selected
                                                </>
                                            ) : (
                                                "Select Template"
                                            )}
                                        </Button>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>
            )}
        </div>
    )
}
