import { getCatalogoPublico } from "./publicCatalogApi";

export interface PublicCategoryResponse {
  id: number;
  name?: string | null;
  nombre?: string | null;
  active?: boolean | null;
  activo?: boolean | null;
  enabled?: boolean | null;
  estado?: string | null;
}

export async function fetchPublicCategories(tenantSlug: string): Promise<PublicCategoryResponse[]> {
  const { categorias: categories } = await getCatalogoPublico(tenantSlug);

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
