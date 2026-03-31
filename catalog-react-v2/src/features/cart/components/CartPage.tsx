import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { formatCOP } from "../../../shared/utils/currency";
import { createOrder, lookupClienteByTelefono, type CreateOrderRequest } from "../api/publicOrderApi";
import { getCartTotalItems, type AvailableBarrio, type CartItem, type PedidoState, useCartStore } from "../store/cartStore";

type WizardStep = 1 | 2 | 3;
type PaymentMethod = "wompi" | "transferencia" | "efectivo";

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

interface CustomerDeliveryStepProps {
  pedidoState: PedidoState;
  availableBarrios: AvailableBarrio[];
  canContinue: boolean;
  customerLookupStatus: "idle" | "loading" | "found" | "not_found" | "error";
  onLookupByPhone: (phone: string) => void;
  updateCliente: (field: "nombre" | "indicativo" | "telefono", value: string) => void;
  updateFacturacion: (field: "tipoIdentificacion" | "identificacion" | "email", value: string) => void;
  updateEntrega: (field: keyof PedidoState["entrega"], value: string) => void;
  selectBarrio: (barrio: AvailableBarrio | null) => void;
  updateMensaje: (field: "texto" | "firma", value: string) => void;
  updateNotas: (value: string) => void;
  onNext: () => void;
  onBack: () => void;
}

interface ConfirmationStepProps {
  pedidoState: PedidoState;
  costoDomicilio: number;
  totalIVA: number;
  totalFinal: number;
  isSubmitting: boolean;
  submitError: string | null;
  paymentMethod: PaymentMethod;
  acceptedTerms: boolean;
  onPaymentChange: (value: PaymentMethod) => void;
  onAcceptTermsChange: (value: boolean) => void;
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
  const gridStyle = { "--wizard-columns": stepTitles.length } as CSSProperties;

