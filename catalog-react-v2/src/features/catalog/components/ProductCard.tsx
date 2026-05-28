import { memo, useEffect, useMemo, useState } from "react";
import type { Producto } from "../../../shared/types/catalog";
import { useCartStore } from "../../cart/store/cartStore";
import { formatCOP } from "../../../shared/utils/currency";
import { resolveProductImageCandidates } from "../utils/cloudfront";

interface ProductCardProps {
  product: Producto;
  companyColor: string;
  onOpenDetail: () => void;
}

const IMAGE_WIDTH = 320;
const IMAGE_HEIGHT = 400;

export const ProductCard = memo(function ProductCard({ product, companyColor, onOpenDetail }: ProductCardProps) {
  const addItem = useCartStore((state) => state.addItem);
  const [isImageLoading, setIsImageLoading] = useState(true);
  const [imageIndex, setImageIndex] = useState(0);

  const imageCandidates = useMemo(
    () => resolveProductImageCandidates(product, "", "sm"),
    [product.imagen, product.imagen_lg, product.imagen_md, product.imagen_sm, product.imagen_url],
  );

  useEffect(() => {
    setImageIndex(0);
    setIsImageLoading(true);
  }, [product.id, imageCandidates]);

  const imageSrc = imageCandidates[imageIndex] ?? "/product-placeholder.svg";
  const normalizedCategory = String(product.categoriaNombre ?? product.categoriaID ?? "").trim();
  const categoryLabel = normalizedCategory ? normalizedCategory : "Sin categoria";

  return (
    <article className="product-card rounded-xl border border-slate-200 bg-white shadow-sm">
      <button
        className="product-media block w-full"
        type="button"
        onClick={onOpenDetail}
        aria-label={`Ver detalle de ${product.nombre}`}
      >
        <div className="product-media-frame rounded-t-xl">
          {isImageLoading ? <span className="product-skeleton" aria-hidden="true" /> : null}

          <img
            className="product-image rounded-t-xl"
            src={imageSrc}
            alt={product.nombre}
            width={IMAGE_WIDTH}
            height={IMAGE_HEIGHT}
            loading="lazy"
            decoding="async"
            onLoad={() => setIsImageLoading(false)}
            onError={() => {
              setImageIndex((currentIndex) => Math.min(currentIndex + 1, imageCandidates.length - 1));
              setIsImageLoading(true);
            }}
          />
        </div>
      </button>

      <div className="product-body p-3">
        <p className="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-[10px] uppercase text-gray-600">
          Categoria {categoryLabel}
        </p>
        <h3 className="line-clamp-2 text-sm font-semibold leading-5 text-slate-800">{product.nombre}</h3>
        {product.codigo_producto ? <p className="text-xs font-medium text-slate-500">Codigo: {product.codigo_producto}</p> : null}
        <p className="text-slate-900 font-semibold">{formatCOP(product.precio)}</p>

        <button
          type="button"
          className="product-add mt-auto w-full rounded-lg px-3 py-2 text-sm font-semibold text-white"
          style={{ backgroundColor: companyColor }}
          onClick={() =>
            addItem({
              id: product.id,
              nombre: product.nombre,
              precio: product.precio,
              imagen: product.imagen,
            })
          }
        >
          Anadir al carrito
        </button>
      </div>
    </article>
  );
});

ProductCard.displayName = "ProductCard";
