import { create } from "zustand";

export interface CartItem {
  id: number;
  nombre: string;
  precio: number;
  imagen: string;
  cantidad: number;
}

export interface PedidoCliente {
  clienteID: number;
  nombre: string;
  telefono: string;
  facturacion: PedidoFacturacion;
}

export interface PedidoFacturacion {
  requiereFactura: boolean;
  tipoIdentificacion: "" | "cedula" | "nit";
  identificacion: string;
  email: string;
}

export interface PedidoEntrega {
  metodo: "recoger" | "domicilio";
  nombreDestinatario: string;
  telefono: string;
  direccion: string;
  complemento: string;
  barrio: string;
  fecha: "hoy" | "programada";
  fechaProgramada: string;
}

export interface PedidoMensaje {
  texto: string;
  firma: string;
}

export interface PedidoState {
  productos: CartItem[];
  subtotal: number;
  cliente: PedidoCliente;
  entrega: PedidoEntrega;
  mensaje: PedidoMensaje;
  notas: string;
  total: number;
}

export interface SubmittedOrder {
  id: string;
  pedidoID: number | null;
  createdAt: string;
  companySlug: string;
  pedido: PedidoState;
  totalItems: number;
  totalPrice: number;
}

interface CartStore {
  pedidoState: PedidoState;
  lastSubmittedOrder: SubmittedOrder | null;
  addProduct: (item: Omit<CartItem, "cantidad">) => void;
  addItem: (item: Omit<CartItem, "cantidad">) => void;
  updateQuantity: (productId: number, qty: number) => void;
  increaseQty: (productId: number) => void;
  decreaseQty: (productId: number) => void;
  removeProduct: (productId: number) => void;
  removeItem: (productId: number) => void;
  clearCart: () => void;
  setClienteID: (id: number) => void;
  updateCliente: (field: "nombre" | "telefono", value: string) => void;
  updateFacturacion: (field: keyof Omit<PedidoFacturacion, "requiereFactura">, value: string) => void;
  toggleFacturacion: (requiresInvoice: boolean) => void;
  updateEntrega: (field: keyof PedidoEntrega, value: string) => void;
  updateMensaje: (field: keyof PedidoMensaje, value: string) => void;
  updateNotas: (value: string) => void;
  resetPedidoState: () => void;
  submitOrder: (companySlug: string, pedidoID?: number | null) => SubmittedOrder | null;
  clearLastSubmittedOrder: () => void;
}

