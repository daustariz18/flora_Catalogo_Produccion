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
});
