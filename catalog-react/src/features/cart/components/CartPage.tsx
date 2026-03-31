import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { formatCOP } from "../../../shared/utils/currency";
import { createCliente, createOrder } from "../api/publicOrderApi";
import { getCartTotalItems, type CartItem, type PedidoState, useCartStore } from "../store/cartStore";

const DELIVERY_COST = 8000;
type WizardStep = 1 | 2 | 3 | 4;

interface WizardStepsProps {
  step: WizardStep;
  stepTitles: string[];
}

interface ProductStepProps {
  hasProducts: boolean;
  catalogPath: string;
  pedidoState: PedidoState;
  totalItems: number;
  onRequestClearCart: () => void;
  decreaseQty: (productId: number) => void;
  increaseQty: (productId: number) => void;
  removeProduct: (productId: number) => void;
  deliveryEstimate: number;
  onNext: () => void;
}

interface CustomerStepProps {
  pedidoState: PedidoState;
  canContinue: boolean;
  updateCliente: (field: "nombre" | "telefono", value: string) => void;
  updateFacturacion: (field: "tipoIdentificacion" | "identificacion" | "email", value: string) => void;
  toggleFacturacion: (requiresInvoice: boolean) => void;
  onNext: () => void;
  onBack: () => void;
}

interface DeliveryStepProps {
  pedidoState: PedidoState;
  canContinue: boolean;
  updateEntrega: (field: keyof PedidoState["entrega"], value: string) => void;
  onNext: () => void;
  onBack: () => void;
}

interface ConfirmationStepProps {
  pedidoState: PedidoState;
  costoDomicilio: number;
  isSubmitting: boolean;
  submitError: string | null;
  updateMensaje: (field: "texto" | "firma", value: string) => void;
  updateNotas: (value: string) => void;
  onBack: () => void;
  onConfirm: () => void;
}

function getStepStatus(stepNumber: number, currentStep: WizardStep): "current" | "done" | "upcoming" {
  if (stepNumber === currentStep) {
    return "current";
  }

  if (stepNumber < currentStep) {
    return "done";
  }

  return "upcoming";
}

function WizardSteps({ step, stepTitles }: Readonly<WizardStepsProps>) {
  return (
    <section className="wizard-steps" aria-label="Progreso del pedido">
      {stepTitles.map((title, index) => {
        const stepNumber = index + 1;
        const status = getStepStatus(stepNumber, step);

        return (
          <div
            key={title}
            className={`wizard-step wizard-step-${status}`}
            aria-current={status === "current" ? "step" : undefined}
          >
            <span>{stepNumber}</span>
            <strong>{title}</strong>
          </div>
        );
      })}
    </section>
  );
}

function ProductStep({
  hasProducts,
  catalogPath,
  pedidoState,
  totalItems,
  onRequestClearCart,
  decreaseQty,
  increaseQty,
  removeProduct,
  deliveryEstimate,
  onNext,
}: Readonly<ProductStepProps>) {
  const estimatedTotal = pedidoState.subtotal + deliveryEstimate;

  return (
    <section className="wizard-panel" aria-label="Seleccion de productos">
      <div className="wizard-panel-head">
        <div>
          <h2>1. Revisa tus arreglos</h2>
          <p>Ajusta cantidades o quita productos antes de continuar.</p>
        </div>
        <button type="button" className="ghost ghost-danger" onClick={onRequestClearCart} disabled={!hasProducts}>
          Vaciar carrito
        </button>
      </div>

      {hasProducts ? (
        <>
          <section className="cart-list" aria-label="Productos del carrito">
            {pedidoState.productos.map((item) => (
              <article key={item.id} className="cart-item">
                <img src={item.imagen} alt={item.nombre} loading="lazy" />
                <div className="cart-item-body">
                  <h2>{item.nombre}</h2>
                  <p>{formatCOP(item.precio)}</p>
                  <div className="qty-controls">
                    <button type="button" onClick={() => decreaseQty(item.id)} aria-label={`Restar ${item.nombre}`}>
                      -
                    </button>
                    <span>{item.cantidad}</span>
                    <button type="button" onClick={() => increaseQty(item.id)} aria-label={`Sumar ${item.nombre}`}>
                      +
                    </button>
                  </div>
                  <p className="cart-item-subtotal">
                    Subtotal: <strong>{formatCOP(item.precio * item.cantidad)}</strong>
                  </p>
                </div>
                <button type="button" className="remove-link" onClick={() => removeProduct(item.id)}>
                  Quitar
                </button>
              </article>
            ))}
          </section>

          <aside className="wizard-summary-card">
            <p className="wizard-summary-row">
              <span>{totalItems} producto(s)</span>
              <strong>{formatCOP(pedidoState.subtotal)}</strong>
            </p>
            <p className="wizard-summary-row">
              <span>Envio estimado</span>
              <strong>{deliveryEstimate > 0 ? formatCOP(deliveryEstimate) : "Se define en entrega"}</strong>
            </p>
            <p className="wizard-summary-row wizard-summary-row-total">
              <span>Total estimado</span>
              <strong>{formatCOP(estimatedTotal)}</strong>
            </p>
            <button type="button" className="cta" onClick={onNext}>
              Continuar al paso 2: Tus datos
            </button>
          </aside>
        </>
      ) : (
        <section className="empty-state wizard-empty-state">
          <p>Tu carrito esta vacio por ahora.</p>
          <Link to={catalogPath} className="cta empty-state-action">
            Agregar mas flores
          </Link>
        </section>
      )}
    </section>
  );
}

