import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mocks = vi.hoisted(() => ({
  resetCheckoutFlow: vi.fn(),
  setTenantSlug: vi.fn(),
  lastSubmittedOrder: {
    id: "PED-123",
    pedidoID: 123,
    empresaID: 4,
    empresaCelular: "+57 3103489766",
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
        rangoHora: "",
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
}));

vi.mock("../store/cartStore", () => ({
  useCartStore: (selector: (state: unknown) => unknown) =>
    selector({
      lastSubmittedOrder: mocks.lastSubmittedOrder,
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
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    mocks.lastSubmittedOrder.companySlug = "flora";
  });

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

  it("returns to the tenant catalog when exiting the app", async () => {
    const user = userEvent.setup();
    const closeSpy = vi.spyOn(window, "close").mockImplementation(() => undefined);

    render(
      <MemoryRouter initialEntries={["/catalogo/flora/pedido-exitoso"]}>
        <Routes>
          <Route path="/catalogo/:tenantSlug/pedido-exitoso" element={<OrderSuccessPage />} />
          <Route path="/catalogo/:tenantSlug" element={<h1>Catalogo flora</h1>} />
        </Routes>
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: "Salir de la app" }));
    expect(closeSpy).toHaveBeenCalledTimes(1);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Catalogo flora" })).toBeInTheDocument();
    });
  });

  it("uses the catalog company WhatsApp number for transfer receipts", () => {
    mocks.lastSubmittedOrder.companySlug = "join-data";

    render(
      <MemoryRouter initialEntries={["/catalogo/join-data/pedido-exitoso"]}>
        <Routes>
          <Route path="/catalogo/:tenantSlug/pedido-exitoso" element={<OrderSuccessPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByRole("link", { name: "Enviar comprobante por WhatsApp" })).toHaveAttribute(
      "href",
      expect.stringContaining("https://wa.me/573103489766"),
    );
  });

  it("uses the detailed WhatsApp message for transfer receipts", () => {
    mocks.lastSubmittedOrder.companySlug = "join-data";

    render(
      <MemoryRouter initialEntries={["/catalogo/join-data/pedido-exitoso"]}>
        <Routes>
          <Route path="/catalogo/:tenantSlug/pedido-exitoso" element={<OrderSuccessPage />} />
        </Routes>
      </MemoryRouter>,
    );

    const href = screen.getByRole("link", { name: "Enviar comprobante por WhatsApp" }).getAttribute("href") ?? "";
    const message = new URL(href).searchParams.get("text") ?? "";

    expect(message).toContain("Hola, ya finalice mi pedido.");
    expect(message).toContain("Cliente: Ana");
    expect(message).toContain("Telefono: +57 3001234567");
    expect(message).toContain("- 1 x Ramo Rosa");
    expect(message).toMatch(/Total: \$\s*30\.000/u);
  });

  it("redirects to the submitted order tenant when the success URL has another slug", async () => {
    mocks.lastSubmittedOrder.companySlug = "lafiore";

    render(
      <MemoryRouter initialEntries={["/catalogo/petalops/pedido-exitoso"]}>
        <Routes>
          <Route path="/catalogo/:tenantSlug/pedido-exitoso" element={<OrderSuccessPage />} />
          <Route path="/catalogo/lafiore/pedido-exitoso" element={<h1>Exito La Fiore</h1>} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Exito La Fiore" })).toBeInTheDocument();
    });
    expect(mocks.resetCheckoutFlow).not.toHaveBeenCalled();
  });
});
