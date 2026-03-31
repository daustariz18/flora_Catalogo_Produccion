import path from "node:path";

export function normalizeLogoFileName(originalFileName) {
  const extension = path.extname(originalFileName || "").toLowerCase();
  const baseName = path.basename(originalFileName || "logo", extension);

  const normalizedBase = baseName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .toLowerCase();

  const safeBase = normalizedBase || "logo";
  const safeExtension = extension || ".png";
  const timestamp = Date.now();

  return `${safeBase}-${timestamp}${safeExtension}`;
}

export function buildTenantLogoKey(tenantSlug, originalFileName) {
  const normalizedFileName = normalizeLogoFileName(originalFileName);
  return `tenants/${tenantSlug}/logos/${normalizedFileName}`;
}
