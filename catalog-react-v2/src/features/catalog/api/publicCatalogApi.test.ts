import { describe, expect, it, vi } from "vitest";
import { getCatalogoPublico } from "./publicCatalogApi";
import { createJsonResponse } from "../../../test/testUtils";

describe("publicCatalogApi", () => {
  it("prefers catalogo when productos is present but empty", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      createJsonResponse({
        empresa: { nombre: "Floreria Rosa" },
        categorias: [],
        productos: [],
        catalogo: [
          {
            id: 1,
            nombre: "Rosa Roja",
            precio: "25000",
            descripcion: "Ramo rojo",
            imagen_url: null,
            nombre_categoria: "Ramos",
          },
        ],
        barrios: [],
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await getCatalogoPublico("flora");

    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("/api/public/flora/catalogo"), expect.any(Object));
    expect(result.productos).toHaveLength(1);
    expect(result.productos[0]?.nombre).toBe("Rosa Roja");
  });

  it("merges codigo_producto from catalogo when productos omits it", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      createJsonResponse({
        empresa: { nombre: "Floreria Rosa" },
        categorias: [],
        productos: [
          {
            id: 1,
            nombre: "Rosa Roja",
            precio: "25000",
            descripcion: "Ramo rojo",
            imagen_url: null,
            nombre_categoria: "Ramos",
          },
        ],
        catalogo: [
          {
            id: 1,
            nombre: "Rosa Roja",
            precio: "25000",
            descripcion: "Ramo rojo",
            imagen_url: null,
            nombre_categoria: "Ramos",
            codigo_producto: "FLORA-0001",
          },
        ],
        barrios: [],
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await getCatalogoPublico("flora");

    expect(result.productos).toHaveLength(1);
    expect(result.productos[0]?.codigo_producto).toBe("FLORA-0001");
  });

  it("filters inactive categories from the public catalog payload", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      createJsonResponse({
        empresa: { nombre: "Floreria Rosa" },
        categorias: [
          { id: 1, nombre: "Ramos", activo: true },
          { id: 2, nombre: "Oculta", activo: false },
          { id: 3, nombre: "Deshabilitada", enabled: false },
          { id: 4, nombre: "Inactiva", estado: "inactive" },
        ],
        productos: [],
        catalogo: [],
        barrios: [],
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await getCatalogoPublico("flora");

    expect(result.categorias).toEqual([{ id: 1, nombre: "Ramos", activo: true }]);
  });

  it("throws a helpful error when the production host returns an html 404", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      createJsonResponse("<html>Not found</html>", {
        ok: false,
        status: 404,
        contentType: "text/html",
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(getCatalogoPublico("flora")).rejects.toThrow(
      /La ruta .* no esta expuesta en este hosting\./,
    );
    expect(fetchMock).toHaveBeenNthCalledWith(1, expect.stringContaining("/api/public/flora/catalogo"), expect.any(Object));
    expect(fetchMock).toHaveBeenNthCalledWith(2, expect.stringContaining("/public/flora/catalogo"), expect.any(Object));
  });
});
