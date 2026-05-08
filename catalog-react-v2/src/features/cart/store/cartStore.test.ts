import { beforeEach, describe, expect, it } from "vitest";
import { getCartTotalItems, useCartStore } from "./cartStore";

function resetStore() {
  useCartStore.setState({
    pedidoState: {
      productos: [],
      subtotal: 0,
      cliente: {
        clienteID: 0,
        nombre: "",
        indicativo: "+57",
        telefono: "",
        facturacion: {
          requiereFactura: true,
          tipoIdentificacion: "",
          identificacion: "",
          email: "",
        },
      },
      entrega: {
        metodo: "domicilio",
        nombreDestinatario: "",
        telefono: "",
        direccion: "",
        complemento: "",
        barrioID: null,
        barrio: "",
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
      total: 0,
    },
    lastSubmittedOrder: null,
    availableBarrios: [],
  });
}

beforeEach(() => {
  localStorage.clear();
  resetStore();
});

describe("cartStore", () => {
  it("adds products and recalculates subtotal and total", () => {
    const store = useCartStore.getState();

    store.addProduct({
      id: 1,
      nombre: "Rosa",
      precio: 10000,
      imagen: "/rosa.png",
    });

    expect(useCartStore.getState().pedidoState.productos).toHaveLength(1);
    expect(useCartStore.getState().pedidoState.subtotal).toBe(10000);
    expect(useCartStore.getState().pedidoState.total).toBe(10000);
    expect(getCartTotalItems(useCartStore.getState().pedidoState.productos)).toBe(1);

    store.increaseQty(1);

    expect(useCartStore.getState().pedidoState.productos[0].cantidad).toBe(2);
    expect(useCartStore.getState().pedidoState.subtotal).toBe(20000);
    expect(useCartStore.getState().pedidoState.total).toBe(20000);
  });

  it("selects a barrio and updates delivery total", () => {
    const store = useCartStore.getState();

    store.addProduct({
      id: 1,
      nombre: "Rosa",
      precio: 10000,
      imagen: "/rosa.png",
    });

    store.selectBarrio({ id: 10, nombre: "Miramar", costoDomicilio: 5000 });

    expect(useCartStore.getState().pedidoState.entrega.barrio).toBe("Miramar");
    expect(useCartStore.getState().pedidoState.entrega.costoDomicilio).toBe(5000);
    expect(useCartStore.getState().pedidoState.total).toBe(15000);
  });

  it("toggles billing data off and clears invoice fields", () => {
    const store = useCartStore.getState();

    store.updateFacturacion("email", "ana@correo.com");
    store.updateFacturacion("identificacion", "900123456");
    store.toggleFacturacion(false);

    expect(useCartStore.getState().pedidoState.cliente.facturacion.requiereFactura).toBe(false);
    expect(useCartStore.getState().pedidoState.cliente.facturacion.identificacion).toBe("");
    expect(useCartStore.getState().pedidoState.cliente.facturacion.email).toBe("");
  });

  it("autocompletes pickup delivery data and clears all delivery fields when switching to domicilio", () => {
    const store = useCartStore.getState();

    store.updateCliente("nombre", "Ana Perez");
    store.updateCliente("telefono", "3001234567");
    store.updateEntrega("direccion", "Calle 100 # 10-20");
    store.updateEntrega("complemento", "Apto 302");
    store.selectBarrio({ id: 10, nombre: "Miramar", costoDomicilio: 5000 });

    store.updateEntrega("metodo", "recoger");

    expect(useCartStore.getState().pedidoState.entrega.metodo).toBe("recoger");
    expect(useCartStore.getState().pedidoState.entrega.nombreDestinatario).toBe("Ana Perez");
    expect(useCartStore.getState().pedidoState.entrega.telefono).toBe("3001234567");
    expect(useCartStore.getState().pedidoState.entrega.direccion).toBe("");
    expect(useCartStore.getState().pedidoState.entrega.complemento).toBe("");
    expect(useCartStore.getState().pedidoState.entrega.barrio).toBe("");
    expect(useCartStore.getState().pedidoState.entrega.barrioID).toBeNull();
    expect(useCartStore.getState().pedidoState.entrega.costoDomicilio).toBe(0);

    store.updateEntrega("metodo", "domicilio");

    expect(useCartStore.getState().pedidoState.entrega.metodo).toBe("domicilio");
    expect(useCartStore.getState().pedidoState.entrega.nombreDestinatario).toBe("");
    expect(useCartStore.getState().pedidoState.entrega.telefono).toBe("");
    expect(useCartStore.getState().pedidoState.entrega.direccion).toBe("");
    expect(useCartStore.getState().pedidoState.entrega.complemento).toBe("");
    expect(useCartStore.getState().pedidoState.entrega.barrio).toBe("");
    expect(useCartStore.getState().pedidoState.entrega.barrioID).toBeNull();
  });

  it("keeps domicilio fields intact when the same delivery method is reapplied", () => {
    const store = useCartStore.getState();

    store.updateEntrega("metodo", "domicilio");
    store.updateEntrega("nombreDestinatario", "Maria");
    store.updateEntrega("telefono", "3001112233");
    store.updateEntrega("direccion", "Calle 10");
    store.updateEntrega("complemento", "Apto 2");
    store.updateEntrega("barrio", "Centro");

    store.updateEntrega("metodo", "domicilio");

    expect(useCartStore.getState().pedidoState.entrega.nombreDestinatario).toBe("Maria");
    expect(useCartStore.getState().pedidoState.entrega.telefono).toBe("3001112233");
    expect(useCartStore.getState().pedidoState.entrega.direccion).toBe("Calle 10");
    expect(useCartStore.getState().pedidoState.entrega.complemento).toBe("Apto 2");
    expect(useCartStore.getState().pedidoState.entrega.barrio).toBe("Centro");
    expect(useCartStore.getState().pedidoState.entrega.barrioID).toBeNull();
    expect(useCartStore.getState().pedidoState.entrega.costoDomicilio).toBe(0);
  });

  it("submits and resets the cart state", () => {
    const store = useCartStore.getState();

    store.addProduct({
      id: 1,
      nombre: "Rosa",
      precio: 10000,
      imagen: "/rosa.png",
    });
    store.updateEntrega("nombreDestinatario", "Luis");

    const order = store.submitOrder("flora", 8, "PED-8", 12000, 1900, "transferencia");

    expect(order?.id).toBe("PED-8");
    expect(order?.paymentStatus).toBe("pendiente_validacion");
    expect(useCartStore.getState().pedidoState.productos).toHaveLength(0);
    expect(useCartStore.getState().lastSubmittedOrder?.pedidoID).toBe(8);
  });

  it("clears the checkout flow and removes persisted draft data", () => {
    const store = useCartStore.getState();

    store.addProduct({
      id: 1,
      nombre: "Rosa",
      precio: 10000,
      imagen: "/rosa.png",
    });
    store.submitOrder("flora", 8, "PED-8", 12000, 1900, "transferencia");

    expect(localStorage.getItem("petalops-checkout-draft")).not.toBeNull();

    store.resetCheckoutFlow();

    expect(useCartStore.getState().pedidoState.productos).toHaveLength(0);
    expect(useCartStore.getState().pedidoState.cliente.nombre).toBe("");
    expect(useCartStore.getState().lastSubmittedOrder).toBeNull();
    expect(localStorage.getItem("petalops-checkout-draft")).toBeNull();
  });

  it("deduplicates and sorts available barrios", () => {
    const store = useCartStore.getState();

    store.setAvailableBarrios([
      { id: 2, nombre: "  Miramar ", costoDomicilio: 5000 },
      { id: 3, nombre: "Centro", costoDomicilio: 3000 },
      { id: 4, nombre: "miramar", costoDomicilio: 7000 },
    ]);

    expect(useCartStore.getState().availableBarrios).toHaveLength(2);
    expect(useCartStore.getState().availableBarrios).toEqual(
      expect.arrayContaining([
        { id: 3, nombre: "Centro", costoDomicilio: 3000 },
        { id: 2, nombre: "  Miramar ", costoDomicilio: 5000 },
      ]),
    );
  });
});
