import { useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { formatCOP } from "../../../shared/utils/currency";
import { buildTenantPath, resolveTenantSlug, storeTenantSlug } from "../../../shared/utils/tenantSlug";
import { CartItemsList } from "./CartItemsList";
import { getCartTotalItems, getCartTotalPrice, useCartStore } from "../store/cartStore";

export function CartPage() {
  const { tenantSlug = "" } = useParams();
  const resolvedTenantSlug = resolveTenantSlug(tenantSlug);
  const items = useCartStore((state) => state.pedidoState.productos);
  const increaseQty = useCartStore((state) => state.increaseQty);
  const decreaseQty = useCartStore((state) => state.decreaseQty);
  const removeProduct = useCartStore((state) => state.removeProduct);
  const totalItems = getCartTotalItems(items);
  const totalPrice = getCartTotalPrice(items);
  const catalogPath = buildTenantPath(resolvedTenantSlug);
  const checkoutPath = buildTenantPath(resolvedTenantSlug, "/checkout");

  useEffect(() => {
    storeTenantSlug(resolvedTenantSlug);
  }, [resolvedTenantSlug]);

  return (
    <main className="cart-page">
      <header className="cart-header">
        <div>
          <p className="wizard-kicker">Carrito</p>
          <h1>Revisa y edita tus productos</h1>
          <p className="checkout-subtitle">Ajusta cantidades antes de finalizar tu pedido.</p>
        </div>
      </header>

      {totalItems === 0 ? (
        <section className="empty-state wizard-empty-state">
          <p>Tu carrito esta vacio por ahora.</p>
          <Link to={catalogPath} className="cta empty-state-action">
            Volver al catalogo
          </Link>
        </section>
      ) : (
        <>
          <CartItemsList
            items={items}
            editable
            onIncrease={increaseQty}
            onDecrease={decreaseQty}
            onRemove={removeProduct}
          />

          <section className="cart-footer">
            <p className="cart-footer-kicker">Resumen final</p>
            <div className="cart-footer-summary">
              <p className="cart-footer-summary-products">
                <span>{`Productos (${totalItems})`}</span>
                <strong>{totalItems}</strong>
              </p>
              <p className="cart-footer-summary-total">
                <span>Total a pagar</span>
                <strong>{formatCOP(totalPrice)}</strong>
              </p>
            </div>
            <div className="cart-footer-actions">
              <Link to={catalogPath} className="ghost cart-footer-secondary-action">
                <span className="cart-action-title">Seguir comprando</span>
                <span className="cart-action-subtitle">Volver al catálogo</span>
              </Link>
              <Link to={checkoutPath} className="cta cart-footer-primary-action">
                <span className="cart-action-title">Continuar</span>
              </Link>
            </div>
          </section>
        </>
      )}
    </main>
  );
}
