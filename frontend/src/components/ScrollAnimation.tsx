"use client"

import { useEffect, useRef, useState } from "react"
import { cn } from "@/lib/utils"

interface ScrollAnimationProps {
    children: React.ReactNode
    className?: string
    animation?: "fade-in-up" | "fade-in-left" | "fade-in-right"
    delay?: number
    duration?: number
    threshold?: number
}

export function ScrollAnimation({
    children,
    className,
    animation = "fade-in-up",
    delay = 0,
    duration = 0.6,
    threshold = 0.1,
}: ScrollAnimationProps) {
    const ref = useRef<HTMLDivElement>(null)
    const [isVisible, setIsVisible] = useState(false)

    useEffect(() => {
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setIsVisible(true)
                    observer.unobserve(entry.target)
                }
            },
            {
                threshold,
                rootMargin: "0px 0px -50px 0px", // Trigger slightly before bottom
            }
        )

        if (ref.current) {
            observer.observe(ref.current)
        }

        return () => {
            if (ref.current) {
                observer.unobserve(ref.current)
            }
        }
    }, [threshold])

    const style = {
        animationName: animation,
        animationDuration: `${duration}s`,
        animationDelay: `${delay}s`,
        animationFillMode: "both",
        animationPlayState: isVisible ? "running" : "paused",
    }

    return (
        <div
            ref={ref}
            className={cn(className)}
            style={style}
        >
            {children}
        </div>
    )
}