  return (
    <section className="wizard-steps" aria-label="Progreso del pedido" style={gridStyle}>
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
              Continuar
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

function CustomerDeliveryStep({
  pedidoState,
  availableBarrios,
  canContinue,
  customerLookupStatus,
  onLookupByPhone,
  updateCliente,
  updateFacturacion,
  updateEntrega,
  selectBarrio,
  updateMensaje,
  updateNotas,
  onNext,
  onBack,
}: Readonly<CustomerDeliveryStepProps>) {
  const facturacion = pedidoState.cliente.facturacion;
  const isDomicilio = pedidoState.entrega.metodo === "domicilio";
  const [barrioQuery, setBarrioQuery] = useState(pedidoState.entrega.barrio);
  const [showBarrioOptions, setShowBarrioOptions] = useState(false);

  useEffect(() => {
    setBarrioQuery(pedidoState.entrega.barrio);
  }, [pedidoState.entrega.barrio]);

  const filteredBarrios = useMemo(() => {
    const query = barrioQuery.trim().toLowerCase();

    if (!query) {
      return availableBarrios.slice(0, 30);
    }

    return availableBarrios.filter((item) => item.nombre.toLowerCase().includes(query)).slice(0, 30);
  }, [availableBarrios, barrioQuery]);

  return (
    <section className="wizard-panel" aria-label="Informacion de contacto y entrega">
      <div className="wizard-panel-head">
        <div>
          <h2>2. Datos y entrega</h2>
          <p>Te pedimos solo lo necesario para entregar tu pedido sin demoras.</p>
        </div>
      </div>

      <section className="checkout-card">
        <div className="checkout-section-head">
          <h3>Contacto principal</h3>
          <p>Usaremos estos datos para confirmar tu pedido por WhatsApp.</p>
        </div>

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
          <span>Indicativo</span>
          <input
            type="text"
            value={pedidoState.cliente.indicativo ?? ""}
            onChange={(event) => updateCliente("indicativo", event.target.value)}
            placeholder="+57"
            autoComplete="tel-country-code"
            required
          />
        </label>

        <label className="checkout-field">
          <span>Telefono</span>
          <input
            type="tel"
            inputMode="tel"
            value={pedidoState.cliente.telefono}
            onChange={(event) => updateCliente("telefono", event.target.value)}
            onBlur={(event) => onLookupByPhone(event.target.value)}
            placeholder="3001234567"
            autoComplete="tel"
            required
          />
          {customerLookupStatus === "loading" ? <small className="checkout-field-help">Buscando cliente...</small> : null}
          {customerLookupStatus === "found" ? (
            <small className="checkout-field-help">Cliente encontrado. Datos autocompletados.</small>
          ) : null}
          {customerLookupStatus === "not_found" ? (
            <small className="checkout-field-help">No encontramos cliente con ese telefono.</small>
          ) : null}
          {customerLookupStatus === "error" ? (
            <small className="checkout-field-help">No se pudo consultar el cliente en este momento.</small>
          ) : null}
        </label>
      </section>

      <section className="checkout-card">
        <div className="checkout-section-head">
          <h3>Entrega</h3>
          <p>Elige como quieres recibir tu pedido.</p>
        </div>

        <div className="delivery-options" role="radiogroup" aria-label="Metodo de entrega">
          <button
            type="button"
            className={`delivery-option ${isDomicilio ? "delivery-option-active" : ""}`}
            onClick={() => updateEntrega("metodo", "domicilio")}
            aria-pressed={isDomicilio}
          >
            <span>Domicilio</span>
            <small>Lo enviamos a una direccion</small>
          </button>
          <button
            type="button"
            className={`delivery-option ${pedidoState.entrega.metodo === "recoger" ? "delivery-option-active" : ""}`}
            onClick={() => updateEntrega("metodo", "recoger")}
            aria-pressed={pedidoState.entrega.metodo === "recoger"}
          >
            <span>Recoger en tienda</span>
            <small>Pasas por el punto de venta</small>
          </button>
        </div>

        <div className="delivery-fields">
          <label className="checkout-field">
            <span>{isDomicilio ? "Nombre de quien recibe" : "Nombre de quien recoge"}</span>
            <input
              type="text"
              value={pedidoState.entrega.nombreDestinatario}
              onChange={(event) => updateEntrega("nombreDestinatario", event.target.value)}
              placeholder="Nombre y apellido"
              autoComplete="name"
              required
            />
          </label>

          {isDomicilio ? (
            <>
              <label className="checkout-field">
                <span>Direccion</span>
                <textarea
                  value={pedidoState.entrega.direccion}
                  onChange={(event) => updateEntrega("direccion", event.target.value)}
                  placeholder="Calle, numero, apartamento, referencia"
                  rows={3}
                  autoComplete="street-address"
                  required
                />
              </label>

              <label className="checkout-field">
                <span>Complemento (opcional)</span>
                <input
                  type="text"
                  value={pedidoState.entrega.complemento}
                  onChange={(event) => updateEntrega("complemento", event.target.value)}
                  placeholder="Torre, apto, piso, interior"
                />
              </label>

              <label className="checkout-field">
                <span>Barrio</span>
                <div className="barrio-combobox">
                  <input
                    type="text"
                    value={barrioQuery}
                    onFocus={() => setShowBarrioOptions(true)}
                    onBlur={() => {
                      window.setTimeout(() => setShowBarrioOptions(false), 120);
                    }}
                    onChange={(event) => {
                      const value = event.target.value;
                      setBarrioQuery(value);
                      updateEntrega("barrio", value);

                      const exactMatch = availableBarrios.find(
                        (item) => item.nombre.toLowerCase() === value.trim().toLowerCase(),
                      );
                      selectBarrio(exactMatch ?? null);
                    }}
                    placeholder="Busca y selecciona un barrio"
                    autoComplete="off"
                  />
                  {showBarrioOptions && filteredBarrios.length > 0 ? (
                    <div className="barrio-options" role="listbox" aria-label="Barrios disponibles">
                      {filteredBarrios.map((barrio) => (
                        <button
                          key={`${barrio.id}-${barrio.nombre}`}
                          type="button"
                          className="barrio-option"
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => {
                            selectBarrio(barrio);
                            setBarrioQuery(barrio.nombre);
                            setShowBarrioOptions(false);
                          }}
                        >
                          <span>{barrio.nombre}</span>
                          <strong>{formatCOP(barrio.costoDomicilio)}</strong>
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
                <small className="checkout-field-help">
                  {pedidoState.entrega.costoDomicilio > 0
                    ? `Envio para ${pedidoState.entrega.barrio}: ${formatCOP(pedidoState.entrega.costoDomicilio)}`
                    : "Selecciona un barrio para calcular el costo de envio."}
                </small>
              </label>
            </>
          ) : null}

          <section className="delivery-date-block" aria-label="Fecha de entrega">
            <div className="delivery-date-head">
              <strong>Momento de entrega</strong>
              <p>Selecciona cuando quieres recibir o recoger tu pedido.</p>
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
          </section>
        </div>
      </section>

      <section className="checkout-card">
        <div className="checkout-section-head">
          <h3>Mensaje para la tarjeta (opcional)</h3>
          <p>Puedes dejar un mensaje corto y firma.</p>
        </div>

        <label className="checkout-field">
          <span>Mensaje</span>
          <textarea
            value={pedidoState.mensaje.texto}
            onChange={(event) => updateMensaje("texto", event.target.value)}
            placeholder="Escribe un mensaje breve"
            rows={2}
          />
        </label>

        <label className="checkout-field">
          <span>Firma (opcional)</span>
          <input
            type="text"
            value={pedidoState.mensaje.firma}
            onChange={(event) => updateMensaje("firma", event.target.value)}
            placeholder="De parte de..."
          />
        </label>

        <label className="checkout-field">
          <span>Notas del pedido (opcional)</span>
          <textarea
            value={pedidoState.notas}
            onChange={(event) => updateNotas(event.target.value)}
            placeholder="Indicaciones adicionales"
            rows={2}
          />
        </label>
      </section>

      <section className="checkout-card">
        <div className="checkout-section-head">
          <h3>Datos de facturacion</h3>
          <p>La factura se genera siempre. La identificacion es opcional.</p>
        </div>

        <div className="delivery-fields">
          <label className="checkout-field">
            <span>Tipo de identificacion (opcional)</span>
            <select
              value={facturacion.tipoIdentificacion}
              onChange={(event) =>
                updateFacturacion("tipoIdentificacion", event.target.value as "cedula" | "nit" | "pasaporte" | "")
              }
            >
              <option value="">No especificar</option>
              <option value="cedula">Cedula</option>
              <option value="nit">NIT</option>
              <option value="pasaporte">Pasaporte</option>
            </select>
          </label>

          <label className="checkout-field">
            <span>Identificacion</span>
            <input
              type="text"
              value={facturacion.identificacion}
              onChange={(event) => updateFacturacion("identificacion", event.target.value)}
              placeholder="Numero de documento (opcional)"
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
        </div>
      </section>

      <div className="wizard-actions wizard-actions-sticky">
        <button type="button" className="ghost" onClick={onBack}>
          Volver
        </button>
        <button type="button" className="cta" onClick={onNext} disabled={!canContinue}>
          Continuar
        </button>
      </div>
    </section>
  );
}

function ConfirmationStep({
  pedidoState,
  costoDomicilio,
  totalIVA,
  totalFinal,
  isSubmitting,
  submitError,
  paymentMethod,
  acceptedTerms,
  onPaymentChange,
  onAcceptTermsChange,
  onBack,
  onConfirm,
}: Readonly<ConfirmationStepProps>) {
  const [copiedAccount, setCopiedAccount] = useState<"" | "nequi" | "daviplata">("");
  const paymentOptions: Array<{ value: PaymentMethod; title: string; caption: string }> = [
    { value: "wompi", title: "WOMPI", caption: "Pago online seguro con tarjeta y PSE" },
    { value: "transferencia", title: "Transferencia", caption: "Confirma con comprobante por WhatsApp" },
    { value: "efectivo", title: "Efectivo", caption: "Pago contra entrega (si aplica)" },
  ];

  return (
    <section className="wizard-panel" aria-label="Resumen final del pedido">
      <div className="wizard-panel-head">
        <div>
          <h2>3. Confirmar pedido</h2>
          <p>Revisa el resumen, elige tu forma de pago y confirma.</p>
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
              <span>Envio</span>
              <strong>{formatCOP(costoDomicilio)}</strong>
            </p>
            {totalIVA > 0 ? (
              <p>
                <span>IVA (19%)</span>
                <strong>{formatCOP(totalIVA)}</strong>
              </p>
            ) : null}
            <p>
              <span>Total a pagar hoy</span>
              <strong>{formatCOP(totalFinal)}</strong>
            </p>
          </div>
        </section>

        <aside className="checkout-card order-meta-card">
          <h2>Datos de entrega</h2>
          <div className="order-meta-list">
            <p>
              <span>Cliente</span>
              <strong>{pedidoState.cliente.nombre}</strong>
            </p>
            <p>
              <span>Telefono</span>
              <strong>{`${pedidoState.cliente.indicativo ?? "+57"} ${pedidoState.cliente.telefono}`}</strong>
            </p>
            <p>
              <span>Entrega</span>
              <strong>{pedidoState.entrega.metodo === "domicilio" ? "Domicilio" : "Recoger en tienda"}</strong>
            </p>
            <p>
              <span>Recibe</span>
              <strong>{pedidoState.entrega.nombreDestinatario}</strong>
            </p>
            {pedidoState.entrega.metodo === "domicilio" ? (
              <p>
                <span>Direccion</span>
                <strong>{pedidoState.entrega.direccion}</strong>
              </p>
            ) : null}
            <p>
              <span>Fecha</span>
              <strong>
                {pedidoState.entrega.fecha === "hoy" ? "Hoy" : `Programada: ${pedidoState.entrega.fechaProgramada}`}
              </strong>
            </p>
          </div>
        </aside>
      </div>

      <section className="checkout-card">
        <h2>Metodo de pago</h2>
        <div className="payment-methods" role="radiogroup" aria-label="Metodo de pago">
          {paymentOptions.map((option) => {
            const isTransfer = option.value === "transferencia";

            return (
              <div key={option.value} className="payment-option-block">
                <button
                  type="button"
                  className={`payment-option ${paymentMethod === option.value ? "payment-option-active" : ""}`}
                  onClick={() => onPaymentChange(option.value)}
                  aria-pressed={paymentMethod === option.value}
                >
                  <strong>{option.title}</strong>
                  <small>{option.caption}</small>
                </button>

                {isTransfer && paymentMethod === "transferencia" ? (
                  <section className="transfer-inline-card">
                    <h3>Datos para transferir</h3>
                    <p>1. Realiza la transferencia. 2. Finaliza tu pedido. 3. Envia el comprobante en la siguiente pantalla.</p>
                    <div className="payment-data-list">
                      <p>
                        <span>Nequi</span>
                        <span className="payment-data-actions">
                          <strong>3007014434</strong>
                          <button
                            type="button"
                            className="ghost payment-copy-button"
                            onClick={async () => {
                              try {
                                await navigator.clipboard.writeText("3007014434");
                                setCopiedAccount("nequi");
                              } catch {
                                setCopiedAccount("");
                              }
                            }}
                          >
                            {copiedAccount === "nequi" ? "Copiado" : "Copiar"}
                          </button>
                        </span>
                      </p>
                      <p>
                        <span>Daviplata</span>
                        <span className="payment-data-actions">
                          <strong>3128896624</strong>
                          <button
                            type="button"
                            className="ghost payment-copy-button"
                            onClick={async () => {
                              try {
                                await navigator.clipboard.writeText("3128896624");
                                setCopiedAccount("daviplata");
                              } catch {
                                setCopiedAccount("");
                              }
                            }}
                          >
                            {copiedAccount === "daviplata" ? "Copiado" : "Copiar"}
                          </button>
                        </span>
                      </p>
                    </div>
                    <p className="transfer-inline-helper">
                      Al finalizar te mostraremos el boton para enviar comprobante por WhatsApp con tu codigo de pedido.
                    </p>
                  </section>
                ) : null}
              </div>
            );
          })}
        </div>

        <label className="checkout-field checkbox-field">
          <span className="checkbox-label-inline">
            <input
              type="checkbox"
              checked={acceptedTerms}
              onChange={(event) => onAcceptTermsChange(event.target.checked)}
            />
            <span>Acepto terminos y confirmo que los datos son correctos.</span>
          </span>
        </label>
      </section>

      {submitError ? <p className="checkout-error wizard-submit-error">{submitError}</p> : null}

      <div className="wizard-actions wizard-actions-sticky">
        <button type="button" className="ghost" onClick={onBack} disabled={isSubmitting}>
          Volver
        </button>
        <button
          type="button"
          className="cta"
          onClick={onConfirm}
          disabled={isSubmitting || !acceptedTerms}
        >
          {isSubmitting ? "Confirmando..." : "Finalizar pedido"}
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
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("wompi");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [customerLookupStatus, setCustomerLookupStatus] = useState<"idle" | "loading" | "found" | "not_found" | "error">(
    "idle",
  );
  const pedidoState = useCartStore((state) => state.pedidoState);
  const addItem = useCartStore((state) => state.addItem);
  const increaseQty = useCartStore((state) => state.increaseQty);
  const decreaseQty = useCartStore((state) => state.decreaseQty);
  const removeProduct = useCartStore((state) => state.removeProduct);
  const clearCart = useCartStore((state) => state.clearCart);
  const updateCliente = useCartStore((state) => state.updateCliente);
  const updateFacturacion = useCartStore((state) => state.updateFacturacion);
  const updateEntrega = useCartStore((state) => state.updateEntrega);
  const selectBarrio = useCartStore((state) => state.selectBarrio);
  const updateMensaje = useCartStore((state) => state.updateMensaje);
  const updateNotas = useCartStore((state) => state.updateNotas);
  const submitOrder = useCartStore((state) => state.submitOrder);
  const availableBarrios = useCartStore((state) => state.availableBarrios);
  const undoTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasPrefilledRecipientRef = useRef(false);

  const totalItems = getCartTotalItems(pedidoState.productos);
  const costoDomicilio = pedidoState.entrega.metodo === "domicilio" ? pedidoState.entrega.costoDomicilio : 0;
  const catalogPath = `/catalogo/${tenantSlug}`;
  const successPath = `/catalogo/${tenantSlug}/pedido-exitoso`;
  const activeTenant = tenantSlug;
  const deliveryEstimate = pedidoState.entrega.metodo === "domicilio" ? pedidoState.entrega.costoDomicilio : 0;
  const hasProducts = pedidoState.productos.length > 0;
  const safeIndicativo = (pedidoState.cliente.indicativo ?? "").trim();
  const aplicaIvaNit =
    activeTenant.trim().toLowerCase() === "flora" && pedidoState.cliente.facturacion.tipoIdentificacion === "nit";
  const totalIVA = aplicaIvaNit ? Math.round(pedidoState.subtotal * 0.19) : 0;
  const totalFinal = pedidoState.subtotal + costoDomicilio + totalIVA;

  const canContinueStep2Base =
    pedidoState.cliente.nombre.trim().length > 1 &&
    pedidoState.cliente.telefono.trim().length >= 7 &&
    pedidoState.entrega.nombreDestinatario.trim().length > 1;
  const canContinueStep2Billing = pedidoState.cliente.facturacion.email.trim().length > 4;
  const canContinueStep2Fecha =
    pedidoState.entrega.fecha === "hoy" || pedidoState.entrega.fechaProgramada.trim().length > 0;
  const canContinueStep2Address = pedidoState.entrega.metodo !== "domicilio" || pedidoState.entrega.direccion.trim().length > 5;
  const canContinueStep2Barrio =
    pedidoState.entrega.metodo !== "domicilio" ||
    (pedidoState.entrega.barrio.trim().length > 1 && pedidoState.entrega.costoDomicilio > 0);
  const canContinueStep2 =
    canContinueStep2Base && canContinueStep2Billing && canContinueStep2Fecha && canContinueStep2Address && canContinueStep2Barrio;
  const canFinalizeOrder = acceptedTerms;

  const stepTitles = useMemo(() => ["Tu carrito", "Datos y entrega", "Confirmar"], []);

  useEffect(() => {
    return () => {
      if (undoTimeoutRef.current) {
        clearTimeout(undoTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!safeIndicativo) {
      updateCliente("indicativo", "+57");
    }
  }, [safeIndicativo, updateCliente]);

  useEffect(() => {
    if (hasPrefilledRecipientRef.current) {
      return;
    }

    if (!pedidoState.entrega.nombreDestinatario.trim() && pedidoState.cliente.nombre.trim()) {
      updateEntrega("nombreDestinatario", pedidoState.cliente.nombre.trim());
      hasPrefilledRecipientRef.current = true;
    }
  }, [pedidoState.cliente.nombre, pedidoState.entrega.nombreDestinatario, updateEntrega]);

  useEffect(() => {
    if (pedidoState.entrega.nombreDestinatario.trim()) {
      hasPrefilledRecipientRef.current = true;
    }
  }, [pedidoState.entrega.nombreDestinatario]);

  useEffect(() => {
    if (!pedidoState.cliente.facturacion.requiereFactura) {
      useCartStore.setState((state) => ({
        pedidoState: {
          ...state.pedidoState,
          cliente: {
            ...state.pedidoState.cliente,
            facturacion: {
              ...state.pedidoState.cliente.facturacion,
              requiereFactura: true,
            },
          },
        },
      }));
    }
  }, [pedidoState.cliente.facturacion.requiereFactura]);

  useEffect(() => {
    if (step > 1 && !hasProducts) {
      setStep(1);
    }
  }, [hasProducts, step]);

  function goNext() {
    setStep((current) => (current >= 3 ? 3 : ((current + 1) as WizardStep)));
  }

  function goBack() {
    setStep((current) => (current <= 1 ? 1 : ((current - 1) as WizardStep)));
  }

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

  async function handleLookupByPhone(phone: string) {
    const normalizedPhone = phone.trim();

    if (normalizedPhone.length < 7) {
      setCustomerLookupStatus("idle");
      return;
    }

    setCustomerLookupStatus("loading");

    try {
      const result = await lookupClienteByTelefono(activeTenant, normalizedPhone, safeIndicativo || "+57");

      if (!result) {
        setCustomerLookupStatus("not_found");
        return;
      }

      if (result.nombre) {
        updateCliente("nombre", result.nombre);
      }

      if (result.indicativo) {
        updateCliente("indicativo", result.indicativo);
      }

      if (result.email) {
        updateFacturacion("email", result.email);
      }

      if (result.identificacion) {
        updateFacturacion("identificacion", result.identificacion);
      }

      if (result.tipoIdentificacion) {
        updateFacturacion("tipoIdentificacion", result.tipoIdentificacion);
      }

      setCustomerLookupStatus("found");
    } catch {
      setCustomerLookupStatus("error");
    }
  }

  async function handleConfirmOrder() {
    if (!canFinalizeOrder) {
      setSubmitError("Debes aceptar los terminos para confirmar el pedido.");
      return;
    }

    setSubmitError(null);
    setIsSubmitting(true);

    try {
      const fallbackIdentificacion =
        pedidoState.cliente.facturacion.identificacion.trim() || pedidoState.cliente.telefono.trim();
      const facturaEsNIT = pedidoState.cliente.facturacion.tipoIdentificacion === "nit";
      const facturaEsPasaporte = pedidoState.cliente.facturacion.tipoIdentificacion === "pasaporte";
      const tipoIdentFallback = facturaEsNIT ? "nit" : facturaEsPasaporte ? "pasaporte" : "cedula";
      const tipoIdentCanonical = facturaEsNIT ? "NIT" : facturaEsPasaporte ? "PAS" : "CC";
      const telefonoLimpio = pedidoState.cliente.telefono.trim();
      const indicativo = safeIndicativo || "+57";
      const telefonoCompleto = telefonoLimpio ? `${indicativo}${telefonoLimpio}` : "";
      const email = pedidoState.cliente.facturacion.email.trim();

      if (!fallbackIdentificacion) {
        setSubmitError("No fue posible validar los datos del cliente. Intenta de nuevo.");
        return;
      }

      const orderPayload: CreateOrderRequest = {
        items: pedidoState.productos.map((producto) => ({
          productoID: producto.id,
          cantidad: producto.cantidad,
        })),
        totalBruto: pedidoState.subtotal,
        totalIVA,
        totalNeto: totalFinal,
        fechaPedido:
          pedidoState.entrega.fecha === "programada" && pedidoState.entrega.fechaProgramada.trim()
            ? `${pedidoState.entrega.fechaProgramada}T00:00:00`
            : undefined,
        version: paymentMethod === "efectivo" ? 2 : 1,
        metodoPago: paymentMethod,
        metodo_pago: paymentMethod,
        nombre: pedidoState.cliente.nombre.trim(),
        nombreCliente: pedidoState.cliente.nombre.trim(),
        nombreCompleto: pedidoState.cliente.nombre.trim(),
        tipoIdent: tipoIdentFallback,
        tipoident: tipoIdentFallback,
        tipoIdentificacion: tipoIdentFallback,
        tipo_ident: tipoIdentCanonical,
        tipoDocumento: tipoIdentCanonical,
        tipo_documento: tipoIdentCanonical,
        identificacion: fallbackIdentificacion,
        indicativo,
        telefono: telefonoLimpio,
        telefonoCompleto,
        telefono_completo: telefonoCompleto,
        email,
        correo: email,
        correoElectronico: email,
        correo_electronico: email,
        ...(facturaEsNIT
          ? { nit: fallbackIdentificacion }
          : facturaEsPasaporte
            ? { pasaporte: fallbackIdentificacion, passport: fallbackIdentificacion }
            : { cedula: fallbackIdentificacion }),
      };

      if (import.meta.env.DEV) {
        console.info("[checkout] Payload /pedidos", orderPayload);
      }

      const response = await createOrder(activeTenant, orderPayload);

      const codigoPedido = response.codigo_pedido ?? response.codigoPedido ?? null;
      const order = submitOrder(tenantSlug, response.pedidoID, codigoPedido, totalFinal, totalIVA, paymentMethod);

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
          <p className="wizard-kicker">{`Paso ${step} de 3`}</p>
          <h1>Revisa y confirma tu pedido</h1>
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
        <CustomerDeliveryStep
          pedidoState={pedidoState}
          availableBarrios={availableBarrios}
          canContinue={canContinueStep2}
          customerLookupStatus={customerLookupStatus}
          onLookupByPhone={(phone) => void handleLookupByPhone(phone)}
          updateCliente={updateCliente}
          updateFacturacion={updateFacturacion}
          updateEntrega={updateEntrega}
          selectBarrio={selectBarrio}
          updateMensaje={updateMensaje}
          updateNotas={updateNotas}
          onNext={goNext}
          onBack={goBack}
        />
      ) : null}

      {step === 3 ? (
        <ConfirmationStep
          pedidoState={pedidoState}
          costoDomicilio={costoDomicilio}
          totalIVA={totalIVA}
          totalFinal={totalFinal}
          isSubmitting={isSubmitting}
          submitError={submitError}
          paymentMethod={paymentMethod}
          acceptedTerms={acceptedTerms}
          onPaymentChange={setPaymentMethod}
          onAcceptTermsChange={setAcceptedTerms}
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
