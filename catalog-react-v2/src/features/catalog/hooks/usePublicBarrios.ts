import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import type { AvailableBarrio } from "../../cart/store/cartStore";
import { fetchPublicBarrios, type PublicBarrioResponse } from "../api/publicBarriosApi";

interface UsePublicBarriosResult {
  barrios: AvailableBarrio[];
  isLoading: boolean;
  error: string | null;
}

export function usePublicBarrios(tenantSlug: string): UsePublicBarriosResult {
  const normalizedTenant = tenantSlug.trim();

  const barriosQuery = useQuery({
    queryKey: ["public-catalog-barrios", normalizedTenant],
    queryFn: () => fetchPublicBarrios(normalizedTenant),
    enabled: Boolean(normalizedTenant),
    staleTime: 1000 * 60 * 10,
  });

  const barrios = useMemo(() => {
    const mapped = (barriosQuery.data?.barrios ?? [])
      .filter((item) => item.activo !== false)
      .map(mapBarrio);

    return mapped.sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  }, [barriosQuery.data?.barrios]);

  return {
    barrios,
    isLoading: barriosQuery.isLoading,
    error: barriosQuery.error instanceof Error ? barriosQuery.error.message : null,
  };
}

function mapBarrio(payload: PublicBarrioResponse): AvailableBarrio {
  const costo = Number(payload.costo_domicilio);

  return {
    id: payload.id_barrio,
    nombre: payload.nombre_barrio.trim(),
    costoDomicilio: Number.isFinite(costo) ? costo : 0,
  };
}
