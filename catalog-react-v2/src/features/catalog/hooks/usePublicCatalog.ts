import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import type { Categoria, Empresa, Producto } from "../../../shared/types/catalog";
import { resolveProductImageUrl } from "../utils/cloudfront";
import { sortCategoriesForDisplay, sortProductsForDisplay } from "../utils/catalogDisplay";
import {
  fetchPublicProductDetail,
  fetchPublicProductsPage,
  type PublicCatalogDetailProduct,
  type PublicCatalogListProduct,
} from "../api/publicProductsApi";
import { fetchPublicCompany, type PublicCompanyResponse } from "../api/publicCompanyApi";
import { fetchPublicCategories, type PublicCategoryResponse } from "../api/publicCategoriesApi";

const DEFAULT_LIMIT = 12;
const DEFAULT_COMPANY_COLOR = "#d94b8a";

interface UsePublicCatalogResult {
  company: Empresa;
  categories: Categoria[];
  products: Producto[];
  total: number;
  hasMore: boolean;
  isLoadingCategories: boolean;
  isLoadingProducts: boolean;
  isLoadingInitial: boolean;
  isLoadingMore: boolean;
  error: string | null;
  loadMore: () => void;
}

export function usePublicCatalog(
  tenantSlug: string,
  selectedCategory: number | null,
  searchQuery: string,
): UsePublicCatalogResult {
  const normalizedTenant = tenantSlug.trim();
  const normalizedSearchQuery = searchQuery.trim();

  const companyQuery = useQuery({
    queryKey: ["public-catalog-company", normalizedTenant],
    queryFn: () => fetchPublicCompany(normalizedTenant),
    enabled: Boolean(normalizedTenant),
    staleTime: 1000 * 60 * 10,
  });

  const categoriesQuery = useQuery({
    queryKey: ["public-catalog-categories", normalizedTenant],
    queryFn: () => fetchPublicCategories(normalizedTenant),
    enabled: Boolean(normalizedTenant),
    staleTime: 1000 * 60 * 10,
  });

  const productsQuery = useInfiniteQuery({
    queryKey: ["public-catalog-products", normalizedTenant, DEFAULT_LIMIT, selectedCategory, normalizedSearchQuery],
    queryFn: ({ pageParam = 0 }) =>
      fetchPublicProductsPage(
        normalizedTenant,
        DEFAULT_LIMIT,
        pageParam,
        selectedCategory,
        normalizedSearchQuery,
      ),
    initialPageParam: 0,
    getNextPageParam: (lastPage) => {
      const nextOffset = lastPage.offset + lastPage.limit;
      return nextOffset < lastPage.total ? nextOffset : undefined;
    },
    enabled: Boolean(normalizedTenant),
    staleTime: 1000 * 60 * 5,
  });

  const products = useMemo(() => {
    const list = productsQuery.data?.pages.flatMap((page) =>
      page.data.map((item) => mapListProduct(item, normalizedTenant)),
    ) ?? [];

    return sortProductsForDisplay(list);
  }, [normalizedTenant, productsQuery.data?.pages]);

  const categories = useMemo(() => {
    const mapped = (categoriesQuery.data ?? []).map(mapCategory);

    return sortCategoriesForDisplay(mapped);
  }, [categoriesQuery.data]);

  const company = useMemo(
    () => mapCompany(companyQuery.data, normalizedTenant),
    [companyQuery.data, normalizedTenant],
  );
  const total = productsQuery.data?.pages[0]?.total ?? products.length;
  const error =
    companyQuery.error instanceof Error
      ? companyQuery.error.message
      : categoriesQuery.error instanceof Error
        ? categoriesQuery.error.message
      : productsQuery.error instanceof Error
        ? productsQuery.error.message
        : null;

  return {
    company,
    categories,
    products,
    total,
    hasMore: Boolean(productsQuery.hasNextPage),
    isLoadingCategories: categoriesQuery.isLoading,
    isLoadingProducts: productsQuery.isLoading,
    isLoadingInitial: companyQuery.isLoading || categoriesQuery.isLoading,
    isLoadingMore: productsQuery.isFetchingNextPage,
    error,
    loadMore: () => {
      if (!productsQuery.hasNextPage || productsQuery.isFetchingNextPage) {
        return;
      }

      void productsQuery.fetchNextPage();
    },
  };
}