function CustomerStep({
  pedidoState,
  canContinue,
  updateCliente,
  updateFacturacion,
  toggleFacturacion,
  onNext,
  onBack,
}: Readonly<CustomerStepProps>) {
  const facturacion = pedidoState.cliente.facturacion;

  return (
    <section className="wizard-panel" aria-label="Informacion del cliente">
      <div className="wizard-panel-head">
        <div>
          <h2>2. Informacion del cliente</h2>
          <p>Necesitamos tus datos basicos para contactarte sobre el pedido.</p>
        </div>
      </div>

      <div className="checkout-card">
        <label className="checkout-field">
          <span>Nombre completo</span>
          <input
            type="text"
            value={pedidoState.cliente.nombre}
            onChange={(event) => updateCliente("nombre", event.target.value)}
            placeholder="Escribe tu nombre"
            autoComplete="name"
            required
          />
        </label>

        <label className="checkout-field">
          <span>Telefono</span>
          <input
            type="tel"
            value={pedidoState.cliente.telefono}
            onChange={(event) => updateCliente("telefono", event.target.value)}
            placeholder="3001234567"
            autoComplete="tel"
            required
          />
        </label>

        <label className="checkout-field checkbox-field">
          <span className="checkbox-label-inline">
            <input
              type="checkbox"
              checked={facturacion.requiereFactura}
              onChange={(event) => toggleFacturacion(event.target.checked)}
            />
            <span>Necesito factura</span>
          </span>
        </label>

        {facturacion.requiereFactura ? (
          <>
            <label className="checkout-field">
              <span>Tipo de identificacion</span>
              <select
                value={facturacion.tipoIdentificacion}
                onChange={(event) =>
                  updateFacturacion("tipoIdentificacion", event.target.value as "cedula" | "nit" | "")
                }
                required
              >
                <option value="">Selecciona una opcion</option>
                <option value="cedula">Cedula</option>
                <option value="nit">NIT</option>
              </select>
            </label>

            <label className="checkout-field">
              <span>Identificacion</span>
              <input
                type="text"
                value={facturacion.identificacion}
                onChange={(event) => updateFacturacion("identificacion", event.target.value)}
                placeholder="Numero de documento"
                required
              />
            </label>

            <label className="checkout-field">
              <span>Correo electronico</span>
              <input
                type="email"
                value={facturacion.email}
                onChange={(event) => updateFacturacion("email", event.target.value)}
                placeholder="correo@ejemplo.com"
                autoComplete="email"
                required
              />
            </label>
          </>
        ) : null}
      </div>

      <div className="wizard-actions">
        <button type="button" className="ghost" onClick={onBack}>
          Volver
        </button>
        <button type="button" className="cta" onClick={onNext} disabled={!canContinue}>
          Continuar con entrega
        </button>
      </div>
    </section>
  );
}

