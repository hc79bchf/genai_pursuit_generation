const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

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
