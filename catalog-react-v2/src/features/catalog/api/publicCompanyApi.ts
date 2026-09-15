import { fetchPublicApiJson } from "../../../shared/api/publicApi";

export interface PublicCompanyResponse {
  id?: number;
  empresa_id?: number | null;
  empresaID?: number | null;
  nombre: string;
  logo_url?: string | null;
  logoUrl?: string | null;
  colorPrimario?: string | null;
  color_primario?: string | null;
  colorSecundario?: string | null;
  color_secundario?: string | null;
  colorFondo?: string | null;
  color_fondo?: string | null;
  colorFondoSuave?: string | null;
  color_fondo_suave?: string | null;
  colorTexto?: string | null;
  color_texto?: string | null;
  colorTextoSuave?: string | null;
  color_texto_suave?: string | null;
  colorBorde?: string | null;
  color_borde?: string | null;
  fuenteFamilia?: string | null;
  fuente_familia?: string | null;
  fuenteTamanoBase?: string | null;
  fuente_tamano_base?: string | null;
}

export async function fetchPublicCompany(tenantSlug: string): Promise<PublicCompanyResponse> {
  return fetchPublicApiJson<PublicCompanyResponse>(
    `/api/public/${encodeURIComponent(tenantSlug)}/empresa`,
    "catalogo publico",
  );
}
