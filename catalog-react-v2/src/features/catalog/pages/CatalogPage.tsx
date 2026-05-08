import { useEffect, useState, type CSSProperties } from "react";
import { useParams } from "react-router-dom";
import type { Producto } from "../../../shared/types/catalog";
import { useCartStore } from "../../cart/store/cartStore";
import { CartSummaryBar } from "../../cart/components/CartSummaryBar";
import { CategoryFilter } from "../components/CategoryFilter";
import { Header } from "../components/Header";
import { ProductDetailModal } from "../components/ProductDetailModal";
import { ProductGrid } from "../components/ProductGrid";
import { usePublicBarrios } from "../hooks/usePublicBarrios";
import { usePublicCatalog } from "../hooks/usePublicCatalog";
import { resolveTenantSlug, storeTenantSlug } from "../../../shared/utils/tenantSlug";

export function CatalogPage() {
  const { tenantSlug = "" } = useParams();
  const activeTenant = resolveTenantSlug(tenantSlug);
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [detailProduct, setDetailProduct] = useState<Producto | null>(null);
  const { barrios } = usePublicBarrios(activeTenant);
  const {
    company,
    categories,
    products,
    hasMore,
    isLoadingCategories,
    isLoadingProducts,
    isLoadingInitial,
    isLoadingMore,
    error,
    loadMore,
  } = usePublicCatalog(activeTenant, selectedCategory);

  const addItem = useCartStore((state) => state.addItem);
  const setAvailableBarrios = useCartStore((state) => state.setAvailableBarrios);

  useEffect(() => {
    if (selectedCategory !== null && !categories.some((category) => category.id === selectedCategory)) {
      setSelectedCategory(null);
    }
  }, [categories, selectedCategory]);

  useEffect(() => {
    storeTenantSlug(activeTenant);
  }, [activeTenant]);

  useEffect(() => {
    setAvailableBarrios(barrios);
  }, [barrios, setAvailableBarrios]);

  if (isLoadingInitial) {
    return <main className="loading-screen">Cargando catalogo...</main>;
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
  const hasProducts = products.length > 0;

  return (
    <main style={{ "--brand-color": companyColor } as CSSProperties} className="catalog-page">
      <Header company={company} tenantSlug={activeTenant} />

      <section className="catalog-content main-content px-4 md:pb-6">
        <CategoryFilter
          categories={categories}
          selectedCategory={selectedCategory}
          onChange={setSelectedCategory}
          companyColor={companyColor}
        />

        {hasProducts ? (
          <ProductGrid
            products={products}
            categories={categories}
            searchQuery=""
            companyColor={companyColor}
            onOpenDetail={setDetailProduct}
            hasMore={hasMore}
            isLoadingMore={isLoadingMore}
            onLoadMore={loadMore}
          />
        ) : (
          <section className="catalog-empty-shell">
            <p className="empty-state">
              {isLoadingProducts || isLoadingCategories
                ? "Cargando categorias y productos..."
                : "Todavia no hay productos publicados para este catalogo."}
            </p>
            <button type="button" className="ghost catalog-load-more" onClick={loadMore} disabled={!hasMore || isLoadingMore}>
              {isLoadingMore ? "Cargando..." : hasMore ? "Cargar mas" : "Sin mas productos"}
            </button>
          </section>
        )}
      </section>

      <ProductDetailModal
        tenantSlug={activeTenant}
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
