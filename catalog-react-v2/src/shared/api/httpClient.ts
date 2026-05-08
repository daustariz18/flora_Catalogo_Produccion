import { apiFetch } from "./apiClient";

export async function getJson<T>(url: string): Promise<T> {
  const response = await apiFetch(url, {
    method: "GET",
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error("No pudimos autenticar la sesion. Revisa tu acceso al backend.");
    }

    if (response.status === 404) {
      throw new Error(`No se encontro el recurso solicitado en ${url}.`);
    }

    throw new Error(`Error HTTP ${response.status}`);
  }

  return (await response.json()) as T;
}
