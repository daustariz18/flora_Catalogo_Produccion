import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

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
  indicativo: string;
  telefono: string;
  facturacion: PedidoFacturacion;
}

export interface PedidoFacturacion {
  requiereFactura: boolean;
  tipoIdentificacion: "" | "cedula" | "nit" | "pasaporte";
  identificacion: string;
  email: string;
}

export interface PedidoEntrega {
  metodo: "recoger" | "domicilio";
  nombreDestinatario: string;
  telefono: string;
  direccion: string;
  complemento: string;
  barrioID: number | null;
  barrio: string;
  costoDomicilio: number;
  fecha: "hoy" | "programada";
  fechaProgramada: string;
  rangoHora: string;
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

export interface AvailableBarrio {
  id: number;
  nombre: string;
  costoDomicilio: number;
}

export interface SubmittedOrder {
  id: string;
  pedidoID: number | null;
  createdAt: string;
  companySlug: string;
  pedido: PedidoState;
  totalItems: number;
  totalIVA: number;
  totalPrice: number;
  paymentMethod: "wompi" | "transferencia" | "efectivo";
  paymentStatus: "confirmado" | "pendiente_validacion" | "pendiente_pago";
  paymentUrl?: string | null;
  paymentReference?: string | null;
}

interface CartStore {
  pedidoState: PedidoState;
  lastSubmittedOrder: SubmittedOrder | null;
  availableBarrios: AvailableBarrio[];
  addProduct: (item: Omit<CartItem, "cantidad">) => void;
  addItem: (item: Omit<CartItem, "cantidad">) => void;
  updateQuantity: (productId: number, qty: number) => void;
  increaseQty: (productId: number) => void;
  decreaseQty: (productId: number) => void;
  removeProduct: (productId: number) => void;
  removeItem: (productId: number) => void;
  clearCart: () => void;
  resetCheckoutFlow: () => void;
  setClienteID: (id: number) => void;
  updateCliente: (field: "nombre" | "indicativo" | "telefono", value: string) => void;
  updateFacturacion: (field: keyof Omit<PedidoFacturacion, "requiereFactura">, value: string) => void;
  toggleFacturacion: (requiresInvoice: boolean) => void;
  updateEntrega: (field: keyof PedidoEntrega, value: string) => void;
  selectBarrio: (barrio: AvailableBarrio | null) => void;
  updateMensaje: (field: keyof PedidoMensaje, value: string) => void;
  updateNotas: (value: string) => void;
  resetPedidoState: () => void;
  submitOrder: (
    companySlug: string,
    pedidoID?: number | null,
    codigoPedido?: string | null,
    totalPriceOverride?: number,
    totalIVA?: number,
    paymentMethod?: "wompi" | "transferencia" | "efectivo",
    paymentUrl?: string | null,
    paymentReference?: string | null,
  ) => SubmittedOrder | null;
  clearLastSubmittedOrder: () => void;
  setAvailableBarrios: (barrios: AvailableBarrio[]) => void;
}

const initialPedidoState: PedidoState = {
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
};

const CHECKOUT_DRAFT_STORAGE_KEY = "petalops-checkout-draft";

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      pedidoState: initialPedidoState,
      lastSubmittedOrder: null,
      availableBarrios: [],
      addProduct: (item) =>
        set((state) => {
          const existing = state.pedidoState.productos.find((product) => product.id === item.id);

          const productos = existing
            ? state.pedidoState.productos.map((product) =>
                product.id === item.id ? { ...product, cantidad: product.cantidad + 1 } : product,
              )
            : [...state.pedidoState.productos, { ...item, cantidad: 1 }];

          return buildPedidoStatePatch(state.pedidoState, { productos });
        }),
      addItem: (item) => get().addProduct(item),
      updateQuantity: (productId, qty) =>
        set((state) => {
          const productos = state.pedidoState.productos
            .map((product) => (product.id === productId ? { ...product, cantidad: qty } : product))
            .filter((product) => product.cantidad > 0);

          return buildPedidoStatePatch(state.pedidoState, { productos });
        }),
      increaseQty: (productId) =>
        set((state) => {
          const productos = state.pedidoState.productos.map((product) =>
            product.id === productId ? { ...product, cantidad: product.cantidad + 1 } : product,
          );

          return buildPedidoStatePatch(state.pedidoState, { productos });
        }),
      decreaseQty: (productId) =>
        set((state) => {
          const productos = state.pedidoState.productos
            .map((product) => (product.id === productId ? { ...product, cantidad: product.cantidad - 1 } : product))
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
      resetCheckoutFlow: () => {
        set({
          pedidoState: initialPedidoState,
          lastSubmittedOrder: null,
        });

        try {
          window.localStorage.removeItem(CHECKOUT_DRAFT_STORAGE_KEY);
        } catch {
          // ignore storage cleanup failures
        }
      },
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
        set((state) => {
          if (field === "metodo") {
            const nextMetodo = value as PedidoEntrega["metodo"];
            const currentMetodo = state.pedidoState.entrega.metodo;

            if (nextMetodo === currentMetodo) {
              return buildPedidoStatePatch(state.pedidoState, {
                entrega: {
                  ...state.pedidoState.entrega,
                },
              });
            }

            const nextEntrega: PedidoEntrega = {
              ...state.pedidoState.entrega,
              metodo: nextMetodo,
              ...(nextMetodo === "recoger"
                ? {
                    direccion: "",
                    complemento: "",
                    barrioID: null,
                    barrio: "",
                    costoDomicilio: 0,
                    nombreDestinatario: state.pedidoState.cliente.nombre,
                    telefono: state.pedidoState.cliente.telefono,
                  }
                : {
                    nombreDestinatario: "",
                    telefono: "",
                    direccion: "",
                    complemento: "",
                    barrioID: null,
                    barrio: "",
                    costoDomicilio: 0,
                  }),
            };

            return buildPedidoStatePatch(state.pedidoState, {
              entrega: nextEntrega,
            });
          }

          return buildPedidoStatePatch(state.pedidoState, {
            entrega: {
              ...state.pedidoState.entrega,
              [field]: value,
            },
          });
        }),
      selectBarrio: (barrio) =>
        set((state) =>
          buildPedidoStatePatch(state.pedidoState, {
            entrega: {
              ...state.pedidoState.entrega,
              barrioID: barrio?.id ?? null,
              barrio: barrio?.nombre ?? "",
              costoDomicilio: barrio?.costoDomicilio ?? 0,
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
      submitOrder: (
        companySlug,
        pedidoID = null,
        codigoPedido = null,
        totalPriceOverride,
        totalIVA = 0,
        paymentMethod = "wompi",
        paymentUrl = null,
        paymentReference = null,
      ) => {
        const { pedidoState } = get();

        if (!pedidoState.productos.length) {
          return null;
        }

        const order: SubmittedOrder = {
          id: buildOrderId(pedidoID, codigoPedido),
          pedidoID,
          createdAt: new Date().toISOString(),
          companySlug,
          pedido: pedidoState,
          totalItems: getCartTotalItems(pedidoState.productos),
          totalIVA: Number.isFinite(totalIVA) ? totalIVA : 0,
          totalPrice:
            typeof totalPriceOverride === "number" && Number.isFinite(totalPriceOverride)
              ? totalPriceOverride
              : pedidoState.total,
          paymentMethod,
          paymentStatus:
            paymentMethod === "transferencia"
              ? "pendiente_validacion"
              : paymentMethod === "wompi"
                ? "pendiente_pago"
                : "confirmado",
          paymentUrl,
          paymentReference,
        };

        set({
          pedidoState: initialPedidoState,
          lastSubmittedOrder: order,
        });

        return order;
      },
      clearLastSubmittedOrder: () => set({ lastSubmittedOrder: null }),
      setAvailableBarrios: (barrios) =>
        set(() => {
          const uniqueByName = new Map<string, AvailableBarrio>();

          for (const barrio of barrios) {
            const key = barrio.nombre.trim().toLowerCase();
            if (!key) {
              continue;
            }

            if (!uniqueByName.has(key)) {
              uniqueByName.set(key, barrio);
            }
          }

          return {
            availableBarrios: Array.from(uniqueByName.values()).sort((a, b) => a.nombre.localeCompare(b.nombre, "es")),
          };
        }),
    }),
    {
      name: "petalops-checkout-draft",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ pedidoState: state.pedidoState }),
      merge: (persistedState, currentState) => {
        const persisted = persistedState as Partial<CartStore> | undefined;
        const persistedPedido = persisted?.pedidoState;

        return {
          ...currentState,
          ...persisted,
          pedidoState: {
            ...currentState.pedidoState,
            ...persistedPedido,
            cliente: {
              ...currentState.pedidoState.cliente,
              ...persistedPedido?.cliente,
              facturacion: {
                ...currentState.pedidoState.cliente.facturacion,
                ...persistedPedido?.cliente?.facturacion,
              },
            },
            entrega: {
              ...currentState.pedidoState.entrega,
              ...persistedPedido?.entrega,
            },
            mensaje: {
              ...currentState.pedidoState.mensaje,
              ...persistedPedido?.mensaje,
            },
          },
        };
      },
    },
  ),
);

export function getCartTotalItems(items: CartItem[]): number {
  return items.reduce((acc, item) => acc + item.cantidad, 0);
}

export function getCartTotalPrice(items: CartItem[]): number {
  return items.reduce((acc, item) => acc + item.cantidad * item.precio, 0);
}

function buildOrderId(pedidoID: number | null, codigoPedido: string | null): string {
  if (typeof codigoPedido === "string" && codigoPedido.trim().length > 0) {
    return codigoPedido.trim();
  }

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
  const deliveryCost = nextState.entrega.metodo === "domicilio" ? nextState.entrega.costoDomicilio : 0;

  return {
    pedidoState: {
      ...nextState,
      subtotal,
      total: subtotal + deliveryCost,
    },
  };
}