function DeliveryStep({
  pedidoState,
  canContinue,
  updateEntrega,
  onNext,
  onBack,
}: Readonly<DeliveryStepProps>) {
  const isDomicilio = pedidoState.entrega.metodo === "domicilio";

  return (
    <section className="wizard-panel" aria-label="Metodo de entrega">
      <div className="wizard-panel-head">
        <div>
          <h2>3. Metodo de entrega</h2>
          <p>Te pedimos solo los datos necesarios segun como quieras recibir el pedido.</p>
        </div>
      </div>

      <div className="checkout-card">
        <section className="delivery-method-block" aria-label="Metodo de entrega">
          <div className="delivery-method-head">
            <strong>Como quieres recibir tu pedido</strong>
            <p>Escoge una opcion para mostrar solo los campos necesarios.</p>
          </div>

          <div className="delivery-options" role="radiogroup" aria-label="Metodo de entrega">
            <button
              type="button"
              className={`delivery-option ${isDomicilio ? "delivery-option-active" : ""}`}
              onClick={() => {
                updateEntrega("metodo", "domicilio");
                updateEntrega("telefono", "");
              }}
              aria-pressed={isDomicilio}
            >
              <span>Domicilio</span>
              <small>Lo enviamos a una direccion</small>
            </button>
            <button
              type="button"
              className={`delivery-option ${pedidoState.entrega.metodo === "recoger" ? "delivery-option-active" : ""}`}
              onClick={() => {
                updateEntrega("metodo", "recoger");
                updateEntrega("direccion", "");
                updateEntrega("complemento", "");
                updateEntrega("barrio", "");
              }}
              aria-pressed={pedidoState.entrega.metodo === "recoger"}
            >
              <span>Recoger en tienda</span>
              <small>Pasa por el punto de venta</small>
            </button>
          </div>
        </section>

        {isDomicilio ? (
          <div className="delivery-fields">
            <label className="checkout-field">
              <span>Nombre destinatario</span>
              <input
                type="text"
                value={pedidoState.entrega.nombreDestinatario}
                onChange={(event) => updateEntrega("nombreDestinatario", event.target.value)}
                placeholder="Persona que recibe"
                required
              />
            </label>

            <label className="checkout-field">
              <span>Telefono destinatario (opcional)</span>
              <input
                type="tel"
                value={pedidoState.entrega.telefono}
                onChange={(event) => updateEntrega("telefono", event.target.value)}
                placeholder="3001234567"
              />
            </label>

            <label className="checkout-field">
              <span>Direccion</span>
              <textarea
                value={pedidoState.entrega.direccion}
                onChange={(event) => updateEntrega("direccion", event.target.value)}
                placeholder="Calle, numero, apartamento, referencias"
                rows={3}
                required
              />
            </label>

            <label className="checkout-field">
              <span>Complemento (opcional)</span>
              <input
                type="text"
                value={pedidoState.entrega.complemento}
                onChange={(event) => updateEntrega("complemento", event.target.value)}
                placeholder="Apto, torre, piso, interior"
              />
            </label>

            <label className="checkout-field">
              <span>Barrio</span>
              <input
                type="text"
                value={pedidoState.entrega.barrio}
                onChange={(event) => updateEntrega("barrio", event.target.value)}
                placeholder="Nombre del barrio"
                required
              />
            </label>
          </div>
        ) : (
          <div className="delivery-fields">
            <label className="checkout-field">
              <span>Nombre de quien recoge</span>
              <input
                type="text"
                value={pedidoState.entrega.nombreDestinatario}
                onChange={(event) => updateEntrega("nombreDestinatario", event.target.value)}
                placeholder="Persona que recoge en tienda"
                required
              />
            </label>

            <label className="checkout-field">
              <span>Telefono</span>
              <input
                type="tel"
                value={pedidoState.entrega.telefono}
                onChange={(event) => updateEntrega("telefono", event.target.value)}
                placeholder="3001234567"
                required
              />
            </label>
          </div>
        )}

        <section className="delivery-date-block" aria-label="Fecha de entrega">
          <div className="delivery-date-head">
            <strong>Entrega</strong>
            <p>Selecciona cuando quieres recibir o recoger el pedido.</p>
          </div>

          <div className="delivery-date-grid" role="radiogroup" aria-label="Momento de entrega">
            <button
              type="button"
              className={`delivery-date-button ${pedidoState.entrega.fecha === "hoy" ? "delivery-date-button-active" : ""}`}
              onClick={() => {
                updateEntrega("fecha", "hoy");
                updateEntrega("fechaProgramada", "");
              }}
              aria-pressed={pedidoState.entrega.fecha === "hoy"}
            >
              Hoy
            </button>
            <button
              type="button"
              className={`delivery-date-button ${pedidoState.entrega.fecha === "programada" ? "delivery-date-button-active" : ""}`}
              onClick={() => updateEntrega("fecha", "programada")}
              aria-pressed={pedidoState.entrega.fecha === "programada"}
            >
              Programar fecha
            </button>
          </div>
        </section>

        {pedidoState.entrega.fecha === "programada" ? (
          <label className="checkout-field delivery-date-picker-field">
            <span>Fecha programada</span>
            <input
              type="date"
              value={pedidoState.entrega.fechaProgramada}
              onChange={(event) => updateEntrega("fechaProgramada", event.target.value)}
              required
            />
          </label>
        ) : null}
      </div>

      <div className="wizard-actions">
        <button type="button" className="ghost" onClick={onBack}>
          Volver
        </button>
        <button type="button" className="cta" onClick={onNext} disabled={!canContinue}>
          Revisar pedido
        </button>
      </div>
    </section>
  );
}

