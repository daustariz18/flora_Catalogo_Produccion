import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { Producto } from "../../../shared/types/catalog";

vi.mock("./ProductCard", () => ({
  ProductCard: ({ product }: { product: Producto }) => (
    <article data-testid="product-card">
      {product.nombre}
      {" | "}
      {String(product.categoriaNombre ?? product.id_categoria ?? product.categoriaID)}
    </article>
  ),
}));

import { ProductGrid } from "./ProductGrid";

const products: Producto[] = [
  {
    id: 1,
    nombre: "Rosa Roja",
    precio: 10000,
    imagen: "/rosa.png",
    categoriaID: 1,
    categoriaNombre: "Rosas",
    codigo_producto: "FLORA-0001",
    descripcion: "Ramo premium con rosas frescas",
  },
  {
    id: 2,
    nombre: "Arreglo Personalizado Deluxe",
    precio: 12000,
    imagen: "/girasol.png",
    categoriaID: 2,
    categoriaNombre: "Arreglos personalizados",
    codigoProduct: "FLORA-0002",
    descripcion: "Diseño especial para ocasiones únicas",
  },
];

describe("ProductGrid", () => {
  it("shows products in the configured display order", () => {
    render(
      <ProductGrid
        products={products}
        companyColor="#ff0000"
        onOpenDetail={vi.fn()}
        emptyMessage="Sin productos"
      />,
    );

    const cards = screen.getAllByTestId("product-card");
    expect(cards[0]).toHaveTextContent("Arreglo Personalizado Deluxe | Arreglos personalizados");
    expect(cards[1]).toHaveTextContent("Rosa Roja | Rosas");
  });

  it("shows the empty state message when there are no products", () => {
    render(
      <ProductGrid
        products={[]}
        companyColor="#ff0000"
        onOpenDetail={vi.fn()}
        emptyMessage="No encontramos productos para esta busqueda."
      />,
    );

    expect(screen.getByText("No encontramos productos para esta busqueda.")).toBeInTheDocument();
  });

  it("renders the load more action when available", () => {
    const onLoadMore = vi.fn();

    render(
      <ProductGrid
        products={products.slice(0, 1)}
        companyColor="#ff0000"
        onOpenDetail={vi.fn()}
        emptyMessage="Sin productos"
        hasMore
        isLoadingMore={false}
        onLoadMore={onLoadMore}
      />,
    );

    screen.getByRole("button", { name: "Cargar mas" }).click();
    expect(onLoadMore).toHaveBeenCalledTimes(1);
  });
});
