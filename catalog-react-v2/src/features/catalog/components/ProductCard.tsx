import { memo, useState } from "react";
import { useCartStore } from "../../cart/store/cartStore";
import { formatCOP } from "../../../shared/utils/currency";

interface ProductCardProps {
  id: number;
  nombre: string;
  precio: number;
  imagenUrl: string;
  categoria: number | string;
  companyColor: string;
  onOpenDetail: () => void;
}

const FALLBACK_IMAGE = "/product-placeholder.svg";

export const ProductCard = memo(function ProductCard({
  id,
  nombre,
  precio,
  imagenUrl,
  categoria,
  companyColor,
  onOpenDetail,
}: ProductCardProps) {
  const addItem = useCartStore((state) => state.addItem);
  const [isImageLoading, setIsImageLoading] = useState(true);
  const [hasImageError, setHasImageError] = useState(false);

  const imageSrc = hasImageError ? FALLBACK_IMAGE : imagenUrl;
  const normalizedCategory = String(categoria).trim();
  const categoryLabel = normalizedCategory ? normalizedCategory : "Sin categoria";

  return (
    <article className="product-card rounded-xl border border-slate-200 bg-white shadow-sm">
      <button
        className="product-media block w-full"
        type="button"
        onClick={onOpenDetail}
        aria-label={`Ver detalle de ${nombre}`}
      >
        <div className="product-media-frame rounded-t-xl">
          {isImageLoading ? <span className="product-skeleton" aria-hidden="true" /> : null}

          <img
            className="product-image rounded-t-xl"
            src={imageSrc}
            alt={nombre}
            loading="lazy"
            onLoad={() => setIsImageLoading(false)}
            onError={() => {
              setHasImageError(true);
              setIsImageLoading(false);
            }}
          />
        </div>
      </button>

      <div className="product-body space-y-2 p-3">
        <p className="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-[10px] uppercase text-gray-600">
          Categoria {categoryLabel}
        </p>
        <h3 className="line-clamp-2 text-sm font-semibold leading-5 text-slate-800">{nombre}</h3>
        <p className="text-slate-900 font-semibold">{formatCOP(precio)}</p>

        <button
          type="button"
          className="product-add mt-2 w-full rounded-lg px-3 py-2 text-sm font-semibold text-white"
          style={{ backgroundColor: companyColor }}
          onClick={() =>
            addItem({
              id,
              nombre,
              precio,
              imagen: imagenUrl,
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
