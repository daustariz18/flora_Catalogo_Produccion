import { fetchPublicApiJson } from "../../../shared/api/publicApi";

export type PublicProducto = {
  id: number;
  id_producto?: number;
  codigo_producto?: string;
  codigoProduct?: string;
  nombre: string;
  precio: string | number;
  descripcion: string | null;
  imagen_url: string | null;
  nombre_categoria?: string | null;
  categoria_nombre?: string | null;
  categoria?: {
    id?: number;
    nombre?: string | null;
  } | null;
};

export type PublicBarrio = {
  id: number;
  nombre: string;
  costoDomicilio: number;
};

export type PublicEmpresa = {
  id?: number;
  slug?: string | null;
  nombre: string;
  logoUrl?: string | null;
  logo_url?: string | null;
  logo?: string | null;
  logoPath?: string | null;
  colorPrimario?: string | null;
  color_primario?: string | null;
  barrios?:
    | Array<
        | string
        | {
            nombre?: string | null;
            barrio?: string | null;
            name?: string | null;
            nombre_barrio?: string | null;
            id_barrio?: number | null;
            costo_domicilio?: number | string | null;
            activo?: boolean | null;
          }
      >
    | null;
};

export type PublicCategoria = {
  id: number;
  nombre: string;
};

export type PublicCatalogoResponse = {
  empresa: PublicEmpresa | null;
  categorias: PublicCategoria[];
  productos: PublicProducto[];
  catalogo?: PublicProducto[];
  barrios: PublicBarrio[];
};

type PublicCatalogRawResponse =
  | PublicProducto[]
  | {
      empresa?: PublicEmpresa | null;
      categorias?: PublicCategoria[];
      productos?: PublicProducto[];
      catalogo?: PublicProducto[];
      barrios?:
        | Array<
            | string
            | {
                nombre?: string | null;
                barrio?: string | null;
                name?: string | null;
                nombre_barrio?: string | null;
                id_barrio?: number | null;
                costo_domicilio?: number | string | null;
                activo?: boolean | null;
              }
          >
        | null;
    };

export async function getCatalogoPublico(tenantSlug: string): Promise<PublicCatalogoResponse> {
  const payload = await fetchPublicApiJson<PublicCatalogRawResponse>(
    `/api/public/${encodeURIComponent(tenantSlug)}/catalogo`,
    "catalogo publico",
  );

  if (Array.isArray(payload)) {
    return {
      empresa: null,
      categorias: [],
      productos: payload,
      barrios: [],
    };
  }

  const barrios = normalizeBarrios(payload.barrios ?? payload.empresa?.barrios ?? []);
  const productos = pickPublicProducts(payload);

  return {
    empresa: payload.empresa ?? null,
    categorias: payload.categorias ?? [],
    productos,
    barrios,
  };
}

function pickPublicProducts(payload: Exclude<PublicCatalogRawResponse, PublicProducto[]>): PublicProducto[] {
  const productos = Array.isArray(payload.productos) ? payload.productos : [];
  const catalogo = Array.isArray(payload.catalogo) ? payload.catalogo : [];

  if (productos.length > 0 && catalogo.length > 0) {
    return mergeCatalogProducts(productos, catalogo);
  }

  if (productos.length > 0) {
    return productos;
  }

  if (catalogo.length > 0) {
    return catalogo;
  }

  return [];
}

function mergeCatalogProducts(primary: PublicProducto[], fallback: PublicProducto[]): PublicProducto[] {
  const byId = new Map<string, PublicProducto>();

  for (const item of fallback) {
    byId.set(getProductKey(item), item);
  }

  return primary.map((item) => {
    const fallbackItem = byId.get(getProductKey(item));

    if (!fallbackItem) {
      return item;
    }

    return {
      ...fallbackItem,
      ...item,
      codigo_producto: item.codigo_producto ?? item.codigoProduct ?? fallbackItem.codigo_producto ?? fallbackItem.codigoProduct,
    };
  });
}

function getProductKey(product: PublicProducto): string {
  return String(product.id_producto ?? product.id);
}

function normalizeBarrios(
  items:
    | Array<
        | string
        | {
            nombre?: string | null;
            barrio?: string | null;
            name?: string | null;
            nombre_barrio?: string | null;
            id_barrio?: number | null;
            costo_domicilio?: number | string | null;
            activo?: boolean | null;
          }
      >
    | null
    | undefined,
): PublicBarrio[] {
  if (!Array.isArray(items)) {
    return [];
  }

  const unique = new Map<string, PublicBarrio>();

  for (const item of items) {
    if (typeof item !== "string" && item.activo === false) {
      continue;
    }

    const value =
      typeof item === "string"
        ? item.trim()
        : item.nombre_barrio?.trim() || item.nombre?.trim() || item.barrio?.trim() || item.name?.trim() || "";
    const id = typeof item === "string" ? 0 : (item as { id_barrio?: number | null }).id_barrio ?? 0;
    const costo =
      typeof item === "string"
        ? 0
        : Number((item as { costo_domicilio?: number | string | null }).costo_domicilio ?? 0);

    if (!value) {
      continue;
    }

    const normalizedKey = value.toLowerCase();
    const nextBarrio: PublicBarrio = {
      id,
      nombre: value,
      costoDomicilio: Number.isFinite(costo) ? costo : 0,
    };

    if (!unique.has(normalizedKey)) {
      unique.set(normalizedKey, nextBarrio);
    }
  }

  return Array.from(unique.values()).sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
}
