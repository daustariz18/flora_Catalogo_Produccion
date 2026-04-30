import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { Producto } from "../../../shared/types/catalog";

vi.mock("./ProductCard", () => ({
  ProductCard: ({ nombre, categoria }: { nombre: string; categoria: number | string }) => (
    <article data-testid="product-card">
      {nombre}
      {" | "}
      {String(categoria)}
    </article>
  ),
}));

import { ProductGrid } from "./ProductGrid";

const products: Producto[] = [
  { id: 1, nombre: "Rosa Roja", precio: 10000, imagen: "/rosa.png", categoriaID: 1, categoriaNombre: "Rosas" },
  { id: 2, nombre: "Girasol", precio: 12000, imagen: "/girasol.png", categoriaID: 2, categoriaNombre: "Girasoles" },
];

describe("ProductGrid", () => {
  it("filters by category and search query", () => {
    render(
      <ProductGrid
        products={products}
        selectedCategory={1}
        searchQuery="rosa"
        companyColor="#ff0000"
        onOpenDetail={vi.fn()}
      />,
    );

    expect(screen.getAllByTestId("product-card")).toHaveLength(1);
    expect(screen.getByText("Rosa Roja | Rosas")).toBeInTheDocument();
  });

  it("shows the empty state when no products match", () => {
    render(
      <ProductGrid
        products={products}
        selectedCategory={3}
        searchQuery="orquidea"
        companyColor="#ff0000"
        onOpenDetail={vi.fn()}
      />,
    );

    expect(screen.getByText("No encontramos arreglos para esta seleccion.")).toBeInTheDocument();
  });
});
