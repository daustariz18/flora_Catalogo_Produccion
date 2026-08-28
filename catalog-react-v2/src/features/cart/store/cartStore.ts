import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export interface CartItem {
  id: number;
  id_producto?: number;
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
  empresaID?: number | null;
  empresaCelular?: string | null;
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
  activeTenantSlug: string;
  draftsByTenant: Record<string, PedidoState>;
  pedidoState: PedidoState;
  lastSubmittedOrder: SubmittedOrder | null;
  availableBarrios: AvailableBarrio[];
  setActiveTenant: (tenantSlug: string) => void;
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
    empresaID?: number | null,
    empresaCelular?: string | null,
  ) => SubmittedOrder | null;
  clearLastSubmittedOrder: () => void;
  setAvailableBarrios: (barrios: AvailableBarrio[]) => void;
}

function createInitialPedidoState(): PedidoState {
  return {
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
}

const CHECKOUT_DRAFT_STORAGE_KEY = "petalops-checkout-draft";

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      activeTenantSlug: "",
      draftsByTenant: {},
      pedidoState: createInitialPedidoState(),
      lastSubmittedOrder: null,
      availableBarrios: [],
      setActiveTenant: (tenantSlug) =>
        set((state) => {
          const nextTenant = normalizeCartTenantSlug(tenantSlug);

          if (!nextTenant || nextTenant === state.activeTenantSlug) {
            return {};
          }

          const draftsByTenant = state.activeTenantSlug
            ? { ...state.draftsByTenant, [state.activeTenantSlug]: state.pedidoState }
            : state.draftsByTenant;

          return {
            activeTenantSlug: nextTenant,
            pedidoState: mergePedidoState(draftsByTenant[nextTenant]),
            draftsByTenant,
            availableBarrios: [],
          };
        }),
      addProduct: (item) =>
        set((state) => {
          const existing = state.pedidoState.productos.find((product) => product.id === item.id);

          const productos = existing
            ? state.pedidoState.productos.map((product) =>
                product.id === item.id ? { ...product, cantidad: product.cantidad + 1 } : product,
              )
            : [...state.pedidoState.productos, { ...item, cantidad: 1 }];

          return buildPedidoStatePatch(state, { productos });
        }),
      addItem: (item) => get().addProduct(item),
      updateQuantity: (productId, qty) =>
        set((state) => {
          const productos = state.pedidoState.productos
            .map((product) => (product.id === productId ? { ...product, cantidad: qty } : product))
            .filter((product) => product.cantidad > 0);

          return buildPedidoStatePatch(state, { productos });
        }),
      increaseQty: (productId) =>
        set((state) => {
          const productos = state.pedidoState.productos.map((product) =>
            product.id === productId ? { ...product, cantidad: product.cantidad + 1 } : product,
          );

          return buildPedidoStatePatch(state, { productos });
        }),
      decreaseQty: (productId) =>
        set((state) => {
          const productos = state.pedidoState.productos
            .map((product) => (product.id === productId ? { ...product, cantidad: product.cantidad - 1 } : product))
            .filter((product) => product.cantidad > 0);

          return buildPedidoStatePatch(state, { productos });
        }),
      removeProduct: (productId) =>
        set((state) => {
          const productos = state.pedidoState.productos.filter((product) => product.id !== productId);
          return buildPedidoStatePatch(state, { productos });
      }),
      removeItem: (productId) => get().removeProduct(productId),
      clearCart: () =>
        set((state) => clearActiveTenantDraft(state)),
      resetCheckoutFlow: () => {
        set((state) => ({
          ...clearActiveTenantDraft(state),
          lastSubmittedOrder: null,
        }));

        try {
          if (Object.keys(get().draftsByTenant).length === 0) {
            window.localStorage.removeItem(CHECKOUT_DRAFT_STORAGE_KEY);
          }
        } catch {
          // ignore storage cleanup failures
        }
      },
      setClienteID: (id) =>
        set((state) =>
          buildPedidoStateStorePatch(state, {
            ...state.pedidoState,
            cliente: { ...state.pedidoState.cliente, clienteID: id },
          }),
        ),
      updateCliente: (field, value) =>
        set((state) =>
          buildPedidoStateStorePatch(state, {
            ...state.pedidoState,
            cliente: {
              ...state.pedidoState.cliente,
              [field]: value,
            },
          }),
        ),
      updateFacturacion: (field, value) =>
        set((state) =>
          buildPedidoStateStorePatch(state, {
            ...state.pedidoState,
            cliente: {
              ...state.pedidoState.cliente,
              facturacion: {
                ...state.pedidoState.cliente.facturacion,
                [field]: value,
              },
            },
          }),
        ),
      toggleFacturacion: (requiresInvoice) =>
        set((state) =>
          buildPedidoStateStorePatch(state, {
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
          }),
        ),
      updateEntrega: (field, value) =>
        set((state) => {
          if (field === "metodo") {
            const nextMetodo = value as PedidoEntrega["metodo"];
            const currentMetodo = state.pedidoState.entrega.metodo;

            if (nextMetodo === currentMetodo) {
              return buildPedidoStatePatch(state, {
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

            return buildPedidoStatePatch(state, {
              entrega: nextEntrega,
            });
          }

          return buildPedidoStatePatch(state, {
            entrega: {
              ...state.pedidoState.entrega,
              [field]: value,
            },
          });
        }),
      selectBarrio: (barrio) =>
        set((state) =>
          buildPedidoStatePatch(state, {
            entrega: {
              ...state.pedidoState.entrega,
              barrioID: barrio?.id ?? null,
              barrio: barrio?.nombre ?? "",
              costoDomicilio: barrio?.costoDomicilio ?? 0,
            },
          }),
        ),
      updateMensaje: (field, value) =>
        set((state) =>
          buildPedidoStateStorePatch(state, {
            ...state.pedidoState,
            mensaje: {
              ...state.pedidoState.mensaje,
              [field]: value,
            },
          }),
        ),
      updateNotas: (value) =>
        set((state) =>
          buildPedidoStateStorePatch(state, {
            ...state.pedidoState,
            notas: value,
          }),
        ),
      resetPedidoState: () =>
        set((state) => clearActiveTenantDraft(state)),
      submitOrder: (
        companySlug,
        pedidoID = null,
        codigoPedido = null,
        totalPriceOverride,
        totalIVA = 0,
        paymentMethod = "wompi",
        paymentUrl = null,
        paymentReference = null,
        empresaID = null,
        empresaCelular = null,
      ) => {
        const { pedidoState } = get();

        if (!pedidoState.productos.length) {
          return null;
        }

        const order: SubmittedOrder = {
          id: buildOrderId(pedidoID, codigoPedido),
          pedidoID,
          empresaID,
          empresaCelular,
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
          ...clearActiveTenantDraft(get()),
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
      partialize: (state) => {
        const draftsByTenant =
          state.activeTenantSlug && hasPedidoDraftData(state.pedidoState)
            ? { ...state.draftsByTenant, [state.activeTenantSlug]: state.pedidoState }
            : state.draftsByTenant;

        return {
          activeTenantSlug: state.activeTenantSlug,
          draftsByTenant: filterEmptyDraftsByTenant(draftsByTenant),
        };
      },
      merge: (persistedState, currentState) => {
        const persisted = persistedState as Partial<CartStore> | undefined;
        const activeTenantSlug = normalizeCartTenantSlug(persisted?.activeTenantSlug);
        const draftsByTenant = normalizeDraftsByTenant(persisted?.draftsByTenant);
        const legacyPedido = persisted?.pedidoState;
        const migratedDraftsByTenant =
          activeTenantSlug && legacyPedido && !draftsByTenant[activeTenantSlug]
            ? { ...draftsByTenant, [activeTenantSlug]: mergePedidoState(legacyPedido) }
            : draftsByTenant;

        return {
          ...currentState,
          activeTenantSlug,
          draftsByTenant: migratedDraftsByTenant,
          pedidoState: activeTenantSlug ? mergePedidoState(migratedDraftsByTenant[activeTenantSlug]) : createInitialPedidoState(),
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

function buildPedidoStatePatch(currentStore: Pick<CartStore, "activeTenantSlug" | "draftsByTenant" | "pedidoState">, partial: Partial<PedidoState>) {
  const nextState: PedidoState = {
    ...currentStore.pedidoState,
    ...partial,
  };

  const subtotal = getCartTotalPrice(nextState.productos);
  const deliveryCost = nextState.entrega.metodo === "domicilio" ? nextState.entrega.costoDomicilio : 0;

  return buildPedidoStateStorePatch(currentStore, {
    ...nextState,
    subtotal,
    total: subtotal + deliveryCost,
  });
}

function buildPedidoStateStorePatch(
  currentStore: Pick<CartStore, "activeTenantSlug" | "draftsByTenant">,
  pedidoState: PedidoState,
) {
  const activeTenantSlug = normalizeCartTenantSlug(currentStore.activeTenantSlug);

  return {
    pedidoState,
    draftsByTenant: activeTenantSlug
      ? {
          ...currentStore.draftsByTenant,
          [activeTenantSlug]: pedidoState,
        }
      : currentStore.draftsByTenant,
  };
}

function clearActiveTenantDraft(currentStore: Pick<CartStore, "activeTenantSlug" | "draftsByTenant">) {
  const pedidoState = createInitialPedidoState();
  const activeTenantSlug = normalizeCartTenantSlug(currentStore.activeTenantSlug);

  if (!activeTenantSlug) {
    return {
      pedidoState,
      draftsByTenant: currentStore.draftsByTenant,
    };
  }

  const draftsByTenant = { ...currentStore.draftsByTenant };
  delete draftsByTenant[activeTenantSlug];

  return {
    pedidoState,
    draftsByTenant,
  };
}

function normalizeCartTenantSlug(value: string | null | undefined): string {
  return value?.trim().toLowerCase() ?? "";
}

function normalizeDraftsByTenant(value: Record<string, PedidoState> | undefined): Record<string, PedidoState> {
  if (!value || typeof value !== "object") {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value)
      .map(([tenantSlug, pedidoState]) => [normalizeCartTenantSlug(tenantSlug), mergePedidoState(pedidoState)] as const)
      .filter(([tenantSlug]) => tenantSlug.length > 0),
  );
}

function mergePedidoState(pedidoState: Partial<PedidoState> | undefined): PedidoState {
  return {
    ...createInitialPedidoState(),
    ...pedidoState,
    cliente: {
      ...createInitialPedidoState().cliente,
      ...pedidoState?.cliente,
      facturacion: {
        ...createInitialPedidoState().cliente.facturacion,
        ...pedidoState?.cliente?.facturacion,
      },
    },
    entrega: {
      ...createInitialPedidoState().entrega,
      ...pedidoState?.entrega,
    },
    mensaje: {
      ...createInitialPedidoState().mensaje,
      ...pedidoState?.mensaje,
    },
    productos: pedidoState?.productos ?? [],
  };
}

function filterEmptyDraftsByTenant(draftsByTenant: Record<string, PedidoState>): Record<string, PedidoState> {
  return Object.fromEntries(
    Object.entries(draftsByTenant).filter(([, pedidoState]) => hasPedidoDraftData(pedidoState)),
  );
}

function hasPedidoDraftData(pedidoState: PedidoState): boolean {
  return (
    pedidoState.productos.length > 0 ||
    pedidoState.cliente.nombre.trim().length > 0 ||
    pedidoState.cliente.telefono.trim().length > 0 ||
    pedidoState.cliente.facturacion.identificacion.trim().length > 0 ||
    pedidoState.entrega.direccion.trim().length > 0 ||
    pedidoState.entrega.barrio.trim().length > 0 ||
    pedidoState.mensaje.texto.trim().length > 0 ||
    pedidoState.mensaje.firma.trim().length > 0 ||
    pedidoState.notas.trim().length > 0
  );
}
