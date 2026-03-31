import { useEffect, useMemo, useState } from "react";
import type { Categoria, Empresa, Producto } from "../../../shared/types/catalog";
import {
  getCatalogoPublico,
  type PublicCatalogoResponse,
  type PublicBarrio,
  type PublicProducto,
} from "../api/publicCatalogApi";
import { buildCloudfrontAssetUrl, getDefaultTenantLogo } from "../utils/cloudfront";

interface UseCompanyDataResult {
  company: Empresa;
  categories: Categoria[];
  products: Producto[];
  barrios: PublicBarrio[];
  isLoading: boolean;
  error: string | null;
}

const DEFAULT_COMPANY_COLOR = "#d94b8a";

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

        const mappedProducts = mapPublicProducts(payload.productos, tenantSlug);
        const mappedCategories = mapCategories(payload, mappedProducts);

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
        setError(loadError instanceof Error ? loadError.message : "No fue posible cargar datos de la empresa.");
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
    id: 0,
    nombre: payload.empresa?.nombre?.trim() || tenantSlug || "Catalogo",
    logo: logoCandidate,
    colorPrimario: payload.empresa?.colorPrimario || payload.empresa?.color_primario || DEFAULT_COMPANY_COLOR,
  };
}

function mapCategories(payload: PublicCatalogoResponse, products: Producto[]): Categoria[] {
  if (payload.categorias.length > 0) {
    return payload.categorias;
  }

  const byName = new Map<string, Categoria>();

  for (const product of products) {
    const name = product.categoriaNombre?.trim() || "Sin categoria";

    if (!byName.has(name)) {
      byName.set(name, {
        id: byName.size + 1,
        nombre: name,
      });
    }
  }

  return Array.from(byName.values());
}

function mapPublicProducts(items: PublicProducto[], tenantSlug: string): Producto[] {
  const categoryIds = new Map<string, number>();

  return [...items]
    .sort((a, b) => (a.id_producto ?? a.id) - (b.id_producto ?? b.id))
    .map((item) => {
    const normalizedCategory =
      item.nombre_categoria?.trim() ||
      item.categoria_nombre?.trim() ||
      item.categoria?.nombre?.trim() ||
      "Sin categoria";

    if (!categoryIds.has(normalizedCategory)) {
      categoryIds.set(normalizedCategory, categoryIds.size + 1);
    }

    const categoryId = categoryIds.get(normalizedCategory) ?? 0;
    const parsedPrice = Number(item.precio);

    return {
      id: item.id,
      id_producto: item.id_producto ?? item.id,
      nombre: item.nombre,
      precio: Number.isFinite(parsedPrice) ? parsedPrice : 0,
      imagen: buildCloudfrontAssetUrl(item.imagen_url, tenantSlug, "productos") || "/product-placeholder.svg",
      categoriaID: categoryId,
      id_categoria: categoryId,
      categoriaNombre: normalizedCategory,
      descripcion: item.descripcion ?? "Descripcion no disponible.",
    };
  });
}
