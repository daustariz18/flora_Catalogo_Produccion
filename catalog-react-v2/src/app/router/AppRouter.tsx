import { Navigate, Route, Routes } from "react-router-dom";
import { CatalogPage } from "../../features/catalog/pages/CatalogPage";
import { CartPage } from "../../features/cart/components/CartPage";
import { CheckoutPage } from "../../features/cart/components/CheckoutPage";
import { OrderSuccessPage } from "../../features/cart/components/OrderSuccessPage";
import { LoginPage } from "../../pages/LoginPage";

export function AppRouter() {
  return (
    <Routes>
      <Route path="/catalogo" element={<CatalogPage />} />
      <Route path="/catalogo/carrito" element={<CartPage />} />
      <Route path="/catalogo/checkout" element={<CheckoutPage />} />
      <Route path="/catalogo/:tenantSlug" element={<CatalogPage />} />
      <Route path="/catalogo/:tenantSlug/carrito" element={<CartPage />} />
      <Route path="/catalogo/:tenantSlug/checkout" element={<CheckoutPage />} />
      <Route path="/catalogo/:tenantSlug/pedido-exitoso" element={<OrderSuccessPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/:tenantSlug/carrito" element={<CartPage />} />
      <Route path="/:tenantSlug/checkout" element={<CheckoutPage />} />
      <Route path="*" element={<Navigate to="/catalogo" replace />} />
    </Routes>
  );
}
