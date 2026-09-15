import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "react-router-dom";
import { fetchPublicCompany, type PublicCompanyResponse } from "../../features/catalog/api/publicCompanyApi";
import { resolveTenantSlug } from "../utils/tenantSlug";
import { applyCompanyTheme, type CompanyThemeColors } from "../theme/companyTheme";

/**
 * Detecta el tenant activo a partir de la URL actual, sin depender de que la
 * ruta este anidada bajo un <Route> con :tenantSlug (por eso no se usa useParams
 * aqui: este hook vive por encima de <Routes> para cubrir TODAS las paginas).
 * Debe reflejar los mismos patrones que AppRouter.
 */
function extractTenantSlugFromPath(pathname: string): string {
  const segments = pathname.split("/").filter(Boolean);

  if (segments.length === 0 || segments[0] === "login") {
    return "";
  }

  if (segments[0] === "catalogo") {
    const second = segments[1];
    return second && second !== "carrito" && second !== "checkout" ? second : "";
  }

  if (segments.length >= 2 && (segments[1] === "carrito" || segments[1] === "checkout")) {
    return segments[0];
  }

  return "";
}

function mapPublicCompanyToTheme(payload: PublicCompanyResponse | undefined): CompanyThemeColors {
  if (!payload) {
    return {};
  }

  return {
    colorPrimario: payload.colorPrimario || payload.color_primario,
    colorSecundario: payload.colorSecundario || payload.color_secundario,
    colorFondo: payload.colorFondo || payload.color_fondo,
    colorFondoSuave: payload.colorFondoSuave || payload.color_fondo_suave,
    colorTexto: payload.colorTexto || payload.color_texto,
    colorTextoSuave: payload.colorTextoSuave || payload.color_texto_suave,
    colorBorde: payload.colorBorde || payload.color_borde,
    fuenteFamilia: payload.fuenteFamilia || payload.fuente_familia,
    fuenteTamanoBase: payload.fuenteTamanoBase || payload.fuente_tamano_base,
  };
}

/**
 * Mantiene el tema del tenant (color, fuente, tamano) aplicado como variables
 * CSS en <html> en CUALQUIER pagina de la app (catalogo, carrito, checkout,
 * exito) — no solo en la pagina de catalogo. Se monta una sola vez a nivel de
 * AppRouter y reacciona a cambios de ruta via useLocation.
 *
 * Usa la misma query key que usePublicCatalog para que React Query comparta
 * cache entre ambos y no se dupliquen llamadas a la API.
 */
export function useTenantThemeSync(): void {
  const location = useLocation();
  const tenantSlug = useMemo(
    () => resolveTenantSlug(extractTenantSlugFromPath(location.pathname)),
    [location.pathname],
  );

  const { data } = useQuery({
    queryKey: ["public-catalog-company", tenantSlug],
    queryFn: () => fetchPublicCompany(tenantSlug),
    enabled: Boolean(tenantSlug),
    staleTime: 1000 * 60 * 10,
  });

  useEffect(() => {
    if (data) {
      applyCompanyTheme(mapPublicCompanyToTheme(data));
    }
  }, [data]);
}
