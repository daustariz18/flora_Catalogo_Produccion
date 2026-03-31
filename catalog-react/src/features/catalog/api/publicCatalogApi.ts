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

export type PublicEmpresa = {
  nombre: string;
  logoUrl?: string | null;
  logo_url?: string | null;
  logo?: string | null;
  logoPath?: string | null;
  colorPrimario?: string | null;
  color_primario?: string | null;
};

export type PublicCategoria = {
  id: number;
  nombre: string;
};

export type PublicCatalogoResponse = {
  empresa: PublicEmpresa | null;
  categorias: PublicCategoria[];
  productos: PublicProducto[];
};

type PublicCatalogRawResponse =
  | PublicProducto[]
  | {
      empresa?: PublicEmpresa | null;
      categorias?: PublicCategoria[];
      productos?: PublicProducto[];
      catalogo?: PublicProducto[];
    };

export async function getCatalogoPublico(tenantSlug: string): Promise<PublicCatalogoResponse> {
  const endpoint = `/api/public/${encodeURIComponent(tenantSlug)}/catalogo`;
  const baseUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim();
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
    };
  }

  if (!response.ok) {
    throw new Error(`Error cargando catalogo (${response.status})`);
  }

  const contentType = response.headers.get("content-type") ?? "";

  if (!contentType.includes("application/json")) {
    if (import.meta.env.DEV && !baseUrl) {
      return {
        empresa: null,
        categorias: [],
        productos: [],
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
      };
    }

    return {
      empresa: payload.empresa ?? null,
      categorias: payload.categorias ?? [],
      productos: payload.productos ?? payload.catalogo ?? [],
    };
  } catch {
    throw new Error("No se pudo procesar la respuesta del catalogo publico.");
  }
}
