const TENANT_STORAGE_KEY = "petalops-last-tenant-slug";

export function normalizeTenantSlug(tenantSlug?: string | null): string {
  return tenantSlug?.trim() ?? "";
}

export function getStoredTenantSlug(): string {
  try {
    return normalizeTenantSlug(window.localStorage.getItem(TENANT_STORAGE_KEY));
  } catch {
    return "";
  }
}

export function storeTenantSlug(tenantSlug?: string | null): void {
  try {
    const normalized = normalizeTenantSlug(tenantSlug);

    if (normalized) {
      window.localStorage.setItem(TENANT_STORAGE_KEY, normalized);
      return;
    }

    window.localStorage.removeItem(TENANT_STORAGE_KEY);
  } catch {
    // Ignore storage failures so navigation still works.
  }
}

export function resolveTenantSlug(tenantSlug?: string | null): string {
  return normalizeTenantSlug(tenantSlug) || getStoredTenantSlug();
}

export function buildTenantPath(tenantSlug?: string | null, suffix = ""): string {
  const resolvedTenantSlug = resolveTenantSlug(tenantSlug);

  if (resolvedTenantSlug) {
    return `/catalogo/${resolvedTenantSlug}${suffix}`;
  }

  return `/catalogo${suffix}`;
}
