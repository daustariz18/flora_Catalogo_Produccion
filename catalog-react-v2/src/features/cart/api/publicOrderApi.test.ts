import { describe, expect, it, vi } from "vitest";
import { createCliente, createOrder, lookupClienteByTelefono } from "./publicOrderApi";
import { createJsonResponse, mockFetchJson } from "../../../test/testUtils";

describe("publicOrderApi", () => {
  it("sends order payloads to the public orders endpoint", async () => {
    const fetchMock = mockFetchJson({
      pedidoID: 9,
      empresaID: 1,
      sucursalID: 2,
      clienteID: 3,
      estadoPedidoID: 4,
      numeroPedido: 5,
      totalBruto: 100,
      totalIVA: 0,
      totalNeto: 100,
    });

    const payload = {
      items: [{ productoID: 1, cantidad: 2 }],
      totalBruto: 100,
      totalIVA: 0,
      totalNeto: 100,
    };

    const result = await createOrder("flora", payload);

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/public/flora/pedidos"),
      expect.objectContaining({
        method: "POST",
      }),
    );
    expect(result.pedidoID).toBe(9);
  });

  it("surfaces backend validation errors for order creation", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      createJsonResponse({ message: "Dato invalido" }, { ok: false, status: 400 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      createCliente("flora", {
        identificacion: "123",
        nombreCompleto: "Ana Perez",
      }),
    ).rejects.toThrow("Dato invalido");
  });

  it("normalizes the phone lookup response", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      createJsonResponse({
        encontrado: true,
        cliente: {
          nombre_completo: "Ana Perez",
          identificacion: "123",
          tipo_ident: "nit",
          telefono: "3001234567",
          indicativo: "+57",
          email: "ana@correo.com",
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await lookupClienteByTelefono("flora", "3001234567", "+57");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toContain("/api/public/flora/clientes/buscar?");
    expect(result).toEqual({
      nombre: "Ana Perez",
      identificacion: "123",
      tipoIdentificacion: "nit",
      telefono: "3001234567",
      indicativo: "+57",
      email: "ana@correo.com",
    });
  });
});
