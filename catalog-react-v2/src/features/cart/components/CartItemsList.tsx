import { useEffect, useRef, useState } from "react";
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
  const previousQuantities = useRef(new Map<number, number>());
  const [animatedItemId, setAnimatedItemId] = useState<number | null>(null);

  useEffect(() => {
    let nextAnimatedId: number | null = null;

    for (const item of items) {
      const previousQty = previousQuantities.current.get(item.id);
      if (previousQty !== undefined && previousQty !== item.cantidad) {
        nextAnimatedId = item.id;
        break;
      }
    }

    previousQuantities.current = new Map(items.map((item) => [item.id, item.cantidad]));

    if (nextAnimatedId === null) {
      return;
    }

    setAnimatedItemId(nextAnimatedId);
    const timeoutId = window.setTimeout(() => setAnimatedItemId(null), 220);

    return () => window.clearTimeout(timeoutId);
  }, [items]);

  if (!items.length) {
    return null;
  }

  return (
    <section className="cart-list" aria-label="Productos del carrito">
      {items.map((item) => {
        return (
          <article key={item.id} className={`cart-item${animatedItemId === item.id ? " cart-item-updated" : ""}`}>
            <img src={item.imagen} alt={item.nombre} loading="lazy" />

            <div className="cart-item-body">
              <h2>{item.nombre}</h2>

              {editable ? (
                <div className="cart-item-actions">
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

                  <button
                    type="button"
                    className="remove-link ghost"
                    onClick={() => onRemove(item.id)}
                    aria-label={`Eliminar ${item.nombre} del carrito`}
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                      <path d="M9 3.75h6a1.5 1.5 0 0 1 1.5 1.5V6h3a.75.75 0 0 1 0 1.5h-1.06l-.7 9.02A2.25 2.25 0 0 1 15.5 18.5h-7a2.25 2.25 0 0 1-2.24-1.98l-.7-9.02H4.5A.75.75 0 0 1 4.5 6h3v-.75A1.5 1.5 0 0 1 9 3.75Zm5.98 2.25v-.75a.75.75 0 0 0-.75-.75h-6a.75.75 0 0 0-.75.75V6h7.5Zm-6.84 9.4a.75.75 0 0 0 1.5-.06l-.15-5.25a.75.75 0 1 0-1.5.06l.15 5.25Zm3.31-.06a.75.75 0 1 0 1.5.06l.15-5.25a.75.75 0 1 0-1.5-.06l-.15 5.25Z" />
                    </svg>
                    <span>Eliminar</span>
                  </button>
                </div>
              ) : (
                <div className="cart-item-compact-meta">
                  <p className="cart-item-unit-price">
                    <span>Precio unitario</span>
                    <strong>{formatCOP(item.precio)}</strong>
                  </p>
                  <p className="cart-item-quantity">
                    <span>Cantidad</span>
                    <strong>{item.cantidad}</strong>
                  </p>
                </div>
              )}
            </div>
          </article>
        );
      })}
    </section>
  );
}
