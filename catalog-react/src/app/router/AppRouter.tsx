import { Navigate, Route, Routes } from "react-router-dom";
import { CatalogPage } from "../../features/catalog/pages/CatalogPage";
import { CartPage } from "../../features/cart/components/CartPage";
import { CheckoutPage } from "../../features/cart/components/CheckoutPage";
import { OrderSuccessPage } from "../../features/cart/components/OrderSuccessPage";

export function AppRouter() {
  return (
    <Routes>
      <Route path="/catalogo/:tenantSlug" element={<CatalogPage />} />
      <Route path="/catalogo/:tenantSlug/carrito" element={<CartPage />} />
      <Route path="/catalogo/:tenantSlug/checkout" element={<CheckoutPage />} />
      <Route path="/catalogo/:tenantSlug/pedido-exitoso" element={<OrderSuccessPage />} />
      <Route path="*" element={<Navigate to="/catalogo/flora" replace />} />
    </Routes>
  );
}
