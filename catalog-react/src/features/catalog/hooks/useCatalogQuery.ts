import { useQuery } from "@tanstack/react-query";
import { fetchCatalogByEmpresa } from "../api/catalogApi";

export function useCatalogQuery(empresaID: string) {
  return useQuery({
    queryKey: ["catalog", empresaID],
    queryFn: () => fetchCatalogByEmpresa(empresaID),
    enabled: Boolean(empresaID),
    staleTime: 1000 * 60 * 5,
  });
}
