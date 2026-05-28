import { useEffect, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { formatCOP } from "../../../shared/utils/currency";
import { buildTenantPath, resolveTenantSlug, storeTenantSlug } from "../../../shared/utils/tenantSlug";
import { useCartStore } from "../store/cartStore";
import type { SubmittedOrder } from "../store/cartStore";
import { buildOrderSummary } from "../utils/orderSummary";

export function OrderSuccessPage() {
  const { tenantSlug = "" } = useParams();
  const resolvedTenantSlug = resolveTenantSlug(tenantSlug);
  const lastSubmittedOrder = useCartStore((state) => state.lastSubmittedOrder);
  const resetCheckoutFlow = useCartStore((state) => state.resetCheckoutFlow);
  const [order, setOrder] = useState<SubmittedOrder | null>(() => lastSubmittedOrder);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    storeTenantSlug(resolvedTenantSlug);
  }, [resolvedTenantSlug]);

  useEffect(() => {
    if (!lastSubmittedOrder) {
      return;
    }

    setOrder(lastSubmittedOrder);
    resetCheckoutFlow();
  }, [lastSubmittedOrder, resetCheckoutFlow]);

  const catalogPath = buildTenantPath(resolvedTenantSlug);
  const cartPath = buildTenantPath(resolvedTenantSlug, "/carrito");

  if (!order) {
    return <Navigate to={cartPath} replace />;
  }

  const subtotalProductos = order.pedido.subtotal;
  const envio = Math.max(0, order.totalPrice - subtotalProductos - order.totalIVA);
  const isTransferPending = order.paymentStatus === "pendiente_validacion";
  const isWompi = order.paymentMethod === "wompi";
  const isWompiPending = order.paymentStatus === "pendiente_pago";
  const paymentLabel = getPaymentMethodLabel(order.paymentMethod);
  const transferWhatsappHref = `https://wa.me/${getPaymentWhatsappNumber()}?text=${encodeURIComponent(
    `Hola, comparto comprobante de pago del pedido ${order.id}. Cliente: ${order.pedido.cliente.nombre}. Total: ${formatCOP(order.totalPrice)}.`,
  )}`;

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

    window.open("about:blank", "_self");
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
          {isTransferPending ? (
            <a className="cta success-link" href={transferWhatsappHref} target="_blank" rel="noreferrer">
              Enviar comprobante por WhatsApp
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

function getPaymentWhatsappNumber(): string {
  const configured = (import.meta.env.VITE_TRANSFER_WHATSAPP_PHONE as string | undefined)?.replace(/\D/g, "");
  return configured || "573128896624";
}
