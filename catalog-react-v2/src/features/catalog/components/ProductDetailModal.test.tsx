import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Producto } from "../../../shared/types/catalog";

const mocks = vi.hoisted(() => ({
  detailQuery: {
    data: null as Producto | null,
    isLoading: false,
    error: null as Error | null,
  },
}));

vi.mock("../hooks/usePublicCatalog", () => ({
  usePublicProductDetail: () => mocks.detailQuery,
  mapDetailProduct: (product: Producto) => product,
}));

import { ProductDetailModal } from "./ProductDetailModal";

describe("ProductDetailModal", () => {
  it("renders the detail data and adds the product to the cart", () => {
    const onClose = vi.fn();
    const onAddToCart = vi.fn();
    const product: Producto = {
      id: 123,
      nombre: "Hamburguesa XL",
      precio: 18900,
      imagen: "/fallback.jpg",
      imagen_md: "/detail-md.jpg",
      categoriaID: 10,
      categoriaNombre: "Hamburguesas",
      codigo_producto: "CAT-123",
      descripcion: "Hamburguesa con doble carne...",
    };

    mocks.detailQuery.data = product;
    mocks.detailQuery.isLoading = false;
    mocks.detailQuery.error = null;

    render(
      <ProductDetailModal
        tenantSlug="flora"
        product={product}
        companyColor="#d94b8a"
        onClose={onClose}
        onAddToCart={onAddToCart}
      />,
    );

    expect(screen.getByRole("dialog", { name: "Detalle de Hamburguesa XL" })).toBeInTheDocument();
    expect(screen.getByText("Categoria")).toBeInTheDocument();
    expect(screen.getByText("Hamburguesas")).toBeInTheDocument();
    expect(screen.getByText("Codigo")).toBeInTheDocument();
    expect(screen.getByText("CAT-123")).toBeInTheDocument();
    expect(screen.getByText("Hamburguesa con doble carne...")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Hamburguesa XL" })).toHaveAttribute(
      "src",
      expect.stringContaining("/detail-md.jpg"),
    );

    fireEvent.click(screen.getByRole("button", { name: "Anadir al carrito" }));

    expect(onAddToCart).toHaveBeenCalledWith(product);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("shows a loading state while the detail is being fetched", () => {
    mocks.detailQuery.data = null;
    mocks.detailQuery.isLoading = true;
    mocks.detailQuery.error = null;

    render(
      <ProductDetailModal
        tenantSlug="flora"
        product={{
          id: 321,
          nombre: "Caja Rosas",
          precio: 25000,
          imagen: "/caja.jpg",
          imagen_md: "/caja-md.jpg",
          categoriaID: 11,
          categoriaNombre: "Rosas",
        }}
        companyColor="#d94b8a"
        onClose={vi.fn()}
        onAddToCart={vi.fn()}
      />,
    );

    expect(screen.getByText("Cargando detalle del producto...")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cargando..." })).toBeDisabled();
  });
});
