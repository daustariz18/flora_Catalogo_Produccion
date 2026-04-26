import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { countryCodes } from "../../../shared/utils/countryCodes";
import { Link, useNavigate, useParams } from "react-router-dom";
import { formatCOP } from "../../../shared/utils/currency";
import { createOrder, lookupClienteByTelefono, type CreateOrderRequest } from "../api/publicOrderApi";
import { useCartStore } from "../store/cartStore";
import type { PedidoState, AvailableBarrio } from "../store/cartStore";


type WizardStep = 1 | 2 | 3 | 4;
type PaymentMethod = "wompi" | "transferencia" | "efectivo";

interface WizardStepsProps {
  step: WizardStep;
  stepTitles: string[];
}

interface CustomerStepProps {
  pedidoState: PedidoState;
  customerLookupStatus: "idle" | "loading" | "found" | "not_found" | "error";
  onLookupByPhone: (phone: string) => void;
  updateCliente: (field: "nombre" | "indicativo" | "telefono", value: string) => void;
  updateFacturacion: (field: "tipoIdentificacion" | "identificacion" | "email", value: string) => void;
  canContinue: boolean;
  onNext: () => void;
  onBack: () => void;
}

interface DeliveryStepProps {
  pedidoState: PedidoState;
  availableBarrios: AvailableBarrio[];
  canContinue: boolean;
  updateEntrega: (field: keyof PedidoState["entrega"], value: string) => void;
  selectBarrio: (barrio: AvailableBarrio | null) => void;
  onNext: () => void;
  onBack: () => void;
}

