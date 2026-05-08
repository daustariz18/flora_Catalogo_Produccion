import { describe, expect, it, vi } from "vitest";
import { createJsonResponse } from "../../../test/testUtils";
import { fetchPublicBarrios } from "./publicBarriosApi";

describe("publicBarriosApi", () => {
  it("requests the barrios endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      createJsonResponse({
        empresa_id: 3,
        slug: "flora",
        barrios: [
          {
            id_barrio: 276,
            empresa_id: 3,
            sucursal_id: 3,
            zona_id: 1,
            nombre_barrio: "Barrio Abajo",
            costo_domicilio: 16000,
            activo: true,
          },
        ],
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await fetchPublicBarrios("flora");

    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("/api/public/flora/barrios"), expect.any(Object));
    expect(response.barrios[0]?.nombre_barrio).toBe("Barrio Abajo");
  });
});
