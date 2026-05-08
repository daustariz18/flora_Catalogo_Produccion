import { useEffect, useMemo, useState } from "react";
import type { Empresa } from "../../../shared/types/catalog";
import { buildCloudfrontAssetUrl } from "../utils/cloudfront";

interface HeaderProps {
  company: Empresa;
  tenantSlug: string;
}

export function Header({ company, tenantSlug }: HeaderProps) {
  const [hasLogoError, setHasLogoError] = useState(false);
  const [logoIndex, setLogoIndex] = useState(0);
  const logoCandidates = useMemo(
    () => buildLogoCandidates(company, tenantSlug),
    [company.logo, company.logoUrl, company.nombre, tenantSlug],
  );
  const logoUrl = logoCandidates[logoIndex] ?? "";
  const shouldShowLogo = Boolean(logoUrl) && !hasLogoError;
  const fallbackInitial = getFallbackInitial(company.nombre);

  useEffect(() => {
    setHasLogoError(false);
    setLogoIndex(0);
  }, [company.logo, company.logoUrl, company.nombre, tenantSlug]);

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
              onError={() => {
                setLogoIndex((current) => {
                  const nextIndex = current + 1;
                  if (nextIndex < logoCandidates.length) {
                    return nextIndex;
                  }

                  setHasLogoError(true);
                  return current;
                });
              }}
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

function buildLogoCandidates(company: Empresa, tenantSlug: string): string[] {
  const candidates = new Set<string>();
  const normalizedTenant = tenantSlug.trim().toLowerCase();

  if (company.logoUrl?.trim()) {
    candidates.add(company.logoUrl.trim());
  }

  if (company.logo?.trim()) {
    candidates.add(buildCloudfrontAssetUrl(company.logo.trim(), normalizedTenant, "logos"));
  }

  if (normalizedTenant) {
    for (const fileName of ["logo.png", "logo.webp", "logo.jpg", "logo.jpeg", "logo.svg"]) {
      candidates.add(
        buildCloudfrontAssetUrl(`tenants/${normalizedTenant}/logos/${fileName}`, normalizedTenant, "logos"),
      );
    }
  }

  return Array.from(candidates).filter(Boolean);
}
