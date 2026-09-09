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
}

export async function fetchPublicCompany(tenantSlug: string): Promise<PublicCompanyResponse> {
  return fetchPublicApiJson<PublicCompanyResponse>(
    `/api/public/${encodeURIComponent(tenantSlug)}/empresa`,
    "catalogo publico",
  );
}
