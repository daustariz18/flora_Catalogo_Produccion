import { fetchPublicApiJson } from "../../../shared/api/publicApi";

export interface PublicBarrioResponse {
  id_barrio: number;
  empresa_id?: number | null;
  sucursal_id?: number | null;
  zona_id?: number | null;
  nombre_barrio: string;
  costo_domicilio: number | string;
  activo?: boolean | null;
}

export interface PublicBarriosPayload {
  empresa_id?: number;
  slug?: string;
  barrios: PublicBarrioResponse[];
}

export async function fetchPublicBarrios(tenantSlug: string): Promise<PublicBarriosPayload> {
  return fetchPublicApiJson<PublicBarriosPayload>(
    `/api/public/${encodeURIComponent(tenantSlug)}/barrios`,
    "catalogo publico",
  );
}
