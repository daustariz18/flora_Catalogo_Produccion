import { fetchPublicApiJson } from "../../../shared/api/publicApi";

export interface CreateClienteRequest {
  identificacion: string;
  nombreCompleto: string;
  tipoIdent?: string;
  telefono?: string;
  indicativo?: string;
  email?: string;
  nombre_completo?: string;
  nombre?: string;
  name?: string;
  phone?: string;
  celular?: string;
  correo?: string;
  documento?: string;
  dni?: string;
  countryCode?: string;
  codigo_pais?: string;
}

export interface CreateClienteResponse {
  clienteID: number;
  empresaID: number;
  nombreCompleto: string;
  identificacion: string;
  telefono: string | null;
  email: string | null;
}

export interface CreateOrderItemRequest {
  productoID: number;
  cantidad: number;
  producto_id?: number;
  productoId?: number;
  id_producto?: number;
  id?: number;
  product_id?: number;
  productId?: number;
  qty?: number;
  quantity?: number;
  count?: number;
}

export interface CreateOrderRequest {
  cliente?: {
    nombre_completo?: string;
    identificacion?: string;
    telefono?: string;
    email?: string;
    tipo_ident?: string;
    indicativo?: string;
  };
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
  productos?: CreateOrderItemRequest[];
  detalles?: CreateOrderItemRequest[];
  order_items?: CreateOrderItemRequest[];
  cart_items?: CreateOrderItemRequest[];
  line_items?: CreateOrderItemRequest[];
  cart?: CreateOrderItemRequest[];
  carrito?: CreateOrderItemRequest[];
  totalBruto: number;
  totalIVA: number;
  totalNeto: number;
  fechaPedido?: string;
  version?: number;
  metodoEntrega?: "domicilio" | "recoger";
  metodo_entrega?: "domicilio" | "recoger";
  direccionEntrega?: string;
  direccion_entrega?: string;
  complementoEntrega?: string;
  complemento_entrega?: string;
  barrioEntrega?: string;
  barrio_entrega?: string;
  barrioEntregaID?: number | null;
  barrio_entrega_id?: number | null;
  barrio_id?: number | null;
  id_barrio?: number | null;
  nombre_barrio?: string;
  barrio_nombre?: string;
  costoDomicilio?: number;
  costo_domicilio?: number;
  fechaEntrega?: string;
  fecha_entrega?: string;
  fechaProgramada?: string;
  fecha_programada?: string;
  rangoHora?: string;
  rango_hora?: string;
  nombreDestinatario?: string;
  nombre_destinatario?: string;
  telefonoDestinatario?: string;
  telefono_destinatario?: string;
  mensaje?: string;
  mensaje_tarjeta?: string;
  firma?: string;
  firma_tarjeta?: string;
  notas?: string;
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

export async function createCliente(
  tenantSlug: string,
  payload: CreateClienteRequest,
): Promise<CreateClienteResponse> {
  return await fetchPublicApiJson<CreateClienteResponse>(
    `/api/public/${encodeURIComponent(tenantSlug)}/clientes`,
    "clientes publicos",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}

export async function createOrder(
  tenantSlug: string,
  payload: CreateOrderRequest,
): Promise<CreateOrderResponse> {
  return await fetchPublicApiJson<CreateOrderResponse>(
    `/api/public/${encodeURIComponent(tenantSlug)}/pedidos`,
    "pedidos publicos",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
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
  const query = new URLSearchParams({
    telefono: normalizedPhone,
    telefono_completo: normalizedTelefonoCompleto,
    indicativo: normalizedIndicativo,
  });

  try {
    const payload = await fetchPublicApiJson<LookupClienteApiResponse>(
      `/api/public/${encodeURIComponent(tenantSlug)}/clientes/buscar?${query.toString()}`,
      "clientes publicos",
    );

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
