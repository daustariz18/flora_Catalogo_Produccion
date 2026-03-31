import { useQuery } from "@tanstack/react-query";
import { fetchPublicProducts } from "../api/catalogApi";

export function useProducts(tenantSlug: string) {
  return useQuery({
    queryKey: ["public-products", tenantSlug],
    queryFn: () => fetchPublicProducts(tenantSlug),
    enabled: Boolean(tenantSlug),
    staleTime: 1000 * 60 * 5,
  });
}
