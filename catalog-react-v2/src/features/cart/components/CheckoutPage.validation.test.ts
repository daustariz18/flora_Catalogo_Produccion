import { describe, expect, it } from "vitest";
import type { PedidoState } from "../store/cartStore";
import { isDeliveryStepComplete, isMessageStepComplete } from "./CheckoutPage";

function buildBasePedidoState(): PedidoState["entrega"] {
  return {
    metodo: "recoger",
    nombreDestinatario: "Ana Perez",
    telefono: "3001234567",
    direccion: "",
    complemento: "",
    barrioID: null,
    barrio: "",
    costoDomicilio: 0,
    fecha: "hoy",
    fechaProgramada: "",
    rangoHora: "",
  };
}

describe("isDeliveryStepComplete", () => {
  it("permite continuar cuando el pedido es para recoger en tienda", () => {
    expect(isDeliveryStepComplete(buildBasePedidoState())).toBe(true);
  });

  it("rechaza fechas de entrega anteriores a hoy", () => {
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 1);

    expect(
      isDeliveryStepComplete({
        ...buildBasePedidoState(),
        metodo: "domicilio" as const,
        direccion: "Calle 10 # 5-20",
        barrio: "Centro",
        fecha: "programada",
        fechaProgramada: pastDate.toISOString().slice(0, 10),
      }),
    ).toBe(false);
  });

  it("exige direccion y barrio cuando el pedido es a domicilio", () => {
    const domicilio = {
      ...buildBasePedidoState(),
      metodo: "domicilio" as const,
    };

    expect(isDeliveryStepComplete(domicilio)).toBe(false);

    expect(
      isDeliveryStepComplete({
        ...domicilio,
        direccion: "Calle 10 # 5-20",
        barrio: "Centro",
        barrioID: 12,
      }),
    ).toBe(true);
  });

  it("rechaza domicilios con texto de barrio sin una seleccion real", () => {
    expect(
      isDeliveryStepComplete({
        ...buildBasePedidoState(),
        metodo: "domicilio" as const,
        direccion: "Calle 10 # 5-20",
        barrio: "Centro",
        barrioID: null,
      }),
    ).toBe(false);
  });
});

describe("isMessageStepComplete", () => {
  it("requiere una firma antes de continuar", () => {
    expect(
      isMessageStepComplete({
        texto: "Feliz cumpleaños",
        firma: "",
      }),
    ).toBe(false);

    expect(
      isMessageStepComplete({
        texto: "Feliz cumpleaños",
        firma: "Anónimo",
      }),
    ).toBe(true);
  });
});
