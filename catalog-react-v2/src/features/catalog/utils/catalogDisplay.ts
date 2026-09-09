import type { Categoria, Producto } from "../../../shared/types/catalog";

interface CatalogDisplayOptions {
  companyId?: number | string | null;
}

function normalizeValue(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function normalizeSearchValue(value: string): string {
  return normalizeValue(value).replace(/[\s._-]+/g, "");
}

function tokenizeSearchValue(value: string): string[] {
  return normalizeValue(value)
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .map((token) => token.trim())
    .filter(Boolean);
}

function buildCategorySearchId(value: string): number {
  const normalized = value.trim().toLowerCase();
  let hash = 0;

  for (const char of normalized) {
    hash = (hash * 31 + char.codePointAt(0)!) >>> 0;
  }

  return hash === 0 ? 1 : hash;
}

function normalizeCategoryOrderKey(value: string): string {
  return normalizeValue(value)
    .replace(/&/g, "y")
    .replace(/[\s._-]+/g, "");
}

export function isPersonalizedCategoryName(value: string): boolean {
  return normalizeValue(value).includes("personaliz");
}

export function isMother2026CategoryName(value: string): boolean {
  const normalized = normalizeSearchValue(value);
  return normalized.includes("madre2026");
}

function getCategoryPriority(value: string): number {
  const normalized = normalizeCategoryOrderKey(value);
  const orderedCategories = [
    ["personalizado", "arreglospersonalizados"],
    ["florabox"],
    ["floracanastos"],
    ["florabouquets"],
    ["corazones"],
    ["maderas"],
    ["ceramicasyvidrios", "ceramicasvidrios"],
    ["ancheta"],
    ["condolencias"],
    ["floramujer"],
    ["adicionales"],
    ["primavera"],
    ["bodas"],
    ["diamujer"],
    ["evento"],
    ["madre2026", "madres", "floramadres"],
  ] as const;

  for (let index = 0; index < orderedCategories.length; index += 1) {
    if (orderedCategories[index].some((candidate) => normalized.includes(candidate))) {
      return index;
    }
  }

  return orderedCategories.length + 1;
}

function normalizeCompanyId(value: number | string | null | undefined): number | null {
  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : null;
}

function getCompanyThreeCategoryPriority(value: string): number | null {
  const normalized = normalizeCategoryOrderKey(value);
  const orderedCategories = [
    ["personalizado", "arreglospersonalizados"],
    ["amoryamistad", "amoryamigos"],
    ["amarillo", "amarillos"],
  ] as const;

  for (let index = 0; index < orderedCategories.length; index += 1) {
    if (orderedCategories[index].some((candidate) => normalized.includes(candidate))) {
      return index;
    }
  }

  return null;
}

export function getCompanyCategoryPriority(value: string, companyId: number | string | null | undefined): number | null {
  if (normalizeCompanyId(companyId) === 3) {
    return getCompanyThreeCategoryPriority(value);
  }

  return null;
}

export function sortCategoriesForDisplay(categories: Categoria[], options: CatalogDisplayOptions = {}): Categoria[] {
  return categories
    .map((category) => ({ category }))
    .sort((a, b) => {
      const aCompanyPriority = getCompanyCategoryPriority(a.category.nombre, options.companyId);
      const bCompanyPriority = getCompanyCategoryPriority(b.category.nombre, options.companyId);

      if (aCompanyPriority !== null || bCompanyPriority !== null) {
        if (aCompanyPriority === null) {
          return 1;
        }

        if (bCompanyPriority === null) {
          return -1;
        }

        if (aCompanyPriority !== bCompanyPriority) {
          return aCompanyPriority - bCompanyPriority;
        }
      }

      const aOrder = a.category.orden_catalogo;
      const bOrder = b.category.orden_catalogo;
      const aHasOrder = aOrder !== null && aOrder !== undefined;
      const bHasOrder = bOrder !== null && bOrder !== undefined;

      if (aHasOrder && bHasOrder && aOrder !== bOrder) {
        return aOrder - bOrder;
      }

      if (aHasOrder !== bHasOrder) {
        return aHasOrder ? -1 : 1;
      }

      return a.category.id - b.category.id;
    })
    .map(({ category }) => category);
}

export function sortProductsForDisplay(products: Producto[], options: CatalogDisplayOptions = {}): Producto[] {
  return products
    .map((product, index) => ({ product, index }))
    .sort((a, b) => {
      const aCompanyPriority = getCompanyCategoryPriority(a.product.categoriaNombre ?? "", options.companyId);
      const bCompanyPriority = getCompanyCategoryPriority(b.product.categoriaNombre ?? "", options.companyId);

      if (aCompanyPriority !== null || bCompanyPriority !== null) {
        if (aCompanyPriority === null) {
          return 1;
        }

        if (bCompanyPriority === null) {
          return -1;
        }

        if (aCompanyPriority !== bCompanyPriority) {
          return aCompanyPriority - bCompanyPriority;
        }
      }

      const aPriority = getCategoryPriority(a.product.categoriaNombre ?? "");
      const bPriority = getCategoryPriority(b.product.categoriaNombre ?? "");

      if (aPriority !== bPriority) {
        return aPriority - bPriority;
      }

      return a.index - b.index;
    })
    .map(({ product }) => product);
}

export function matchesCatalogSearch(product: Producto, query: string, categories: Categoria[] = []): boolean {
  const normalizedQuery = normalizeSearchValue(query);

  if (!normalizedQuery) {
    return true;
  }

  const categoryNameById = new Map(categories.map((category) => [category.id, category.nombre] as const));
  const categoryNameByHashedId = new Map(categories.map((category) => [buildCategorySearchId(category.nombre), category.nombre] as const));
  const resolvedCategoryName =
    product.categoriaNombre?.trim() ||
    categoryNameById.get(product.id_categoria ?? product.categoriaID) ||
    categoryNameByHashedId.get(product.id_categoria ?? product.categoriaID) ||
    "";
  const searchText = [
    product.nombre,
    product.codigo_catalogo ?? product.codigo_producto ?? product.codigoProduct ?? "",
    resolvedCategoryName,
    product.descripcion ?? "",
  ]
    .map((value) => normalizeSearchValue(value))
    .filter(Boolean)
    .join(" ");
  const queryTokens = tokenizeSearchValue(query);

  if (searchText.includes(normalizedQuery)) {
    return true;
  }

  if (queryTokens.length > 1 && queryTokens.every((token) => searchText.includes(token))) {
    return true;
  }

  const nombre = normalizeSearchValue(product.nombre);
  const codigo = normalizeSearchValue(product.codigo_catalogo ?? product.codigo_producto ?? product.codigoProduct ?? "");
  const categoria = normalizeSearchValue(resolvedCategoryName);
  const categoryIds = new Set(
    categories
      .filter((category) => normalizeSearchValue(category.nombre).includes(normalizedQuery))
      .flatMap((category) => [category.id, buildCategorySearchId(category.nombre)]),
  );
  const productCategoryId = product.id_categoria ?? product.categoriaID;

  return (
    nombre.includes(normalizedQuery) ||
    codigo.includes(normalizedQuery) ||
    categoria.includes(normalizedQuery) ||
    normalizeSearchValue(product.descripcion ?? "").includes(normalizedQuery) ||
    (productCategoryId !== undefined && categoryIds.has(productCategoryId))
  );
}