function ConfirmationStep({
  pedidoState,
  costoDomicilio,
  isSubmitting,
  submitError,
  updateMensaje,
  updateNotas,
  onBack,
  onConfirm,
}: Readonly<ConfirmationStepProps>) {
  return (
    <section className="wizard-panel" aria-label="Resumen final del pedido">
      <div className="wizard-panel-head">
        <div>
          <h2>4. Confirmacion</h2>
          <p>Verifica tu informacion antes de confirmar el pedido.</p>
        </div>
      </div>

      <div className="wizard-review-grid">
        <section className="checkout-card checkout-summary">
          <h2>Resumen del pedido</h2>
          <div className="checkout-items">
            {pedidoState.productos.map((item) => (
              <div key={item.id} className="checkout-summary-item">
                <div>
                  <strong>{item.nombre}</strong>
                  <p>{item.cantidad} unidad(es)</p>
                </div>
                <span>{formatCOP(item.precio * item.cantidad)}</span>
              </div>
            ))}
          </div>

          <div className="checkout-totals">
            <p>
              <span>Subtotal</span>
              <strong>{formatCOP(pedidoState.subtotal)}</strong>
            </p>
            <p>
              <span>Costo domicilio</span>
              <strong>{formatCOP(costoDomicilio)}</strong>
            </p>
            <p>
              <span>Total</span>
              <strong>{formatCOP(pedidoState.total)}</strong>
            </p>
          </div>
        </section>

        <aside className="checkout-card order-meta-card">
          <h2>Datos del cliente</h2>
          <div className="order-meta-list">
            <p>
              <span>Nombre</span>
              <strong>{pedidoState.cliente.nombre}</strong>
            </p>
            <p>
              <span>Telefono</span>
              <strong>{pedidoState.cliente.telefono}</strong>
            </p>
            {pedidoState.cliente.facturacion.requiereFactura ? (
              <>
                <p>
                  <span>Facturacion</span>
                  <strong>Si, requiere factura</strong>
                </p>
                <p>
                  <span>Tipo ID</span>
                  <strong>
                    {pedidoState.cliente.facturacion.tipoIdentificacion === "nit" ? "NIT" : "Cedula"}
                  </strong>
                </p>
                <p>
                  <span>Identificacion</span>
                  <strong>{pedidoState.cliente.facturacion.identificacion}</strong>
                </p>
                <p>
                  <span>Email factura</span>
                  <strong>{pedidoState.cliente.facturacion.email}</strong>
                </p>
              </>
            ) : null}
            <p>
              <span>Entrega</span>
              <strong>{pedidoState.entrega.metodo === "domicilio" ? "Domicilio" : "Recoger en tienda"}</strong>
            </p>
            <p>
              <span>Nombre entrega</span>
              <strong>{pedidoState.entrega.nombreDestinatario}</strong>
            </p>
            {pedidoState.entrega.telefono.trim() ? (
              <p>
                <span>Telefono entrega</span>
                <strong>{pedidoState.entrega.telefono}</strong>
              </p>
            ) : null}
            {pedidoState.entrega.metodo === "domicilio" ? (
              <>
                <p>
                  <span>Direccion</span>
                  <strong>{pedidoState.entrega.direccion}</strong>
                </p>
                {pedidoState.entrega.complemento.trim() ? (
                  <p>
                    <span>Complemento</span>
                    <strong>{pedidoState.entrega.complemento}</strong>
                  </p>
                ) : null}
                <p>
                  <span>Barrio</span>
                  <strong>{pedidoState.entrega.barrio}</strong>
                </p>
              </>
            ) : null}
            <p>
              <span>Fecha entrega</span>
              <strong>
                {pedidoState.entrega.fecha === "hoy"
                  ? "Hoy"
                  : `Programada: ${pedidoState.entrega.fechaProgramada}`}
              </strong>
            </p>
            {pedidoState.mensaje.texto.trim() ? (
              <p>
                <span>Mensaje tarjeta</span>
                <strong>{pedidoState.mensaje.texto}</strong>
              </p>
            ) : null}
            {pedidoState.mensaje.firma.trim() ? (
              <p>
                <span>Firma</span>
                <strong>{pedidoState.mensaje.firma}</strong>
              </p>
            ) : null}
            {pedidoState.notas.trim() ? (
              <p>
                <span>Notas</span>
                <strong>{pedidoState.notas}</strong>
              </p>
            ) : null}
          </div>
        </aside>
      </div>

      <section className="checkout-card delivery-notes-field" aria-label="Mensaje y notas opcionales">
        <h2>Mensaje y notas (opcional)</h2>

        <label className="checkout-field">
          <span>Mensaje para la tarjeta</span>
          <textarea
            value={pedidoState.mensaje.texto}
            onChange={(event) => updateMensaje("texto", event.target.value)}
            placeholder="Escribe un mensaje breve"
            rows={2}
          />
        </label>

        <label className="checkout-field">
          <span>Firma</span>
          <input
            type="text"
            value={pedidoState.mensaje.firma}
            onChange={(event) => updateMensaje("firma", event.target.value)}
            placeholder="De parte de..."
          />
        </label>

        <label className="checkout-field">
          <span>Notas adicionales</span>
          <textarea
            value={pedidoState.notas}
            onChange={(event) => updateNotas(event.target.value)}
            placeholder="Indicaciones adicionales del pedido"
            rows={2}
          />
        </label>
      </section>

      {submitError ? <p className="checkout-error wizard-submit-error">{submitError}</p> : null}

      <div className="wizard-actions">
        <button type="button" className="ghost" onClick={onBack} disabled={isSubmitting}>
          Volver
        </button>
        <button type="button" className="cta" onClick={onConfirm} disabled={isSubmitting}>
          {isSubmitting ? "Confirmando..." : "Confirmar pedido"}
        </button>
      </div>
    </section>
  );
}

