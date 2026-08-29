import { describe, expect, it } from "vitest";
import type { Producto } from "../../../shared/types/catalog";
import { resolvePublicCategories } from "./usePublicCatalog";

describe("usePublicCatalog category resolution", () => {
  it("uses backend categories as the source of public tabs when available", () => {
    const products: Producto[] = [
      {
        id: 1,
        nombre: "Producto Amor",
        precio: 120000,
        imagen: "/amor.png",
        categoriaID: 81,
        id_categoria: 81,
        categoriaNombre: "Amor & Amistad",
      },
      {
        id: 2,
        nombre: "Producto Flora Box",
        precio: 350000,
        imagen: "/box.png",
        categoriaID: 2,
        id_categoria: 2,
        categoriaNombre: "Flora Box",
      },
    ];

    const categories = resolvePublicCategories(
      [
        { id: 1, name: "Personalizado", orden_catalogo: 1 },
        { id: 2, name: "Flora Box", orden_catalogo: 4 },
      ],
      products,
    );

    expect(categories.map((category) => category.nombre)).toEqual(["Personalizado", "Flora Box"]);
  });

  it("falls back to product categories only when backend categories are empty", () => {
    const products: Producto[] = [
      {
        id: 1,
        nombre: "Producto Amor",
        precio: 120000,
        imagen: "/amor.png",
        categoriaID: 81,
        id_categoria: 81,
        categoriaNombre: "Amor & Amistad",
      },
    ];

    const categories = resolvePublicCategories([], products);

    expect(categories).toEqual([{ id: 81, nombre: "Amor & Amistad", orden_catalogo: null }]);
  });
});
