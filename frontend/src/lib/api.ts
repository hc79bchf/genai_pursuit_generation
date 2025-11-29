const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const API_URL = `${BASE_URL}/api/v1`;

interface FetchOptions extends RequestInit {
    token?: string;
}

export async function fetchApi(endpoint: string, options: FetchOptions = {}) {
    const { token, ...fetchOptions } = options;
    const headers: Record<string, string> = {};

    if (!(options.body instanceof FormData)) {
        headers["Content-Type"] = "application/json";
    }

    if (fetchOptions.headers) {
        const headerObj = fetchOptions.headers as Record<string, string>;
        Object.assign(headers, headerObj);
    }

    if (token) {
        headers["Authorization"] = `Bearer ${token}`;
    } else {
        // Try to get token from localStorage if running in browser
        if (typeof window !== "undefined") {
            const storedToken = localStorage.getItem("token");
            if (storedToken) {
                headers["Authorization"] = `Bearer ${storedToken}`;
            }
        }
    }

    const response = await fetch(`${API_URL}${endpoint}`, {
        ...fetchOptions,
        headers,
    });

    if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
            if (typeof window !== "undefined") {
                localStorage.removeItem("token");
                window.location.href = "/login";
            }
        }
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || "An error occurred");
    }

    return response.json();
}

export async function fetchBlob(endpoint: string, options: FetchOptions = {}) {
    const { token, ...fetchOptions } = options;
    const headers: Record<string, string> = {};

    if (fetchOptions.headers) {
        const headerObj = fetchOptions.headers as Record<string, string>;
        Object.assign(headers, headerObj);
    }

    if (token) {
        headers["Authorization"] = `Bearer ${token}`;
    } else {
        if (typeof window !== "undefined") {
            const storedToken = localStorage.getItem("token");
            if (storedToken) {
                headers["Authorization"] = `Bearer ${storedToken}`;
            }
        }
    }

    const response = await fetch(`${API_URL}${endpoint}`, {
        ...fetchOptions,
        headers,
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || "An error occurred");
    }

    return response.blob();
}

// Token refresh configuration
const TOKEN_REFRESH_INTERVAL = 10 * 60 * 1000; // Refresh every 10 minutes of activity
const ACTIVITY_EVENTS = ['mousedown', 'keydown', 'scroll', 'touchstart'];

let lastActivity = Date.now();
let refreshTimeout: NodeJS.Timeout | null = null;

/**
 * Refresh the access token and update localStorage
 */
export async function refreshToken(): Promise<boolean> {
    if (typeof window === 'undefined') return false;

    const token = localStorage.getItem('token');
    if (!token) return false;

    try {
        const response = await fetch(`${API_URL}/auth/refresh`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
        });

        if (response.ok) {
            const data = await response.json();
            localStorage.setItem('token', data.access_token);
            return true;
        }
        return false;
    } catch {
        return false;
    }
}

/**
 * Update last activity timestamp
 */
function updateActivity() {
    lastActivity = Date.now();
}

/**
 * Check if user has been active recently and refresh token if needed
 */
async function checkAndRefreshToken() {
    const timeSinceActivity = Date.now() - lastActivity;

    // Only refresh if user has been active in the last 5 minutes
    if (timeSinceActivity < 5 * 60 * 1000) {
        await refreshToken();
    }

    // Schedule next check
    scheduleTokenRefresh();
}

/**
 * Schedule the next token refresh check
 */
function scheduleTokenRefresh() {
    if (refreshTimeout) {
        clearTimeout(refreshTimeout);
    }
    refreshTimeout = setTimeout(checkAndRefreshToken, TOKEN_REFRESH_INTERVAL);
}

/**
 * Initialize activity-based token refresh
 * Call this once when the app mounts
 */
export function initTokenRefresh() {
    if (typeof window === 'undefined') return;

    // Track user activity
    ACTIVITY_EVENTS.forEach(event => {
        window.addEventListener(event, updateActivity, { passive: true });
    });

    // Start the refresh cycle
    scheduleTokenRefresh();

    // Return cleanup function
    return () => {
        ACTIVITY_EVENTS.forEach(event => {
            window.removeEventListener(event, updateActivity);
        });
        if (refreshTimeout) {
            clearTimeout(refreshTimeout);
        }
    };
}

export const api = {
    getPursuit: (id: string) => fetchApi(`/pursuits/${id}`),
    getPursuits: () => fetchApi('/pursuits/'),
    getActivities: (limit: number = 10) => fetchApi(`/activities/?limit=${limit}`),
    getDashboardStats: () => fetchApi('/stats/dashboard'),
    generatePPTOutline: (id: string, customResearch?: any) => fetchApi(`/pursuits/${id}/generate-ppt-outline`, {
        method: 'POST',
        body: JSON.stringify({ custom_research: customResearch })
    }),
    downloadFile: (pursuitId: string, fileId: string) => fetchBlob(`/pursuits/${pursuitId}/files/${fileId}/download`),
    refreshToken,
};
