import { describe, expect, it, vi } from "vitest";
import { createJsonResponse } from "../../../test/testUtils";
import { fetchPublicCategories } from "./publicCategoriesApi";

describe("publicCategoriesApi", () => {
  it("requests the categories endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      createJsonResponse([
        { id: 1, name: "Rosas", orden_catalogo: 1 },
        { id: 2, name: "Orquideas", orden_catalogo: 2 },
      ]),
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await fetchPublicCategories("flora");

    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("/api/public/flora/categorias"), expect.any(Object));
    expect(response).toHaveLength(2);
    expect(response[0]).toMatchObject({ id: 1, name: "Rosas", orden_catalogo: 1 });
  });

  it("filters inactive categories from the public categories endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      createJsonResponse({
        data: [
          { id: 1, nombre: "Personalizado", activo: true },
          { id_categoria: 81, nombre: "Amor & Amistad", ordenCatalogo: 2, activo: true },
          { id: 2, nombre: "Oculta", activo: false },
          { id: 3, nombre: "Deshabilitada", enabled: false },
          { id: 4, nombre: "Inactiva por estado", estado: "inactiva" },
          { id: 5, nombre: "Flora Box" },
        ],
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await fetchPublicCategories("flora");

    expect(response.map((category) => category.nombre)).toEqual([
      "Personalizado",
      "Amor & Amistad",
      "Flora Box",
    ]);
  });
});
