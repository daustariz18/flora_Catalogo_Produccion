import { describe, expect, it, vi } from "vitest";
import { createJsonResponse } from "../../../test/testUtils";
import { fetchPublicCategories } from "./publicCategoriesApi";

describe("publicCategoriesApi", () => {
  it("requests the categories endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      createJsonResponse([
        { id: 1, name: "Personalizado" },
        { id: 2, name: "Flora Box" },
      ]),
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await fetchPublicCategories("flora");

    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("/api/public/flora/categorias"), expect.any(Object));
    expect(response).toHaveLength(2);
    expect(response[0]?.name).toBe("Personalizado");
  });

  it("filters inactive categories from the public categories endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      createJsonResponse([
        { id: 1, name: "Personalizado", activo: true },
        { id: 2, name: "Oculta", activo: false },
        { id: 3, name: "Deshabilitada", enabled: false },
        { id: 4, name: "Inactiva por estado", estado: "inactiva" },
        { id: 5, name: "Flora Box" },
      ]),
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await fetchPublicCategories("flora");

    expect(response.map((category) => category.name)).toEqual(["Personalizado", "Flora Box"]);
  });
});
