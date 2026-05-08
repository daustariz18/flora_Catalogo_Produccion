import { useMemo } from "react";
import type { Categoria, Producto } from "../../../shared/types/catalog";
import { ProductCard } from "./ProductCard";
import { matchesCatalogSearch, sortProductsForDisplay } from "../utils/catalogDisplay";

interface ProductGridProps {
  products: Producto[];
  categories?: Categoria[];
  searchQuery: string;
  companyColor: string;
  onOpenDetail: (product: Producto) => void;
  hasMore?: boolean;
  isLoadingMore?: boolean;
  onLoadMore?: () => void;
}

export function ProductGrid({
  products,
  categories = [],
  searchQuery,
  companyColor,
  onOpenDetail,
  hasMore = false,
  isLoadingMore = false,
  onLoadMore,
}: ProductGridProps) {
  const filteredProducts = useMemo(() => {
    let result = sortProductsForDisplay(products);
    if (searchQuery.trim()) {
      result = result.filter((product) => matchesCatalogSearch(product, searchQuery, categories));
    }
    return result;
  }, [categories, products, searchQuery]);

  if (!filteredProducts.length) {
    return (
      <div className="catalog-empty-state">
        <p className="empty-state">No encontramos arreglos para esta seleccion.</p>
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
            id={product.id}
            nombre={product.nombre}
            codigoProducto={product.codigo_producto ?? product.codigoProduct}
            precio={product.precio}
            imagenUrl={product.imagen}
            categoria={product.categoriaNombre ?? product.id_categoria ?? product.categoriaID}
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
