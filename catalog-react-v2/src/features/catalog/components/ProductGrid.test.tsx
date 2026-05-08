import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { Categoria, Producto } from "../../../shared/types/catalog";

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

const categories: Categoria[] = [
  { id: 1, nombre: "Rosas" },
  { id: 2, nombre: "Arreglos personalizados" },
  { id: 3, nombre: "Flora Madres" },
];

function buildCategorySearchId(value: string): number {
  const normalized = value.trim().toLowerCase();
  let hash = 0;

  for (const char of normalized) {
    hash = (hash * 31 + char.codePointAt(0)!) >>> 0;
  }

  return hash === 0 ? 1 : hash;
}

describe("ProductGrid", () => {
  it("filters by search query", () => {
    render(
      <ProductGrid
        products={products}
        categories={categories}
        searchQuery="rosa"
        companyColor="#ff0000"
        onOpenDetail={vi.fn()}
      />,
    );

    expect(screen.getAllByTestId("product-card")).toHaveLength(1);
    expect(screen.getByText("Rosa Roja | Rosas")).toBeInTheDocument();
  });

  it("filters by product code", () => {
    render(
      <ProductGrid
        products={products}
        categories={categories}
        searchQuery="flora0001"
        companyColor="#ff0000"
        onOpenDetail={vi.fn()}
      />,
    );

    expect(screen.getAllByTestId("product-card")).toHaveLength(1);
    expect(screen.getByText("Rosa Roja | Rosas")).toBeInTheDocument();
  });

  it("filters by alternate product code field", () => {
    render(
      <ProductGrid
        products={products}
        categories={categories}
        searchQuery="FLORA-0002"
        companyColor="#ff0000"
        onOpenDetail={vi.fn()}
      />,
    );

    expect(screen.getAllByTestId("product-card")).toHaveLength(1);
    expect(screen.getByText("Arreglo Personalizado Deluxe | Arreglos personalizados")).toBeInTheDocument();
  });

  it("filters by category name", () => {
    render(
      <ProductGrid
        products={products}
        categories={categories}
        searchQuery="personalizados"
        companyColor="#ff0000"
        onOpenDetail={vi.fn()}
      />,
    );

    expect(screen.getAllByTestId("product-card")).toHaveLength(1);
    expect(screen.getByText("Arreglo Personalizado Deluxe | Arreglos personalizados")).toBeInTheDocument();
  });

  it("shows personalized products first", () => {
    render(
      <ProductGrid
        products={products}
        categories={categories}
        searchQuery=""
        companyColor="#ff0000"
        onOpenDetail={vi.fn()}
      />,
    );

    const cards = screen.getAllByTestId("product-card");
    expect(cards[0]).toHaveTextContent("Arreglo Personalizado Deluxe | Arreglos personalizados");
    expect(cards[1]).toHaveTextContent("Rosa Roja | Rosas");
  });

  it("shows the empty state when no products match", () => {
    render(
      <ProductGrid
        products={products}
        categories={categories}
        searchQuery="orquidea"
        companyColor="#ff0000"
        onOpenDetail={vi.fn()}
    />,
    );

    expect(screen.getByText("No encontramos arreglos para esta seleccion.")).toBeInTheDocument();
  });

  it("filters by category even when the product has no category name", () => {
    render(
      <ProductGrid
        products={[
          {
            id: 3,
            nombre: "Ramo Sin Categoria Nombre",
            precio: 50000,
            imagen: "/ramo.png",
            categoriaID: 1,
          },
        ]}
        categories={categories}
        searchQuery="rosas"
        companyColor="#ff0000"
        onOpenDetail={vi.fn()}
      />,
    );

    expect(screen.getByText("Ramo Sin Categoria Nombre | 1")).toBeInTheDocument();
  });

  it("filters by related description text", () => {
    render(
      <ProductGrid
        products={products}
        categories={categories}
        searchQuery="premium"
        companyColor="#ff0000"
        onOpenDetail={vi.fn()}
      />,
    );

    expect(screen.getAllByTestId("product-card")).toHaveLength(1);
    expect(screen.getByText("Rosa Roja | Rosas")).toBeInTheDocument();
  });

  it("filters by category hash when the category name is missing on the product", () => {
    render(
      <ProductGrid
        products={[
          {
            id: 3,
            nombre: "Arreglo para madres",
            precio: 50000,
            imagen: "/madres.png",
            categoriaID: buildCategorySearchId("Flora Madres"),
          },
        ]}
        categories={categories}
        searchQuery="madres"
        companyColor="#ff0000"
        onOpenDetail={vi.fn()}
      />,
    );

    expect(screen.getAllByTestId("product-card")).toHaveLength(1);
    expect(screen.getByText(`Arreglo para madres | ${buildCategorySearchId("Flora Madres")}`)).toBeInTheDocument();
  });
});
