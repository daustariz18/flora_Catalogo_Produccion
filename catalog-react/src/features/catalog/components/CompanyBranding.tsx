import type { Empresa } from "../../../shared/types/catalog";
import { Header } from "./Header";

interface CompanyBrandingProps {
  company: Empresa;
}

export function CompanyBranding({ company }: CompanyBrandingProps) {
  return <Header company={company} tenantSlug={slugifyCompanyName(company.nombre)} />;
}

function slugifyCompanyName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
