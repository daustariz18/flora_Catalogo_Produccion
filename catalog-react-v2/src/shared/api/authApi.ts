import { apiFetch, clearAccessTokens, storeAccessTokens } from "./apiClient";

export interface LoginRequest {
  email: string;
  password: string;
  slug: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type?: string;
}

export async function login(request: LoginRequest): Promise<TokenResponse> {
  const response = await apiFetch("/auth/login", {
    method: "POST",
    body: JSON.stringify(request),
  });

  const contentType = response.headers.get("content-type") ?? "";

  if (!response.ok) {
    throw new Error(await buildLoginError(response, contentType));
  }

  if (!contentType.includes("application/json")) {
    throw new Error("El backend de autenticacion no devolvio JSON.");
  }

  const payload = (await response.json()) as TokenResponse;

  storeAccessTokens({
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token,
    tokenType: payload.token_type,
  });

  return payload;
}

export function logout(): void {
  clearAccessTokens();
}

export { clearAccessTokens };

async function buildLoginError(response: Response, contentType: string): Promise<string> {
  if (response.status === 401) {
    return "No pudimos iniciar sesion. Verifica tu correo, contraseña y slug del tenant.";
  }

  if (response.status === 404) {
    return "El servicio de autenticacion no esta disponible en el backend configurado.";
  }

  if (contentType.includes("application/json")) {
    try {
      const payload = (await response.json()) as { message?: string; detail?: string };

      if (payload?.message) {
        return payload.message;
      }

      if (typeof payload?.detail === "string") {
        return payload.detail;
      }
    } catch {
      // fall through to status fallback
    }
  }

  return `Error HTTP ${response.status} al iniciar sesion.`;
}
