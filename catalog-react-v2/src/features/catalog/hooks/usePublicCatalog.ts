import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import type { Categoria, Empresa, Producto } from "../../../shared/types/catalog";
import type { ProductSortMode } from "../components/ProductGrid";
import { resolveProductImageUrl } from "../utils/cloudfront";
import { matchesCatalogSearch, sortCategoriesForDisplay, sortProductsForDisplay } from "../utils/catalogDisplay";
import {
  fetchPublicProductDetail,
  fetchPublicProductsPage,
  type PublicCatalogDetailProduct,
  type PublicCatalogListProduct,
} from "../api/publicProductsApi";
import { fetchPublicCompany, type PublicCompanyResponse } from "../api/publicCompanyApi";
import { fetchPublicCategories, type PublicCategoryResponse } from "../api/publicCategoriesApi";

const DEFAULT_LIMIT = 12;
const SORTED_LIMIT = 100;
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
  sortMode: ProductSortMode = "code-asc",
): UsePublicCatalogResult {
  const normalizedTenant = tenantSlug.trim();
  const normalizedSearchQuery = searchQuery.trim();
  const shouldLoadAllProducts = true;
  const [sortedVisibleCount, setSortedVisibleCount] = useState(DEFAULT_LIMIT);

  useEffect(() => {
    setSortedVisibleCount(DEFAULT_LIMIT);
  }, [normalizedTenant, selectedCategory, normalizedSearchQuery, sortMode]);

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
    enabled: Boolean(normalizedTenant) && !shouldLoadAllProducts,
    staleTime: 1000 * 60 * 5,
  });

  const allProductsQuery = useQuery({
    queryKey: ["public-catalog-products-all", normalizedTenant, SORTED_LIMIT],
    queryFn: () => fetchAllPublicProducts(normalizedTenant, null, ""),
    enabled: Boolean(normalizedTenant) && shouldLoadAllProducts,
    staleTime: 1000 * 60 * 5,
  });

  const allProducts = useMemo(() => {
    const sourceProducts = shouldLoadAllProducts
      ? allProductsQuery.data
      : productsQuery.data?.pages.flatMap((page) => page.data);

    return sourceProducts?.map((item) => mapListProduct(item, normalizedTenant)) ?? [];
  }, [allProductsQuery.data, normalizedTenant, productsQuery.data?.pages, shouldLoadAllProducts]);

  const categories = useMemo(() => {
    const mapped = (categoriesQuery.data ?? []).map(mapCategory);
    const derived = allProducts.map(productToCategory);

    return sortCategoriesForDisplay(mergeCategories(derived, mapped));
  }, [allProducts, categoriesQuery.data]);

  const filteredProducts = useMemo(() => {
    return allProducts.filter(
      (product) =>
        matchesSelectedCategory(product, selectedCategory, categories) &&
        matchesCatalogSearch(product, normalizedSearchQuery, categories),
    );
  }, [allProducts, categories, normalizedSearchQuery, selectedCategory]);

  const allSortedProducts = useMemo(() => {
    return sortProducts(filteredProducts, sortMode);
  }, [filteredProducts, sortMode]);

  const products = useMemo(() => {
    if (!shouldLoadAllProducts) {
      return allSortedProducts;
    }

    return allSortedProducts.slice(0, sortedVisibleCount);
  }, [allSortedProducts, shouldLoadAllProducts, sortedVisibleCount]);

  const company = useMemo(
    () => mapCompany(companyQuery.data, normalizedTenant),
    [companyQuery.data, normalizedTenant],
  );
  const total = shouldLoadAllProducts ? allSortedProducts.length : productsQuery.data?.pages[0]?.total ?? products.length;
  const error =
    companyQuery.error instanceof Error
      ? companyQuery.error.message
      : categoriesQuery.error instanceof Error
        ? categoriesQuery.error.message
      : allProductsQuery.error instanceof Error
        ? allProductsQuery.error.message
      : productsQuery.error instanceof Error
        ? productsQuery.error.message
        : null;

  return {
    company,
    categories,
    products,
    total,
    hasMore: shouldLoadAllProducts ? products.length < allSortedProducts.length : Boolean(productsQuery.hasNextPage),
    isLoadingCategories: categoriesQuery.isLoading,
    isLoadingProducts: shouldLoadAllProducts ? allProductsQuery.isLoading : productsQuery.isLoading,
    isLoadingInitial: companyQuery.isLoading || categoriesQuery.isLoading,
    isLoadingMore: shouldLoadAllProducts ? false : productsQuery.isFetchingNextPage,
    error,
    loadMore: () => {
      if (shouldLoadAllProducts) {
        setSortedVisibleCount((current) => Math.min(current + DEFAULT_LIMIT, allSortedProducts.length));
        return;
      }

      if (!productsQuery.hasNextPage || productsQuery.isFetchingNextPage) {
        return;
      }

      void productsQuery.fetchNextPage();
    },
  };
}

