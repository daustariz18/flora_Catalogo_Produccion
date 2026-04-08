export type PublicProducto = {
  id: number;
  id_producto?: number;
  nombre: string;
  precio: string;
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
  barrios: PublicBarrio[];
};

const API_BASE_URL = (
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ??
  (import.meta.env.VITE_API_URL as string | undefined)
)
  ?.trim()
  .replace(/\/+$/, "");

function buildPublicApiUrl(path: string): string {
  if (!API_BASE_URL) {
    return path;
  }

  return `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

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
  const endpoint = buildPublicApiUrl(`/api/public/${encodeURIComponent(tenantSlug)}/catalogo`);
  let response: Response;

  try {
    response = await fetch(endpoint, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });
  } catch {
    throw new Error("No fue posible conectar con el API de catalogo publico.");
  }

  if (response.status === 404) {
    return {
      empresa: null,
      categorias: [],
      productos: [],
      barrios: [],
    };
  }

  if (!response.ok) {
    throw new Error(`Error cargando catalogo (${response.status})`);
  }

  const contentType = response.headers.get("content-type") ?? "";

  if (!contentType.includes("application/json")) {
    if (import.meta.env.DEV && !API_BASE_URL) {
      return {
        empresa: null,
        categorias: [],
        productos: [],
        barrios: [],
      };
    }

    throw new Error("Respuesta invalida del servidor de catalogo publico.");
  }

  try {
    const payload = (await response.json()) as PublicCatalogRawResponse;

    if (Array.isArray(payload)) {
      return {
        empresa: null,
        categorias: [],
        productos: payload,
        barrios: [],
      };
    }

    const barrios = normalizeBarrios(payload.barrios ?? payload.empresa?.barrios ?? []);

    return {
      empresa: payload.empresa ?? null,
      categorias: payload.categorias ?? [],
      productos: payload.productos ?? payload.catalogo ?? [],
      barrios,
    };
  } catch {
    throw new Error("No se pudo procesar la respuesta del catalogo publico.");
  }
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
