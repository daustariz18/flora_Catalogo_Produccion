export interface CreateClienteRequest {
  identificacion: string;
  nombreCompleto: string;
  tipoIdent?: string;
  telefono?: string;
  indicativo?: string;
  email?: string;
}

export interface CreateClienteResponse {
  clienteID: number;
  empresaID: number;
  nombreCompleto: string;
  identificacion: string;
  telefono: string | null;
  email: string | null;
}

export async function createCliente(
  tenantSlug: string,
  payload: CreateClienteRequest,
): Promise<CreateClienteResponse> {
  const res = await fetch(`/api/public/${tenantSlug}/clientes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error(await buildPublicOrderError(res, "clientes", tenantSlug));
  }

  return (await res.json()) as CreateClienteResponse;
}

export interface CreateOrderItemRequest {
  productoID: number;
  cantidad: number;
}

export interface CreateOrderRequest {
  sucursalID?: number;
  nombre?: string;
  nombreCliente?: string;
  nombreCompleto?: string;
  tipoIdent?: string;
  tipoident?: string;
  tipoIdentificacion?: string;
  tipo_ident?: string;
  tipoDocumento?: string;
  tipo_documento?: string;
  identificacion?: string;
  indicativo?: string;
  telefono?: string;
  telefonoCompleto?: string;
  telefono_completo?: string;
  email?: string;
  correo?: string;
  correoElectronico?: string;
  correo_electronico?: string;
  cedula?: string;
  nit?: string;
  pasaporte?: string;
  passport?: string;
  metodoPago?: "wompi" | "transferencia" | "efectivo";
  metodo_pago?: "wompi" | "transferencia" | "efectivo";
  items: CreateOrderItemRequest[];
  totalBruto: number;
  totalIVA: number;
  totalNeto: number;
  fechaPedido?: string;
  version?: number;
}

export interface CreateOrderResponse {
  pedidoID: number;
  empresaID: number;
  sucursalID: number;
  clienteID: number;
  estadoPedidoID: number;
  numeroPedido: number;
  codigoPedido?: string | null;
  codigo_pedido?: string | null;
  totalBruto: number;
  totalIVA: number;
  totalNeto: number;
}

export interface ApiErrorResponse {
  message?: string;
  detail?: string | { loc: string[]; msg: string; type: string }[];
}

export interface LookupClienteResult {
  nombre?: string;
  indicativo?: string;
  telefono?: string;
  email?: string;
  tipoIdentificacion?: "cedula" | "nit" | "pasaporte";
  identificacion?: string;
}

interface LookupClienteApiResponse {
  encontrado?: boolean;
  cliente?: {
    cliente_id?: number;
    nombre_completo?: string;
    identificacion?: string;
    tipo_ident?: string;
    telefono?: string;
    telefono_completo?: string;
    indicativo?: string;
    email?: string;
  } | null;
}

export async function createOrder(
  tenantSlug: string,
  payload: CreateOrderRequest,
): Promise<CreateOrderResponse> {
  const res = await fetch(`/api/public/${tenantSlug}/pedidos`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error(await buildPublicOrderError(res, "pedidos", tenantSlug));
  }

  return (await res.json()) as CreateOrderResponse;
}

export async function lookupClienteByTelefono(
  tenantSlug: string,
  telefono: string,
  indicativo = "+57",
): Promise<LookupClienteResult | null> {
  const normalizedPhone = telefono.trim();
  const normalizedIndicativo = indicativo.trim() || "+57";

  if (normalizedPhone.length < 7) {
    return null;
  }

  const normalizedTelefonoCompleto = `${normalizedIndicativo}${normalizedPhone}`.replace(/\s+/g, "");
  const params = new URLSearchParams({
    telefono: normalizedPhone,
    telefono_completo: normalizedTelefonoCompleto,
    indicativo: normalizedIndicativo,
  });

  try {
    const res = await fetch(`/api/public/${tenantSlug}/clientes/buscar?${params.toString()}`, {
      method: "GET",
    });

    if (!res.ok) {
      return null;
    }

    const payload = (await res.json()) as LookupClienteApiResponse;
    if (!payload?.encontrado || !payload.cliente) {
      return null;
    }

    const tipoRaw = (payload.cliente.tipo_ident ?? "").toLowerCase();
    const tipoIdentificacion: LookupClienteResult["tipoIdentificacion"] =
      tipoRaw.includes("nit")
        ? "nit"
        : tipoRaw.includes("pas")
          ? "pasaporte"
          : tipoRaw.includes("ced") || tipoRaw.includes("cc")
            ? "cedula"
            : undefined;

    return {
      nombre: payload.cliente.nombre_completo ?? undefined,
      indicativo: payload.cliente.indicativo ?? undefined,
      telefono: payload.cliente.telefono ?? undefined,
      email: payload.cliente.email ?? undefined,
      tipoIdentificacion,
      identificacion: payload.cliente.identificacion ?? undefined,
    };
  } catch {
    return null;
  }
}

async function buildPublicOrderError(
  response: Response,
  endpoint: "clientes" | "pedidos",
  tenantSlug: string,
): Promise<string> {
  if (response.status === 404) {
    return `El checkout web aun no esta habilitado para "${tenantSlug}". El endpoint publico /${endpoint} no existe en este backend.`;
  }

  let message = `Error HTTP ${response.status}`;

  try {
    const err = (await response.json()) as ApiErrorResponse;

    if (import.meta.env.DEV) {
      console.error(`[publicOrderApi:${endpoint}] error response:`, err);
    }

    if (err?.message) {
      message = err.message;
    } else if (Array.isArray(err?.detail)) {
      message = err.detail.map((d) => `${d.loc.join(".")}: ${d.msg}`).join(" | ");
    } else if (typeof err?.detail === "string") {
      message = err.detail;
    }
  } catch {
    // keep status fallback
  }

  return message;
}
