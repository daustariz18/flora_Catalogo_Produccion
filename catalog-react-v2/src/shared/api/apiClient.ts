const API_BASE_URL = (
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ??
  (import.meta.env.VITE_API_URL as string | undefined)
)
  ?.trim()
  .replace(/\/+$/, "");

const AUTH_STORAGE_KEYS = [
  "petalops-access-token",
  "petalops-auth-token",
  "access_token",
  "accessToken",
  "token",
];

export function getApiBaseUrl(): string | undefined {
  return API_BASE_URL || undefined;
}

export function isAbsoluteUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

export function normalizeApiPath(path: string): string {
  return path.startsWith("/") ? path : `/${path}`;
}

export function joinApiPath(path: string): string {
  if (isAbsoluteUrl(path)) {
    return path;
  }

  const normalizedPath = normalizeApiPath(path);
  const baseUrl = getApiBaseUrl();

  if (!baseUrl) {
    return normalizedPath;
  }

  if (baseUrl.endsWith("/api") && normalizedPath.startsWith("/api/")) {
    return `${baseUrl}${normalizedPath.slice(4)}`;
  }

  return `${baseUrl}${normalizedPath}`;
}

export function buildApiEndpointCandidates(path: string): string[] {
  if (isAbsoluteUrl(path)) {
    return [path];
  }

  const normalizedPath = normalizeApiPath(path);
  const fallbackPath = normalizedPath.replace(/^\/api(?=\/)/, "");

  const baseUrl = getApiBaseUrl();
  const candidates = baseUrl
    ? [joinApiPath(normalizedPath), joinApiPath(fallbackPath)]
    : [normalizedPath, fallbackPath];

  return Array.from(new Set(candidates));
}

export function getStoredAccessToken(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  for (const key of AUTH_STORAGE_KEYS) {
    const token = window.localStorage.getItem(key) ?? window.sessionStorage.getItem(key);

    if (token && token.trim()) {
      return token.trim();
    }
  }

  return null;
}

export function buildApiHeaders(headers: HeadersInit | undefined, includeAuth = true): Headers {
  const nextHeaders = new Headers(headers);

  if (!nextHeaders.has("Accept")) {
    nextHeaders.set("Accept", "application/json");
  }

  if (!nextHeaders.has("Content-Type")) {
    nextHeaders.set("Content-Type", "application/json");
  }

  if (includeAuth) {
    const token = getStoredAccessToken();

    if (token && !nextHeaders.has("Authorization")) {
      nextHeaders.set("Authorization", `Bearer ${token}`);
    }
  }

  return nextHeaders;
}

export async function apiFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const endpoint = isAbsoluteUrl(input) ? input : joinApiPath(input);

  const { headers, credentials, ...rest } = init;

  return fetch(endpoint, {
    ...rest,
    credentials: credentials ?? "include",
    headers: buildApiHeaders(headers, true),
  });
}

export function storeAccessTokens(tokens: {
  accessToken?: string;
  refreshToken?: string;
  tokenType?: string;
}): void {
  if (typeof window === "undefined") {
    return;
  }

  if (tokens.accessToken?.trim()) {
    window.localStorage.setItem("petalops-access-token", tokens.accessToken.trim());
  }

  if (tokens.refreshToken?.trim()) {
    window.localStorage.setItem("petalops-refresh-token", tokens.refreshToken.trim());
  }

  if (tokens.tokenType?.trim()) {
    window.localStorage.setItem("petalops-token-type", tokens.tokenType.trim());
  }
}

export function clearAccessTokens(): void {
  if (typeof window === "undefined") {
    return;
  }

  for (const key of AUTH_STORAGE_KEYS) {
    window.localStorage.removeItem(key);
    window.sessionStorage.removeItem(key);
  }

  window.localStorage.removeItem("petalops-refresh-token");
  window.localStorage.removeItem("petalops-token-type");
}
