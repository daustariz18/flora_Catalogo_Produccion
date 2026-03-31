const CLOUDFRONT_BASE_URL = "https://ddy2osi8uorg4.cloudfront.net";

type AssetType = "logos" | "productos";

export function getDefaultTenantLogo(tenantSlug: string): string {
  const normalizedTenant = tenantSlug.trim().toLowerCase();

  if (!normalizedTenant) {
    return "";
  }

  return `tenants/${normalizedTenant}/logos/logo.png`;
}

export function buildCloudfrontAssetUrl(rawPath: string | null | undefined, tenantSlug: string, assetType: AssetType): string {
  const normalizedTenant = tenantSlug.trim();
  const input = (rawPath ?? "").trim();

  if (!normalizedTenant || !input) {
    return "";
  }

  // Keep backend-provided absolute URLs as-is to avoid breaking signed or specially encoded object keys.
  if (isAbsoluteUrl(input)) {
    return input;
  }

  const extractedPath = extractStoragePath(input);

  if (extractedPath) {
    return `${CLOUDFRONT_BASE_URL}/${encodePath(extractedPath)}`;
  }

  const fileName = extractFileName(input);
  if (!fileName) {
    return "";
  }

  const fallbackPath = `tenants/${normalizedTenant}/${assetType}/${fileName}`;
  return `${CLOUDFRONT_BASE_URL}/${encodePath(fallbackPath)}`;
}

function isAbsoluteUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function extractStoragePath(value: string): string {
  const withoutQuery = value.split("?")[0].split("#")[0];

  try {
    const parsed = new URL(withoutQuery);
    const path = parsed.pathname.replace(/^\/+/, "");
    return pickPathFromTenants(path);
  } catch {
    const trimmed = withoutQuery.replace(/^\/+/, "");
    return pickPathFromTenants(trimmed);
  }
}

function pickPathFromTenants(path: string): string {
  const marker = "tenants/";
  const index = path.toLowerCase().indexOf(marker);

  if (index === -1) {
    return "";
  }

  return path.slice(index);
}

function extractFileName(value: string): string {
  const withoutQuery = value.split("?")[0].split("#")[0];
  const segments = withoutQuery.split("/").filter(Boolean);
  if (!segments.length) {
    return "";
  }

  const raw = segments[segments.length - 1];

  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

function encodePath(path: string): string {
  return path
    .split("/")
    .filter(Boolean)
    .map((segment) => {
      try {
        return encodeURIComponent(decodeURIComponent(segment));
      } catch {
        return encodeURIComponent(segment);
      }
    })
    .join("/");
}