export function CartPage() {
  const navigate = useNavigate();
  const { tenantSlug = "" } = useParams();
  const [step, setStep] = useState<WizardStep>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [showClearCartConfirm, setShowClearCartConfirm] = useState(false);
  const [undoItem, setUndoItem] = useState<CartItem | null>(null);
  const pedidoState = useCartStore((state) => state.pedidoState);
  const addItem = useCartStore((state) => state.addItem);
  const increaseQty = useCartStore((state) => state.increaseQty);
  const decreaseQty = useCartStore((state) => state.decreaseQty);
  const removeProduct = useCartStore((state) => state.removeProduct);
  const clearCart = useCartStore((state) => state.clearCart);
  const updateCliente = useCartStore((state) => state.updateCliente);
  const updateFacturacion = useCartStore((state) => state.updateFacturacion);
  const toggleFacturacion = useCartStore((state) => state.toggleFacturacion);
  const updateEntrega = useCartStore((state) => state.updateEntrega);
  const updateMensaje = useCartStore((state) => state.updateMensaje);
  const updateNotas = useCartStore((state) => state.updateNotas);
  const setClienteID = useCartStore((state) => state.setClienteID);
  const submitOrder = useCartStore((state) => state.submitOrder);
  const undoTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const totalItems = getCartTotalItems(pedidoState.productos);
  const costoDomicilio = pedidoState.entrega.metodo === "domicilio" ? DELIVERY_COST : 0;
  const catalogPath = `/catalogo/${tenantSlug}`;
  const successPath = `/catalogo/${tenantSlug}/pedido-exitoso`;
  const activeTenant = tenantSlug;
  const deliveryEstimate = pedidoState.entrega.metodo === "domicilio" ? DELIVERY_COST : 0;

  const canContinueStep2Base =
    pedidoState.cliente.nombre.trim().length > 1 && pedidoState.cliente.telefono.trim().length >= 7;
  const canContinueStep2Billing =
    !pedidoState.cliente.facturacion.requiereFactura ||
    (pedidoState.cliente.facturacion.tipoIdentificacion !== "" &&
      pedidoState.cliente.facturacion.identificacion.trim().length > 3 &&
      pedidoState.cliente.facturacion.email.trim().length > 4);
  const canContinueStep2 = canContinueStep2Base && canContinueStep2Billing;

  const canContinueStep3Fecha =
    pedidoState.entrega.fecha === "hoy" || pedidoState.entrega.fechaProgramada.trim().length > 0;
  const canContinueStep3 =
    (pedidoState.entrega.metodo === "domicilio" &&
      pedidoState.entrega.nombreDestinatario.trim().length > 1 &&
      pedidoState.entrega.direccion.trim().length > 3 &&
      pedidoState.entrega.barrio.trim().length > 1 &&
      canContinueStep3Fecha) ||
    (pedidoState.entrega.metodo === "recoger" &&
      pedidoState.entrega.nombreDestinatario.trim().length > 1 &&
      pedidoState.entrega.telefono.trim().length >= 7 &&
      canContinueStep3Fecha);

  const stepTitles = useMemo(() => ["Tu carrito", "Tus datos", "Entrega", "Confirmar"], []);

  useEffect(() => {
    return () => {
      if (undoTimeoutRef.current) {
        clearTimeout(undoTimeoutRef.current);
      }
    };
  }, []);

  function goNext() {
    setStep((current) => {
      if (current === 1) {
        return 2;
      }
      if (current === 2) {
        return 3;
      }
      if (current === 3) {
        return 4;
      }
      return 4;
    });
  }

  function goBack() {
    setStep((current) => {
      if (current === 4) {
        return 3;
      }
      if (current === 3) {
        return 2;
      }
      if (current === 2) {
        return 1;
      }
      return 1;
    });
  }

  const hasProducts = pedidoState.productos.length > 0;

  function openClearCartConfirm() {
    setShowClearCartConfirm(true);
  }

  function confirmClearCart() {
    clearCart();
    setShowClearCartConfirm(false);
    setUndoItem(null);
  }

  function handleRemoveProduct(productId: number) {
    const item = pedidoState.productos.find((product) => product.id === productId);

    if (!item) {
      return;
    }

    removeProduct(productId);
    setUndoItem(item);

    if (undoTimeoutRef.current) {
      clearTimeout(undoTimeoutRef.current);
    }

    undoTimeoutRef.current = setTimeout(() => {
      setUndoItem(null);
      undoTimeoutRef.current = null;
    }, 7000);
  }

  function undoRemoveProduct() {
    if (!undoItem) {
      return;
    }

    for (let i = 0; i < undoItem.cantidad; i += 1) {
      addItem({
        id: undoItem.id,
        nombre: undoItem.nombre,
        precio: undoItem.precio,
        imagen: undoItem.imagen,
      });
    }

    setUndoItem(null);

    if (undoTimeoutRef.current) {
      clearTimeout(undoTimeoutRef.current);
      undoTimeoutRef.current = null;
    }
  }

  async function handleConfirmOrder() {
    setSubmitError(null);
    setIsSubmitting(true);

    try {
      const clienteResponse = await createCliente(activeTenant, {
        identificacion: pedidoState.cliente.telefono.trim(),
        nombreCompleto: pedidoState.cliente.nombre.trim(),
        telefono: pedidoState.cliente.telefono.trim(),
        indicativo: "+57",
        email: pedidoState.cliente.facturacion.email.trim() || undefined,
      });

      setClienteID(clienteResponse.clienteID);

      const response = await createOrder(activeTenant, {
        clienteID: clienteResponse.clienteID,
        items: pedidoState.productos.map((producto) => ({
          productoID: producto.id,
          cantidad: producto.cantidad,
        })),
        totalBruto: pedidoState.subtotal,
        totalIVA: 0,
        totalNeto: pedidoState.subtotal + costoDomicilio,
        fechaPedido:
          pedidoState.entrega.fecha === "programada" && pedidoState.entrega.fechaProgramada.trim()
            ? `${pedidoState.entrega.fechaProgramada}T00:00:00`
            : undefined,
        version: 1,
      });

      const order = submitOrder(tenantSlug, response.pedidoID);

      if (!order) {
        setSubmitError("No fue posible confirmar el pedido. Intenta de nuevo.");
        return;
      }

      navigate(successPath, { replace: true });
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "No fue posible registrar el pedido en este momento.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="cart-page wizard-page">
      <header className="cart-header wizard-header">
        <div>
          <p className="wizard-kicker">{`Paso ${step} de 4`}</p>
          <h1>Revisa tu pedido</h1>
        </div>
        <Link to={catalogPath} className="back-link back-link-muted">
          Agregar mas flores
        </Link>
      </header>

      <WizardSteps step={step} stepTitles={stepTitles} />

      {step === 1 ? (
        <ProductStep
          hasProducts={hasProducts}
          catalogPath={catalogPath}
          pedidoState={pedidoState}
          totalItems={totalItems}
          onRequestClearCart={openClearCartConfirm}
          decreaseQty={decreaseQty}
          increaseQty={increaseQty}
          removeProduct={handleRemoveProduct}
          deliveryEstimate={deliveryEstimate}
          onNext={goNext}
        />
      ) : null}

      {step === 2 ? (
        <CustomerStep
          pedidoState={pedidoState}
          canContinue={canContinueStep2}
          updateCliente={updateCliente}
          updateFacturacion={updateFacturacion}
          toggleFacturacion={toggleFacturacion}
          onNext={goNext}
          onBack={goBack}
        />
      ) : null}

      {step === 3 ? (
        <DeliveryStep
          pedidoState={pedidoState}
          canContinue={canContinueStep3}
          updateEntrega={updateEntrega}
          onNext={goNext}
          onBack={goBack}
        />
      ) : null}

      {step === 4 ? (
        <ConfirmationStep
          pedidoState={pedidoState}
          costoDomicilio={costoDomicilio}
          isSubmitting={isSubmitting}
          submitError={submitError}
          updateMensaje={updateMensaje}
          updateNotas={updateNotas}
          onBack={goBack}
          onConfirm={() => void handleConfirmOrder()}
        />
      ) : null}

      {showClearCartConfirm ? (
        <div className="confirm-backdrop" role="presentation" onClick={() => setShowClearCartConfirm(false)}>
          <section
            className="confirm-dialog"
            role="dialog"
            aria-modal="true"
            aria-label="Confirmar vaciado del carrito"
            onClick={(event) => event.stopPropagation()}
          >
            <h2>Vaciar carrito</h2>
            <p>{`Se eliminaran ${totalItems} producto(s) del carrito. Esta accion no se puede deshacer.`}</p>
            <div className="confirm-actions">
              <button type="button" className="ghost" onClick={() => setShowClearCartConfirm(false)}>
                Cancelar
              </button>
              <button type="button" className="cta cta-danger" onClick={confirmClearCart}>
                Si, vaciar carrito
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {undoItem ? (
        <aside className="cart-toast" role="status" aria-live="polite">
          <p>{`${undoItem.nombre} se quito del carrito.`}</p>
          <button type="button" className="ghost" onClick={undoRemoveProduct}>
            Deshacer
          </button>
        </aside>
      ) : null}
    </main>
  );
}
