"use client"

import { useEffect, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ArrowLeft, Send, Paperclip, FileText, Bot, Loader2, Download, Calendar, User } from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { fetchApi } from "@/lib/api"
import { MetadataDisplay } from "@/components/metadata-display"

interface Pursuit {
    id: string
    entity_name: string
    internal_pursuit_owner_name: string
    status: string
    files: any[]
    metadata?: any
    created_at?: string
    client_pursuit_owner_name?: string
    client_pursuit_owner_email?: string
    industry?: string
    service_types?: string[]
    technologies?: string[]
    geography?: string
    submission_due_date?: string
    estimated_fees_usd?: number
    expected_format?: string
    requirements_text?: string
}

export default function PursuitDetailPage({ params }: { params: { id: string } }) {
    const [pursuit, setPursuit] = useState<Pursuit | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [activeTab, setActiveTab] = useState("overview")
    const [messages, setMessages] = useState([
        { role: "assistant", content: "Hello! I've analyzed the RFP. What would you like to know?" }
    ])
    const [input, setInput] = useState("")
    const [isUploading, setIsUploading] = useState(false)
    const [isExtracting, setIsExtracting] = useState(false)
    const [uploadSuccess, setUploadSuccess] = useState(false)

    const tabs = [
        { id: "overview", label: "Overview" },
        { id: "files", label: "Files" },
        { id: "chat", label: "AI Assistant" },
    ]

    useEffect(() => {
        async function loadPursuit() {
            try {
                const data = await fetchApi(`/pursuits/${params.id}`)
                setPursuit(data)
            } catch (error) {
                console.error("Failed to load pursuit", error)
            } finally {
                setIsLoading(false)
            }
        }
        loadPursuit()
    }, [params.id])

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || !e.target.files[0]) return

        setIsUploading(true)
        setUploadSuccess(false)
        const file = e.target.files[0]
        const formData = new FormData()
        formData.append("file", file)
        formData.append("file_type", "rfp")

        try {
            await fetchApi(`/pursuits/${params.id}/files`, {
                method: "POST",
                body: formData
            })

            const data = await fetchApi(`/pursuits/${params.id}`)
            setPursuit(data)
            setUploadSuccess(true)
            setActiveTab("files")

            // Auto-trigger extraction
            handleExtract()
        } catch (error) {
            console.error("Upload failed", error)
        } finally {
            setIsUploading(false)
        }
    }

    const handleExtract = async () => {
        setIsExtracting(true)
        try {
            await fetchApi(`/pursuits/${params.id}/extract`, { method: "POST" })
            const data = await fetchApi(`/pursuits/${params.id}`)
            setPursuit(data)
            setActiveTab("overview")
        } catch (error) {
            console.error("Extraction failed", error)
        } finally {
            setIsExtracting(false)
        }
    }

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!input.trim()) return

        const userMessage = input
        setMessages(prev => [...prev, { role: "user", content: userMessage }])
        setInput("")

        setMessages(prev => [...prev, { role: "assistant", content: "Thinking...", isLoading: true }])

        try {
            const response = await fetchApi(`/pursuits/${params.id}/chat`, {
                method: "POST",
                body: JSON.stringify({ message: userMessage })
            })

            setMessages(prev => {
                const newMessages = [...prev]
                newMessages.pop()
                return [...newMessages, { role: "assistant", content: response.response }]
            })
        } catch (error) {
            console.error("Chat failed", error)
            setMessages(prev => {
                const newMessages = [...prev]
                newMessages.pop()
                return [...newMessages, { role: "assistant", content: "Sorry, I encountered an error processing your request." }]
            })
        }
    }

    if (isLoading || !pursuit) {
        return (
            <div className="flex h-[50vh] items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        )
    }

    return (
        <div className="space-y-6 h-[calc(100vh-100px)] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                    <Button asChild variant="ghost" size="icon" className="hover:bg-white/10 text-muted-foreground hover:text-white">
                        <Link href="/dashboard">
                            <ArrowLeft className="h-5 w-5" />
                        </Link>
                    </Button>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-white">{pursuit.entity_name}</h1>
                        <div className="flex items-center space-x-4 text-sm text-muted-foreground mt-1">
                            <span className="flex items-center">
                                <User className="h-3 w-3 mr-1" />
                                {pursuit.internal_pursuit_owner_name}
                            </span>
                            <div className="flex items-center">
                                <div className={cn(
                                    "h-2 w-2 rounded-full mr-2",
                                    pursuit.status === 'In Progress' ? 'bg-blue-500' :
                                        pursuit.status === 'Review' ? 'bg-yellow-500' : 'bg-slate-500'
                                )} />
                                {pursuit.status}
                            </div>
                        </div>
                    </div>
                </div>
                <Button
                    onClick={handleExtract}
                    disabled={isExtracting || !pursuit.files || pursuit.files.length === 0}
                    className="bg-primary hover:bg-primary/90 shadow-[0_0_20px_rgba(124,58,237,0.3)] border border-white/10"
                >
                    {isExtracting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Bot className="mr-2 h-4 w-4" />}
                    Extract Metadata
                </Button>
            </div>

            {/* Tabs */}
            <div className="flex space-x-1 bg-white/5 p-1 rounded-xl w-fit backdrop-blur-sm border border-white/10">
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={cn(
                            "relative px-6 py-2.5 text-sm font-medium rounded-lg transition-all duration-200",
                            activeTab === tab.id ? "text-white shadow-lg" : "text-muted-foreground hover:text-white hover:bg-white/5"
                        )}
                    >
                        {activeTab === tab.id && (
                            <motion.div
                                layoutId="active-tab"
                                className="absolute inset-0 bg-primary rounded-lg"
                                transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                            />
                        )}
                        <span className="relative z-10">{tab.label}</span>
                    </button>
                ))}
            </div>

            {/* Content */}
            <div className="flex-1 min-h-0">
                <AnimatePresence mode="wait">
                    {activeTab === "overview" && (
                        <motion.div
                            key="overview"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="grid gap-6 md:grid-cols-3 h-full"
                        >
                            <div className="md:col-span-2 space-y-6">
                                <div className="glass-card rounded-xl p-6">
                                    <h3 className="text-lg font-semibold text-white mb-4">Requirements Summary</h3>
                                    <MetadataDisplay data={pursuit} />
                                </div>
                            </div>

                            <div className="space-y-6">
                                <div className="glass-card rounded-xl p-6">
                                    <h3 className="text-lg font-semibold text-white mb-4">Metadata</h3>
                                    <div className="space-y-4">
                                        <div className="p-3 rounded-lg bg-white/5 border border-white/5">
                                            <div className="text-xs text-muted-foreground mb-1">Status</div>
                                            <div className="font-medium text-blue-400">{pursuit.status}</div>
                                        </div>
                                        <div className="p-3 rounded-lg bg-white/5 border border-white/5">
                                            <div className="text-xs text-muted-foreground mb-1">Owner</div>
                                            <div className="font-medium text-white">{pursuit.internal_pursuit_owner_name}</div>
                                        </div>
                                        <div className="p-3 rounded-lg bg-white/5 border border-white/5">
                                            <div className="text-xs text-muted-foreground mb-1">Created</div>
                                            <div className="font-medium text-white">
                                                {pursuit.created_at ? new Date(pursuit.created_at).toLocaleDateString() : 'N/A'}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {activeTab === "files" && (
                        <motion.div
                            key="files"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="h-full"
                        >
                            <div className="glass-card rounded-xl p-6 h-full flex flex-col">
                                <div className="flex items-center justify-between mb-6">
                                    <div>
                                        <h3 className="text-lg font-semibold text-white">Project Files</h3>
                                        <p className="text-sm text-muted-foreground">Manage RFP documents and attachments</p>
                                    </div>
                                </div>

                                <div className="border-2 border-dashed border-white/10 rounded-xl p-12 text-center hover:bg-white/5 transition-all cursor-pointer relative group mb-8">
                                    <input
                                        type="file"
                                        className="absolute inset-0 opacity-0 cursor-pointer z-10"
                                        onChange={handleFileUpload}
                                        disabled={isUploading}
                                    />
                                    <div className="flex flex-col items-center space-y-4 group-hover:scale-105 transition-transform duration-200">
                                        <div className="p-4 bg-primary/10 rounded-full ring-1 ring-primary/20 group-hover:ring-primary/50 transition-all">
                                            {isUploading ? <Loader2 className="h-8 w-8 animate-spin text-primary" /> : <Paperclip className="h-8 w-8 text-primary" />}
                                        </div>
                                        <div>
                                            <div className="text-lg font-medium text-white">
                                                {isUploading ? "Uploading..." : "Drop files here or click to upload"}
                                            </div>
                                            <div className="text-sm text-muted-foreground mt-1">PDF, DOCX up to 10MB</div>
                                        </div>
                                    </div>
                                </div>

                                {uploadSuccess && (
                                    <div className="mb-6 p-4 bg-green-500/10 border border-green-500/20 rounded-xl flex items-center text-green-400">
                                        <div className="h-2 w-2 rounded-full bg-green-500 mr-3" />
                                        File uploaded successfully! Metadata extraction started...
                                    </div>
                                )}

                                <div className="space-y-3">
                                    {pursuit.files?.map((file: any) => (
                                        <div key={file.id} className="flex items-center justify-between p-4 bg-white/5 border border-white/5 rounded-xl hover:bg-white/10 transition-colors group">
                                            <div className="flex items-center space-x-4">
                                                <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400">
                                                    <FileText className="h-5 w-5" />
                                                </div>
                                                <div>
                                                    <div className="font-medium text-white">{file.file_name}</div>
                                                    <div className="text-xs text-muted-foreground mt-0.5">
                                                        Uploaded {new Date(file.uploaded_at).toLocaleDateString()}
                                                    </div>
                                                </div>
                                            </div>
                                            <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-white opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Download className="h-4 w-4 mr-2" />
                                                Download
                                            </Button>
                                        </div>
                                    ))}
                                    {(!pursuit.files || pursuit.files.length === 0) && (
                                        <div className="text-center text-muted-foreground py-8">
                                            No files uploaded yet.
                                        </div>
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {activeTab === "chat" && (
                        <motion.div
                            key="chat"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="h-full flex flex-col"
                        >
                            <div className="glass-card rounded-xl flex-1 flex flex-col min-h-0 overflow-hidden border border-white/10">
                                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                                    {messages.map((msg, i) => (
                                        <div
                                            key={i}
                                            className={cn(
                                                "flex w-full",
                                                msg.role === "user" ? "justify-end" : "justify-start"
                                            )}
                                        >
                                            <div className={cn(
                                                "flex max-w-[80%] rounded-2xl px-5 py-3.5 text-sm shadow-sm",
                                                msg.role === "user"
                                                    ? "bg-primary text-white rounded-tr-sm"
                                                    : "bg-white/10 text-white border border-white/5 rounded-tl-sm"
                                            )}>
                                                {msg.role === "assistant" && <Bot className="mr-3 h-4 w-4 mt-0.5 shrink-0 text-primary-foreground/80" />}
                                                <div className="leading-relaxed">{msg.content}</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <div className="p-4 bg-white/5 border-t border-white/10">
                                    <form onSubmit={handleSend} className="flex space-x-3">
                                        <Input
                                            value={input}
                                            onChange={(e) => setInput(e.target.value)}
                                            placeholder="Ask about the RFP..."
                                            className="flex-1 bg-black/20 border-white/10 focus:ring-primary focus:border-primary/50 text-white placeholder:text-muted-foreground h-12 rounded-xl"
                                        />
                                        <Button type="submit" size="icon" className="h-12 w-12 rounded-xl bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20">
                                            <Send className="h-5 w-5" />
                                        </Button>
                                    </form>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    )
}
