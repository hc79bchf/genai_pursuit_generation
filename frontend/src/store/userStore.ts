import { create } from 'zustand'
import { fetchApi } from '@/lib/api'

interface User {
    id: string
    email: string
    full_name: string
    title?: string
    department?: string
    is_active: boolean
}

interface UserState {
    user: User | null
    isLoading: boolean
    error: string | null
    fetchUser: () => Promise<void>
    clearUser: () => void
}

export const useUserStore = create<UserState>((set) => ({
    user: null,
    isLoading: false,
    error: null,

    fetchUser: async () => {
        set({ isLoading: true, error: null })
        try {
            const user = await fetchApi('/auth/me')
            set({ user, isLoading: false })
        } catch (error: any) {
            set({ error: error.message, isLoading: false, user: null })
        }
    },

    clearUser: () => {
        set({ user: null, error: null })
    }
}))
