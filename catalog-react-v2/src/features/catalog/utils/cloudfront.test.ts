import { describe, expect, it } from "vitest";
import { buildCloudfrontAssetUrl, getDefaultTenantLogo } from "./cloudfront";

describe("cloudfront helpers", () => {
  it("builds the default tenant logo path", () => {
    expect(getDefaultTenantLogo(" Flora ")).toBe("tenants/flora/logos/logo.png");
  });

  it("returns absolute urls unchanged", () => {
    const url = "https://example.com/media/flower.png";

    expect(buildCloudfrontAssetUrl(url, "flora", "productos")).toBe(url);
  });

  it("builds the cloudfront fallback path when only a filename is provided", () => {
    expect(buildCloudfrontAssetUrl("rosa roja.png", "flora", "productos")).toBe(
      "https://ddy2osi8uorg4.cloudfront.net/tenants/flora/productos/rosa%20roja.png",
    );
  });

  it("extracts a tenants path from a backend url", () => {
    expect(
      buildCloudfrontAssetUrl("/storage/tenants/flora/productos/rosa.png?signature=abc", "flora", "productos"),
    ).toBe("https://ddy2osi8uorg4.cloudfront.net/tenants/flora/productos/rosa.png");
  });
});
