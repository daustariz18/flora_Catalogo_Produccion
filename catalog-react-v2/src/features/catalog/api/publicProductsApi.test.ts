import { describe, expect, it, vi } from "vitest";
import { createJsonResponse } from "../../../test/testUtils";
import { fetchPublicProductDetail, fetchPublicProductsPage } from "./publicProductsApi";

describe("publicProductsApi", () => {
  it("requests the paginated product list endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      createJsonResponse({
        data: [
          {
            id: 123,
            nombre: "Hamburguesa XL",
            precio: 18900,
            imagen_url: "https://cdn.ejemplo.com/prod/123.jpg",
            categoria_nombre: "Hamburguesas",
            codigo_producto: "CAT-123",
          },
        ],
        total: 115,
        limit: 12,
        offset: 0,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await fetchPublicProductsPage("flora", 12, 0);

    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("/api/public/flora/productos?limit=12&offset=0"), expect.any(Object));
    expect(response.data[0]?.nombre).toBe("Hamburguesa XL");
    expect(response.total).toBe(115);
  });

  it("sends the category filter when provided", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      createJsonResponse({
        data: [],
        total: 0,
        limit: 12,
        offset: 0,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await fetchPublicProductsPage("flora", 12, 0, 2);

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/public/flora/productos?limit=12&offset=0&categoria_id=2"),
      expect.any(Object),
    );
  });

  it("requests the product detail endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      createJsonResponse({
        id: 123,
        nombre: "Hamburguesa XL",
        precio: 18900,
        descripcion: "Hamburguesa con doble carne...",
        imagen_url: "https://cdn.ejemplo.com/prod/123.jpg",
        categoria_nombre: "Hamburguesas",
        codigo_producto: "CAT-123",
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await fetchPublicProductDetail("flora", 123);

    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("/api/public/flora/producto/123"), expect.any(Object));
    expect(response.descripcion).toContain("doble carne");
  });
});
