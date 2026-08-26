import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { countryCodes } from "../../../shared/utils/countryCodes";
import { formatCOP } from "../../../shared/utils/currency";
import { buildTenantPath, resolveTenantSlug, storeTenantSlug } from "../../../shared/utils/tenantSlug";
import {
  createOrder,
  lookupClienteByTelefono,
  prepareWompiCheckout,
  type CreateOrderRequest,
  type CreateOrderResponse,
  type PrepareWompiCheckoutResponse,
  type WompiCheckoutPayload,
} from "../api/publicOrderApi";
import { CartItemsList } from "./CartItemsList";
import { useCartStore } from "../store/cartStore";
import type { AvailableBarrio, CartItem, PedidoState } from "../store/cartStore";
import { usePublicBarrios } from "../../catalog/hooks/usePublicBarrios";
import { getCatalogoPublico, type PublicPaymentMethod } from "../../catalog/api/publicCatalogApi";

type WizardStep = 1 | 2 | 3 | 4;
type PaymentMethod = "wompi" | "transferencia" | "efectivo";
type CheckoutPaymentOption = {
  value: PaymentMethod;
  title: string;
  caption: string;
  cta: string;
  subtitle: string;
  badge?: string;
  confirmationBullets?: string[];
};
type TransferAccount = {
  id: string;
  label: string;
  number: string;
};
const SIGNATURE_PLACEHOLDER = "Anónimo";
const TRANSFER_ACCOUNTS_COMPANY_ID = 2;
const COMPANY_TRANSFER_ACCOUNTS: TransferAccount[] = [
  { id: "nequi", label: "Nequi", number: "3001720582" },
  { id: "daviplata", label: "Daviplata", number: "3128896624" },
];
const WOMPI_CHECKOUT_URL =
  (import.meta.env.VITE_WOMPI_CHECKOUT_URL as string | undefined)?.trim() || "https://checkout.wompi.co/p/";

function normalizeDeliveryShift(value: string): string {
  const normalized = value.trim().toLowerCase();

  if (normalized.startsWith("mañana") || normalized.startsWith("manana")) {
    return "Mañana";
  }

  if (normalized.startsWith("tarde")) {
    return "Tarde";
  }

  return value.trim();
}

function firstNonEmpty(...values: Array<string | null | undefined>): string | null {
  for (const value of values) {
    const normalized = value?.trim();
    if (normalized) {
      return normalized;
    }
  }

  return null;
}

function getPaymentUrl(response: CreateOrderResponse | PrepareWompiCheckoutResponse): string | null {
  return firstNonEmpty(
    response.paymentUrl,
    response.payment_url,
    response.checkoutUrl,
    response.checkout_url,
    response.wompiUrl,
    response.wompi_url,
    response.linkPago,
    response.link_pago,
  );
}

function getNextActionRedirectUrl(response: CreateOrderResponse): string | null {
  const nextAction = response.next_action ?? response.nextAction;

  if (nextAction?.type === "redirect") {
    return firstNonEmpty(nextAction.redirect_url, nextAction.redirectUrl);
  }

  return firstNonEmpty(response.pago?.redirect_url, response.pago?.redirectUrl);
}

function getWompiCheckoutPayload(
  response: CreateOrderResponse | PrepareWompiCheckoutResponse,
): WompiCheckoutPayload | null {
  return response.paymentPayload ?? response.payment_payload ?? response.wompiPayload ?? response.wompi_payload ?? null;
}

const DEFAULT_PAYMENT_OPTIONS: CheckoutPaymentOption[] = [
  {
    value: "transferencia",
    title: "Transferencia",
    caption: "Confirma con comprobante por WhatsApp",
    cta: "FINALIZAR PEDIDO",
    subtitle: "Enviar comprobante luego",
  },
  {
    value: "efectivo",
    title: "Efectivo",
    caption: "Pago contra entrega (si aplica)",
    cta: "CONFIRMAR PEDIDO",
    subtitle: "Registrar pedido",
  },
];

