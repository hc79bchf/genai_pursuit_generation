"use client"

import * as React from "react"
import { useState, useRef, useEffect } from "react"
import { cn } from "@/lib/utils"
import { ChevronDown, Check, X } from "lucide-react"

export interface FilterOption {
    value: string
    label: string
}

export interface FilterDropdownProps {
    label: string
    options: FilterOption[]
    value: string[]
    onChange: (value: string[]) => void
    placeholder?: string
    className?: string
    multiple?: boolean
}

export function FilterDropdown({
    label,
    options,
    value,
    onChange,
    placeholder = "All",
    className,
    multiple = true,
}: FilterDropdownProps) {
    const [isOpen, setIsOpen] = useState(false)
    const containerRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false)
            }
        }

        document.addEventListener("mousedown", handleClickOutside)
        return () => document.removeEventListener("mousedown", handleClickOutside)
    }, [])

    const handleToggle = (optionValue: string) => {
        if (multiple) {
            if (value.includes(optionValue)) {
                onChange(value.filter((v) => v !== optionValue))
            } else {
                onChange([...value, optionValue])
            }
        } else {
            onChange(value.includes(optionValue) ? [] : [optionValue])
            setIsOpen(false)
        }
    }

    const handleClear = (e: React.MouseEvent) => {
        e.stopPropagation()
        onChange([])
    }

    const displayValue = value.length === 0
        ? placeholder
        : value.length === 1
            ? options.find((o) => o.value === value[0])?.label || value[0]
            : `${value.length} selected`

    return (
        <div ref={containerRef} className={cn("relative w-full", className)}>
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className={cn(
                    "flex items-center justify-between gap-2 h-9 px-3 rounded-lg text-sm w-full",
                    "border border-white/10 bg-white/5 hover:bg-white/10 transition-colors",
                    "text-white",
                    value.length > 0 && "border-primary/50 bg-primary/10"
                )}
            >
                <span className="text-muted-foreground text-xs mr-1">{label}:</span>
                <span className={cn(
                    "truncate",
                    value.length === 0 ? "text-muted-foreground" : "text-white"
                )}>
                    {displayValue}
                </span>
                <div className="flex items-center gap-1">
                    {value.length > 0 && (
                        <button
                            onClick={handleClear}
                            className="p-0.5 hover:bg-white/10 rounded"
                        >
                            <X className="h-3 w-3 text-muted-foreground hover:text-white" />
                        </button>
                    )}
                    <ChevronDown className={cn(
                        "h-4 w-4 text-muted-foreground transition-transform",
                        isOpen && "rotate-180"
                    )} />
                </div>
            </button>

            {isOpen && (
                <div className={cn(
                    "absolute z-50 mt-1 min-w-full w-max max-w-[250px] rounded-lg",
                    "border border-white/10 bg-[#1e1e2e] shadow-lg",
                    "py-1 max-h-60 overflow-auto"
                )}>
                    {options.map((option) => {
                        const isSelected = value.includes(option.value)
                        return (
                            <button
                                key={option.value}
                                type="button"
                                onClick={() => handleToggle(option.value)}
                                className={cn(
                                    "w-full px-3 py-2 text-sm text-left flex items-center justify-between",
                                    "hover:bg-white/10 transition-colors",
                                    isSelected && "text-primary bg-primary/10"
                                )}
                            >
                                <span className={isSelected ? "text-primary" : "text-white"}>
                                    {option.label}
                                </span>
                                {isSelected && <Check className="h-4 w-4 text-primary" />}
                            </button>
                        )
                    })}
                    {options.length === 0 && (
                        <div className="px-3 py-2 text-sm text-muted-foreground">
                            No options available
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
