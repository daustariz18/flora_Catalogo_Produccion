import { Navigate, useParams } from "react-router-dom";

export function CheckoutPage() {
  const { tenantSlug = "" } = useParams();
  const cartPath = `/catalogo/${tenantSlug}/carrito`;

  return <Navigate to={cartPath} replace />;
}