function mapPublicPaymentMethods(methods: PublicPaymentMethod[]): CheckoutPaymentOption[] {
  const mapped: CheckoutPaymentOption[] = [];

  for (const method of methods) {
    if (method.enabled === false) {
      continue;
    }

    const value = normalizePaymentMethod(method.value ?? method.method ?? method.code ?? method.id);

    if (!value || value === "wompi") {
      continue;
    }

    const fallback = DEFAULT_PAYMENT_OPTIONS.find((option) => option.value === value);
    mapped.push({
      value,
      title: method.title?.trim() || method.label?.trim() || fallback?.title || value,
      caption: method.caption?.trim() || method.description?.trim() || fallback?.caption || "",
      cta: method.cta?.trim() || method.button?.trim() || fallback?.cta || "CONTINUAR",
      subtitle: method.subtitle?.trim() || method.subtext?.trim() || fallback?.subtitle || "",
      badge: method.badge?.trim() || (method.recommended ? "Recomendado" : undefined),
      confirmationBullets: method.confirmation_bullets ?? method.confirmationBullets ?? fallback?.confirmationBullets,
    });
  }

  return mapped.length > 0 ? mapped : DEFAULT_PAYMENT_OPTIONS;
}

function getEmpresaId(empresa: { id?: number | null; empresa_id?: number | null; empresaID?: number | null } | null): number | null {
  return empresa?.id ?? empresa?.empresa_id ?? empresa?.empresaID ?? null;
}

function getEmpresaSlug(empresa: { slug?: string | null } | null): string | null {
  return firstNonEmpty(empresa?.slug);
}

function getEmpresaCelular(
  empresa:
    | {
        celular?: string | null;
        cell?: string | null;
        phone?: string | null;
        telefono?: string | null;
        telefono_celular?: string | null;
      }
    | null,
): string | null {
  return firstNonEmpty(empresa?.celular, empresa?.telefono_celular, empresa?.cell, empresa?.phone, empresa?.telefono);
}

function getTransferAccountsForCompany(empresaId: number | null): TransferAccount[] {
  return empresaId === TRANSFER_ACCOUNTS_COMPANY_ID ? COMPANY_TRANSFER_ACCOUNTS : [];
}

function withTransferAccountFlow(
  options: CheckoutPaymentOption[],
  transferAccounts: TransferAccount[],
): CheckoutPaymentOption[] {
  if (transferAccounts.length === 0) {
    return options;
  }

  const optionsWithTransfer = options.some((option) => option.value === "transferencia")
    ? options
    : [
        ...options,
        DEFAULT_PAYMENT_OPTIONS.find((option) => option.value === "transferencia") ?? DEFAULT_PAYMENT_OPTIONS[0],
      ];

  return optionsWithTransfer.map((option) =>
    option.value === "transferencia"
      ? {
          ...option,
          title: option.title || "Transferencia",
          caption: "Paga por Nequi o Daviplata y envía el comprobante por WhatsApp",
          cta: "FINALIZAR Y ENVIAR COMPROBANTE",
          subtitle: "Te abriremos WhatsApp al finalizar",
          confirmationBullets: [
            "Elige Nequi o Daviplata y transfiere el total",
            "Al finalizar podrás enviar el comprobante por WhatsApp",
          ],
        }
      : option,
  );
}

function normalizePaymentMethod(value: string | null | undefined): PaymentMethod | null {
  const normalized = value?.trim().toLowerCase();

  if (normalized === "wompi" || normalized === "transferencia" || normalized === "efectivo") {
    return normalized;
  }

  return null;
}

function getPaymentReference(response: CreateOrderResponse): string | null {
  return firstNonEmpty(
    response.paymentReference,
    response.payment_reference,
    response.referenciaPago,
    response.referencia_pago,
    response.codigo_pedido,
    response.codigoPedido,
  );
}

function buildFallbackPaymentReference(pedidoID: number | null | undefined, codigoPedido: string | null): string {
  if (codigoPedido?.trim()) {
    return codigoPedido.trim();
  }

  if (typeof pedidoID === "number" && Number.isFinite(pedidoID) && pedidoID > 0) {
    return `PED-${pedidoID}`;
  }

  return `PED-${Date.now().toString().slice(-8)}`;
}

