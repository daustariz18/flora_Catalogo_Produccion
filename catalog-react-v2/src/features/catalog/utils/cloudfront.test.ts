import { describe, expect, it } from "vitest";
import { buildCloudfrontAssetUrl, getDefaultTenantLogo, resolveProductImageCandidates, resolveProductImageUrl } from "./cloudfront";

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

  it("keeps relative legacy image paths untouched", () => {
    expect(resolveProductImageUrl("/ramo.png", "flora")).toBe("/ramo.png");
  });

  it("prioritizes the requested product image variant and falls back to the original image", () => {
    expect(
      resolveProductImageCandidates(
        {
          imagen_sm: null,
          imagen_md: "/productos/12-md.jpg",
          imagen_lg: "/productos/12-lg.jpg",
          imagen_url: "/productos/12.jpg",
        },
        "flora",
        "sm",
      ),
    ).toEqual(["/productos/12.jpg", "/productos/12-md.jpg", "/productos/12-lg.jpg", "/product-placeholder.svg"]);
  });
});
