import { describe, expect, it, vi } from "vitest";
import { createJsonResponse } from "../../../test/testUtils";
import { fetchPublicCategories } from "./publicCategoriesApi";

describe("publicCategoriesApi", () => {
  it("requests the categories endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      createJsonResponse({
        empresa: { nombre: "Flora" },
        categorias: [
          { id: 1, nombre: "Personalizado" },
          { id: 2, nombre: "Flora Box" },
        ],
        productos: [],
        catalogo: [],
        barrios: [],
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await fetchPublicCategories("flora");

    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("/api/public/flora/catalogo"), expect.any(Object));
    expect(response).toHaveLength(2);
    expect(response[0]?.nombre).toBe("Personalizado");
  });

  it("filters inactive categories from the public categories endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      createJsonResponse({
        empresa: { nombre: "Flora" },
        categorias: [
          { id: 1, nombre: "Personalizado", activo: true },
          { id: 2, nombre: "Oculta", activo: false },
          { id: 3, nombre: "Deshabilitada", enabled: false },
          { id: 4, nombre: "Inactiva por estado", estado: "inactiva" },
          { id: 5, nombre: "Flora Box" },
        ],
        productos: [],
        catalogo: [],
        barrios: [],
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await fetchPublicCategories("flora");

    expect(response.map((category) => category.nombre)).toEqual(["Personalizado", "Flora Box"]);
  });
});
