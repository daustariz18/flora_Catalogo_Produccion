import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

const mocks = vi.hoisted(() => ({
  addItem: vi.fn(),
}));

vi.mock("../../cart/store/cartStore", () => ({
  useCartStore: (selector: (state: { addItem: typeof mocks.addItem }) => unknown) =>
    selector({ addItem: mocks.addItem }),
}));

import { ProductCard } from "./ProductCard";

describe("ProductCard", () => {
  it("opens details and adds the product to the cart", () => {
    const onOpenDetail = vi.fn();

    render(
      <ProductCard
        id={5}
        nombre="Ramo Primavera"
        codigoProducto="FLORA-0001"
        precio={25000}
        imagenUrl="/ramo.png"
        categoria="Primavera"
        companyColor="#123456"
        onOpenDetail={onOpenDetail}
      />,
    );

    expect(screen.getByText("Codigo: FLORA-0001")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Ver detalle de Ramo Primavera" }));
    fireEvent.click(screen.getByRole("button", { name: "Anadir al carrito" }));

    expect(onOpenDetail).toHaveBeenCalledTimes(1);
    expect(mocks.addItem).toHaveBeenCalledWith({
      id: 5,
      nombre: "Ramo Primavera",
      precio: 25000,
      imagen: "/ramo.png",
    });
  });

  it("does not render the code when the backend does not send it", () => {
    render(
      <ProductCard
        id={6}
        nombre="Ramo Sin Codigo"
        precio={20000}
        imagenUrl="/ramo.png"
        categoria="Ramos"
        companyColor="#123456"
        onOpenDetail={vi.fn()}
      />,
    );

    expect(screen.queryByText(/Codigo:/)).toBeNull();
  });
});
