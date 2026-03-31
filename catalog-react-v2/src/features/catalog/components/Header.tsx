import { useEffect, useMemo, useState } from "react";
import type { Empresa } from "../../../shared/types/catalog";
import { buildCloudfrontAssetUrl } from "../utils/cloudfront";

interface HeaderProps {
  company: Empresa;
  tenantSlug: string;
}

export function Header({ company, tenantSlug }: HeaderProps) {
  const [hasLogoError, setHasLogoError] = useState(false);
  const logoUrl = useMemo(
    () => buildCloudfrontAssetUrl(company.logo || company.logoUrl, tenantSlug, "logos"),
    [company.logo, company.logoUrl, tenantSlug],
  );
  const shouldShowLogo = Boolean(logoUrl) && !hasLogoError;
  const fallbackInitial = getFallbackInitial(company.nombre);

  useEffect(() => {
    setHasLogoError(false);
  }, [logoUrl, tenantSlug]);

  return (
    <header className="company-header">
      <div className="company-header-inner px-4 py-3">
        <div className="company-logo" aria-label={`Identidad visual de ${company.nombre}`}>
          {shouldShowLogo ? (
            <img
              className="company-logo-image"
              src={logoUrl}
              alt={`Logo de ${company.nombre}`}
              loading="lazy"
              onError={() => setHasLogoError(true)}
            />
          ) : (
            <span className="company-logo-fallback-initial" aria-hidden="true" title={company.nombre}>
              {fallbackInitial}
            </span>
          )}
        </div>

        <div className="min-w-0">
          <h1 className="truncate text-xl font-bold text-slate-900">{company.nombre}</h1>
          <p className="text-sm text-gray-500">Arreglos florales para cada ocasion</p>
        </div>
      </div>
    </header>
  );
}

function getFallbackInitial(name: string): string {
  const trimmed = name.trim().toUpperCase();

  if (!trimmed) {
    return "F";
  }

  return trimmed.charAt(0);
}
