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
  clienteID: number;
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
  totalBruto: number;
  totalIVA: number;
  totalNeto: number;
}

export interface ApiErrorResponse {
  message?: string;
  detail?: string | { loc: string[]; msg: string; type: string }[];
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
