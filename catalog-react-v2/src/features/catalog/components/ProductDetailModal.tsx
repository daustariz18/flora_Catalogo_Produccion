import type { Producto } from "../../../shared/types/catalog";
import { formatCOP } from "../../../shared/utils/currency";
import { mapDetailProduct, usePublicProductDetail } from "../hooks/usePublicCatalog";

interface ProductDetailModalProps {
  tenantSlug: string;
  product: Producto | null;
  onClose: () => void;
  onAddToCart: (product: Producto) => void;
  companyColor: string;
}

export function ProductDetailModal({
  tenantSlug,
  product,
  onClose,
  onAddToCart,
  companyColor,
}: ProductDetailModalProps) {
  const detailQuery = usePublicProductDetail(tenantSlug, product?.id ?? null);

  if (!product) {
    return null;
  }

  const detailProduct = detailQuery.data ? mapDetailProduct(detailQuery.data, tenantSlug) : null;
  const displayProduct = detailProduct ?? product;
  const isLoadingDetail = detailQuery.isLoading && !detailProduct;
  const errorMessage = detailQuery.error instanceof Error ? detailQuery.error.message : null;

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal-panel"
        role="dialog"
        aria-modal="true"
        aria-label={`Detalle de ${displayProduct.nombre}`}
        onClick={(event) => event.stopPropagation()}
      >
        <img src={displayProduct.imagen} alt={displayProduct.nombre} className="modal-image" />
        <div className="modal-body">
          <h2>{displayProduct.nombre}</h2>
          <p className="modal-price">{formatCOP(displayProduct.precio)}</p>
          <div className="modal-meta">
            {displayProduct.categoriaNombre ? (
              <p>
                <span>Categoria</span>
                <strong>{displayProduct.categoriaNombre}</strong>
              </p>
            ) : null}
            {displayProduct.codigo_producto ? (
              <p>
                <span>Codigo</span>
                <strong>{displayProduct.codigo_producto}</strong>
              </p>
            ) : null}
          </div>
          <p className="modal-description">
            {errorMessage
              ? "No pudimos cargar la descripcion del producto en este momento."
              : displayProduct.descripcion ?? (isLoadingDetail ? "Cargando detalle del producto..." : "Arreglo floral de alta calidad.")}
          </p>
          <div className="modal-actions">
            <button type="button" className="ghost" onClick={onClose}>
              Cerrar
            </button>
            <button
              type="button"
              className="cta"
              style={{ backgroundColor: companyColor }}
              disabled={isLoadingDetail}
              onClick={() => {
                onAddToCart(displayProduct);
                onClose();
              }}
            >
              {isLoadingDetail ? "Cargando..." : "Anadir al carrito"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
