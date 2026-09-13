// Shared API client and base URL — used across the application
export const API_BASE = import.meta.env.VITE_API_URL !== undefined && import.meta.env.VITE_API_URL !== ""
  ? import.meta.env.VITE_API_URL
  : (import.meta.env.DEV ? "http://localhost:5000" : "");

function getAuthHeader(): Record<string, string> {
  const token = localStorage.getItem("teltech_token") || localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function resolveUrl(path: string): string {
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }
  const base = API_BASE ? API_BASE.replace(/\/$/, "") : "";
  let cleanPath = path;
  if (!cleanPath.startsWith("/")) {
    cleanPath = "/" + cleanPath;
  }
  if (!cleanPath.startsWith("/api/")) {
    cleanPath = "/api" + cleanPath;
  }
  return `${base}${cleanPath}`;
}

async function handleResponse<T = any>(res: Response): Promise<T> {
  if (!res.ok) {
    let errorMsg = `HTTP ${res.status}: ${res.statusText}`;
    try {
      const errJson = await res.json();
      errorMsg = errJson.message || errJson.error || errorMsg;
    } catch {
      // Ignore JSON parse failure
    }
    throw new Error(errorMsg);
  }
  if (res.status === 204) {
    return {} as T;
  }
  return res.json();
}

export const API = {
  baseUrl: API_BASE,

  async get<T = any>(path: string, options?: RequestInit): Promise<T> {
    const url = resolveUrl(path);
    const res = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeader(),
        ...options?.headers,
      },
      ...options,
    });
    return handleResponse<T>(res);
  },

  async post<T = any>(path: string, body?: unknown, options?: RequestInit): Promise<T> {
    const url = resolveUrl(path);
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeader(),
        ...options?.headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      ...options,
    });
    return handleResponse<T>(res);
  },

  async put<T = any>(path: string, body?: unknown, options?: RequestInit): Promise<T> {
    const url = resolveUrl(path);
    const res = await fetch(url, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeader(),
        ...options?.headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      ...options,
    });
    return handleResponse<T>(res);
  },

  async patch<T = any>(path: string, body?: unknown, options?: RequestInit): Promise<T> {
    const url = resolveUrl(path);
    const res = await fetch(url, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeader(),
        ...options?.headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      ...options,
    });
    return handleResponse<T>(res);
  },

  async delete<T = any>(path: string, options?: RequestInit): Promise<T> {
    const url = resolveUrl(path);
    const res = await fetch(url, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeader(),
        ...options?.headers,
      },
      ...options,
    });
    return handleResponse<T>(res);
  },

  // Enable string coercion for backwards compatibility with `${API}/api/...`
  toString(): string {
    return API_BASE;
  },
  valueOf(): string {
    return API_BASE;
  },
  [Symbol.toPrimitive](): string {
    return API_BASE;
  },
};

export default API;