export function usePublicProductDetail(tenantSlug: string, productId: number | null) {
  const normalizedTenant = tenantSlug.trim();

  return useQuery({
    queryKey: ["public-catalog-product-detail", normalizedTenant, productId],
    queryFn: () => fetchPublicProductDetail(normalizedTenant, productId ?? 0),
    enabled: Boolean(normalizedTenant) && Number.isFinite(productId ?? NaN) && (productId ?? 0) > 0,
    staleTime: 1000 * 60 * 10,
    gcTime: 1000 * 60 * 30,
  });
}

function buildFallbackCompany(tenantSlug: string): Empresa {
  const prettyName = prettifyTenantSlug(tenantSlug);

  return {
    id: 0,
    nombre: prettyName,
    logo: "",
    logoUrl: "",
    colorPrimario: DEFAULT_COMPANY_COLOR,
  };
}

function mapCompany(payload: PublicCompanyResponse | undefined, tenantSlug: string): Empresa {
  if (!payload) {
    return buildFallbackCompany(tenantSlug);
  }

  const logoUrl = payload.logoUrl?.trim() || payload.logo_url?.trim() || "";

  return {
    id: payload.id ?? 0,
    nombre: payload.nombre?.trim() || prettifyTenantSlug(tenantSlug),
    logo: logoUrl,
    logoUrl,
    colorPrimario: payload.colorPrimario || payload.color_primario || DEFAULT_COMPANY_COLOR,
  };
}

function mapCategory(payload: PublicCategoryResponse): Categoria {
  return {
    id: payload.id,
    nombre: payload.name?.trim() || payload.nombre?.trim() || "Sin categoria",
  };
}

function toPositiveNumber(value: unknown): number | null {
  const parsed = Number(value);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function prettifyTenantSlug(tenantSlug: string): string {
  const normalized = tenantSlug.trim().replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim();

  if (!normalized) {
    return "Catalogo";
  }

  return normalized
    .split(" ")
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

function mapListProduct(item: PublicCatalogListProduct, tenantSlug: string): Producto {
  const categoryName = item.categoria_nombre?.trim() || "Sin categoria";
  const categoryId =
    toPositiveNumber(item.categoria_id ?? item.category_id) ??
    buildCategoryId(categoryName);
  const parsedPrice = Number(item.precio);
  const imagenUrl = resolveProductImageUrl(item.imagen_url, tenantSlug);
  const imagenSm = resolveProductImageUrl(item.imagen_sm, tenantSlug);
  const imagenMd = resolveProductImageUrl(item.imagen_md, tenantSlug);
  const imagenLg = resolveProductImageUrl(item.imagen_lg, tenantSlug);
  const imagen = imagenUrl || imagenSm || imagenMd || imagenLg || "/product-placeholder.svg";

  return {
    id: item.id,
    id_producto: item.id,
    codigo_producto: item.codigo_producto ?? undefined,
    nombre: item.nombre,
    precio: Number.isFinite(parsedPrice) ? parsedPrice : 0,
    imagen,
    imagen_url: imagenUrl || undefined,
    imagen_sm: imagenSm || undefined,
    imagen_md: imagenMd || undefined,
    imagen_lg: imagenLg || undefined,
    categoriaID: categoryId,
    id_categoria: categoryId,
    categoriaNombre: categoryName,
  };
}

function buildCategoryId(categoryName: string): number {
  const normalized = categoryName.trim().toLowerCase() || "sin categoria";
  let hash = 0;

  for (const char of normalized) {
    hash = (hash * 31 + char.codePointAt(0)!) >>> 0;
  }

  return hash === 0 ? 1 : hash;
}

export function mapDetailProduct(item: PublicCatalogDetailProduct, tenantSlug: string): Producto {
  const base = mapListProduct(item, tenantSlug);

  return {
    ...base,
    descripcion: item.descripcion ?? undefined,
  };
}
