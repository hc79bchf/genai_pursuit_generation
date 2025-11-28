import { create } from 'zustand'

interface PursuitStore {
    activePursuitsCount: number
    setActivePursuitsCount: (count: number) => void
    refreshPursuitsCount: () => Promise<void>
}

export const usePursuitStore = create<PursuitStore>((set) => ({
    activePursuitsCount: 0,

    setActivePursuitsCount: (count: number) => {
        set({ activePursuitsCount: count })
    },

    refreshPursuitsCount: async () => {
        try {
            // Dynamically import to avoid circular dependencies
            const { fetchApi } = await import('@/lib/api')
            const pursuits = await fetchApi("/pursuits/")

            // Count non-deleted, active pursuits
            // Inactive statuses: cancelled, stale, lost
            const activeCount = pursuits.filter((p: any) =>
                !p.is_deleted &&
                !['cancelled', 'stale', 'lost'].includes(p.status)
            ).length

            set({ activePursuitsCount: activeCount })
        } catch (error) {
            console.error("Failed to refresh pursuits count:", error)
        }
    }
}))
