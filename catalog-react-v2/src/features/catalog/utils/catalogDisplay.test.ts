import { describe, expect, it } from "vitest";
import type { Categoria, Producto } from "../../../shared/types/catalog";
import { sortCategoriesForDisplay, sortProductsForDisplay } from "./catalogDisplay";

describe("catalogDisplay", () => {
  it("puts personalized categories first", () => {
    const categories: Categoria[] = [
      { id: 2, nombre: "Flora Box" },
      { id: 1, nombre: "Arreglos personalizados" },
      { id: 4, nombre: "Flora Madres" },
      { id: 3, nombre: "Condolencias" },
      { id: 5, nombre: "Adicionales" },
    ];

    expect(sortCategoriesForDisplay(categories).map((category) => category.nombre)).toEqual([
      "Arreglos personalizados",
      "Flora Madres",
      "Flora Box",
      "Condolencias",
      "Adicionales",
    ]);
  });

  it("puts personalized products first", () => {
    const products: Producto[] = [
      { id: 2, nombre: "Rosa Roja", precio: 10000, imagen: "/rosa.png", categoriaID: 1, categoriaNombre: "Rosas" },
      {
        id: 3,
        nombre: "Arreglo Madre 2026",
        precio: 15000,
        imagen: "/madre.png",
        categoriaID: 3,
        categoriaNombre: "Flora Madres",
      },
      {
        id: 1,
        nombre: "Arreglo Personalizado Deluxe",
        precio: 12000,
        imagen: "/personalizado.png",
        categoriaID: 2,
        categoriaNombre: "Arreglos personalizados",
      },
    ];

    expect(sortProductsForDisplay(products).map((product) => product.nombre)).toEqual([
      "Arreglo Personalizado Deluxe",
      "Arreglo Madre 2026",
      "Rosa Roja",
    ]);
  });

  it("keeps backend order for the remaining categories and products", () => {
    const categories: Categoria[] = [
      { id: 10, nombre: "Personalizado" },
      { id: 11, nombre: "Flora Madres" },
      { id: 20, nombre: "Flora Box" },
      { id: 21, nombre: "Flora Canastos" },
      { id: 22, nombre: "Flora Bouquets" },
      { id: 23, nombre: "Corazones" },
      { id: 30, nombre: "Ceramicas & Vidrios" },
      { id: 31, nombre: "Maderas" },
      { id: 32, nombre: "Ancheta" },
      { id: 33, nombre: "Condolencias" },
      { id: 34, nombre: "Flora Mujer" },
      { id: 40, nombre: "Adicionales" },
      { id: 41, nombre: "Primavera" },
      { id: 42, nombre: "Bodas" },
      { id: 43, nombre: "Dia Mujer" },
      { id: 44, nombre: "Evento" },
    ];
    const products: Producto[] = [
      {
        id: 1,
        nombre: "Producto Flora Box",
        precio: 10000,
        imagen: "/flora-box.png",
        categoriaID: 20,
        categoriaNombre: "Flora Box",
      },
      {
        id: 2,
        nombre: "Producto Personalizado",
        precio: 12000,
        imagen: "/personalizado.png",
        categoriaID: 10,
        categoriaNombre: "Personalizado",
      },
      {
        id: 3,
        nombre: "Producto Madre",
        precio: 15000,
        imagen: "/madre.png",
        categoriaID: 11,
        categoriaNombre: "Flora Madres",
      },
      {
        id: 4,
        nombre: "Producto Canastos",
        precio: 9000,
        imagen: "/canastos.png",
        categoriaID: 21,
        categoriaNombre: "Flora Canastos",
      },
      {
        id: 5,
        nombre: "Producto Bouquets",
        precio: 9000,
        imagen: "/bouquets.png",
        categoriaID: 22,
        categoriaNombre: "Flora Bouquets",
      },
      {
        id: 6,
        nombre: "Producto Corazones",
        precio: 9000,
        imagen: "/corazones.png",
        categoriaID: 23,
        categoriaNombre: "Corazones",
      },
      {
        id: 7,
        nombre: "Producto Ceramicas",
        precio: 9000,
        imagen: "/ceramicas.png",
        categoriaID: 30,
        categoriaNombre: "Ceramicas & Vidrios",
      },
      {
        id: 8,
        nombre: "Producto Maderas",
        precio: 9000,
        imagen: "/maderas.png",
        categoriaID: 31,
        categoriaNombre: "Maderas",
      },
      {
        id: 9,
        nombre: "Producto Ancheta",
        precio: 9000,
        imagen: "/ancheta.png",
        categoriaID: 32,
        categoriaNombre: "Ancheta",
      },
      {
        id: 10,
        nombre: "Producto Condolencias",
        precio: 9000,
        imagen: "/condolencias.png",
        categoriaID: 33,
        categoriaNombre: "Condolencias",
      },
      {
        id: 11,
        nombre: "Producto Flora Mujer",
        precio: 9000,
        imagen: "/mujer.png",
        categoriaID: 34,
        categoriaNombre: "Flora Mujer",
      },
      {
        id: 12,
        nombre: "Producto Adicionales",
        precio: 8000,
        imagen: "/adicionales.png",
        categoriaID: 40,
        categoriaNombre: "Adicionales",
      },
      {
        id: 13,
        nombre: "Producto Primavera",
        precio: 8000,
        imagen: "/primavera.png",
        categoriaID: 41,
        categoriaNombre: "Primavera",
      },
      {
        id: 14,
        nombre: "Producto Bodas",
        precio: 8000,
        imagen: "/bodas.png",
        categoriaID: 42,
        categoriaNombre: "Bodas",
      },
      {
        id: 15,
        nombre: "Producto Dia Mujer",
        precio: 8000,
        imagen: "/dia-mujer.png",
        categoriaID: 43,
        categoriaNombre: "Dia Mujer",
      },
      {
        id: 16,
        nombre: "Producto Evento",
        precio: 8000,
        imagen: "/evento.png",
        categoriaID: 44,
        categoriaNombre: "Evento",
      },
    ];

    expect(sortCategoriesForDisplay(categories).map((category) => category.nombre)).toEqual([
      "Personalizado",
      "Flora Madres",
      "Flora Box",
      "Flora Canastos",
      "Flora Bouquets",
      "Corazones",
      "Maderas",
      "Ceramicas & Vidrios",
      "Ancheta",
      "Condolencias",
      "Flora Mujer",
      "Adicionales",
      "Primavera",
      "Bodas",
      "Dia Mujer",
      "Evento",
    ]);
    expect(sortProductsForDisplay(products).map((product) => product.nombre)).toEqual([
      "Producto Personalizado",
      "Producto Madre",
      "Producto Flora Box",
      "Producto Canastos",
      "Producto Bouquets",
      "Producto Corazones",
      "Producto Maderas",
      "Producto Ceramicas",
      "Producto Ancheta",
      "Producto Condolencias",
      "Producto Flora Mujer",
      "Producto Adicionales",
      "Producto Primavera",
      "Producto Bodas",
      "Producto Dia Mujer",
      "Producto Evento",
    ]);
  });
});
