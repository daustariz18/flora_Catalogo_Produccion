import { describe, expect, it } from "vitest";
import { formatCOP } from "../../../shared/utils/currency";
import type { PedidoState } from "../store/cartStore";
import { buildFloraWhatsappMessage } from "./CheckoutPage";

function buildSamplePedidoState(): PedidoState {
  return {
    productos: [
      {
        id: 1,
        nombre: "Flora Box Redonda 24 Rosas de Jardín",
        precio: 365000,
        imagen: "/producto.png",
        cantidad: 1,
      },
    ],
    subtotal: 365000,
    cliente: {
      clienteID: 1,
      nombre: "Diego Ustariz Mejía",
      indicativo: "+57",
      telefono: "3128896624",
      facturacion: {
        requiereFactura: false,
        tipoIdentificacion: "",
        identificacion: "",
        email: "",
      },
    },
    entrega: {
      metodo: "domicilio",
      nombreDestinatario: "Diego Ustariz Mejía",
      telefono: "3128896624",
      direccion: "Calle 100 # 43B - 23",
      complemento: "",
      barrioID: 10,
      barrio: "Miramar",
      costoDomicilio: 0,
      fecha: "hoy",
      fechaProgramada: "",
      rangoHora: "",
    },
    mensaje: {
      texto: "",
      firma: "",
    },
    notas: "",
    total: 365000,
  } as PedidoState;
}

describe("buildFloraWhatsappMessage", () => {
  it("builds the WhatsApp message with the requested structure", () => {
    const message = buildFloraWhatsappMessage(buildSamplePedidoState(), 365000);

    expect(message).toBe(
      [
        "Hola, ya finalicé mi pedido. Comparto los detalles para validar y continuar con el pago:",
        "",
        "Cliente: Diego Ustariz Mejía",
        "Teléfono: +57 3128896624",
        "",
        "Pedido:",
        "• 1 x Flora Box Redonda 24 Rosas de Jardín",
        "",
        "Entrega: Domicilio",
        "Dirección: Calle 100 # 43B - 23",
        "Barrio: Miramar",
        "Fecha: Hoy",
        "",
        `Total: ${formatCOP(365000)}`,
        "",
        "Quedo atento a la información de pago para completar el proceso.",
      ].join("\n"),
    );
  });
});
