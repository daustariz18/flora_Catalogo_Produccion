import { formatCOP } from "../../../shared/utils/currency";
import type { SubmittedOrder } from "../store/cartStore";

export function buildOrderSummary(order: SubmittedOrder): string {
  const orderCode = order.pedidoID ? `Pedido #${order.pedidoID}` : `Pedido ${order.id}`;
  const lines = [
    orderCode,
    "",
    "Cliente:",
    order.pedido.cliente.nombre,
    `Telefono: ${order.pedido.cliente.telefono}`,
  ];

  if (order.pedido.cliente.facturacion.requiereFactura) {
    lines.push(
      "Facturacion: Si",
      `Tipo identificacion: ${order.pedido.cliente.facturacion.tipoIdentificacion === "nit" ? "NIT" : "Cedula"}`,
      `Identificacion: ${order.pedido.cliente.facturacion.identificacion}`,
      `Email factura: ${order.pedido.cliente.facturacion.email}`,
    );
  }

  lines.push(`Entrega: ${order.pedido.entrega.metodo === "domicilio" ? "Domicilio" : "Recoger en tienda"}`);

  if (order.pedido.entrega.nombreDestinatario.trim()) {
    lines.push(`Recibe/Recoge: ${order.pedido.entrega.nombreDestinatario.trim()}`);
  }

  if (order.pedido.entrega.telefono.trim()) {
    lines.push(`Telefono entrega: ${order.pedido.entrega.telefono.trim()}`);
  }

  if (order.pedido.entrega.direccion.trim()) {
    lines.push(`Direccion: ${order.pedido.entrega.direccion.trim()}`);
  }

  if (order.pedido.entrega.complemento.trim()) {
    lines.push(`Complemento: ${order.pedido.entrega.complemento.trim()}`);
  }

  if (order.pedido.entrega.barrio.trim()) {
    lines.push(`Barrio: ${order.pedido.entrega.barrio.trim()}`);
  }

  lines.push(
    `Fecha entrega: ${order.pedido.entrega.fecha === "hoy" ? "Hoy" : `Programada (${order.pedido.entrega.fechaProgramada})`}`,
  );

  if (order.pedido.mensaje.texto.trim()) {
    lines.push(`Mensaje tarjeta: ${order.pedido.mensaje.texto.trim()}`);
  }

  if (order.pedido.mensaje.firma.trim()) {
    lines.push(`Firma: ${order.pedido.mensaje.firma.trim()}`);
  }

  if (order.pedido.notas.trim()) {
    lines.push(`Notas: ${order.pedido.notas.trim()}`);
  }

  lines.push("", "Productos:");

  for (const item of order.pedido.productos) {
    lines.push(`- ${item.cantidad} x ${item.nombre} (${formatCOP(item.precio)})`);
  }

  lines.push("", `Total items: ${order.totalItems}`, `Total: ${formatCOP(order.totalPrice)}`);

  return lines.join("\n");
}