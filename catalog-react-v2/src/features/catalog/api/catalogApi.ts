import type { CatalogResponse, Producto } from "../../../shared/types/catalog";
import {
  getCatalogoPublico,
  type PublicCatalogoResponse,
} from "./publicCatalogApi";
import { buildCloudfrontAssetUrl, getDefaultTenantLogo } from "../utils/cloudfront";
import { sortCategoriesForDisplay, sortProductsForDisplay } from "../utils/catalogDisplay";

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

const mockCatalog: CatalogResponse = {
  empresa: {
    id: 3,
    nombre: "Catalogo Demo",
    logo: "https://ddy2osi8uorg4.cloudfront.net/tenants/demo/logos/logo.png",
    colorPrimario: "#d94b8a",
  },
  categorias: [
    { id: 1, nombre: "Ramos" },
    { id: 2, nombre: "Cumpleanos" },
  ],
  productos: [
    {
      id: 10,
      nombre: "Ramo Rosas Premium",
      precio: 95000,
      imagen: "https://ddy2osi8uorg4.cloudfront.net/tenants/demo/productos/10.jpg",
      categoriaID: 1,
      descripcion: "Rosas premium con follaje verde y empaque elegante.",
    },
    {
      id: 11,
      nombre: "Ramo Primavera",
      precio: 78000,
      imagen: "https://ddy2osi8uorg4.cloudfront.net/tenants/demo/productos/11.jpg",
      categoriaID: 1,
      descripcion: "Mezcla de flores frescas de temporada.",
    },
    {
      id: 12,
      nombre: "Caja Floral Fiesta",
      precio: 105000,
      imagen: "https://ddy2osi8uorg4.cloudfront.net/tenants/demo/productos/12.jpg",
      categoriaID: 2,
      descripcion: "Arreglo vibrante ideal para celebraciones.",
    },
  ],
};

export async function fetchCatalogByEmpresa(empresaID: string): Promise<CatalogResponse> {
  if (!empresaID) {
    return mockCatalog;
  }

  const payload = await getCatalogoPublico(empresaID);
  const products = sortProductsForDisplay(mapPublicProducts(payload, empresaID));

  return {
    empresa: {
      id: 0,
      nombre: payload.empresa?.nombre?.trim() || empresaID || "Catalogo",
      logo:
        payload.empresa?.logoUrl?.trim() ||
        payload.empresa?.logo_url?.trim() ||
        payload.empresa?.logo?.trim() ||
        payload.empresa?.logoPath?.trim() ||
        getDefaultTenantLogo(empresaID),
      colorPrimario: payload.empresa?.colorPrimario || payload.empresa?.color_primario || DEFAULT_COMPANY_COLOR,
    },
    categorias: sortCategoriesForDisplay(mapCategories(payload, products)),
    productos: products,
  };
}

export async function fetchPublicProducts(tenantSlug: string): Promise<Producto[]> {
  if (!tenantSlug) {
    return mockCatalog.productos.map(normalizeProduct);
  }

  const payload = await getCatalogoPublico(tenantSlug);
  return mapPublicProducts(payload, tenantSlug);
}

function normalizeProduct(product: Partial<Producto>): Producto {
  return {
    id: Number(product.id ?? 0),
    id_producto: product.id_producto ?? product.id,
    codigo_producto: product.codigo_producto ?? product.codigoProduct,
    nombre: product.nombre ?? "Producto sin nombre",
    precio: Number(product.precio ?? 0),
    imagen: product.imagen ?? "",
    categoriaID: Number(product.categoriaID ?? product.id_categoria ?? 0),
    descripcion: product.descripcion,
    id_categoria: product.id_categoria ?? product.categoriaID,
  };
}

function mapCategories(payload: PublicCatalogoResponse, products: Producto[]) {
  if (payload.categorias.length > 0) {
    return payload.categorias;
  }

  const byId = new Map<number, { id: number; nombre: string }>();

  for (const product of products) {
    const categoryId = toPositiveNumber(product.id_categoria ?? product.categoriaID);
    const name = product.categoriaNombre?.trim() || "Sin categoria";

    if (!categoryId || byId.has(categoryId)) {
      continue;
    }

    byId.set(categoryId, {
      id: categoryId,
      nombre: name,
    });
  }

  return Array.from(byId.values());
}

function mapPublicProducts(payload: PublicCatalogoResponse, tenantSlug: string): Producto[] {
  const items = Array.isArray(payload.productos) ? payload.productos : [];
  const categoryIndex = new Map<string, { id: number; nombre: string }>();

  for (const category of payload.categorias) {
    categoryIndex.set(normalizeCategoryKey(category.nombre), category);
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
        toPositiveNumber(item.categoria_id) ??
        toPositiveNumber(item.category_id) ??
        toPositiveNumber(item.categoria?.id) ??
        toPositiveNumber(item.categoriaID) ??
        toPositiveNumber(item.id_categoria);
      const categoryId = matchedCategory?.id ?? directCategoryId ?? 0;
      const categoryName = matchedCategory?.nombre ?? normalizedCategory;
      const parsedPrice = Number(item.precio);

      return {
        id: item.id,
        id_producto: item.id_producto ?? item.id,
        codigo_producto: item.codigo_producto ?? item.codigoProduct,
        nombre: item.nombre,
        precio: Number.isFinite(parsedPrice) ? parsedPrice : 0,
        imagen: buildCloudfrontAssetUrl(item.imagen_url, tenantSlug, "productos") || "/product-placeholder.svg",
        categoriaID: categoryId,
        id_categoria: categoryId,
        categoriaNombre: categoryName,
        descripcion: item.descripcion ?? "Descripcion no disponible.",
      };
    });
}
