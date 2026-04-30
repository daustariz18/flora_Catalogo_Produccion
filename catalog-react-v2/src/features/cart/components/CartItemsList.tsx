import { formatCOP } from "../../../shared/utils/currency";
import type { CartItem } from "../store/cartStore";

interface CartItemsListProps {
  items: CartItem[];
  editable: boolean;
  onIncrease: (productId: number) => void;
  onDecrease: (productId: number) => void;
  onRemove: (productId: number) => void;
}

export function CartItemsList({ items, editable, onIncrease, onDecrease, onRemove }: CartItemsListProps) {
  if (!items.length) {
    return null;
  }

  return (
    <section className="cart-list" aria-label="Productos del carrito">
      {items.map((item) => {
        const subtotal = item.precio * item.cantidad;

        return (
          <article key={item.id} className="cart-item">
            <img src={item.imagen} alt={item.nombre} loading="lazy" />

            <div className="cart-item-body">
              <h2>{item.nombre}</h2>
              <p className="cart-item-unit-price">
                <span>Precio por unidad</span>
                <strong>{formatCOP(item.precio)}</strong>
              </p>
              <p className="cart-item-subtotal">
                <span>Subtotal</span>
                <strong>{formatCOP(subtotal)}</strong>
              </p>

              {editable ? (
                <div className="qty-controls" aria-label={`Controles de ${item.nombre}`}>
                  <button
                    type="button"
                    className="ghost"
                    onClick={() => onDecrease(item.id)}
                    disabled={item.cantidad <= 1}
                    aria-label={`Disminuir cantidad de ${item.nombre}`}
                  >
                    -
                  </button>
                  <span>{item.cantidad}</span>
                  <button
                    type="button"
                    className="ghost"
                    onClick={() => onIncrease(item.id)}
                    aria-label={`Aumentar cantidad de ${item.nombre}`}
                  >
                    +
                  </button>
                </div>
              ) : (
                <p className="cart-item-quantity">
                  <span>Cantidad</span>
                  <strong>{item.cantidad}</strong>
                </p>
              )}
            </div>

            <div className="cart-item-rail">
              <span>Total</span>
              <strong>{formatCOP(subtotal)}</strong>
              {editable ? (
                <button
                  type="button"
                  className="remove-link ghost"
                  onClick={() => onRemove(item.id)}
                  aria-label={`Eliminar ${item.nombre} del carrito`}
                >
                  Eliminar
                </button>
              ) : null}
            </div>
          </article>
        );
      })}
    </section>
  );
}