function buildWompiCheckoutUrlFromPayload(payload: WompiCheckoutPayload | null): string | null {
  if (!payload) {
    return null;
  }

  const query = new URLSearchParams();
  const normalizedPayload: Record<string, string | number | null | undefined> = {
    ...payload,
    "public-key": payload["public-key"] ?? payload.publicKey ?? payload.public_key,
    "amount-in-cents": payload["amount-in-cents"] ?? payload.amountInCents ?? payload.amount_in_cents,
    "signature:integrity":
      payload["signature:integrity"] ?? payload.signatureIntegrity ?? payload.signature_integrity,
    "redirect-url": payload["redirect-url"] ?? payload.redirectUrl ?? payload.redirect_url,
    "expiration-time": payload["expiration-time"] ?? payload.expirationTime ?? payload.expiration_time,
  };

  for (const [key, value] of Object.entries(normalizedPayload)) {
    if (value === null || value === undefined || value === "") {
      continue;
    }

    query.set(toWompiCheckoutKey(key), String(value));
  }

  return query.has("public-key") && query.has("amount-in-cents") && query.has("reference") && query.has("signature:integrity")
    ? `${WOMPI_CHECKOUT_URL}?${query.toString()}`
    : null;
}

function toWompiCheckoutKey(key: string): string {
  if (key === "signatureIntegrity" || key === "signature_integrity") {
    return "signature:integrity";
  }

  return key.replace(/_/g, "-").replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}

async function resolveWompiPaymentUrl(
  tenantSlug: string,
  orderResponse: CreateOrderResponse,
): Promise<string | null> {
  const directUrl = getPaymentUrl(orderResponse);

  if (directUrl) {
    return directUrl;
  }

  const createOrderPayloadUrl = buildWompiCheckoutUrlFromPayload(
    orderResponse.checkout ?? getWompiCheckoutPayload(orderResponse),
  );

  if (createOrderPayloadUrl) {
    return createOrderPayloadUrl;
  }

  if (!orderResponse.pedidoID) {
    return null;
  }

  const preparedCheckout = await prepareWompiCheckout(tenantSlug, orderResponse.pedidoID);
  return getPaymentUrl(preparedCheckout) ?? buildWompiCheckoutUrlFromPayload(
    preparedCheckout.checkout ?? getWompiCheckoutPayload(preparedCheckout),
  );
}

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
  requiresSignature: boolean;
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
  paymentOptions: CheckoutPaymentOption[];
  transferAccounts: TransferAccount[];
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

function normalizeWhatsappNumber(value: string | null | undefined): string | null {
  const digits = value?.replace(/\D/g, "") ?? "";

  if (!digits) {
    return null;
  }

  if (digits.length === 10) {
    return `57${digits}`;
  }

  return digits;
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

  return (
    hasValidDate &&
    entrega.direccion.trim().length > 0 &&
    entrega.barrioID !== null &&
    entrega.barrio.trim().length > 0
  );
}

