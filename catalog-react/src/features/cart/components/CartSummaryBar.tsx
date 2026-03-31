import { Link, useParams } from "react-router-dom";
import { getCartTotalItems, getCartTotalPrice, useCartStore } from "../store/cartStore";
import { formatCOP } from "../../../shared/utils/currency";

export function CartSummaryBar() {
  const { tenantSlug = "" } = useParams();
  const items = useCartStore((state) => state.pedidoState.productos);
  const totalItems = getCartTotalItems(items);
  const cartPath = `/catalogo/${tenantSlug}/carrito`;

  if (!totalItems) {
    return null;
  }

  return (
    <aside className="bottom-checkout fixed inset-x-0 bottom-0 z-30 px-4 py-3 md:sticky md:bottom-0">
      <div className="bottom-checkout-inner">
        <div className="bottom-checkout-info">
          <strong>{totalItems}</strong> {totalItems === 1 ? "producto en tu carrito" : "productos en tu carrito"}
          <p className="bottom-checkout-price">{formatCOP(getCartTotalPrice(items))}</p>
        </div>
        <Link to={cartPath} className="cart-link bottom-checkout-action">
          Ver carrito
        </Link>
      </div>
    </aside>
  );
}
