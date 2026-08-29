import { fetchPublicApiJson } from "../../../shared/api/publicApi";

export interface PublicCategoryResponse {
  id?: number;
  id_categoria?: number | null;
  name?: string | null;
  nombre?: string | null;
  orden_catalogo?: number | null;
  ordenCatalogo?: number | null;
  active?: boolean | null;
  activo?: boolean | null;
  enabled?: boolean | null;
  estado?: string | null;
}

type PublicCategoriesRawResponse =
  | PublicCategoryResponse[]
  | {
      categorias?: PublicCategoryResponse[];
      data?: PublicCategoryResponse[];
    };

export async function fetchPublicCategories(tenantSlug: string): Promise<PublicCategoryResponse[]> {
  const payload = await fetchPublicApiJson<PublicCategoriesRawResponse>(
    `/api/public/${encodeURIComponent(tenantSlug)}/categorias`,
    "catalogo publico",
  );
  const categories = Array.isArray(payload) ? payload : payload.categorias ?? payload.data ?? [];

  return categories.filter(isPublicCategoryActive);
}

function isPublicCategoryActive(category: PublicCategoryResponse): boolean {
  const status = category.estado?.trim().toLowerCase();

  return (
    category.activo !== false &&
    category.active !== false &&
    category.enabled !== false &&
    status !== "inactiva" &&
    status !== "inactivo" &&
    status !== "inactive" &&
    status !== "disabled"
  );
}
