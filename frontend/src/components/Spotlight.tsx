"use client"

import React, { useRef, useState, useEffect } from "react"
import { cn } from "@/lib/utils"

interface SpotlightProps extends React.HTMLAttributes<HTMLDivElement> {
    children: React.ReactNode
    className?: string
    spotlightColor?: string
    borderColor?: string
    borderWidth?: number
    fillColor?: string
}

export function Spotlight({
    children,
    className,
    spotlightColor = "rgba(255, 255, 255, 0.1)",
    borderColor = "rgba(255, 255, 255, 0.3)",
    borderWidth = 1,
    fillColor = "rgba(255, 255, 255, 0.05)",
    ...props
}: SpotlightProps) {
    const divRef = useRef<HTMLDivElement>(null)
    const [position, setPosition] = useState({ x: 0, y: 0 })
    const [opacity, setOpacity] = useState(0)

    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!divRef.current) return

        const div = divRef.current
        const rect = div.getBoundingClientRect()

        setPosition({ x: e.clientX - rect.left, y: e.clientY - rect.top })
    }

    const handleMouseEnter = () => {
        setOpacity(1)
    }

    const handleMouseLeave = () => {
        setOpacity(0)
    }

    return (
        <div
            ref={divRef}
            onMouseMove={handleMouseMove}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            className={cn(
                "relative overflow-hidden rounded-xl border border-white/10 bg-white/5",
                className
            )}
            {...props}
        >
            {/* Spotlight Effect */}
            <div
                className="pointer-events-none absolute -inset-px opacity-0 transition-opacity duration-300"
                style={{
                    opacity,
                    background: `radial-gradient(600px circle at ${position.x}px ${position.y}px, ${spotlightColor}, transparent 40%)`,
                }}
            />

            {/* Border Effect */}
            <div
                className="pointer-events-none absolute -inset-px opacity-0 transition-opacity duration-300"
                style={{
                    opacity,
                    background: `radial-gradient(600px circle at ${position.x}px ${position.y}px, ${borderColor}, transparent 40%)`,
                    maskImage: `linear-gradient(black, black), linear-gradient(black, black)`,
                    maskClip: "content-box, border-box",
                    maskComposite: "exclude", // This creates the border mask
                    WebkitMaskComposite: "xor", // Safari support
                    padding: `${borderWidth}px`,
                }}
            />

            {/* Content */}
            <div className="relative h-full">{children}</div>
        </div>
    )
}