function normalizeSortName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es-CO")
    .trim();
}

function matchesSelectedCategory(product: Producto, selectedCategory: number | null, categories: Categoria[]): boolean {
  if (selectedCategory === null) {
    return true;
  }

  const productCategoryId = product.id_categoria ?? product.categoriaID;

  if (productCategoryId === selectedCategory) {
    return true;
  }

  const selectedCategoryName = categories.find((category) => category.id === selectedCategory)?.nombre;

  return Boolean(
    selectedCategoryName &&
      product.categoriaNombre &&
      normalizeSortName(product.categoriaNombre) === normalizeSortName(selectedCategoryName),
  );
}

function isAdditionalProduct(product: Producto): boolean {
  return normalizeSortName(product.categoriaNombre ?? "").includes("adicional");
}

function isPersonalizedProduct(product: Producto): boolean {
  return normalizeSortName(product.categoriaNombre ?? "").includes("personaliz");
}

function normalizeSortCode(product: Producto): string {
  return normalizeSortName(product.codigo_catalogo ?? product.codigo_producto ?? product.codigoProduct ?? String(product.id_producto ?? product.id));
}

function sortProducts(products: Producto[], sortMode: ProductSortMode): Producto[] {
  const relevanceSortedProducts = sortProductsForDisplay(products);

  return relevanceSortedProducts
    .map((product, index) => ({ product, index }))
    .sort((a, b) => {
      if (sortMode === "code-asc") {
        const personalizedComparison = Number(isPersonalizedProduct(b.product)) - Number(isPersonalizedProduct(a.product));

        if (personalizedComparison !== 0) {
          return personalizedComparison;
        }

        const comparison = normalizeSortCode(a.product).localeCompare(normalizeSortCode(b.product), "es-CO", {
          numeric: true,
          sensitivity: "base",
        });

        return comparison || a.index - b.index;
      }

      if (sortMode === "name-asc" || sortMode === "name-desc") {
        const comparison = normalizeSortName(a.product.nombre).localeCompare(normalizeSortName(b.product.nombre), "es-CO");
        return sortMode === "name-asc" ? comparison || a.index - b.index : -comparison || a.index - b.index;
      }

      if (sortMode === "price-desc" || sortMode === "price-asc") {
        if (sortMode === "price-asc") {
          const additionalComparison = Number(isAdditionalProduct(a.product)) - Number(isAdditionalProduct(b.product));

          if (additionalComparison !== 0) {
            return additionalComparison;
          }
        }

        const comparison = a.product.precio - b.product.precio;
        return sortMode === "price-asc" ? comparison || a.index - b.index : -comparison || a.index - b.index;
      }

      return a.index - b.index;
    })
    .map(({ product }) => product);
}

async function fetchAllPublicProducts(
  tenantSlug: string,
  selectedCategory: number | null,
  searchQuery: string,
): Promise<PublicCatalogListProduct[]> {
  const firstPage = await fetchPublicProductsPage(
    tenantSlug,
    SORTED_LIMIT,
    0,
    selectedCategory,
    searchQuery,
  );
  const pages = [firstPage];
  const requests: Array<Promise<Awaited<ReturnType<typeof fetchPublicProductsPage>>>> = [];

  for (let offset = firstPage.limit; offset < firstPage.total; offset += firstPage.limit) {
    requests.push(
      fetchPublicProductsPage(
        tenantSlug,
        SORTED_LIMIT,
        offset,
        selectedCategory,
        searchQuery,
      ),
    );
  }

  if (requests.length > 0) {
    pages.push(...(await Promise.all(requests)));
  }

  return pages.flatMap((page) => page.data);
}

function productToCategory(product: Producto): Categoria | null {
  const categoryName = product.categoriaNombre?.trim();

  if (!categoryName) {
    return null;
  }

  return {
    id: product.id_categoria ?? product.categoriaID,
    nombre: categoryName,
  };
}

function mergeCategories(...categoryGroups: Array<Array<Categoria | null>>): Categoria[] {
  const byKey = new Map<string, Categoria>();

  for (const category of categoryGroups.flat()) {
    if (!category) {
      continue;
    }

    const name = category.nombre.trim();
    const key = normalizeSortName(name);

    if (!name || byKey.has(key)) {
      continue;
    }

    byKey.set(key, {
      id: category.id,
      nombre: name,
    });
  }

  return Array.from(byKey.values());
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
    id_producto: toPositiveNumber(item.id_producto ?? item.producto_id ?? item.productoID) ?? item.id,
    codigo_catalogo: item.codigo_catalogo ?? item.codigoCatalogo ?? undefined,
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
