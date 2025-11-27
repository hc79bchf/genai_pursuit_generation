import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface ResearchState {
    // Active research state
    pursuitId: string | null
    isResearching: boolean
    researchProgress: number
    completedQueries: number
    totalQueries: number
    elapsedTime: number
    startTime: number | null

    // Actions
    startResearch: (pursuitId: string, totalQueries: number) => void
    updateProgress: (progress: number, completedQueries: number) => void
    completeResearch: () => void
    resetResearch: () => void
    incrementElapsedTime: () => void
}

export const useResearchStore = create<ResearchState>()(
    persist(
        (set, get) => ({
            // Initial state
            pursuitId: null,
            isResearching: false,
            researchProgress: 0,
            completedQueries: 0,
            totalQueries: 0,
            elapsedTime: 0,
            startTime: null,

            // Start new research session
            startResearch: (pursuitId: string, totalQueries: number) => {
                set({
                    pursuitId,
                    isResearching: true,
                    researchProgress: 0,
                    completedQueries: 0,
                    totalQueries,
                    elapsedTime: 0,
                    startTime: Date.now()
                })
            },

            // Update research progress
            updateProgress: (progress: number, completedQueries: number) => {
                set({
                    researchProgress: progress,
                    completedQueries
                })
            },

            // Complete research
            completeResearch: () => {
                set({
                    isResearching: false,
                    researchProgress: 100,
                    startTime: null
                })
            },

            // Reset all research state
            resetResearch: () => {
                set({
                    pursuitId: null,
                    isResearching: false,
                    researchProgress: 0,
                    completedQueries: 0,
                    totalQueries: 0,
                    elapsedTime: 0,
                    startTime: null
                })
            },

            // Increment elapsed time
            incrementElapsedTime: () => {
                set((state) => ({
                    elapsedTime: state.elapsedTime + 1
                }))
            }
        }),
        {
            name: 'research-progress-storage',
            // Only persist certain fields
            partialize: (state) => ({
                pursuitId: state.pursuitId,
                isResearching: state.isResearching,
                researchProgress: state.researchProgress,
                completedQueries: state.completedQueries,
                totalQueries: state.totalQueries,
                elapsedTime: state.elapsedTime,
                startTime: state.startTime
            })
        }
    )
)
