import type { Producto } from "../../../shared/types/catalog";
import { ProductCard } from "./ProductCard";

export type CatalogViewMode = "grid" | "list";
export type ProductSortMode = "code-asc" | "name-asc" | "name-desc" | "price-desc" | "price-asc";

interface ProductGridProps {
  products: Producto[];
  companyColor: string;
  onOpenDetail: (product: Producto) => void;
  emptyMessage: string;
  hasMore?: boolean;
  isLoadingMore?: boolean;
  onLoadMore?: () => void;
  viewMode?: CatalogViewMode;
}

export function ProductGrid({
  products,
  companyColor,
  onOpenDetail,
  emptyMessage,
  hasMore = false,
  isLoadingMore = false,
  onLoadMore,
  viewMode = "grid",
}: ProductGridProps) {
  const filteredProducts = products;

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
      <section className={`product-grid product-grid-${viewMode} gap-4`} aria-label="Listado de productos">
        {filteredProducts.map((product) => (
          <ProductCard
            key={product.id}
            product={product}
            companyColor={companyColor}
            onOpenDetail={() => onOpenDetail(product)}
            viewMode={viewMode}
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
