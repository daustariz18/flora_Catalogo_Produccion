import { useEffect, useLayoutEffect, useState, type CSSProperties } from "react";
import { useParams } from "react-router-dom";
import type { Producto } from "../../../shared/types/catalog";
import { useCartStore } from "../../cart/store/cartStore";
import { CartSummaryBar } from "../../cart/components/CartSummaryBar";
import { CategoryFilter } from "../components/CategoryFilter";
import { Header } from "../components/Header";
import { ProductDetailModal } from "../components/ProductDetailModal";
import { ProductGrid, type CatalogViewMode, type ProductSortMode } from "../components/ProductGrid";
import { ProductSortDropdown } from "../components/ProductSortDropdown";
import { ViewModeToggle } from "../components/ViewModeToggle";
import { usePublicBarrios } from "../hooks/usePublicBarrios";
import { usePublicCatalog } from "../hooks/usePublicCatalog";
import { resolveTenantSlug, storeTenantSlug } from "../../../shared/utils/tenantSlug";

const CATALOG_VIEW_MODE_KEY = "petalops.catalog.viewMode";
const CATALOG_VIEW_MODES: CatalogViewMode[] = ["grid", "list"];
const CATALOG_SORT_MODE_KEY = "petalops.catalog.sortMode";

function readStoredViewMode(): CatalogViewMode {
  try {
    const storedMode = window.localStorage.getItem(CATALOG_VIEW_MODE_KEY);
    return CATALOG_VIEW_MODES.includes(storedMode as CatalogViewMode) ? (storedMode as CatalogViewMode) : "grid";
  } catch {
    return "grid";
  }
}

export function CatalogPage() {
  const { tenantSlug = "" } = useParams();
  const activeTenant = resolveTenantSlug(tenantSlug);
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<CatalogViewMode>(readStoredViewMode);
  const [sortMode, setSortMode] = useState<ProductSortMode>("code-asc");
  const [detailProduct, setDetailProduct] = useState<Producto | null>(null);
  const { barrios } = usePublicBarrios(activeTenant);
  const {
    company,
    categories,
    products,
    hasMore,
    isLoadingProducts,
    isLoadingInitial,
    isLoadingMore,
    error,
    loadMore,
  } = usePublicCatalog(activeTenant, selectedCategory, searchQuery, sortMode);

  const addItem = useCartStore((state) => state.addItem);
  const setActiveTenant = useCartStore((state) => state.setActiveTenant);
  const setAvailableBarrios = useCartStore((state) => state.setAvailableBarrios);
  const effectiveSelectedCategory =
    selectedCategory !== null && !categories.some((category) => category.id === selectedCategory)
      ? null
      : selectedCategory;

  useLayoutEffect(() => {
    setActiveTenant(activeTenant);
  }, [activeTenant, setActiveTenant]);

  useEffect(() => {
    storeTenantSlug(activeTenant);
  }, [activeTenant]);

  useEffect(() => {
    window.localStorage.setItem(CATALOG_VIEW_MODE_KEY, viewMode);
  }, [viewMode]);

  useEffect(() => {
    window.localStorage.setItem(CATALOG_SORT_MODE_KEY, sortMode);
  }, [sortMode]);

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
  const normalizedSearchQuery = searchQuery.trim();
  const isSearchActive = normalizedSearchQuery.length > 0;
  const emptyMessage = isSearchActive
    ? "No encontramos productos para esta busqueda."
    : effectiveSelectedCategory !== null
      ? "No encontramos productos para esta seleccion."
      : "Todavia no hay productos publicados para este catalogo.";
  const showProductLoading = isLoadingProducts && products.length === 0;

  return (
    <main style={{ "--brand-color": companyColor } as CSSProperties} className="catalog-page">
      <Header company={company} tenantSlug={activeTenant} />

      <section className="catalog-content main-content px-4 md:pb-6">
        <div className="catalog-search-wrap">
          <label htmlFor="catalog-search" className="catalog-search-label">
            Buscar productos
          </label>
          <div className="catalog-search-field">
            <span className="catalog-search-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" role="presentation">
                <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.8" />
                <path d="M16 16L20 20" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </span>
            <input
              id="catalog-search"
              className="catalog-search-input"
              type="text"
              value={searchQuery}
              placeholder="Nombre, codigo o categoria"
              aria-label="Buscar productos"
              onChange={(event) => setSearchQuery(event.target.value)}
            />
            {normalizedSearchQuery ? (
              <button
                type="button"
                className="catalog-search-clear"
                onClick={() => setSearchQuery("")}
                aria-label="Limpiar busqueda"
              >
                Limpiar
              </button>
            ) : null}
          </div>
        </div>

        <div className="catalog-toolbar">
          <CategoryFilter
            categories={categories}
            selectedCategory={effectiveSelectedCategory}
            onChange={setSelectedCategory}
            companyColor={companyColor}
          />
          <div className="catalog-toolbar-actions">
            <ProductSortDropdown value={sortMode} onChange={setSortMode} />
            <ViewModeToggle value={viewMode} onChange={setViewMode} />
          </div>
        </div>

        {showProductLoading ? (
          <section className="catalog-empty-shell" aria-live="polite">
            <p className="empty-state">{isSearchActive ? "Buscando productos..." : "Cargando productos..."}</p>
          </section>
        ) : (
          <ProductGrid
            products={products}
            companyColor={companyColor}
            onOpenDetail={setDetailProduct}
            emptyMessage={emptyMessage}
            hasMore={hasMore}
            isLoadingMore={isLoadingMore}
            onLoadMore={loadMore}
            viewMode={viewMode}
          />
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
            id_producto: product.id_producto ?? product.id,
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
