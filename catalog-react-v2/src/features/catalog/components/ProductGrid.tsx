import { useMemo } from "react";
import type { Producto } from "../../../shared/types/catalog";
import { ProductCard } from "./ProductCard";
import { sortProductsForDisplay } from "../utils/catalogDisplay";

interface ProductGridProps {
  products: Producto[];
  companyColor: string;
  onOpenDetail: (product: Producto) => void;
  emptyMessage: string;
  hasMore?: boolean;
  isLoadingMore?: boolean;
  onLoadMore?: () => void;
}

export function ProductGrid({
  products,
  companyColor,
  onOpenDetail,
  emptyMessage,
  hasMore = false,
  isLoadingMore = false,
  onLoadMore,
}: ProductGridProps) {
  const filteredProducts = useMemo(() => {
    return sortProductsForDisplay(products);
  }, [products]);

  if (!filteredProducts.length) {
    return (
      <div className="catalog-empty-state">
        <p className="empty-state">{emptyMessage}</p>
        {hasMore && onLoadMore ? (
          <button type="button" className="ghost catalog-load-more" onClick={onLoadMore} disabled={isLoadingMore}>
            {isLoadingMore ? "Cargando..." : "Cargar mas"}
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="catalog-products-stack">
      <section className="product-grid gap-4" aria-label="Listado de productos">
        {filteredProducts.map((product) => (
          <ProductCard
            key={product.id}
            product={product}
            companyColor={companyColor}
            onOpenDetail={() => onOpenDetail(product)}
          />
        ))}
      </section>

      {hasMore && onLoadMore ? (
        <div className="catalog-load-more-wrap">
          <button type="button" className="cta catalog-load-more" onClick={onLoadMore} disabled={isLoadingMore}>
            {isLoadingMore ? "Cargando..." : "Cargar mas"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