interface MessageStepProps {
  pedidoState: PedidoState;
  canContinue: boolean;
  updateMensaje: (field: keyof PedidoState["mensaje"], value: string) => void;
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

function formatLocalDateISO(date: Date = new Date()): string {
  const offsetMinutes = date.getTimezoneOffset();
  const localDate = new Date(date.getTime() - offsetMinutes * 60_000);
  return localDate.toISOString().slice(0, 10);
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

function CustomerStep({
  pedidoState,
  customerLookupStatus,
  onLookupByPhone,
  updateCliente,
  updateFacturacion,
  canContinue,
  onNext,
  onBack,
}: Readonly<CustomerStepProps>) {
  const facturacion = pedidoState.cliente.facturacion;
  const clienteEncontrado = customerLookupStatus === "found";
  const estadoCliente =
    customerLookupStatus === "found"
      ? "Cliente encontrado"
      : customerLookupStatus === "loading"
        ? "Buscando cliente"
        : customerLookupStatus === "not_found"
          ? "Nuevo cliente"
          : customerLookupStatus === "error"
            ? "Sin conexión"
            : "Nuevo cliente";

  return (
    <section className="wizard-panel" aria-label="Informacion de contacto">
      <div className="wizard-panel-head">
        <div>
          <h2>1. Información del cliente</h2>
          <p>Confirmamos tu identidad y el correo donde se respaldará el pedido.</p>
        </div>
      </div>

      <section className="checkout-card checkout-card-compact">
        <div className="compact-card-head">
          <h3>Información del cliente</h3>
          <span className={`compact-badge ${clienteEncontrado ? "compact-badge-success" : "compact-badge-muted"}`}>
            {estadoCliente}
          </span>
        </div>

        <div className="compact-form-grid compact-form-grid-top">
          <label className="checkout-field">
            <span>Teléfono WhatsApp</span>
            <div className="phone-input phone-input-compact">
              <select
                value={pedidoState.cliente.indicativo ?? "+57"}
                onChange={(event) => updateCliente("indicativo", event.target.value)}
                autoComplete="tel-country-code"
              >
                {countryCodes.map(({ code, name }) => (
                  <option key={code + name} value={code} title={`${name} (${code})`}>
                    {name} {code}
                  </option>
                ))}
              </select>
              <input
                type="tel"
                inputMode="tel"
                value={pedidoState.cliente.telefono}
                onChange={(event) => updateCliente("telefono", event.target.value)}
                onBlur={(event) => onLookupByPhone(event.target.value)}
                placeholder="3128896624"
                autoComplete="tel"
                required
              />
            </div>
            {customerLookupStatus === "loading" ? <small className="checkout-field-help">Buscando cliente...</small> : null}
            {customerLookupStatus === "found" ? (
              <small className="checkout-field-help">Cliente encontrado. Datos autocompletados.</small>
            ) : null}
            {customerLookupStatus === "not_found" ? (
              <small className="checkout-field-help">No encontramos cliente con ese teléfono.</small>
            ) : null}
            {customerLookupStatus === "error" ? (
              <small className="checkout-field-help">No se pudo consultar el cliente en este momento.</small>
            ) : null}
          </label>

          <label className="checkout-field">
            <span>Nombre completo</span>
            <input
              type="text"
              value={pedidoState.cliente.nombre}
              onChange={(event) => updateCliente("nombre", event.target.value)}
              placeholder="Diego Ustariz"
              autoComplete="name"
              required
            />
          </label>

          <label className="checkout-field">
            <span>Tipo de identificación</span>
            <select
              value={facturacion.tipoIdentificacion || "cedula"}
              onChange={(event) =>
                updateFacturacion("tipoIdentificacion", event.target.value as "cedula" | "nit" | "pasaporte" | "")
              }
            >
              <option value="cedula">Cédula</option>
              <option value="nit">NIT</option>
              <option value="pasaporte">Pasaporte</option>
            </select>
          </label>

          <label className="checkout-field">
            <span>Identificación</span>
            <input
              type="text"
              value={facturacion.identificacion}
              onChange={(event) => updateFacturacion("identificacion", event.target.value)}
              placeholder="1062397422"
              inputMode="numeric"
            />
          </label>
        </div>

        <div className="compact-form-grid compact-form-grid-bottom">
          <label className="checkout-field checkout-field-wide">
            <span>Correo electrónico (opcional)</span>
            <input
              type="email"
              value={facturacion.email}
              onChange={(event) => updateFacturacion("email", event.target.value)}
              placeholder="diusme@gmail.com"
              autoComplete="email"
            />
          </label>
        </div>
      </section>

      <div className="wizard-actions wizard-actions-sticky">
        <button type="button" className="ghost wizard-action-secondary" onClick={onBack}>
          Regresar
        </button>
        <button type="button" className="cta wizard-action-primary" onClick={onNext} disabled={!canContinue}>
          Siguiente
        </button>
      </div>
    </section>
  );
}

function DeliveryStep({
  pedidoState,
  availableBarrios,
  canContinue,
  updateEntrega,
  selectBarrio,
  onNext,
  onBack,
}: Readonly<DeliveryStepProps>) {
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
    <section className="wizard-panel" aria-label="Informacion de entrega y mensaje">
      <div className="wizard-panel-head">
        <div>
          <h2>2. Información de entrega</h2>
          <p>Organiza cómo recibirá el pedido y revisa la fecha de entrega.</p>
        </div>
      </div>

      <section className="checkout-card checkout-card-compact">
        <div className="compact-card-head">
          <h3>Información de entrega</h3>
        </div>

        <div className="delivery-options delivery-options-compact" role="radiogroup" aria-label="Metodo de entrega">
          <button
            type="button"
            className={`delivery-option delivery-option-compact ${isDomicilio ? "delivery-option-active" : ""}`}
            onClick={() => updateEntrega("metodo", "domicilio")}
            aria-pressed={isDomicilio}
          >
            <span>Domicilio</span>
          </button>
          <button
            type="button"
            className={`delivery-option delivery-option-compact ${pedidoState.entrega.metodo === "recoger" ? "delivery-option-active" : ""}`}
            onClick={() => updateEntrega("metodo", "recoger")}
            aria-pressed={pedidoState.entrega.metodo === "recoger"}
          >
            <span>Recoger en tienda</span>
          </button>
        </div>

        <div className="compact-form-grid compact-form-grid-delivery">
          <label className="checkout-field">
            <span>Nombre del destinatario *</span>
            <input
              type="text"
              value={pedidoState.entrega.nombreDestinatario}
              onChange={(event) => updateEntrega("nombreDestinatario", event.target.value)}
              placeholder="Ej: Maria Perez"
              autoComplete="name"
              required
            />
          </label>

          <label className="checkout-field">
            <span>Teléfono destino</span>
            <div className="phone-input phone-input-compact">
              <span className="phone-prefix">+57</span>
              <input
                type="tel"
                value={pedidoState.entrega.telefono}
                onChange={(event) => updateEntrega("telefono", event.target.value)}
                placeholder="3001234567"
                autoComplete="tel"
              />
            </div>
          </label>

          {isDomicilio ? (
            <>
              <label className="checkout-field">
                <span>Dirección principal *</span>
                <input
                  type="text"
                  value={pedidoState.entrega.direccion}
                  onChange={(event) => updateEntrega("direccion", event.target.value)}
                  placeholder="Ej: Calle 72 #45-32"
                  autoComplete="street-address"
                  required
                />
              </label>

              <label className="checkout-field">
                <span>Complemento de dirección</span>
                <input
                  type="text"
                  value={pedidoState.entrega.complemento}
                  onChange={(event) => updateEntrega("complemento", event.target.value)}
                  placeholder="Ej: Torre 2 Apto 502"
                />
                <small className="checkout-field-help">Apartamento, torre, casa u oficina</small>
              </label>

              <label className="checkout-field checkout-field-wide">
                <span>Barrio de entrega *</span>
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
                    placeholder="Ej: Miramar"
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
                    ? `Costo de domicilio: ${formatCOP(pedidoState.entrega.costoDomicilio)}`
                    : "Costo de domicilio: $0"}
                </small>
              </label>
            </>
          ) : null}
        </div>

        <section className="delivery-date-block delivery-date-block-compact" aria-label="Fecha de entrega">
          <div className="delivery-date-head">
            <strong>Fecha de entrega *</strong>
          </div>

          <div className="delivery-date-grid">
            <label className="checkout-field">
              <span>Fecha</span>
              <input
                type="date"
                value={pedidoState.entrega.fechaProgramada || new Date().toISOString().slice(0, 10)}
                onChange={(event) => {
                  updateEntrega("fecha", "programada");
                  updateEntrega("fechaProgramada", event.target.value);
                }}
                required
              />
            </label>

            <label className="checkout-field">
              <span>Rango de hora (opcional)</span>
              <select defaultValue="">
                <option value="">Seleccione...</option>
                <option value="Mañana (8am - 12pm)">Mañana (8am - 12pm)</option>
                <option value="Tarde (2pm - 6pm)">Tarde (2pm - 6pm)</option>
              </select>
            </label>
          </div>
        </section>
      </section>

      <div className="wizard-actions wizard-actions-sticky">
        <button type="button" className="ghost wizard-action-secondary" onClick={onBack}>
          Volver
        </button>
        <button type="button" className="cta wizard-action-primary" onClick={onNext} disabled={!canContinue}>
          Continuar
        </button>
      </div>
    </section>
  );
}

