import { useEffect, useMemo, useState } from "react";
import type { Categoria, Empresa, Producto } from "../../../shared/types/catalog";
import {
  getCatalogoPublico,
  type PublicCatalogoResponse,
  type PublicBarrio,
} from "../api/publicCatalogApi";
import { getDefaultTenantLogo, resolveProductImageUrl } from "../utils/cloudfront";
import { sortCategoriesForDisplay, sortProductsForDisplay } from "../utils/catalogDisplay";

interface UseCompanyDataResult {
  company: Empresa;
  categories: Categoria[];
  products: Producto[];
  barrios: PublicBarrio[];
  isLoading: boolean;
  error: string | null;
}

const DEFAULT_COMPANY_COLOR = "#d94b8a";

function normalizeCategoryKey(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[\s._-]+/g, "")
    .trim();
}

function toPositiveNumber(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function useCompanyData(tenantSlug: string): UseCompanyDataResult {
  const [products, setProducts] = useState<Producto[]>([]);
  const [categories, setCategories] = useState<Categoria[]>([]);
  const [barrios, setBarrios] = useState<PublicBarrio[]>([]);
  const [company, setCompany] = useState<Empresa>(() =>
    toCompany({
      empresa: null,
      categorias: [],
      productos: [],
      barrios: [],
    }, tenantSlug),
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadCompanyData() {
      if (!tenantSlug) {
        setProducts([]);
        setCategories([]);
        setCompany(
          toCompany(
            {
              empresa: null,
              categorias: [],
              productos: [],
              barrios: [],
            },
            tenantSlug,
          ),
        );
        setBarrios([]);
        setError(null);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const payload = await getCatalogoPublico(tenantSlug);

        if (cancelled) {
          return;
        }

        const companyId = resolveCompanyId(payload);
        const mappedProducts = sortProductsForDisplay(mapPublicProducts(payload, tenantSlug), { companyId });
        const mappedCategories = sortCategoriesForDisplay(mapCategories(payload, mappedProducts), { companyId });

        setProducts(mappedProducts);
        setCategories(mappedCategories);
        setBarrios(payload.barrios ?? []);
        setCompany(toCompany(payload, tenantSlug));
      } catch (loadError) {
        if (cancelled) {
          return;
        }

        setProducts([]);
        setCategories([]);
        setBarrios([]);
        if (loadError instanceof Error && loadError.message.toLowerCase().includes("slug")) {
          setError(loadError.message);
        } else {
          setError("No pudimos cargar el catalogo en este momento. Verifica que el backend publico este disponible para este tenant.");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadCompanyData();

    return () => {
      cancelled = true;
    };
  }, [tenantSlug]);

  useEffect(() => {
    document.title = `Catalogo - ${company.nombre}`;

    return () => {
      document.title = "Catalogo";
    };
  }, [company.nombre]);

  return useMemo(
    () => ({
      company,
      categories,
      products,
      barrios,
      isLoading,
      error,
    }),
    [barrios, categories, company, error, isLoading, products],
  );
}

function toCompany(payload: PublicCatalogoResponse, tenantSlug: string): Empresa {
  const logoCandidate =
    payload.empresa?.logoUrl?.trim() ||
    payload.empresa?.logo_url?.trim() ||
    payload.empresa?.logo?.trim() ||
    payload.empresa?.logoPath?.trim() ||
    getDefaultTenantLogo(tenantSlug);

  return {
    id: resolveCompanyId(payload) ?? 0,
    nombre: payload.empresa?.nombre?.trim() || tenantSlug || "Catalogo",
    logo: logoCandidate,
    colorPrimario: payload.empresa?.colorPrimario || payload.empresa?.color_primario || DEFAULT_COMPANY_COLOR,
  };
}

export function mapCategories(payload: PublicCatalogoResponse, products: Producto[]): Categoria[] {
  if (payload.categorias.length > 0) {
    return payload.categorias.map((category) => ({
      id: toPositiveNumber(category.id ?? category.id_categoria) ?? 0,
      nombre: category.name?.trim() || category.nombre?.trim() || "Sin categoria",
      orden_catalogo: normalizeCatalogOrder(category.orden_catalogo ?? category.ordenCatalogo),
    }));
  }

  const byId = new Map<number, Categoria>();

  for (const product of products) {
    const categoryId = toPositiveNumber(product.id_categoria ?? product.categoriaID);
    const name = product.categoriaNombre?.trim() || "Sin categoria";

    if (!categoryId || byId.has(categoryId)) {
      continue;
    }

    byId.set(categoryId, {
      id: categoryId,
      nombre: name,
      orden_catalogo: null,
    });
  }

  return Array.from(byId.values());
}

export function mapPublicProducts(payload: PublicCatalogoResponse, tenantSlug: string): Producto[] {
  const items = Array.isArray(payload.productos) ? payload.productos : [];
  const categoryIndex = new Map<string, Categoria>();

  for (const category of payload.categorias) {
    const categoryName = category.name?.trim() || category.nombre?.trim();

    if (categoryName) {
      categoryIndex.set(normalizeCategoryKey(categoryName), {
        id: toPositiveNumber(category.id ?? category.id_categoria) ?? 0,
        nombre: categoryName,
        orden_catalogo: normalizeCatalogOrder(category.orden_catalogo ?? category.ordenCatalogo),
      });
    }
  }

  return [...items]
    .map((item) => {
      const normalizedCategory =
        item.nombre_categoria?.trim() ||
        item.categoria_nombre?.trim() ||
        item.categoria?.nombre?.trim() ||
        "Sin categoria";

      const categoryKey = normalizeCategoryKey(normalizedCategory);
      const matchedCategory = categoryIndex.get(categoryKey);
      const directCategoryId =
        toPositiveNumber(item.categoria?.id) ??
        toPositiveNumber(item.categoriaID) ??
        toPositiveNumber(item.id_categoria);
      const categoryId = matchedCategory?.id ?? directCategoryId ?? 0;
      const categoryName = matchedCategory?.nombre ?? normalizedCategory;
      const parsedPrice = Number(item.precio);

      return {
        id: item.id,
        id_producto: item.id_producto ?? item.id,
        codigo_catalogo: item.codigo_catalogo ?? item.codigoCatalogo ?? undefined,
        codigo_producto: item.codigo_producto ?? item.codigoProduct,
        nombre: item.nombre,
        precio: Number.isFinite(parsedPrice) ? parsedPrice : 0,
        imagen:
          resolveProductImageUrl(item.imagen_url, tenantSlug) ||
          resolveProductImageUrl(item.imagen_sm, tenantSlug) ||
          resolveProductImageUrl(item.imagen_md, tenantSlug) ||
          resolveProductImageUrl(item.imagen_lg, tenantSlug) ||
          "/product-placeholder.svg",
        imagen_url: resolveProductImageUrl(item.imagen_url, tenantSlug) || undefined,
        imagen_sm: resolveProductImageUrl(item.imagen_sm, tenantSlug) || undefined,
        imagen_md: resolveProductImageUrl(item.imagen_md, tenantSlug) || undefined,
        imagen_lg: resolveProductImageUrl(item.imagen_lg, tenantSlug) || undefined,
        categoriaID: categoryId,
        id_categoria: categoryId,
        categoriaNombre: categoryName,
        descripcion: item.descripcion ?? "Descripcion no disponible.",
      };
    });
}

function normalizeCatalogOrder(value: unknown): number | null {
  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : null;
}

function resolveCompanyId(payload: PublicCatalogoResponse): number | null {
  return toPositiveNumber(payload.empresa?.id ?? payload.empresa?.empresa_id ?? payload.empresa?.empresaID);
}