const initialPedidoState: PedidoState = {
  productos: [],
  subtotal: 0,
  cliente: {
    clienteID: 0,
    nombre: "",
    telefono: "",
    facturacion: {
      requiereFactura: false,
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
    barrio: "",
    fecha: "hoy",
    fechaProgramada: "",
  },
  mensaje: {
    texto: "",
    firma: "",
  },
  notas: "",
  total: 0,
};

export const useCartStore = create<CartStore>((set, get) => ({
  pedidoState: initialPedidoState,
  lastSubmittedOrder: null,
  addProduct: (item) =>
    set((state) => {
      const existing = state.pedidoState.productos.find((product) => product.id === item.id);

      const productos = existing
        ? state.pedidoState.productos.map((product) =>
            product.id === item.id
              ? { ...product, cantidad: product.cantidad + 1 }
              : product,
          )
        : [...state.pedidoState.productos, { ...item, cantidad: 1 }];

      return buildPedidoStatePatch(state.pedidoState, { productos });
    }),
  addItem: (item) => get().addProduct(item),
  updateQuantity: (productId, qty) =>
    set((state) => {
      const productos = state.pedidoState.productos
        .map((product) =>
          product.id === productId
            ? { ...product, cantidad: qty }
            : product,
        )
        .filter((product) => product.cantidad > 0);

      return buildPedidoStatePatch(state.pedidoState, { productos });
    }),
  increaseQty: (productId) =>
    set((state) => {
      const productos = state.pedidoState.productos.map((product) =>
        product.id === productId
          ? { ...product, cantidad: product.cantidad + 1 }
          : product,
      );

      return buildPedidoStatePatch(state.pedidoState, { productos });
    }),
  decreaseQty: (productId) =>
    set((state) => {
      const productos = state.pedidoState.productos
        .map((product) =>
          product.id === productId
            ? { ...product, cantidad: product.cantidad - 1 }
            : product,
        )
        .filter((product) => product.cantidad > 0);

      return buildPedidoStatePatch(state.pedidoState, { productos });
    }),
  removeProduct: (productId) =>
    set((state) => {
      const productos = state.pedidoState.productos.filter((product) => product.id !== productId);
      return buildPedidoStatePatch(state.pedidoState, { productos });
    }),
  removeItem: (productId) => get().removeProduct(productId),
  clearCart: () => set({ pedidoState: initialPedidoState }),
  setClienteID: (id) =>
    set((state) => ({
      pedidoState: {
        ...state.pedidoState,
        cliente: { ...state.pedidoState.cliente, clienteID: id },
      },
    })),
  updateCliente: (field, value) =>
    set((state) => ({
      pedidoState: {
        ...state.pedidoState,
        cliente: {
          ...state.pedidoState.cliente,
          [field]: value,
        },
      },
    })),
  updateFacturacion: (field, value) =>
    set((state) => ({
      pedidoState: {
        ...state.pedidoState,
        cliente: {
          ...state.pedidoState.cliente,
          facturacion: {
            ...state.pedidoState.cliente.facturacion,
            [field]: value,
          },
        },
      },
    })),
  toggleFacturacion: (requiresInvoice) =>
    set((state) => ({
      pedidoState: {
        ...state.pedidoState,
        cliente: {
          ...state.pedidoState.cliente,
          facturacion: {
            ...state.pedidoState.cliente.facturacion,
            requiereFactura: requiresInvoice,
            tipoIdentificacion: requiresInvoice ? state.pedidoState.cliente.facturacion.tipoIdentificacion : "",
            identificacion: requiresInvoice ? state.pedidoState.cliente.facturacion.identificacion : "",
            email: requiresInvoice ? state.pedidoState.cliente.facturacion.email : "",
          },
        },
      },
    })),
  updateEntrega: (field, value) =>
    set((state) =>
      buildPedidoStatePatch(state.pedidoState, {
        entrega: {
          ...state.pedidoState.entrega,
          [field]: value,
        },
      }),
    ),
  updateMensaje: (field, value) =>
    set((state) => ({
      pedidoState: {
        ...state.pedidoState,
        mensaje: {
          ...state.pedidoState.mensaje,
          [field]: value,
        },
      },
    })),
  updateNotas: (value) =>
    set((state) => ({
      pedidoState: {
        ...state.pedidoState,
        notas: value,
      },
    })),
  resetPedidoState: () => set({ pedidoState: initialPedidoState }),
  submitOrder: (companySlug, pedidoID = null) => {
    const { pedidoState } = get();

    if (!pedidoState.productos.length) {
      return null;
    }

    const order: SubmittedOrder = {
      id: buildOrderId(pedidoID),
      pedidoID,
      createdAt: new Date().toISOString(),
      companySlug,
      pedido: pedidoState,
      totalItems: getCartTotalItems(pedidoState.productos),
      totalPrice: pedidoState.total,
    };

    set({
      pedidoState: initialPedidoState,
      lastSubmittedOrder: order,
    });

    return order;
  },
  clearLastSubmittedOrder: () => set({ lastSubmittedOrder: null }),
}));

export function getCartTotalItems(items: CartItem[]): number {
  return items.reduce((acc, item) => acc + item.cantidad, 0);
}

export function getCartTotalPrice(items: CartItem[]): number {
  return items.reduce((acc, item) => acc + item.cantidad * item.precio, 0);
}

function buildOrderId(pedidoID: number | null): string {
  if (typeof pedidoID === "number" && Number.isFinite(pedidoID) && pedidoID > 0) {
    return `PED-${pedidoID}`;
  }

  return `PED-${Date.now().toString().slice(-8)}`;
}

function buildPedidoStatePatch(currentState: PedidoState, partial: Partial<PedidoState>) {
  const nextState: PedidoState = {
    ...currentState,
    ...partial,
  };

  const subtotal = getCartTotalPrice(nextState.productos);
  const deliveryCost = nextState.entrega.metodo === "domicilio" ? 8000 : 0;

  return {
    pedidoState: {
      ...nextState,
      subtotal,
      total: subtotal + deliveryCost,
    },
  };
}