export function isMessageStepComplete(mensaje: PedidoState["mensaje"], requiresSignature = true): boolean {
  return !requiresSignature || mensaje.firma.trim().length > 0;
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

export function buildFloraWhatsappUrl(
  pedidoState: PedidoState,
  totalFinal: number,
  whatsappNumber?: string | null,
): string | null {
  const message = buildFloraWhatsappMessage(pedidoState, totalFinal);
  const destination = normalizeWhatsappNumber(whatsappNumber);

  if (!destination) {
    return null;
  }

  return `https://wa.me/${destination}?text=${encodeURIComponent(message)}`;
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
    if (pedidoState.entrega.barrioID !== null && pedidoState.entrega.barrio.trim().length > 0) {
      setBarrioQuery(pedidoState.entrega.barrio);
    } else if (!isDomicilio) {
      setBarrioQuery("");
    }
  }, [isDomicilio, pedidoState.entrega.barrio, pedidoState.entrega.barrioID]);

  const filteredBarrios = useMemo(() => {
    const query = barrioQuery.trim().toLowerCase();

    if (!query) {
      return availableBarrios.slice(0, 30);
    }

    return availableBarrios.filter((item) => item.nombre.toLowerCase().includes(query)).slice(0, 30);
  }, [availableBarrios, barrioQuery]);

  const exactMatch = useMemo(() => {
    const query = barrioQuery.trim().toLowerCase();

    if (!query) {
      return null;
    }

    return availableBarrios.find((item) => item.nombre.trim().toLowerCase() === query) ?? null;
  }, [availableBarrios, barrioQuery]);

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
                    className="barrio-combobox-input"
                    type="text"
                    value={barrioQuery}
                    onFocus={() => setShowBarrioOptions(true)}
                    onBlur={() => {
                      window.setTimeout(() => {
                        setShowBarrioOptions(false);
                        if (!exactMatch && pedidoState.entrega.barrioID !== null) {
                          setBarrioQuery(pedidoState.entrega.barrio);
                        }
                      }, 120);
                    }}
                    onChange={(event) => {
                      const value = event.target.value;
                      setBarrioQuery(value);
                      setShowBarrioOptions(true);
                      const matchedBarrio =
                        availableBarrios.find((item) => item.nombre.trim().toLowerCase() === value.trim().toLowerCase()) ??
                        null;
                      selectBarrio(matchedBarrio);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Escape") {
                        setShowBarrioOptions(false);
                        return;
                      }

                      if (event.key === "Enter" && exactMatch) {
                        event.preventDefault();
                        selectBarrio(exactMatch);
                        setBarrioQuery(exactMatch.nombre);
                        setShowBarrioOptions(false);
                      }
                    }}
                    placeholder="Busca tu barrio"
                    autoComplete="off"
                    required={isDomicilio}
                    aria-required={isDomicilio}
                    aria-autocomplete="list"
                    aria-expanded={showBarrioOptions}
                    aria-controls="barrio-options-list"
                  />

                  {showBarrioOptions ? (
                    <div className="barrio-options" id="barrio-options-list" role="listbox" aria-label="Barrios disponibles">
                      {filteredBarrios.length > 0 ? (
                        filteredBarrios.map((barrio) => (
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
                        ))
                      ) : (
                        <div className="barrio-options-empty">No encontramos coincidencias registradas.</div>
                      )}
                    </div>
                  ) : null}
                </div>
                <small className="checkout-field-help">
                  {pedidoState.entrega.barrioID !== null
                    ? `Costo de domicilio: ${formatCOP(pedidoState.entrega.costoDomicilio)}`
                    : "Escribe para filtrar y elige un barrio existente de la lista."}
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
              <span>Preferencia de entrega (opcional)</span>
              <select
                value={normalizeDeliveryShift(pedidoState.entrega.rangoHora)}
                onChange={(event) => updateEntrega("rangoHora", event.target.value)}
              >
                <option value="">Seleccione...</option>
                <option value="Mañana">Mañana</option>
                <option value="Tarde">Tarde</option>
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
  requiresSignature,
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
            <span>{requiresSignature ? "Firma" : "Firma (opcional)"}</span>
            <input
              type="text"
              value={pedidoState.mensaje.firma}
              onChange={(event) => updateMensaje("firma", event.target.value)}
              placeholder={SIGNATURE_PLACEHOLDER}
              required={requiresSignature}
            />
            {requiresSignature ? (
              <small className="checkout-field-help">Si no deseas firmar, escribe {SIGNATURE_PLACEHOLDER}.</small>
            ) : null}
          </label>
        </div>
      </section>

      <section className="checkout-card checkout-card-compact checkout-card-message">
        <div className="compact-card-head">
          <h3>Observaciones Para el Arreglo</h3>
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
  paymentOptions,
  transferAccounts,
  isFlora,
  onPaymentChange,
  onBack,
  onConfirm,
}: Readonly<ConfirmationStepProps>) {
  const [copiedTransferAccount, setCopiedTransferAccount] = useState<string | null>(null);
  const selectedPaymentOption =
    paymentOptions.find((option) => option.value === paymentMethod) ??
    DEFAULT_PAYMENT_OPTIONS.find((option) => option.value === paymentMethod);
  const confirmTitle = isFlora
    ? "CONFIRMAR PEDIDO"
    : selectedPaymentOption?.cta ?? "CONTINUAR";
  const confirmSubtitle = isFlora
    ? "Continuar en WhatsApp"
    : selectedPaymentOption?.subtitle ?? "";
  const confirmationBullets =
    selectedPaymentOption?.confirmationBullets ??
    (paymentMethod === "wompi"
      ? ["Crearemos tu pedido antes de abrir Wompi", "El pago se valida de forma segura"]
      : paymentMethod === "transferencia"
        ? ["Podrás enviar el comprobante por WhatsApp al finalizar"]
        : ["El pago queda marcado para gestionarse contra entrega"]);
  const selectedPaymentTitle = selectedPaymentOption?.title ?? "";

  const deliveryLabel =
    pedidoState.entrega.metodo === "domicilio" ? "Domicilio" : "Recoger en tienda";
  const deliveryTiming = pedidoState.entrega.fecha === "hoy" ? "Hoy" : "Programada";
  const deliveryLine = `${deliveryLabel} · ${deliveryTiming}`;
  const customerLine = `${pedidoState.cliente.nombre} · ${pedidoState.cliente.indicativo ?? "+57"} ${pedidoState.cliente.telefono}`;
  const addressLine = formatDeliveryAddress(pedidoState.entrega.direccion, pedidoState.entrega.complemento);
  const deliveryShiftLine = normalizeDeliveryShift(pedidoState.entrega.rangoHora);
  const hasMessage = pedidoState.mensaje.texto.trim().length > 0 || pedidoState.mensaje.firma.trim().length > 0;
  const showTransferAccounts = paymentMethod === "transferencia" && transferAccounts.length > 0;

  async function handleCopyTransferAccount(account: TransferAccount) {
    try {
      await navigator.clipboard.writeText(account.number);
      setCopiedTransferAccount(account.id);
    } catch {
      setCopiedTransferAccount(null);
    }
  }

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
                {deliveryShiftLine ? (
                  <p>
                    <span>Preferencia de entrega</span>
                    <strong>{deliveryShiftLine}</strong>
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
        {(isFlora ? ["Te enviaremos la información de pago por WhatsApp"] : confirmationBullets).map((bullet) => (
          <p key={bullet}>✔ {bullet}</p>
        ))}
      </section>

      {isFlora ? null : (
        <section className="checkout-card payment-card">
          <div className="payment-card-head">
            <div>
              <h2>Metodo de pago</h2>
              <p>{selectedPaymentTitle ? `Seleccionado: ${selectedPaymentTitle}` : "Elige como quieres pagar."}</p>
            </div>
            {paymentMethod === "wompi" ? <span className="payment-secure-pill">Pago seguro</span> : null}
          </div>
          <div className="payment-methods" role="radiogroup" aria-label="Metodo de pago">
            {paymentOptions.map((option) => {
              const isTransfer = option.value === "transferencia";
              const isSelected = paymentMethod === option.value;
              const isWompi = option.value === "wompi";

              return (
                <div key={option.value} className="payment-option-block">
                  <button
                    type="button"
                    className={`payment-option ${isWompi ? "payment-option-wompi" : ""} ${isSelected ? "payment-option-active" : ""}`}
                    onClick={() => onPaymentChange(option.value)}
                    aria-pressed={isSelected}
                  >
                    <span className="payment-option-topline">
                      <strong>{option.title}</strong>
                      {option.badge ? <span className="payment-badge">{option.badge}</span> : null}
                    </span>
                    <span>{option.caption}</span>
                    {isWompi ? (
                      <small className="checkout-field-help">
                        Se abrirá Wompi después de registrar el pedido.
                      </small>
                    ) : null}
                    {isTransfer ? (
                      <small className="checkout-field-help">
                        Verifica el comprobante por WhatsApp antes de confirmar.
                      </small>
                    ) : null}
                  </button>
                  {isTransfer && showTransferAccounts ? (
                    <div className="transfer-inline-card" aria-live="polite">
                      <div>
                        <h3>Datos para transferir</h3>
                        <p className="transfer-inline-helper">
                          Transfiere el total exacto y conserva el comprobante para enviarlo por WhatsApp.
                        </p>
                      </div>
                      <div className="payment-data-list">
                        {transferAccounts.map((account) => (
                          <p key={account.id}>
                            <span>{account.label}</span>
                            <strong>{account.number}</strong>
                            <button
                              type="button"
                              className="ghost payment-copy-button"
                              onClick={() => void handleCopyTransferAccount(account)}
                            >
                              {copiedTransferAccount === account.id ? "Copiado" : "Copiar"}
                            </button>
                          </p>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
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
          <span className="confirmation-primary-title">
            {isSubmitting && paymentMethod === "wompi" ? "ABRIENDO WOMPI" : confirmTitle}
          </span>
          <span className="cart-action-subtitle">
            {isSubmitting ? "Registrando pedido..." : confirmSubtitle}
          </span>
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
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("transferencia");
  const [paymentOptions, setPaymentOptions] = useState<CheckoutPaymentOption[]>(DEFAULT_PAYMENT_OPTIONS);
  const [empresaId, setEmpresaId] = useState<number | null>(null);
  const [empresaSlug, setEmpresaSlug] = useState<string | null>(null);
  const [empresaCelular, setEmpresaCelular] = useState<string | null>(null);
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
  const orderTenantSlug = empresaSlug ?? resolvedTenantSlug;
  const successPath = buildTenantPath(orderTenantSlug, "/pedido-exitoso");
  const isFlora = resolvedTenantSlug.trim().toLowerCase() === "flora";
  const hasProducts = pedidoState.productos.length > 0;
  const safeIndicativo = (pedidoState.cliente.indicativo ?? "").trim();
  const aplicaIvaNit =
    resolvedTenantSlug.trim().toLowerCase() === "flora" && pedidoState.cliente.facturacion.tipoIdentificacion === "nit";
  const totalIVA = aplicaIvaNit ? Math.round(pedidoState.subtotal * 0.19) : 0;
  const totalFinal = pedidoState.subtotal + costoDomicilio + totalIVA;
  const requiresMessageSignature = (empresaId ?? (isFlora ? 3 : null)) === 3;

  const canContinueStep1 =
    pedidoState.cliente.nombre.trim().length > 1 &&
    pedidoState.cliente.telefono.trim().length >= 7 &&
    pedidoState.cliente.facturacion.identificacion.trim().length > 0;
  const canContinueStep2 = isDeliveryStepComplete(pedidoState.entrega);
  const canContinueStep3 = isMessageStepComplete(pedidoState.mensaje, requiresMessageSignature);

  const stepTitles = useMemo(() => ["Información del cliente", "Información de entrega", "Mensaje", "Confirmar"], []);

  useEffect(() => {
    storeTenantSlug(resolvedTenantSlug);
  }, [resolvedTenantSlug]);

  useEffect(() => {
    setAvailableBarrios(barrios);
  }, [barrios, setAvailableBarrios]);

  useEffect(() => {
    let cancelled = false;

    async function loadPaymentMethods() {
      if (!resolvedTenantSlug) {
        setPaymentOptions(DEFAULT_PAYMENT_OPTIONS);
        setEmpresaId(null);
        setEmpresaSlug(null);
        setEmpresaCelular(null);
        return;
      }

      try {
        const catalog = await getCatalogoPublico(resolvedTenantSlug);
        const nextEmpresaId = getEmpresaId(catalog.empresa);
        const nextEmpresaSlug = getEmpresaSlug(catalog.empresa);
        const nextEmpresaCelular = getEmpresaCelular(catalog.empresa);
        const transferAccounts = getTransferAccountsForCompany(nextEmpresaId);
        const mappedOptions = isFlora
          ? DEFAULT_PAYMENT_OPTIONS
          : withTransferAccountFlow(mapPublicPaymentMethods(catalog.payment_methods ?? []), transferAccounts);

        if (!cancelled) {
          setEmpresaId(nextEmpresaId);
          setEmpresaSlug(nextEmpresaSlug);
          setEmpresaCelular(nextEmpresaCelular);
          setPaymentOptions(mappedOptions);
          if (!mappedOptions.some((option) => option.value === paymentMethod)) {
            setPaymentMethod(mappedOptions[0]?.value ?? "transferencia");
          }
        }
      } catch {
        if (!cancelled) {
          setEmpresaId(null);
          setEmpresaSlug(null);
          setEmpresaCelular(null);
          setPaymentOptions(DEFAULT_PAYMENT_OPTIONS);
        }
      }
    }

    void loadPaymentMethods();

    return () => {
      cancelled = true;
    };
  }, [isFlora, paymentMethod, resolvedTenantSlug]);

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
      const result = await lookupClienteByTelefono(orderTenantSlug, normalizedPhone, safeIndicativo || "+57");

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

  function handlePaymentChange(value: PaymentMethod) {
    setPaymentMethod(value);
    setSubmitError(null);
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
          ? "Completa la direccion principal y selecciona un barrio de la lista antes de confirmar el pedido."
          : "Completa los datos de entrega antes de confirmar el pedido.",
      );
      return;
    }

    if (!isMessageStepComplete(pedidoState.mensaje, requiresMessageSignature)) {
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
      const toOrderItem = (producto: CartItem) => ({
        productoID: producto.id_producto ?? producto.id,
        cantidad: producto.cantidad,
      });
      const toExpandedOrderItem = (producto: CartItem) => {
        const productoID = producto.id_producto ?? producto.id;

        return {
          productoID,
          cantidad: producto.cantidad,
          producto_id: productoID,
          productoId: productoID,
          id_producto: productoID,
          id: productoID,
          product_id: productoID,
          productId: productoID,
          qty: producto.cantidad,
          quantity: producto.cantidad,
          count: producto.cantidad,
        };
      };
      const orderPayload: CreateOrderRequest = {
        cliente: {
          nombre_completo: pedidoState.cliente.nombre.trim(),
          identificacion: fallbackIdentificacion,
          telefono: telefonoLimpio,
          email,
          tipo_ident: tipoIdentCanonical,
          indicativo,
        },
        items: pedidoState.productos.map(toOrderItem),
        productos: pedidoState.productos.map(toExpandedOrderItem),
        detalles: pedidoState.productos.map(toOrderItem),
        order_items: pedidoState.productos.map(toOrderItem),
        cart_items: pedidoState.productos.map(toOrderItem),
        line_items: pedidoState.productos.map(toOrderItem),
        cart: pedidoState.productos.map(toOrderItem),
        carrito: pedidoState.productos.map(toOrderItem),
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
        rangoHora: normalizeDeliveryShift(pedidoState.entrega.rangoHora),
        rango_hora: normalizeDeliveryShift(pedidoState.entrega.rangoHora),
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

      const response = await createOrder(orderTenantSlug, orderPayload);

      const codigoPedido = response.codigo_pedido ?? response.codigoPedido ?? null;
      const responseEmpresaId = response.empresaID ?? empresaId;
      const paymentReference =
        getPaymentReference(response) ?? buildFallbackPaymentReference(response.pedidoID, codigoPedido);
      const responseNextActionUrl = getNextActionRedirectUrl(response);
      const paymentUrl =
        effectivePaymentMethod === "wompi"
          ? responseNextActionUrl ?? await resolveWompiPaymentUrl(orderTenantSlug, response)
          : null;
      if (effectivePaymentMethod === "wompi" && !paymentUrl) {
        setSubmitError(
          "Wompi no esta configurado en el backend. El backend debe devolver checkout_url o checkout/payment_payload firmado.",
        );
        return;
      }

      const order = submitOrder(
        orderTenantSlug,
        response.pedidoID,
        codigoPedido,
        totalFinal,
        totalIVA,
        effectivePaymentMethod,
        paymentUrl,
        paymentReference,
        responseEmpresaId,
        empresaCelular,
      );

      if (!order) {
        setSubmitError("No fue posible confirmar el pedido. Intenta de nuevo.");
        return;
      }

      if (isFlora) {
        const whatsappUrl = buildFloraWhatsappUrl(pedidoState, totalFinal, empresaCelular);

        if (!whatsappUrl) {
          setSubmitError("No encontramos el celular de WhatsApp de la empresa. Verifica el catalogo e intenta de nuevo.");
          return;
        }

        window.location.assign(whatsappUrl);
        return;
      }

      if (effectivePaymentMethod === "wompi" && paymentUrl) {
        window.location.assign(paymentUrl);
        return;
      }

      navigate(successPath, { replace: true });
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "No fue posible registrar el pedido en este momento.");
  } finally {
      setIsSubmitting(false);
    }
  }

  const transferAccounts = getTransferAccountsForCompany(empresaId);

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
          requiresSignature={requiresMessageSignature}
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
          paymentOptions={paymentOptions}
          transferAccounts={transferAccounts}
          onPaymentChange={handlePaymentChange}
          onBack={goBack}
          isFlora={isFlora}
          onConfirm={() => void handleConfirmOrder()}
        />
      ) : null}
    </main>
  );
}

