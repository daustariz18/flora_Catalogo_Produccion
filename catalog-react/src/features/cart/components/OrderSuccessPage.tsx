import { useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { formatCOP } from "../../../shared/utils/currency";
import { useCartStore } from "../store/cartStore";
import { buildOrderSummary } from "../utils/orderSummary";

export function OrderSuccessPage() {
  const { tenantSlug = "" } = useParams();
  const lastSubmittedOrder = useCartStore((state) => state.lastSubmittedOrder);
  const [copied, setCopied] = useState(false);

  const catalogPath = `/catalogo/${tenantSlug}`;
  const cartPath = `/catalogo/${tenantSlug}/carrito`;

  if (!lastSubmittedOrder) {
    return <Navigate to={cartPath} replace />;
  }

  const order = lastSubmittedOrder;

  async function handleCopySummary() {
    const summary = buildOrderSummary(order);

    try {
      await navigator.clipboard.writeText(summary);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <main className="cart-page success-page">
      <section className="success-card">
        <p className="success-kicker">Pedido confirmado</p>
        <h1>{order.id}</h1>
        <p className="success-copy">
          El pedido quedo listo en la app. Puedes copiar el resumen para compartirlo o seguir comprando.
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
            <span>Total</span>
            <strong>{formatCOP(order.totalPrice)}</strong>
          </p>
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
          <button type="button" className="cta" onClick={() => void handleCopySummary()}>
            {copied ? "Resumen copiado" : "Copiar resumen"}
          </button>
          <Link to={catalogPath} className="ghost success-link">
            Volver al catalogo
          </Link>
        </div>
      </section>
    </main>
  );
}
