import { fetchPublicApiJson } from "../../../shared/api/publicApi";

export interface PublicCategoryResponse {
  id: number;
  name: string;
}

export async function fetchPublicCategories(tenantSlug: string): Promise<PublicCategoryResponse[]> {
  return fetchPublicApiJson<PublicCategoryResponse[]>(
    `/api/public/${encodeURIComponent(tenantSlug)}/categorias`,
    "catalogo publico",
  );
}
