"use client"

import * as React from "react"
import { useState, useRef, useEffect, useCallback } from "react"
import { cn } from "@/lib/utils"
import { ChevronDown, Plus, Check, Loader2 } from "lucide-react"

export interface ComboboxOption {
    value: string
    label: string
    email?: string
}

export interface ComboboxInputProps {
    value: string
    onChange: (value: string, email?: string) => void
    options: ComboboxOption[]
    onSearch?: (query: string) => void
    onAddNew?: (value: string) => void
    placeholder?: string
    label?: string
    required?: boolean
    isLoading?: boolean
    allowCustomValue?: boolean
    className?: string
    disabled?: boolean
}

export function ComboboxInput({
    value,
    onChange,
    options,
    onSearch,
    onAddNew,
    placeholder = "Type to search...",
    label,
    required = false,
    isLoading = false,
    allowCustomValue = true,
    className,
    disabled = false,
}: ComboboxInputProps) {
    const [isOpen, setIsOpen] = useState(false)
    const [inputValue, setInputValue] = useState(value)
    const [highlightedIndex, setHighlightedIndex] = useState(-1)
    const containerRef = useRef<HTMLDivElement>(null)
    const inputRef = useRef<HTMLInputElement>(null)
    const listRef = useRef<HTMLUListElement>(null)

    // Sync input value with external value
    useEffect(() => {
        setInputValue(value)
    }, [value])

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false)
            }
        }

        document.addEventListener("mousedown", handleClickOutside)
        return () => document.removeEventListener("mousedown", handleClickOutside)
    }, [])

    // Filter options based on input
    const filteredOptions = options.filter((option) =>
        option.label.toLowerCase().includes(inputValue.toLowerCase())
    )

    // Check if input matches any existing option exactly
    const exactMatch = options.some(
        (option) => option.label.toLowerCase() === inputValue.trim().toLowerCase()
    )

    // Show "Add new" option if custom values are allowed and there's input text
    // Always show it at the top when typing, even if there are partial matches or while loading
    const showAddNew = allowCustomValue && inputValue.trim().length > 0

    const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const newValue = e.target.value
        setInputValue(newValue)
        setIsOpen(true)
        setHighlightedIndex(-1)

        if (onSearch) {
            onSearch(newValue)
        }
    }, [onSearch])

    const handleSelect = useCallback((option: ComboboxOption) => {
        setInputValue(option.label)
        onChange(option.label, option.email)
        setIsOpen(false)
        setHighlightedIndex(-1)
    }, [onChange])

    const handleAddNew = useCallback(() => {
        if (inputValue.trim()) {
            if (onAddNew) {
                onAddNew(inputValue.trim())
            }
            onChange(inputValue.trim())
            setIsOpen(false)
        }
    }, [inputValue, onAddNew, onChange])

    const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
        if (!isOpen) {
            if (e.key === "ArrowDown" || e.key === "Enter") {
                setIsOpen(true)
                e.preventDefault()
            }
            return
        }

        const totalOptions = filteredOptions.length + (showAddNew ? 1 : 0)

        switch (e.key) {
            case "ArrowDown":
                e.preventDefault()
                setHighlightedIndex((prev) => (prev < totalOptions - 1 ? prev + 1 : 0))
                break
            case "ArrowUp":
                e.preventDefault()
                setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : totalOptions - 1))
                break
            case "Enter":
                e.preventDefault()
                if (highlightedIndex >= 0) {
                    if (showAddNew && highlightedIndex === 0) {
                        // "Add new" is at index 0 when shown
                        handleAddNew()
                    } else {
                        // Adjust index for filtered options when "Add new" is shown
                        const optionIndex = showAddNew ? highlightedIndex - 1 : highlightedIndex
                        if (optionIndex >= 0 && optionIndex < filteredOptions.length) {
                            handleSelect(filteredOptions[optionIndex])
                        }
                    }
                } else if (showAddNew) {
                    handleAddNew()
                } else if (filteredOptions.length === 1) {
                    handleSelect(filteredOptions[0])
                }
                break
            case "Escape":
                setIsOpen(false)
                setHighlightedIndex(-1)
                break
            case "Tab":
                setIsOpen(false)
                break
        }
    }, [isOpen, filteredOptions, showAddNew, highlightedIndex, handleSelect, handleAddNew])

    const handleBlur = useCallback(() => {
        // Delay closing to allow click on option
        setTimeout(() => {
            if (allowCustomValue && inputValue.trim()) {
                onChange(inputValue.trim())
            }
        }, 200)
    }, [allowCustomValue, inputValue, onChange])

    return (
        <div ref={containerRef} className={cn("relative", className)}>
            {label && (
                <label className="text-sm font-medium text-white mb-2 block">
                    {label}
                    {required && <span className="text-red-400 ml-1">*</span>}
                </label>
            )}
            <div className="relative">
                <input
                    ref={inputRef}
                    type="text"
                    value={inputValue}
                    onChange={handleInputChange}
                    onFocus={() => setIsOpen(true)}
                    onBlur={handleBlur}
                    onKeyDown={handleKeyDown}
                    placeholder={placeholder}
                    required={required}
                    disabled={disabled}
                    className={cn(
                        "flex h-10 w-full rounded-md border border-white/10 bg-black/20 px-3 py-2 pr-10 text-sm text-white",
                        "placeholder:text-muted-foreground",
                        "focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-0",
                        "disabled:cursor-not-allowed disabled:opacity-50"
                    )}
                />
                <button
                    type="button"
                    onClick={() => setIsOpen(!isOpen)}
                    disabled={disabled}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-white transition-colors"
                >
                    {isLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                        <ChevronDown className={cn("h-4 w-4 transition-transform", isOpen && "rotate-180")} />
                    )}
                </button>
            </div>

            {isOpen && (filteredOptions.length > 0 || showAddNew || isLoading) && (
                <ul
                    ref={listRef}
                    className={cn(
                        "absolute z-[100] mt-1 max-h-60 w-full overflow-auto rounded-md",
                        "border border-white/10 bg-[#1e1e2e] shadow-lg",
                        "py-1"
                    )}
                >
                    {/* Add New option - ALWAYS shown at the top when there's input */}
                    {showAddNew && (
                        <li
                            onClick={handleAddNew}
                            className={cn(
                                "px-3 py-3 text-sm cursor-pointer flex items-center",
                                "hover:bg-primary/30 transition-colors bg-primary/15 border-b border-white/10",
                                highlightedIndex === 0 && "bg-primary/30"
                            )}
                        >
                            <div className="p-1 bg-primary/20 rounded mr-2">
                                <Plus className="h-4 w-4 text-primary" />
                            </div>
                            <div className="flex flex-col">
                                <span className="text-white font-medium">
                                    Add new {exactMatch ? "(create duplicate)" : ""}
                                </span>
                                <span className="text-primary text-xs">"{inputValue.trim()}"</span>
                            </div>
                        </li>
                    )}

                    {isLoading ? (
                        <li className="px-3 py-2 text-sm text-muted-foreground flex items-center">
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            Searching...
                        </li>
                    ) : (
                        <>
                            {filteredOptions.map((option, index) => {
                                // Adjust index for highlighting when "Add new" is shown
                                const adjustedIndex = showAddNew ? index + 1 : index
                                return (
                                    <li
                                        key={option.value}
                                        onClick={() => handleSelect(option)}
                                        className={cn(
                                            "px-3 py-2 text-sm cursor-pointer flex items-center justify-between",
                                            "hover:bg-white/10 transition-colors",
                                            highlightedIndex === adjustedIndex && "bg-white/10",
                                            option.label === value && "text-primary"
                                        )}
                                    >
                                        <div className="flex flex-col">
                                            <span className="text-white">{option.label}</span>
                                            {option.email && (
                                                <span className="text-xs text-muted-foreground">{option.email}</span>
                                            )}
                                        </div>
                                        {option.label === value && (
                                            <Check className="h-4 w-4 text-primary" />
                                        )}
                                    </li>
                                )
                            })}

                            {filteredOptions.length === 0 && !showAddNew && (
                                <li className="px-3 py-2 text-sm text-muted-foreground">
                                    No results found
                                </li>
                            )}
                        </>
                    )}
                </ul>
            )}
        </div>
    )
}
