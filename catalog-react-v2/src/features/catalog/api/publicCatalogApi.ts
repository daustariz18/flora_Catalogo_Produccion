import { fetchPublicApiJson } from "../../../shared/api/publicApi";

export type PublicProducto = {
  id: number;
  id_producto?: number;
  codigo_producto?: string;
  codigoProduct?: string;
  categoria_id?: number | null;
  category_id?: number | null;
  categoriaID?: number;
  id_categoria?: number;
  nombre: string;
  precio: string | number;
  descripcion: string | null;
  imagen_url: string | null;
  imagen_sm?: string | null;
  imagen_md?: string | null;
  imagen_lg?: string | null;
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
  empresa_id?: number | null;
  empresaID?: number | null;
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
  active?: boolean | null;
  activo?: boolean | null;
  enabled?: boolean | null;
  estado?: string | null;
};

export type PublicPaymentMethod = {
  value?: string | null;
  method?: string | null;
  code?: string | null;
  id?: string | null;
  title?: string | null;
  label?: string | null;
  caption?: string | null;
  description?: string | null;
  cta?: string | null;
  button?: string | null;
  subtitle?: string | null;
  subtext?: string | null;
  badge?: string | null;
  recommended?: boolean | null;
  enabled?: boolean | null;
  confirmation_bullets?: string[] | null;
  confirmationBullets?: string[] | null;
};

export type PublicCatalogoResponse = {
  empresa: PublicEmpresa | null;
  categorias: PublicCategoria[];
  productos: PublicProducto[];
  catalogo?: PublicProducto[];
  barrios: PublicBarrio[];
  payment_methods?: PublicPaymentMethod[];
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
      payment_methods?: PublicPaymentMethod[] | null;
      paymentMethods?: PublicPaymentMethod[] | null;
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
      payment_methods: [],
    };
  }

  const barrios = normalizeBarrios(payload.barrios ?? payload.empresa?.barrios ?? []);
  const productos = pickPublicProducts(payload);

  return {
    empresa: payload.empresa ?? null,
    categorias: normalizeCategorias(payload.categorias ?? []),
    productos,
    barrios,
    payment_methods: payload.payment_methods ?? payload.paymentMethods ?? [],
  };
}

function normalizeCategorias(items: PublicCategoria[]): PublicCategoria[] {
  return items.filter((item) => {
    const status = item.estado?.trim().toLowerCase();

    return (
      item.activo !== false &&
      item.active !== false &&
      item.enabled !== false &&
      status !== "inactiva" &&
      status !== "inactivo" &&
      status !== "inactive" &&
      status !== "disabled"
    );
  });
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
