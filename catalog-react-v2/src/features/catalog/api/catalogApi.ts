import type { CatalogResponse, Producto } from "../../../shared/types/catalog";
import {
  getCatalogoPublico,
  type PublicCatalogoResponse,
  type PublicProducto,
} from "./publicCatalogApi";
import { buildCloudfrontAssetUrl, getDefaultTenantLogo } from "../utils/cloudfront";

const DEFAULT_COMPANY_COLOR = "#d94b8a";

const mockCatalog: CatalogResponse = {
  empresa: {
    id: 3,
    nombre: "Floreria Rosa",
    logo: "https://ddy2osi8uorg4.cloudfront.net/tenants/flora/logos/logo.png",
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
      imagen: "https://ddy2osi8uorg4.cloudfront.net/tenants/flora/productos/10.jpg",
      categoriaID: 1,
      descripcion: "Rosas premium con follaje verde y empaque elegante.",
    },
    {
      id: 11,
      nombre: "Ramo Primavera",
      precio: 78000,
      imagen: "https://ddy2osi8uorg4.cloudfront.net/tenants/flora/productos/11.jpg",
      categoriaID: 1,
      descripcion: "Mezcla de flores frescas de temporada.",
    },
    {
      id: 12,
      nombre: "Caja Floral Fiesta",
      precio: 105000,
      imagen: "https://ddy2osi8uorg4.cloudfront.net/tenants/flora/productos/12.jpg",
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
  const products = mapPublicProducts(payload.productos, empresaID);

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
    categorias: mapCategories(payload, products),
    productos: products,
  };
}

export async function fetchPublicProducts(tenantSlug: string): Promise<Producto[]> {
  if (!tenantSlug) {
    return mockCatalog.productos.map(normalizeProduct);
  }

  const payload = await getCatalogoPublico(tenantSlug);
  return mapPublicProducts(payload.productos, tenantSlug);
}

function normalizeProduct(product: Partial<Producto>): Producto {
  return {
    id: Number(product.id ?? 0),
    id_producto: product.id_producto ?? product.id,
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

  const byName = new Map<string, { id: number; nombre: string }>();

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
