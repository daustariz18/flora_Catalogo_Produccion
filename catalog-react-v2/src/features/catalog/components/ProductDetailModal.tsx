import type { Producto } from "../../../shared/types/catalog";
import { formatCOP } from "../../../shared/utils/currency";

interface ProductDetailModalProps {
  product: Producto | null;
  onClose: () => void;
  onAddToCart: (product: Producto) => void;
  companyColor: string;
}

export function ProductDetailModal({
  product,
  onClose,
  onAddToCart,
  companyColor,
}: ProductDetailModalProps) {
  if (!product) {
    return null;
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal-panel"
        role="dialog"
        aria-modal="true"
        aria-label={`Detalle de ${product.nombre}`}
        onClick={(event) => event.stopPropagation()}
      >
        <img src={product.imagen} alt={product.nombre} className="modal-image" />
        <div className="modal-body">
          <h2>{product.nombre}</h2>
          <p className="modal-price">{formatCOP(product.precio)}</p>
          <p className="modal-description">{product.descripcion ?? "Arreglo floral de alta calidad."}</p>
          <div className="modal-actions">
            <button type="button" className="ghost" onClick={onClose}>
              Cerrar
            </button>
            <button
              type="button"
              className="cta"
              style={{ backgroundColor: companyColor }}
              onClick={() => {
                onAddToCart(product);
                onClose();
              }}
            >
              Anadir al carrito
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
