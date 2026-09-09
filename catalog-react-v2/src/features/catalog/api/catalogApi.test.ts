import { describe, expect, it, vi } from "vitest";
import { fetchCatalogByEmpresa, fetchPublicProducts } from "./catalogApi";
import { getCatalogoPublico } from "./publicCatalogApi";

vi.mock("./publicCatalogApi", () => ({
  getCatalogoPublico: vi.fn(),
}));

describe("catalogApi", () => {
  it("keeps the real backend category ids when mapping catalog data", async () => {
    vi.mocked(getCatalogoPublico).mockResolvedValueOnce({
      empresa: {
        nombre: "Flora",
        logoUrl: null,
        colorPrimario: "#d94b8a",
      },
      categorias: [
        { id: 10, nombre: "Personalizado" },
        { id: 20, nombre: "Flora Box" },
      ],
      productos: [
        {
          id: 1,
          id_producto: 1,
          nombre: "Arreglo Personalizado Deluxe",
          precio: "120000",
          descripcion: "Arreglo personalizado",
          imagen_url: null,
          nombre_categoria: "Personalizado",
          categoriaID: 999,
        },
        {
          id: 2,
          id_producto: 2,
          nombre: "Flora Box Grande 36 Rosas",
          precio: "360000",
          descripcion: "Caja floral",
          imagen_url: null,
          categoria_nombre: "Flora Box",
          categoria: { id: 20, nombre: "Flora Box" },
        },
      ],
      barrios: [],
    });

    const catalog = await fetchCatalogByEmpresa("flora");

    expect(catalog.categorias).toEqual([
      { id: 10, nombre: "Personalizado", orden_catalogo: null },
      { id: 20, nombre: "Flora Box", orden_catalogo: null },
    ]);
    expect(catalog.productos).toHaveLength(2);
    expect(catalog.productos[0]?.categoriaID).toBe(10);
    expect(catalog.productos[0]?.id_categoria).toBe(10);
    expect(catalog.productos[0]?.categoriaNombre).toBe("Personalizado");
    expect(catalog.productos[1]?.categoriaID).toBe(20);
    expect(catalog.productos[1]?.id_categoria).toBe(20);
    expect(catalog.productos[1]?.categoriaNombre).toBe("Flora Box");
  });

  it("keeps direct backend ids when catalog categories are missing", async () => {
    vi.mocked(getCatalogoPublico).mockResolvedValueOnce({
      empresa: null,
      categorias: [],
      productos: [
        {
          id: 5,
          id_producto: 5,
          nombre: "Arreglo Personalizado Simple",
          precio: "85000",
          descripcion: null,
          imagen_url: null,
          categoriaID: 77,
          nombre_categoria: "Personalizado",
        },
      ],
      barrios: [],
    });

    const products = await fetchPublicProducts("flora");

    expect(products).toHaveLength(1);
    expect(products[0]?.categoriaID).toBe(77);
    expect(products[0]?.id_categoria).toBe(77);
    expect(products[0]?.categoriaNombre).toBe("Personalizado");
  });

  it("prioritizes personalized, amor amistad, and amarillo for empresa 3", async () => {
    vi.mocked(getCatalogoPublico).mockResolvedValueOnce({
      empresa: {
        id: 3,
        nombre: "Flora",
        logoUrl: null,
        colorPrimario: "#d94b8a",
      },
      categorias: [
        { id: 10, nombre: "Rosas", orden_catalogo: 1 },
        { id: 20, nombre: "Amarillo", orden_catalogo: 9 },
        { id: 30, nombre: "Amor & Amistad", orden_catalogo: 8 },
        { id: 40, nombre: "Personalizado", orden_catalogo: 7 },
      ],
      productos: [
        {
          id: 1,
          id_producto: 1,
          nombre: "Rosas A",
          precio: "10000",
          descripcion: null,
          imagen_url: null,
          nombre_categoria: "Rosas",
        },
        {
          id: 2,
          id_producto: 2,
          nombre: "Amarillo A",
          precio: "10000",
          descripcion: null,
          imagen_url: null,
          nombre_categoria: "Amarillo",
        },
        {
          id: 3,
          id_producto: 3,
          nombre: "Amor A",
          precio: "10000",
          descripcion: null,
          imagen_url: null,
          nombre_categoria: "Amor & Amistad",
        },
        {
          id: 4,
          id_producto: 4,
          nombre: "Personalizado A",
          precio: "10000",
          descripcion: null,
          imagen_url: null,
          nombre_categoria: "Personalizado",
        },
      ],
      barrios: [],
    });

    const catalog = await fetchCatalogByEmpresa("3");

    expect(catalog.empresa.id).toBe(3);
    expect(catalog.categorias.map((category) => category.nombre)).toEqual([
      "Personalizado",
      "Amor & Amistad",
      "Amarillo",
      "Rosas",
    ]);
    expect(catalog.productos.map((product) => product.nombre)).toEqual([
      "Personalizado A",
      "Amor A",
      "Amarillo A",
      "Rosas A",
    ]);
  });
});
