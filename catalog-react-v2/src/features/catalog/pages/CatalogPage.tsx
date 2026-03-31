import { useEffect, useState, type CSSProperties } from "react";
import { useParams } from "react-router-dom";
import type { Producto } from "../../../shared/types/catalog";
import { useCartStore } from "../../cart/store/cartStore";
import { CartSummaryBar } from "../../cart/components/CartSummaryBar";
import { CategoryFilter } from "../components/CategoryFilter";
import { Header } from "../components/Header";
import { ProductDetailModal } from "../components/ProductDetailModal";
import { ProductGrid } from "../components/ProductGrid";
import { useCompanyData } from "../hooks/useCompanyData";

export function CatalogPage() {
  const { tenantSlug = "" } = useParams();
  const activeTenant = tenantSlug;
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [detailProduct, setDetailProduct] = useState<Producto | null>(null);
  const { company, categories, products, barrios, isLoading, error } = useCompanyData(activeTenant);

  const addItem = useCartStore((state) => state.addItem);
  const setAvailableBarrios = useCartStore((state) => state.setAvailableBarrios);

  useEffect(() => {
    if (selectedCategory !== null && !categories.some((category) => category.id === selectedCategory)) {
      setSelectedCategory(null);
    }
  }, [categories, selectedCategory]);

  useEffect(() => {
    setAvailableBarrios(barrios);
  }, [barrios, setAvailableBarrios]);

  if (isLoading) {
    return <main className="loading-screen">Cargando catalogo floral...</main>;
  }

  if (error) {
    return (
      <main className="loading-screen error-screen">
        <h1>No pudimos cargar el catalogo</h1>
        <p>{error}</p>
      </main>
    );
  }

  const companyColor = company.colorPrimario;

  return (
    <main style={{ "--brand-color": companyColor } as CSSProperties} className="catalog-page">
      <Header company={company} tenantSlug={activeTenant} />

      <section className="catalog-content main-content px-4 md:pb-6">
        <div className="catalog-search-wrap">
          <svg className="catalog-search-icon" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="search"
            className="catalog-search-input"
            placeholder="Busca flores, ramos o arreglos..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Buscar flores, ramos o arreglos"
          />
        </div>

        <CategoryFilter
          categories={categories}
          selectedCategory={selectedCategory}
          onChange={setSelectedCategory}
          companyColor={companyColor}
        />

        <ProductGrid
          products={products}
          selectedCategory={selectedCategory}
          searchQuery={searchQuery}
          companyColor={companyColor}
          onOpenDetail={setDetailProduct}
        />
      </section>

      <ProductDetailModal
        product={detailProduct}
        companyColor={companyColor}
        onClose={() => setDetailProduct(null)}
        onAddToCart={(product) =>
          addItem({
            id: product.id,
            nombre: product.nombre,
            precio: product.precio,
            imagen: product.imagen,
          })
        }
      />

      <CartSummaryBar />
    </main>
  );
}
