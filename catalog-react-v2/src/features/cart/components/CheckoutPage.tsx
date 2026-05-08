import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { countryCodes } from "../../../shared/utils/countryCodes";
import { formatCOP } from "../../../shared/utils/currency";
import { buildTenantPath, resolveTenantSlug, storeTenantSlug } from "../../../shared/utils/tenantSlug";
import { createOrder, lookupClienteByTelefono, type CreateOrderRequest } from "../api/publicOrderApi";
import { CartItemsList } from "./CartItemsList";
import { useCartStore } from "../store/cartStore";
import type { AvailableBarrio, CartItem, PedidoState } from "../store/cartStore";
import { usePublicBarrios } from "../../catalog/hooks/usePublicBarrios";

type WizardStep = 1 | 2 | 3 | 4;
type PaymentMethod = "wompi" | "transferencia" | "efectivo";
const SIGNATURE_PLACEHOLDER = "Anónimo";

interface WizardStepsProps {
  step: WizardStep;
  stepTitles: string[];
  onStepChange: (step: WizardStep) => void;
}

interface CustomerStepProps {
  pedidoState: PedidoState;
  customerLookupStatus: "idle" | "loading" | "found" | "not_found" | "error";
  onLookupByPhone: (phone: string) => void;
  onPhoneChange: (phone: string) => void;
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
  items: CartItem[];
  pedidoState: PedidoState;
  costoDomicilio: number;
  totalIVA: number;
  totalFinal: number;
  isSubmitting: boolean;
  submitError: string | null;
  paymentMethod: PaymentMethod;
  isFlora: boolean;
  onPaymentChange: (value: PaymentMethod) => void;
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

function formatPhoneNumber(indicativo: string | null, telefono: string): string {
  const safeIndicativo = (indicativo ?? "+57").trim();
  const safeTelefono = telefono.trim();
  return `${safeIndicativo} ${safeTelefono}`.trim();
}

function formatDeliveryAddress(direccion: string, complemento: string): string {
  return [direccion.trim(), complemento.trim()].filter(Boolean).join(" · ");
}

function isOnOrAfterToday(dateValue: string): boolean {
  const selectedDate = dateValue.trim();
  if (!selectedDate) {
    return false;
  }

  return selectedDate >= formatLocalDateISO();
}

export function isDeliveryStepComplete(entrega: PedidoState["entrega"]): boolean {
  const dateValue = entrega.fecha === "hoy" ? formatLocalDateISO() : entrega.fechaProgramada;
  const hasValidDate = isOnOrAfterToday(dateValue);

  if (entrega.metodo !== "domicilio") {
    return hasValidDate;
  }

  return hasValidDate && entrega.direccion.trim().length > 0 && entrega.barrio.trim().length > 0;
}

export function isMessageStepComplete(mensaje: PedidoState["mensaje"]): boolean {
  return mensaje.firma.trim().length > 0;
}

export function buildFloraWhatsappMessage(pedidoState: PedidoState, totalFinal: number): string {
  const lines: string[] = [
    "Hola, ya finalicé mi pedido. Comparto los detalles para validar y continuar con el pago:",
    "",
    `Cliente: ${pedidoState.cliente.nombre.trim()}`,
    `Teléfono: ${formatPhoneNumber(pedidoState.cliente.indicativo, pedidoState.cliente.telefono)}`,
    "",
    "Pedido:",
    ...pedidoState.productos.map((producto) => `• ${producto.cantidad} x ${producto.nombre}`),
    "",
    `Entrega: ${pedidoState.entrega.metodo === "domicilio" ? "Domicilio" : "Recoger en tienda"}`,
  ];

  if (pedidoState.entrega.metodo === "domicilio") {
    const addressLine = formatDeliveryAddress(pedidoState.entrega.direccion, pedidoState.entrega.complemento);

    lines.push(`Dirección: ${addressLine}`);

    if (pedidoState.entrega.barrio.trim()) {
      lines.push(`Barrio: ${pedidoState.entrega.barrio.trim()}`);
    }
  }

  lines.push(`Fecha: ${pedidoState.entrega.fecha === "hoy" ? "Hoy" : pedidoState.entrega.fechaProgramada.trim()}`);
  lines.push("");
  lines.push(`Total: ${formatCOP(totalFinal)}`);
  lines.push("");
  lines.push("Quedo atento a la información de pago para completar el proceso.");

  return lines.join("\n");
}

function buildFloraWhatsappUrl(pedidoState: PedidoState, totalFinal: number): string {
  const message = buildFloraWhatsappMessage(pedidoState, totalFinal);
  return `https://wa.me/573013755838?text=${encodeURIComponent(message)}`;
}

function WizardSteps({ step, stepTitles, onStepChange }: Readonly<WizardStepsProps>) {
  const gridStyle = { "--wizard-columns": stepTitles.length } as CSSProperties;

  return (
    <section className="wizard-steps" aria-label="Progreso del pedido" style={gridStyle}>
      {stepTitles.map((title, index) => {
        const stepNumber = index + 1;
        const status = getStepStatus(stepNumber, step);
        const isCurrent = status === "current";

        return (
          <button
            key={title}
            type="button"
            className={`wizard-step wizard-step-${status}`}
            aria-current={isCurrent ? "step" : undefined}
            aria-label={`Ir al paso ${stepNumber}: ${title}`}
            onClick={() => onStepChange(stepNumber as WizardStep)}
          >
            <span>{stepNumber}</span>
            <strong>{title}</strong>
          </button>
        );
      })}
    </section>
  );
}

function CustomerStep({
  pedidoState,
  customerLookupStatus,
  onLookupByPhone,
  onPhoneChange,
  updateCliente,
  updateFacturacion,
  canContinue,
  onNext,
  onBack,
}: Readonly<CustomerStepProps>) {
  const facturacion = pedidoState.cliente.facturacion;
  const estadoCliente =
    customerLookupStatus === "found"
      ? "Cliente encontrado"
      : customerLookupStatus === "loading"
        ? "Buscando cliente"
        : customerLookupStatus === "not_found"
          ? "Nuevo cliente"
          : customerLookupStatus === "error"
            ? "Sin conexion"
            : null;

  return (
    <section className="wizard-panel" aria-label="Informacion de contacto">
      <section className="checkout-card checkout-card-compact">
        <div className="compact-card-head customer-card-head">
          <h3>Datos del cliente</h3>
          {estadoCliente ? (
            <span
              className={`compact-badge ${customerLookupStatus === "found" ? "compact-badge-success" : "compact-badge-muted"}`}
            >
              {estadoCliente}
            </span>
          ) : null}
        </div>

        <div className="compact-form-grid compact-form-grid-top">
          <label className="checkout-field">
            <span>Celular de WhatsApp</span>
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
                onChange={(event) => onPhoneChange(event.target.value)}
                onBlur={(event) => onLookupByPhone(event.target.value)}
                placeholder="3001234567"
                autoComplete="tel"
                required
              />
            </div>
            {customerLookupStatus === "loading" ? <small className="checkout-field-help">Buscando cliente...</small> : null}
            {customerLookupStatus === "found" ? (
              <small className="checkout-field-help">Datos autocompletados.</small>
            ) : null}
            {customerLookupStatus === "not_found" ? (
              <small className="checkout-field-help">Nuevo cliente. Completa los datos manualmente.</small>
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
              placeholder="Ej: Andrea Gomez"
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
              <option value="cedula">Cedula</option>
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
              placeholder="1234567890"
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
              placeholder="ejemplo@correo.com"
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
  const isPickup = pedidoState.entrega.metodo === "recoger";
  const hasResetBlankDelivery = useRef(false);
  const [barrioQuery, setBarrioQuery] = useState(pedidoState.entrega.barrio);
  const [showBarrioOptions, setShowBarrioOptions] = useState(false);

  useEffect(() => {
    setBarrioQuery(pedidoState.entrega.barrio);
  }, [pedidoState.entrega.barrio]);

  useEffect(() => {
    if (hasResetBlankDelivery.current || !isDomicilio) {
      return;
    }

    const hasAnyDeliveryData =
      pedidoState.entrega.nombreDestinatario.trim().length > 0 ||
      pedidoState.entrega.telefono.trim().length > 0 ||
      pedidoState.entrega.direccion.trim().length > 0 ||
      pedidoState.entrega.complemento.trim().length > 0 ||
      pedidoState.entrega.barrio.trim().length > 0 ||
      pedidoState.entrega.barrioID !== null ||
      pedidoState.entrega.costoDomicilio > 0;

    if (!hasAnyDeliveryData) {
      hasResetBlankDelivery.current = true;
      return;
    }

    updateEntrega("metodo", "domicilio");
    hasResetBlankDelivery.current = true;
  }, [isDomicilio, pedidoState.entrega, updateEntrega]);

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
          <h2>2. Informacion de entrega</h2>
          <p>Organiza como recibira el pedido y revisa la fecha de entrega.</p>
        </div>
      </div>

      <section className="checkout-card checkout-card-compact">
        <div className="compact-card-head">
          <h3>Informacion de entrega</h3>
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
            className={`delivery-option delivery-option-compact ${isPickup ? "delivery-option-active" : ""}`}
            onClick={() => updateEntrega("metodo", "recoger")}
            aria-pressed={isPickup}
          >
            <span>Recoger en tienda</span>
          </button>
        </div>

        {isPickup ? (
          <p className="checkout-field-help checkout-field-help-standalone">
            Puedes cambiar el nombre y teléfono si otra persona recogerá el pedido.
          </p>
        ) : null}

        <div className="compact-form-grid compact-form-grid-delivery">
          <label className="checkout-field">
            <span>Nombre del destinatario</span>
            <input
              type="text"
              value={pedidoState.entrega.nombreDestinatario}
              onChange={(event) => updateEntrega("nombreDestinatario", event.target.value)}
              placeholder="Ej: Maria Perez"
              autoComplete="name"
            />
            <small className="checkout-field-help">Escribe aqui el nombre de la persona que recibira el pedido.</small>
          </label>

          <label className="checkout-field">
            <span>Telefono destino</span>
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
                <span>Direccion Principal *</span>
                <input
                  type="text"
                  value={pedidoState.entrega.direccion}
                  onChange={(event) => updateEntrega("direccion", event.target.value)}
                  placeholder="Ej: Calle 72 #45-32"
                  autoComplete="street-address"
                  required={isDomicilio}
                  aria-required={isDomicilio}
                />
              </label>

              <label className="checkout-field">
                <span>Complemento de direccion</span>
                <input
                  type="text"
                  value={pedidoState.entrega.complemento}
                  onChange={(event) => updateEntrega("complemento", event.target.value)}
                  placeholder="Ej: Torre 2 Apto 502"
                />
                <small className="checkout-field-help">Apartamento, torre, casa u oficina</small>
              </label>

              <label className="checkout-field checkout-field-wide">
                <span>Barrios de Entrega *</span>
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
                    required={isDomicilio}
                    aria-required={isDomicilio}
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
              <select value={pedidoState.entrega.rangoHora} onChange={(event) => updateEntrega("rangoHora", event.target.value)}>
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
              placeholder="Escribe tu mensaje aqui..."
              rows={5}
            />
          </label>

          <label className="checkout-field checkout-field-wide">
            <span>Firma</span>
            <input
              type="text"
              value={pedidoState.mensaje.firma}
              onChange={(event) => updateMensaje("firma", event.target.value)}
              placeholder={SIGNATURE_PLACEHOLDER}
              required
            />
            <small className="checkout-field-help">Si no deseas firmar, escribe {SIGNATURE_PLACEHOLDER}.</small>
          </label>
        </div>
      </section>

      <section className="checkout-card checkout-card-compact checkout-card-message">
        <div className="compact-card-head">
          <h3>Observaciones especiales</h3>
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
  items,
  pedidoState,
  costoDomicilio,
  totalIVA,
  totalFinal,
  isSubmitting,
  submitError,
  paymentMethod,
  isFlora,
  onPaymentChange,
  onBack,
  onConfirm,
}: Readonly<ConfirmationStepProps>) {
  const paymentOptions: Array<{ value: PaymentMethod; title: string; caption: string }> = [
    { value: "wompi", title: "WOMPI", caption: "Pago online seguro con tarjeta y PSE" },
    { value: "transferencia", title: "Transferencia", caption: "Confirma con comprobante por WhatsApp" },
    { value: "efectivo", title: "Efectivo", caption: "Pago contra entrega (si aplica)" },
  ];
  const confirmTitle = isFlora ? "CONFIRMAR PEDIDO" : "FINALIZAR PEDIDO";
  const confirmSubtitle = isFlora ? "Continuar en WhatsApp" : "Continuar al pago";

  const deliveryLabel =
    pedidoState.entrega.metodo === "domicilio" ? "Domicilio" : "Recoger en tienda";
  const deliveryTiming = pedidoState.entrega.fecha === "hoy" ? "Hoy" : "Programada";
  const deliveryLine = `${deliveryLabel} · ${deliveryTiming}`;
  const customerLine = `${pedidoState.cliente.nombre} · ${pedidoState.cliente.indicativo ?? "+57"} ${pedidoState.cliente.telefono}`;
  const addressLine = formatDeliveryAddress(pedidoState.entrega.direccion, pedidoState.entrega.complemento);
  const timeRangeLine = pedidoState.entrega.rangoHora.trim();
  const hasMessage = pedidoState.mensaje.texto.trim().length > 0 || pedidoState.mensaje.firma.trim().length > 0;

  return (
    <section className="wizard-panel" aria-label="Resumen final del pedido">
      <div className="wizard-panel-head confirmation-panel-head">
        <div>
          <p>{isFlora ? "Revisa el resumen y confirma el pedido." : "Revisa el resumen y elige tu forma de pago."}</p>
        </div>
      </div>

      <div className="wizard-review-grid">
        <section className="checkout-card checkout-summary confirmation-summary">
          <h2>Resumen</h2>
          <CartItemsList
            items={items}
            editable={false}
            onIncrease={() => undefined}
            onDecrease={() => undefined}
            onRemove={() => undefined}
          />

          <div className="checkout-totals">
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

        <aside className="checkout-card order-meta-card confirmation-meta-card">
          <h2>Entrega</h2>
          <div className="order-meta-list">
            <p>
              <span>Entrega</span>
              <strong>{deliveryLine}</strong>
            </p>
            <p>
              <span>Telefono</span>
              <strong>{customerLine}</strong>
            </p>
            {pedidoState.entrega.metodo === "domicilio" ? (
              <>
                {addressLine.length > 0 ? (
                  <p>
                    <span>Direccion</span>
                    <strong>{addressLine}</strong>
                  </p>
                ) : null}
                {timeRangeLine ? (
                  <p>
                    <span>Rango de hora</span>
                    <strong>{timeRangeLine}</strong>
                  </p>
                ) : null}
                {pedidoState.entrega.barrio.trim().length > 0 ? (
                  <p>
                    <span>Barrio</span>
                    <strong>{pedidoState.entrega.barrio}</strong>
                  </p>
                ) : null}
              </>
            ) : null}
            {pedidoState.entrega.nombreDestinatario.trim().length > 0 ? (
              <p>
                <span>Recibe</span>
                <strong>{pedidoState.entrega.nombreDestinatario}</strong>
              </p>
            ) : null}
            <p>
              <span>Fecha</span>
              <strong>{pedidoState.entrega.fecha === "hoy" ? "Hoy" : pedidoState.entrega.fechaProgramada}</strong>
            </p>
            {hasMessage ? (
              <p>
                <span>Mensaje</span>
                <strong>{[pedidoState.mensaje.texto, pedidoState.mensaje.firma].filter(Boolean).join(" · ")}</strong>
              </p>
            ) : null}
          </div>
        </aside>
      </div>

      <section className="checkout-trust">
        <p>✔ Tu pedido quedará registrado automáticamente</p>
        <p>{isFlora ? "✔ Te enviaremos la información de pago por WhatsApp" : "✔ Te enviaremos la información de pago por WhatsApp"}</p>
      </section>

      {isFlora ? null : (
        <section className="checkout-card payment-card">
          <h2>Metodo de pago</h2>
          <div className="payment-methods" role="radiogroup" aria-label="Metodo de pago">
            {paymentOptions.map((option) => {
              const isTransfer = option.value === "transferencia";
              const isSelected = paymentMethod === option.value;

              return (
                <button
                  key={option.value}
                  type="button"
                  className={`payment-option ${isSelected ? "payment-option-active" : ""}`}
                  onClick={() => onPaymentChange(option.value)}
                  aria-pressed={isSelected}
                >
                  <strong>{option.title}</strong>
                  <span>{option.caption}</span>
                  {isTransfer ? (
                    <small className="checkout-field-help">
                      Verifica el comprobante por WhatsApp antes de confirmar.
                    </small>
                  ) : null}
                </button>
              );
            })}
          </div>
        </section>
      )}

      {submitError ? <p className="checkout-error wizard-submit-error">{submitError}</p> : null}

      <div className="wizard-actions wizard-actions-sticky confirmation-actions">
        <button type="button" className="ghost wizard-action-secondary" onClick={onBack} disabled={isSubmitting}>
          Volver
        </button>
        <button
          type="button"
          className={`cta wizard-action-primary ${isFlora ? "confirmation-action-whatsapp" : ""}`}
          onClick={onConfirm}
          disabled={isSubmitting}
        >
          <span className="confirmation-primary-title">{confirmTitle}</span>
          <span className="cart-action-subtitle">{confirmSubtitle}</span>
        </button>
      </div>
    </section>
  );
}

export function CheckoutPage() {
  const navigate = useNavigate();
  const { tenantSlug = "" } = useParams();
  const resolvedTenantSlug = resolveTenantSlug(tenantSlug);
  const [step, setStep] = useState<WizardStep>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("wompi");
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
  const setAvailableBarrios = useCartStore((state) => state.setAvailableBarrios);
  const { barrios } = usePublicBarrios(resolvedTenantSlug);

  const costoDomicilio = pedidoState.entrega.metodo === "domicilio" ? pedidoState.entrega.costoDomicilio : 0;
  const catalogPath = buildTenantPath(resolvedTenantSlug);
  const successPath = buildTenantPath(resolvedTenantSlug, "/pedido-exitoso");
  const isFlora = resolvedTenantSlug.trim().toLowerCase() === "flora";
  const hasProducts = pedidoState.productos.length > 0;
  const safeIndicativo = (pedidoState.cliente.indicativo ?? "").trim();
  const aplicaIvaNit =
    resolvedTenantSlug.trim().toLowerCase() === "flora" && pedidoState.cliente.facturacion.tipoIdentificacion === "nit";
  const totalIVA = aplicaIvaNit ? Math.round(pedidoState.subtotal * 0.19) : 0;
  const totalFinal = pedidoState.subtotal + costoDomicilio + totalIVA;

  const canContinueStep1 =
    pedidoState.cliente.nombre.trim().length > 1 &&
    pedidoState.cliente.telefono.trim().length >= 7 &&
    pedidoState.cliente.facturacion.identificacion.trim().length > 0;
  const canContinueStep2 = isDeliveryStepComplete(pedidoState.entrega);
  const canContinueStep3 = isMessageStepComplete(pedidoState.mensaje);

  const stepTitles = useMemo(() => ["Información del cliente", "Información de entrega", "Mensaje", "Confirmar"], []);

  useEffect(() => {
    storeTenantSlug(resolvedTenantSlug);
  }, [resolvedTenantSlug]);

  useEffect(() => {
    setAvailableBarrios(barrios);
  }, [barrios, setAvailableBarrios]);

  useEffect(() => {
    if (!safeIndicativo) {
      updateCliente("indicativo", "+57");
    }
  }, [safeIndicativo, updateCliente]);

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

  function goToStep(nextStep: WizardStep) {
    setStep(nextStep);
  }

  async function handleLookupByPhone(phone: string) {
    const normalizedPhone = phone.trim();

    if (normalizedPhone.length < 7) {
      setCustomerLookupStatus("idle");
      return;
    }

    setCustomerLookupStatus("loading");

    try {
      const result = await lookupClienteByTelefono(resolvedTenantSlug, normalizedPhone, safeIndicativo || "+57");

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

  function handlePhoneChange(phone: string) {
    updateCliente("telefono", phone);
    setCustomerLookupStatus("idle");
  }

  async function handleConfirmOrder() {
    if (!resolvedTenantSlug) {
      setSubmitError("No pudimos identificar el tenant de este pedido. Vuelve al catalogo e intenta de nuevo.");
      return;
    }

    if (!canContinueStep1) {
      setStep(1);
      setSubmitError("Completa los datos del cliente antes de confirmar el pedido.");
      return;
    }

    if (!canContinueStep2) {
      setStep(2);
      setSubmitError(
        pedidoState.entrega.metodo === "domicilio"
          ? "Completa la direccion principal y el barrio de entrega antes de confirmar el pedido."
          : "Completa los datos de entrega antes de confirmar el pedido.",
      );
      return;
    }

    if (!isMessageStepComplete(pedidoState.mensaje)) {
      setStep(3);
      setSubmitError(`Completa la firma del mensaje. Si prefieres no firmar, escribe ${SIGNATURE_PLACEHOLDER}.`);
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
      const telefonoDestinatario = pedidoState.entrega.telefono.trim() || telefonoLimpio;
      const email = pedidoState.cliente.facturacion.email.trim();

      if (!fallbackIdentificacion) {
        setSubmitError("No fue posible validar los datos del cliente. Intenta de nuevo.");
        return;
      }

      const effectivePaymentMethod: PaymentMethod = isFlora ? "efectivo" : paymentMethod;
      const orderPayload: CreateOrderRequest = {
        cliente: {
          nombre_completo: pedidoState.cliente.nombre.trim(),
          identificacion: fallbackIdentificacion,
          telefono: telefonoLimpio,
          email,
          tipo_ident: tipoIdentCanonical,
          indicativo,
        },
        items: pedidoState.productos.map((producto) => ({
          productoID: producto.id,
          cantidad: producto.cantidad,
        })),
        productos: pedidoState.productos.map((producto) => ({
          productoID: producto.id,
          cantidad: producto.cantidad,
          producto_id: producto.id,
          productoId: producto.id,
          id_producto: producto.id,
          id: producto.id,
          product_id: producto.id,
          productId: producto.id,
          qty: producto.cantidad,
          quantity: producto.cantidad,
          count: producto.cantidad,
        })),
        detalles: pedidoState.productos.map((producto) => ({
          productoID: producto.id,
          cantidad: producto.cantidad,
        })),
        order_items: pedidoState.productos.map((producto) => ({
          productoID: producto.id,
          cantidad: producto.cantidad,
        })),
        cart_items: pedidoState.productos.map((producto) => ({
          productoID: producto.id,
          cantidad: producto.cantidad,
        })),
        line_items: pedidoState.productos.map((producto) => ({
          productoID: producto.id,
          cantidad: producto.cantidad,
        })),
        cart: pedidoState.productos.map((producto) => ({
          productoID: producto.id,
          cantidad: producto.cantidad,
        })),
        carrito: pedidoState.productos.map((producto) => ({
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
        version: effectivePaymentMethod === "efectivo" ? 2 : 1,
        metodoPago: effectivePaymentMethod,
        metodo_pago: effectivePaymentMethod,
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
        metodoEntrega: pedidoState.entrega.metodo,
        metodo_entrega: pedidoState.entrega.metodo,
        nombreDestinatario: pedidoState.entrega.nombreDestinatario,
        nombre_destinatario: pedidoState.entrega.nombreDestinatario,
        telefonoDestinatario: telefonoDestinatario,
        telefono_destinatario: telefonoDestinatario,
        direccionEntrega: formatDeliveryAddress(pedidoState.entrega.direccion, pedidoState.entrega.complemento),
        direccion_entrega: formatDeliveryAddress(pedidoState.entrega.direccion, pedidoState.entrega.complemento),
        complementoEntrega: pedidoState.entrega.complemento,
        complemento_entrega: pedidoState.entrega.complemento,
        rangoHora: pedidoState.entrega.rangoHora.trim(),
        rango_hora: pedidoState.entrega.rangoHora.trim(),
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
        mensaje: pedidoState.mensaje.texto,
        mensaje_tarjeta: pedidoState.mensaje.texto,
        firma: pedidoState.mensaje.firma,
        firma_tarjeta: pedidoState.mensaje.firma,
        notas: pedidoState.notas,
      };

      console.info("[checkout] Payload /pedidos", orderPayload);

      const response = await createOrder(resolvedTenantSlug, orderPayload);

      const codigoPedido = response.codigo_pedido ?? response.codigoPedido ?? null;
      const order = submitOrder(resolvedTenantSlug, response.pedidoID, codigoPedido, totalFinal, totalIVA, effectivePaymentMethod);

      if (!order) {
        setSubmitError("No fue posible confirmar el pedido. Intenta de nuevo.");
        return;
      }

      if (isFlora) {
        window.location.assign(buildFloraWhatsappUrl(pedidoState, totalFinal));
        return;
      }

      navigate(successPath, { replace: true });
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "No fue posible registrar el pedido en este momento.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!resolvedTenantSlug) {
    return (
      <main className="cart-page checkout-page">
        <section className="empty-state wizard-empty-state">
          <p>No pudimos identificar el tenant de este pedido.</p>
          <Link to={catalogPath} className="cta empty-state-action">
            Volver al catalogo
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="cart-page wizard-page checkout-page">
      <header className="cart-header wizard-header">
        <div>
          <p className="wizard-kicker">{`Paso ${step} de 4`}</p>
          <h1>Revisa y confirma tu pedido</h1>
        </div>
        <Link to={catalogPath} className="back-link back-link-muted">
          Agregar otro arreglo
        </Link>
      </header>

      {hasProducts ? null : (
        <section className="empty-state wizard-empty-state">
          <p>Tu carrito esta vacio por ahora.</p>
          <Link to={catalogPath} className="cta empty-state-action">
            Agregar otro arreglo
          </Link>
        </section>
      )}

      {hasProducts ? <WizardSteps step={step} stepTitles={stepTitles} onStepChange={goToStep} /> : null}

      {hasProducts && step === 1 ? (
        <CustomerStep
          pedidoState={pedidoState}
          customerLookupStatus={customerLookupStatus}
          onLookupByPhone={(phone) => void handleLookupByPhone(phone)}
          onPhoneChange={handlePhoneChange}
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
          items={pedidoState.productos}
          pedidoState={pedidoState}
          costoDomicilio={costoDomicilio}
          totalIVA={totalIVA}
          totalFinal={totalFinal}
          isSubmitting={isSubmitting}
          submitError={submitError}
          paymentMethod={paymentMethod}
          onPaymentChange={setPaymentMethod}
          onBack={goBack}
          isFlora={isFlora}
          onConfirm={() => void handleConfirmOrder()}
        />
      ) : null}
    </main>
  );
}

