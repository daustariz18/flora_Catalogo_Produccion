import { useEffect, useLayoutEffect, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { formatCOP } from "../../../shared/utils/currency";
import { buildTenantPath, resolveTenantSlug, storeTenantSlug } from "../../../shared/utils/tenantSlug";
import { useCartStore } from "../store/cartStore";
import type { SubmittedOrder } from "../store/cartStore";
import { buildOrderSummary } from "../utils/orderSummary";

export function OrderSuccessPage() {
  const { tenantSlug = "" } = useParams();
  const navigate = useNavigate();
  const resolvedTenantSlug = resolveTenantSlug(tenantSlug);
  const setActiveTenant = useCartStore((state) => state.setActiveTenant);
  const lastSubmittedOrder = useCartStore((state) => state.lastSubmittedOrder);
  const resetCheckoutFlow = useCartStore((state) => state.resetCheckoutFlow);
  const [order, setOrder] = useState<SubmittedOrder | null>(() =>
    isOrderForTenant(lastSubmittedOrder, resolvedTenantSlug) ? lastSubmittedOrder : null,
  );
  const [copied, setCopied] = useState(false);

  useLayoutEffect(() => {
    setActiveTenant(resolvedTenantSlug);
  }, [resolvedTenantSlug, setActiveTenant]);

  useEffect(() => {
    storeTenantSlug(resolvedTenantSlug);
  }, [resolvedTenantSlug]);

  useEffect(() => {
    if (!lastSubmittedOrder) {
      return;
    }

    if (!isOrderForTenant(lastSubmittedOrder, resolvedTenantSlug)) {
      return;
    }

    setOrder(lastSubmittedOrder);
    resetCheckoutFlow();
  }, [lastSubmittedOrder, resetCheckoutFlow, resolvedTenantSlug]);

  const catalogPath = buildTenantPath(resolvedTenantSlug);
  const cartPath = buildTenantPath(resolvedTenantSlug, "/carrito");

  if (!order && lastSubmittedOrder && !isOrderForTenant(lastSubmittedOrder, resolvedTenantSlug)) {
    return <Navigate to={buildTenantPath(lastSubmittedOrder.companySlug, "/pedido-exitoso")} replace />;
  }

  if (order && !isOrderForTenant(order, resolvedTenantSlug)) {
    return <Navigate to={buildTenantPath(order.companySlug, "/pedido-exitoso")} replace />;
  }

  if (!order) {
    return <Navigate to={cartPath} replace />;
  }

  const subtotalProductos = order.pedido.subtotal;
  const envio = Math.max(0, order.totalPrice - subtotalProductos - order.totalIVA);
  const isTransferPending = order.paymentStatus === "pendiente_validacion";
  const isWompi = order.paymentMethod === "wompi";
  const isWompiPending = order.paymentStatus === "pendiente_pago";
  const shouldShowWhatsappAction = order.paymentMethod === "transferencia" || order.paymentMethod === "efectivo";
  const paymentLabel = getPaymentMethodLabel(order.paymentMethod);
  const paymentWhatsappNumber = getPaymentWhatsappNumber(order);
  const orderWhatsappHref = paymentWhatsappNumber && shouldShowWhatsappAction
    ? `https://wa.me/${paymentWhatsappNumber}?text=${encodeURIComponent(getPaymentWhatsappMessage(order))}`
    : null;
  const orderWhatsappLabel =
    order.paymentMethod === "transferencia" ? "Enviar comprobante por WhatsApp" : "Enviar pedido por WhatsApp";

  async function handleCopySummary() {
    if (!order) {
      return;
    }

    const summary = buildOrderSummary(order);

    try {
      await navigator.clipboard.writeText(summary);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  function handleExitApp() {
    try {
      resetCheckoutFlow();
    } catch {
      // ignore storage errors
    }

    window.close();

    window.setTimeout(() => {
      if (!window.closed) {
        navigate(catalogPath, { replace: true });
      }
    }, 100);
  }

  return (
    <main className="cart-page success-page">
      <section className="success-card">
        <p className="success-kicker">
          {isTransferPending || isWompiPending ? "Pedido recibido" : "Pedido confirmado"}
        </p>
        <h1>{order.id}</h1>
        <p className="success-copy">
          {isTransferPending
            ? "Recibimos tu pedido. Queda pendiente de validacion del comprobante de transferencia."
            : isWompi
              ? order.paymentUrl
                ? "Tu pedido quedo registrado. Puedes continuar al pago online de Wompi si la ventana no se abrio automaticamente."
                : "Tu pedido quedo registrado con metodo de pago Wompi."
              : "El pedido quedo listo en la app. Puedes copiar el resumen para compartirlo o seguir comprando."}
        </p>

        {order.pedidoID ? <p className="success-api-id">Pedido registrado: #{order.pedidoID}</p> : null}

        <div className="success-meta">
          <p>
            <span>Cliente</span>
            <strong>{order.pedido.cliente.nombre}</strong>
          </p>
          <p>
            <span>Telefono</span>
            <strong>{order.pedido.cliente.telefono}</strong>
          </p>
          <p>
            <span>Subtotal</span>
            <strong>{formatCOP(subtotalProductos)}</strong>
          </p>
          <p>
            <span>Envio</span>
            <strong>{formatCOP(envio)}</strong>
          </p>
          {order.totalIVA > 0 ? (
            <p>
              <span>IVA</span>
              <strong>{formatCOP(order.totalIVA)}</strong>
            </p>
          ) : null}
          <p>
            <span>Total</span>
            <strong>{formatCOP(order.totalPrice)}</strong>
          </p>
          <p>
            <span>Metodo de pago</span>
            <strong>{paymentLabel}</strong>
          </p>
          {order.paymentReference ? (
            <p>
              <span>Referencia de pago</span>
              <strong>{order.paymentReference}</strong>
            </p>
          ) : null}
        </div>

        <div className="checkout-items">
          {order.pedido.productos.map((item) => (
            <div key={item.id} className="checkout-summary-item">
              <div>
                <strong>{item.nombre}</strong>
                <p>{item.cantidad} unidad(es)</p>
              </div>
              <span>{formatCOP(item.precio * item.cantidad)}</span>
            </div>
          ))}
        </div>

        <div className="success-actions">
          {isWompi && order.paymentUrl ? (
            <a className="cta success-link" href={order.paymentUrl} target="_blank" rel="noreferrer">
              Continuar pago en Wompi
            </a>
          ) : null}
          {orderWhatsappHref ? (
            <a className="cta success-link" href={orderWhatsappHref} target="_blank" rel="noreferrer">
              {orderWhatsappLabel}
            </a>
          ) : null}
          <button type="button" className="cta" onClick={() => void handleCopySummary()}>
            {copied ? "Resumen copiado" : "Copiar resumen"}
          </button>
          <Link to={catalogPath} className="ghost success-link">
            Volver al catalogo
          </Link>
          <button type="button" className="ghost success-link" onClick={handleExitApp}>
            Salir de la app
          </button>
        </div>
      </section>
    </main>
  );
}

function getPaymentMethodLabel(method: SubmittedOrder["paymentMethod"]): string {
  if (method === "wompi") {
    return "WOMPI";
  }

  if (method === "transferencia") {
    return "Transferencia";
  }

  return "Efectivo";
}

function isOrderForTenant(order: SubmittedOrder | null | undefined, tenantSlug: string): boolean {
  if (!order) {
    return false;
  }

  return normalizeSlug(order.companySlug) === normalizeSlug(tenantSlug);
}

function normalizeSlug(value: string): string {
  return value.trim().toLowerCase();
}

function getPaymentWhatsappNumber(order: SubmittedOrder): string | null {
  return normalizeWhatsappNumber(order.empresaCelular);
}

function getPaymentWhatsappMessage(order: SubmittedOrder): string {
  return buildDetailedWhatsappMessage(order);
}

function buildDetailedWhatsappMessage(order: SubmittedOrder): string {
  const { pedido } = order;
  const lines: string[] = [
    "Hola, ya finalice mi pedido. Comparto los detalles para validar y continuar con el pago:",
    "",
    `Cliente: ${pedido.cliente.nombre.trim()}`,
    `Telefono: ${formatPhoneNumber(pedido.cliente.indicativo, pedido.cliente.telefono)}`,
    "",
    "Pedido:",
    ...pedido.productos.map((producto) => `- ${producto.cantidad} x ${producto.nombre}`),
    "",
    `Entrega: ${pedido.entrega.metodo === "domicilio" ? "Domicilio" : "Recoger en tienda"}`,
  ];

  if (pedido.entrega.metodo === "domicilio") {
    const addressLine = [pedido.entrega.direccion.trim(), pedido.entrega.complemento.trim()]
      .filter(Boolean)
      .join(" - ");

    lines.push(`Direccion: ${addressLine}`);

    if (pedido.entrega.barrio.trim()) {
      lines.push(`Barrio: ${pedido.entrega.barrio.trim()}`);
    }
  }

  lines.push(`Fecha: ${pedido.entrega.fecha === "hoy" ? "Hoy" : pedido.entrega.fechaProgramada.trim()}`);
  lines.push("");
  lines.push(`Total: ${formatCOP(order.totalPrice)}`);
  lines.push("");
  lines.push("Quedo atento a la informacion de pago para completar el proceso.");

  return lines.join("\n");
}

function normalizeWhatsappNumber(value: string | null | undefined): string | null {
  const digits = value?.replace(/\D/g, "") ?? "";

  if (!digits) {
    return null;
  }

  if (digits.length === 10) {
    return `57${digits}`;
  }

  return digits;
}

function formatPhoneNumber(indicativo: string | null, telefono: string): string {
  const safeIndicativo = (indicativo ?? "+57").trim();
  const safeTelefono = telefono.trim();
  return `${safeIndicativo} ${safeTelefono}`.trim();
}
