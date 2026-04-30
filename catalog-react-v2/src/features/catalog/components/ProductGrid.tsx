import { useMemo } from "react";
import type { Producto } from "../../../shared/types/catalog";
import { ProductCard } from "./ProductCard";

interface ProductGridProps {
  products: Producto[];
  selectedCategory: number | null;
  searchQuery: string;
  companyColor: string;
  onOpenDetail: (product: Producto) => void;
}

export function ProductGrid({
  products,
  selectedCategory,
  searchQuery,
  companyColor,
  onOpenDetail,
}: ProductGridProps) {
  const filteredProducts = useMemo(() => {
    let result = products;
    if (selectedCategory !== null) {
      result = result.filter((p) => (p.id_categoria ?? p.categoriaID) === selectedCategory);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter((p) => p.nombre.toLowerCase().includes(q));
    }
    return result;
  }, [products, selectedCategory, searchQuery]);

  if (!filteredProducts.length) {
    return <p className="empty-state">No encontramos arreglos para esta seleccion.</p>;
  }

  return (
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
  );
}
