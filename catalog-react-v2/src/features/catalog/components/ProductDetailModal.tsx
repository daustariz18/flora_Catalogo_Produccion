import { useEffect, useMemo, useState } from "react";
import type { Producto } from "../../../shared/types/catalog";
import { formatCOP } from "../../../shared/utils/currency";
import { resolveProductImageCandidates } from "../utils/cloudfront";
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
  const [imageIndex, setImageIndex] = useState(0);
  const [isImageLoading, setIsImageLoading] = useState(true);
  const detailProduct = detailQuery.data && product ? mapDetailProduct(detailQuery.data, tenantSlug) : null;
  const displayProduct = detailProduct ?? product;
  const isLoadingDetail = detailQuery.isLoading && !detailProduct;
  const errorMessage = detailQuery.error instanceof Error ? detailQuery.error.message : null;
  const imageCandidates = useMemo(
    () => (displayProduct ? resolveProductImageCandidates(displayProduct, tenantSlug, "md") : ["/product-placeholder.svg"]),
    [
      displayProduct?.id,
      displayProduct?.imagen,
      displayProduct?.imagen_lg,
      displayProduct?.imagen_md,
      displayProduct?.imagen_sm,
      displayProduct?.imagen_url,
      tenantSlug,
    ],
  );

  useEffect(() => {
    setImageIndex(0);
    setIsImageLoading(true);
  }, [displayProduct?.id, imageCandidates]);

  const imageSrc = imageCandidates[imageIndex] ?? "/product-placeholder.svg";

  if (!displayProduct) {
    return null;
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal-panel"
        role="dialog"
        aria-modal="true"
        aria-label={`Detalle de ${displayProduct.nombre}`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-image-shell">
          {isImageLoading ? <span className="product-skeleton" aria-hidden="true" /> : null}
          <img
            src={imageSrc}
            alt={displayProduct.nombre}
            className="modal-image"
            width={800}
            height={560}
            loading="lazy"
            decoding="async"
            onLoad={() => setIsImageLoading(false)}
            onError={() => {
              setImageIndex((currentIndex) => Math.min(currentIndex + 1, imageCandidates.length - 1));
              setIsImageLoading(true);
            }}
          />
        </div>
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
            {displayProduct.codigo_catalogo || displayProduct.codigo_producto || displayProduct.codigoProduct ? (
              <p>
                <span>Codigo</span>
                <strong>{displayProduct.codigo_catalogo ?? displayProduct.codigo_producto ?? displayProduct.codigoProduct}</strong>
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
