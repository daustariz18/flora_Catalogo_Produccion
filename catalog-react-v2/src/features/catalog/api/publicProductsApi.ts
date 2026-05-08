import { fetchPublicApiJson } from "../../../shared/api/publicApi";

export interface PublicCatalogListProduct {
  id: number;
  nombre: string;
  precio: number | string;
  imagen_url: string | null;
  categoria_id?: number | null;
  category_id?: number | null;
  categoria_nombre: string | null;
  codigo_producto: string | null;
}

export interface PublicCatalogListResponse {
  data: PublicCatalogListProduct[];
  total: number;
  limit: number;
  offset: number;
}

export interface PublicCatalogDetailProduct extends PublicCatalogListProduct {
  descripcion: string | null;
}

export async function fetchPublicProductsPage(
  tenantSlug: string,
  limit: number,
  offset: number,
  categoryId: number | null = null,
): Promise<PublicCatalogListResponse> {
  const params = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
  });

  if (categoryId !== null) {
    params.set("categoria_id", String(categoryId));
  }

  return fetchPublicApiJson<PublicCatalogListResponse>(
    `/api/public/${encodeURIComponent(tenantSlug)}/productos?${params.toString()}`,
    "catalogo publico",
  );
}

export async function fetchPublicProductDetail(
  tenantSlug: string,
  productId: number,
): Promise<PublicCatalogDetailProduct> {
  return fetchPublicApiJson<PublicCatalogDetailProduct>(
    `/api/public/${encodeURIComponent(tenantSlug)}/producto/${productId}`,
    "catalogo publico",
  );
}
