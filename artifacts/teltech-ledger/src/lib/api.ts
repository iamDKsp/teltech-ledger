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

function toHeadersRecord(headers?: HeadersInit): Record<string, string> {
  if (!headers) return {};
  if (headers instanceof Headers) {
    const record: Record<string, string> = {};
    headers.forEach((val, key) => { record[key] = val; });
    return record;
  }
  if (Array.isArray(headers)) {
    return Object.fromEntries(headers);
  }
  return headers as Record<string, string>;
}

function buildHeaders(customHeaders?: HeadersInit, includeContentType = true): Record<string, string> {
  return {
    ...(includeContentType ? { "Content-Type": "application/json" } : {}),
    ...getAuthHeader(),
    ...toHeadersRecord(customHeaders),
  };
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
    const { headers, ...restOptions } = options ?? {};
    const res = await fetch(url, {
      method: "GET",
      ...restOptions,
      headers: buildHeaders(headers, true),
    });
    return handleResponse<T>(res);
  },

  async post<T = any>(path: string, body?: unknown, options?: RequestInit): Promise<T> {
    const url = resolveUrl(path);
    const { headers, ...restOptions } = options ?? {};
    const res = await fetch(url, {
      method: "POST",
      ...restOptions,
      headers: buildHeaders(headers, true),
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    return handleResponse<T>(res);
  },

  async put<T = any>(path: string, body?: unknown, options?: RequestInit): Promise<T> {
    const url = resolveUrl(path);
    const { headers, ...restOptions } = options ?? {};
    const res = await fetch(url, {
      method: "PUT",
      ...restOptions,
      headers: buildHeaders(headers, true),
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    return handleResponse<T>(res);
  },

  async patch<T = any>(path: string, body?: unknown, options?: RequestInit): Promise<T> {
    const url = resolveUrl(path);
    const { headers, ...restOptions } = options ?? {};
    const res = await fetch(url, {
      method: "PATCH",
      ...restOptions,
      headers: buildHeaders(headers, true),
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    return handleResponse<T>(res);
  },

  async delete<T = any>(path: string, options?: RequestInit): Promise<T> {
    const url = resolveUrl(path);
    const { headers, ...restOptions } = options ?? {};
    const res = await fetch(url, {
      method: "DELETE",
      ...restOptions,
      headers: buildHeaders(headers, true),
    });
    return handleResponse<T>(res);
  },

  async postForm<T = any>(path: string, formData: FormData, options?: RequestInit): Promise<T> {
    const url = resolveUrl(path);
    const { headers, ...restOptions } = options ?? {};
    const res = await fetch(url, {
      method: "POST",
      ...restOptions,
      headers: buildHeaders(headers, false),
      body: formData,
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
