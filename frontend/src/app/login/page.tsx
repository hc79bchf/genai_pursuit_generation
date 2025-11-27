"use client"

import { useState } from "react"
import dynamic from "next/dynamic"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, Lock, Mail } from "lucide-react"
import { useRouter } from "next/navigation"
import { fetchApi } from "@/lib/api"

// Import motion with SSR disabled
const MotionDiv = dynamic(
    () => import("framer-motion").then((mod) => mod.motion.div),
    { ssr: false }
)

export default function LoginPage() {
    const [isLoading, setIsLoading] = useState(false)
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [error, setError] = useState("")
    const router = useRouter()

    async function onSubmit(event: React.FormEvent) {
        event.preventDefault()
        setIsLoading(true)
        setError("")

        try {
            const formData = new URLSearchParams()
            formData.append("username", email)
            formData.append("password", password)

            const data = await fetchApi("/auth/login", {
                method: "POST",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                },
                body: formData.toString(),
            })

            localStorage.setItem("token", data.access_token)
            router.push("/dashboard")
        } catch (err: any) {
            setError(err.message || "Failed to login")
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-[#0f172a] to-black">
            <MotionDiv
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
            >
                <Card className="w-[400px] border-slate-800 bg-slate-950/50 backdrop-blur-xl">
                    <CardHeader className="space-y-1">
                        <CardTitle className="text-2xl text-center tracking-tight">
                            Pursuit Response
                        </CardTitle>
                        <CardDescription className="text-center">
                            Enter your credentials to access the platform
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-4">
                        <form onSubmit={onSubmit}>
                            <div className="grid gap-4">
                                {error && (
                                    <div className="text-red-500 text-sm text-center">{error}</div>
                                )}
                                <div className="grid gap-2">
                                    <div className="relative">
                                        <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                        <Input
                                            id="email"
                                            placeholder="name@example.com"
                                            type="email"
                                            autoCapitalize="none"
                                            autoComplete="email"
                                            autoCorrect="off"
                                            disabled={isLoading}
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            className="pl-10 bg-slate-900/50 border-slate-800 focus:border-primary"
                                        />
                                    </div>
                                </div>
                                <div className="grid gap-2">
                                    <div className="relative">
                                        <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                        <Input
                                            id="password"
                                            placeholder="Password"
                                            type="password"
                                            autoCapitalize="none"
                                            autoComplete="current-password"
                                            disabled={isLoading}
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            className="pl-10 bg-slate-900/50 border-slate-800 focus:border-primary"
                                        />
                                    </div>
                                </div>
                                <Button disabled={isLoading} className="w-full bg-primary hover:bg-primary/90 transition-all duration-300">
                                    {isLoading && (
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    )}
                                    Sign In
                                </Button>
                            </div>
                        </form>
                    </CardContent>
                    <CardFooter className="flex flex-col space-y-2">
                        <div className="text-sm text-muted-foreground text-center">
                            Don't have an account? Contact admin.
                        </div>
                    </CardFooter>
                </Card>
            </MotionDiv>
        </div>
    )
}
