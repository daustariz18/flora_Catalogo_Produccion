import { apiFetch, buildApiEndpointCandidates, getApiBaseUrl } from "./apiClient";

type PublicApiLabel = "catalogo publico" | "clientes publicos" | "pedidos publicos";

export function getPublicApiBaseUrl(): string | undefined {
  return getApiBaseUrl();
}

export function buildPublicApiEndpointCandidates(path: string): string[] {
  return buildApiEndpointCandidates(path);
}

export async function fetchPublicApiJson<T>(
  path: string,
  label: PublicApiLabel,
  init: RequestInit = {},
): Promise<T> {
  const endpoints = buildPublicApiEndpointCandidates(path);
  let lastError: string | null = null;

  for (const endpoint of endpoints) {
    let response: Response;

    try {
      response = await apiFetch(endpoint, init);
    } catch {
      lastError = `[publicApi:${label}] No fue posible conectar con ${endpoint}.`;
      continue;
    }

    const contentType = response.headers.get("content-type") ?? "";
    logPublicApiAttempt(label, endpoint, response.status, contentType);

    if (!response.ok) {
      lastError = await buildHttpError(label, endpoint, response, contentType);

      const shouldTryFallback = response.status === 404 || !contentType.includes("application/json");
      if (shouldTryFallback) {
        continue;
      }

      throw new Error(lastError);
    }

    if (!contentType.includes("application/json")) {
      lastError = buildNonJsonError(label, endpoint, response.status, contentType);
      continue;
    }

    try {
      return (await response.json()) as T;
    } catch {
      lastError = `[publicApi:${label}] No se pudo procesar la respuesta JSON de ${endpoint}.`;
    }
  }

  throw new Error(lastError ?? `[publicApi:${label}] No fue posible cargar el recurso solicitado.`);
}

function logPublicApiAttempt(label: PublicApiLabel, endpoint: string, status: number, contentType: string): void {
  const message = `[publicApi:${label}] ${endpoint} -> ${status} (${contentType || "sin content-type"})`;

  if (import.meta.env.DEV) {
    console.info(message);
    return;
  }

  if (status >= 400) {
    console.warn(message);
  }
}

async function buildHttpError(
  label: PublicApiLabel,
  endpoint: string,
  response: Response,
  contentType: string,
): Promise<string> {
  if (response.status === 404 && !contentType.includes("application/json")) {
    return `[publicApi:${label}] La ruta ${endpoint} no esta expuesta en este hosting.`;
  }

  if (response.status === 401) {
    return `[publicApi:${label}] El backend rechazo la sesion o las credenciales. Verifica el backend configurado.`;
  }

  if (contentType.includes("application/json")) {
    try {
      const err = (await response.json()) as {
        message?: string;
        detail?: string | { loc: Array<string | number>; msg: string }[];
      };

      if (err?.message) {
        return `[publicApi:${label}] ${err.message}`;
      }

      if (Array.isArray(err?.detail)) {
        return `[publicApi:${label}] ${err.detail.map((d) => `${d.loc.join(".")}: ${d.msg}`).join(" | ")}`;
      }

      if (typeof err?.detail === "string") {
        return `[publicApi:${label}] ${err.detail}`;
      }
    } catch {
      // fall through to status fallback
    }
  }

  return `[publicApi:${label}] Error HTTP ${response.status} en ${endpoint} (${contentType || "sin content-type"}).`;
}

function buildNonJsonError(label: PublicApiLabel, endpoint: string, status: number, contentType: string): string {
  return `[publicApi:${label}] El servidor respondio ${status} con ${contentType || "sin content-type"} en ${endpoint}.`;
}
