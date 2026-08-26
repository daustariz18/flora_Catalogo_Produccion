import { describe, expect, it } from "vitest";
import type { SubmittedOrder } from "../store/cartStore";
import { buildOrderSummary } from "./orderSummary";

function buildSampleOrder(): SubmittedOrder {
  return {
    id: "PED-12345",
    pedidoID: 12345,
    createdAt: "2026-04-24T12:00:00.000Z",
    companySlug: "flora",
    totalItems: 3,
    totalIVA: 1900,
    totalPrice: 13900,
    paymentMethod: "transferencia",
    paymentStatus: "pendiente_validacion",
    pedido: {
      productos: [
        { id: 1, nombre: "Rosas", precio: 5000, imagen: "/rosa.png", cantidad: 2 },
        { id: 2, nombre: "Girasoles", precio: 3900, imagen: "/girasol.png", cantidad: 1 },
      ],
      subtotal: 13900,
      cliente: {
        clienteID: 7,
        nombre: "Ana Perez",
        indicativo: "+57",
        telefono: "3001234567",
        facturacion: {
          requiereFactura: true,
          tipoIdentificacion: "nit",
          identificacion: "900123456",
          email: "ana@correo.com",
        },
      },
      entrega: {
        metodo: "domicilio",
        nombreDestinatario: "Luis Perez",
        telefono: "3001234567",
        direccion: "Calle 72 #45-32",
        complemento: "Apto 502",
        barrioID: 15,
        barrio: "Miramar",
        costoDomicilio: 0,
        fecha: "programada",
        fechaProgramada: "2026-04-30",
        rangoHora: "Tarde",
      },
      mensaje: {
        texto: "Feliz cumpleanos",
        firma: "Con amor, tu familia",
      },
      notas: "Entregar en la tarde",
      total: 13900,
    },
  };
}

describe("buildOrderSummary", () => {
  it("includes the main order details and totals", () => {
    const summary = buildOrderSummary(buildSampleOrder());

    expect(summary).toContain("Pedido #12345");
    expect(summary).toContain("Estado de pago: Pendiente de validacion");
    expect(summary).toContain("Tipo identificacion: NIT");
    expect(summary).toContain("Entrega: Domicilio");
    expect(summary).toContain("- 2 x Rosas ($ 5.000)");
    expect(summary).toContain("IVA: $ 1.900");
    expect(summary).toContain("Total: $ 13.900");
  });
});