function MessageStep({
  pedidoState,
  canContinue,
  updateMensaje,
  updateNotas,
  onNext,
  onBack,
}: Readonly<MessageStepProps>) {
  return (
    <section className="wizard-panel" aria-label="Mensaje del pedido">
      <div className="wizard-panel-head">
        <div>
          <h2>3. Mensaje</h2>
          <p>Escribe el mensaje de la tarjeta y las observaciones especiales del pedido.</p>
        </div>
      </div>

      <section className="checkout-card checkout-card-compact checkout-card-message">
        <div className="compact-card-head">
          <h3>Mensaje para la tarjeta</h3>
        </div>

        <div className="message-card-grid">
          <label className="checkout-field checkout-field-wide">
            <textarea
              className="checkout-textarea checkout-textarea-message"
              value={pedidoState.mensaje.texto}
              onChange={(event) => updateMensaje("texto", event.target.value)}
              placeholder="Escribe tu mensaje aquí..."
              rows={5}
            />
          </label>

          <label className="checkout-field checkout-field-wide">
            <span>Firma</span>
            <input
              type="text"
              value={pedidoState.mensaje.firma}
              onChange={(event) => updateMensaje("firma", event.target.value)}
              placeholder="Ej: Con amor, tu familia"
            />
          </label>
        </div>
      </section>

      <section className="checkout-card checkout-card-compact checkout-card-message">
        <div className="compact-card-head">
          <h3>Observaciones Especiales</h3>
        </div>

        <label className="checkout-field checkout-field-wide">
          <textarea
            className="checkout-textarea checkout-textarea-notes"
            value={pedidoState.notas}
            onChange={(event) => updateNotas(event.target.value)}
            placeholder="Notas adicionales para el pedido (opcional)."
            rows={5}
          />
        </label>
      </section>

      <div className="wizard-actions wizard-actions-sticky">
        <button type="button" className="ghost wizard-action-secondary" onClick={onBack}>
          Anterior
        </button>
        <button type="button" className="cta wizard-action-primary" onClick={onNext} disabled={!canContinue}>
          Siguiente
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
          <h2>4. Confirmar pedido</h2>
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
            <p>
              <span>Mensaje</span>
              <strong>{pedidoState.mensaje.texto || "Sin mensaje"}</strong>
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
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("wompi");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [customerLookupStatus, setCustomerLookupStatus] = useState<"idle" | "loading" | "found" | "not_found" | "error">(
    "idle",
  );
  const pedidoState = useCartStore((state) => state.pedidoState);
  const updateCliente = useCartStore((state) => state.updateCliente);
  const updateFacturacion = useCartStore((state) => state.updateFacturacion);
  const updateEntrega = useCartStore((state) => state.updateEntrega);
  const updateMensaje = useCartStore((state) => state.updateMensaje);
  const updateNotas = useCartStore((state) => state.updateNotas);
  const selectBarrio = useCartStore((state) => state.selectBarrio);
  const submitOrder = useCartStore((state) => state.submitOrder);
  const availableBarrios = useCartStore((state) => state.availableBarrios);
  const hasPrefilledRecipientRef = useRef(false);

  const costoDomicilio = pedidoState.entrega.metodo === "domicilio" ? pedidoState.entrega.costoDomicilio : 0;
  const catalogPath = `/catalogo/${tenantSlug}`;
  const successPath = `/catalogo/${tenantSlug}/pedido-exitoso`;
  const activeTenant = tenantSlug;
  const hasProducts = pedidoState.productos.length > 0;
  const safeIndicativo = (pedidoState.cliente.indicativo ?? "").trim();
  const aplicaIvaNit =
    activeTenant.trim().toLowerCase() === "flora" && pedidoState.cliente.facturacion.tipoIdentificacion === "nit";
  const totalIVA = aplicaIvaNit ? Math.round(pedidoState.subtotal * 0.19) : 0;
  const totalFinal = pedidoState.subtotal + costoDomicilio + totalIVA;

  const canContinueStep1 =
    pedidoState.cliente.nombre.trim().length > 1 &&
    pedidoState.cliente.telefono.trim().length >= 7 &&
    pedidoState.cliente.facturacion.identificacion.trim().length > 0;
  const canContinueStep2Base = pedidoState.entrega.nombreDestinatario.trim().length > 1;
  const canContinueStep2Fecha =
    pedidoState.entrega.fecha === "hoy" || pedidoState.entrega.fechaProgramada.trim().length > 0;
  const canContinueStep2Address = pedidoState.entrega.metodo !== "domicilio" || pedidoState.entrega.direccion.trim().length > 5;
  const canContinueStep2Barrio =
    pedidoState.entrega.metodo !== "domicilio" ||
    (pedidoState.entrega.barrio.trim().length > 1 && pedidoState.entrega.costoDomicilio > 0);
  const canContinueStep2 = canContinueStep2Base && canContinueStep2Fecha && canContinueStep2Address && canContinueStep2Barrio;
  const canContinueStep3 = true;
  const canFinalizeOrder = acceptedTerms;

  const stepTitles = useMemo(() => ["Información del cliente", "Información de entrega", "Mensaje", "Confirmar"], []);

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
    setStep((current) => (current >= 4 ? 4 : ((current + 1) as WizardStep)));
  }

  function goBack() {
    setStep((current) => (current <= 1 ? 1 : ((current - 1) as WizardStep)));
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
    if (!canContinueStep1) {
      setStep(1);
      setSubmitError("Completa los datos del cliente antes de confirmar el pedido.");
      return;
    }

    if (!canContinueStep2) {
      setStep(3);
      setSubmitError("Completa los datos de entrega antes de confirmar el pedido.");
      return;
    }

    if (!canFinalizeOrder) {
      setSubmitError("Debes aceptar los terminos para confirmar el pedido.");
      return;
    }

    if (pedidoState.entrega.metodo === "domicilio") {
      const hasDireccion = pedidoState.entrega.direccion.trim().length > 5;
      const hasBarrio =
        pedidoState.entrega.barrio.trim().length > 1 || Number.isFinite(pedidoState.entrega.barrioID ?? NaN);

      if (!hasDireccion || !hasBarrio) {
        setStep(2);
        setSubmitError("Para envio a domicilio debes completar direccion y barrio antes de confirmar.");
        return;
      }
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
      const telefonoDestinatario = pedidoState.entrega.telefono.trim() || telefonoLimpio;
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
            ? pedidoState.entrega.fechaProgramada.trim()
            : formatLocalDateISO(),
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

        // DATOS DE ENVÍO (ENTREGA)
        metodoEntrega: pedidoState.entrega.metodo,
        metodo_entrega: pedidoState.entrega.metodo,
        nombreDestinatario: pedidoState.entrega.nombreDestinatario,
        nombre_destinatario: pedidoState.entrega.nombreDestinatario,
        telefonoDestinatario: telefonoDestinatario,
        telefono_destinatario: telefonoDestinatario,
        direccionEntrega: pedidoState.entrega.direccion,
        direccion_entrega: pedidoState.entrega.direccion,
        complementoEntrega: pedidoState.entrega.complemento,
        complemento_entrega: pedidoState.entrega.complemento,
        barrioEntrega: pedidoState.entrega.barrio,
        barrio_entrega: pedidoState.entrega.barrio,
        barrioEntregaID: pedidoState.entrega.barrioID,
        barrio_entrega_id: pedidoState.entrega.barrioID,
        barrio_id: pedidoState.entrega.barrioID,
        id_barrio: pedidoState.entrega.barrioID,
        nombre_barrio: pedidoState.entrega.barrio,
        barrio_nombre: pedidoState.entrega.barrio,
        costoDomicilio: pedidoState.entrega.costoDomicilio,
        costo_domicilio: pedidoState.entrega.costoDomicilio,
        fechaEntrega:
          pedidoState.entrega.fecha === "programada" && pedidoState.entrega.fechaProgramada.trim()
            ? pedidoState.entrega.fechaProgramada.trim()
            : formatLocalDateISO(),
        fecha_entrega:
          pedidoState.entrega.fecha === "programada" && pedidoState.entrega.fechaProgramada.trim()
            ? pedidoState.entrega.fechaProgramada.trim()
            : formatLocalDateISO(),
        fechaProgramada:
          pedidoState.entrega.fecha === "programada" ? pedidoState.entrega.fechaProgramada.trim() : "",
        fecha_programada:
          pedidoState.entrega.fecha === "programada" ? pedidoState.entrega.fechaProgramada.trim() : "",

        // MENSAJE Y NOTAS
        mensaje: pedidoState.mensaje.texto,
        mensaje_tarjeta: pedidoState.mensaje.texto,
        firma: pedidoState.mensaje.firma,
        firma_tarjeta: pedidoState.mensaje.firma,
        notas: pedidoState.notas,
      };

      console.info("[checkout] Payload /pedidos", orderPayload);

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
          <p className="wizard-kicker">{`Paso ${step} de 4`}</p>
          <h1>Revisa y confirma tu pedido</h1>
        </div>
        <Link to={catalogPath} className="back-link back-link-muted">
          Agregar mas flores
        </Link>
      </header>

      {hasProducts ? null : (
        <section className="empty-state wizard-empty-state">
          <p>Tu carrito esta vacio por ahora.</p>
          <Link to={catalogPath} className="cta empty-state-action">
            Agregar mas flores
          </Link>
        </section>
      )}

      {hasProducts ? <WizardSteps step={step} stepTitles={stepTitles} /> : null}

      {hasProducts && step === 1 ? (
        <CustomerStep
          pedidoState={pedidoState}
          customerLookupStatus={customerLookupStatus}
          onLookupByPhone={(phone) => void handleLookupByPhone(phone)}
          updateCliente={updateCliente}
          updateFacturacion={updateFacturacion}
          canContinue={canContinueStep1}
          onNext={goNext}
          onBack={() => navigate(catalogPath)}
        />
      ) : null}

      {hasProducts && step === 2 ? (
        <DeliveryStep
          pedidoState={pedidoState}
          availableBarrios={availableBarrios}
          canContinue={canContinueStep2}
          updateEntrega={updateEntrega}
          selectBarrio={selectBarrio}
          onNext={goNext}
          onBack={goBack}
        />
      ) : null}

      {hasProducts && step === 3 ? (
        <MessageStep
          pedidoState={pedidoState}
          canContinue={canContinueStep3}
          updateMensaje={updateMensaje}
          updateNotas={updateNotas}
          onNext={goNext}
          onBack={goBack}
        />
      ) : null}

      {hasProducts && step === 4 ? (
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

    </main>
  );
}
