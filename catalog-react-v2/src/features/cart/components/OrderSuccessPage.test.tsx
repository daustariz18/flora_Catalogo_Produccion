import { describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { render, screen, waitFor } from "@testing-library/react";

const mocks = vi.hoisted(() => ({
  resetCheckoutFlow: vi.fn(),
  setTenantSlug: vi.fn(),
}));

vi.mock("../store/cartStore", () => ({
  useCartStore: (selector: (state: unknown) => unknown) =>
    selector({
      lastSubmittedOrder: {
        id: "PED-123",
        pedidoID: 123,
        createdAt: "2026-04-29T00:00:00.000Z",
        companySlug: "flora",
        pedido: {
          productos: [
            {
              id: 10,
              nombre: "Ramo Rosa",
              precio: 25000,
              imagen: "/rosa.png",
              cantidad: 1,
            },
          ],
          subtotal: 25000,
          cliente: {
            clienteID: 1,
            nombre: "Ana",
            indicativo: "+57",
            telefono: "3001234567",
            facturacion: {
              requiereFactura: true,
              tipoIdentificacion: "cedula",
              identificacion: "123",
              email: "ana@correo.com",
            },
          },
          entrega: {
            metodo: "domicilio",
            nombreDestinatario: "Ana",
            telefono: "3001234567",
            direccion: "Calle 1",
            complemento: "",
            barrioID: 1,
            barrio: "Centro",
            costoDomicilio: 5000,
            fecha: "hoy",
            fechaProgramada: "",
          },
          mensaje: {
            texto: "Feliz dia",
            firma: "Flora",
          },
          notas: "",
          total: 30000,
        },
        totalItems: 1,
        totalIVA: 0,
        totalPrice: 30000,
        paymentMethod: "transferencia",
        paymentStatus: "pendiente_validacion",
      },
      resetCheckoutFlow: mocks.resetCheckoutFlow,
    }),
}));

vi.mock("../../../shared/utils/tenantSlug", () => ({
  resolveTenantSlug: (value: string) => value,
  storeTenantSlug: mocks.setTenantSlug,
  buildTenantPath: (tenantSlug: string, suffix = "") => `/catalogo/${tenantSlug}${suffix}`,
}));

import { OrderSuccessPage } from "./OrderSuccessPage";

describe("OrderSuccessPage", () => {
  it("resets the checkout flow after the success screen mounts", async () => {
    render(
      <MemoryRouter initialEntries={["/catalogo/flora/pedido-exitoso"]}>
        <Routes>
          <Route path="/catalogo/:tenantSlug/pedido-exitoso" element={<OrderSuccessPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: "PED-123" })).toBeInTheDocument();

    await waitFor(() => {
      expect(mocks.resetCheckoutFlow).toHaveBeenCalledTimes(1);
    });
  });
});
