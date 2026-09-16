import { describe, expect, it } from "vitest";
import { countryCodes } from "./countryCodes";

describe("countryCodes", () => {
  it("includes the main dialing codes used by the checkout and the expanded regions", () => {
    expect(countryCodes).toContainEqual({ code: "+57", name: "Colombia" });
    expect(countryCodes).toContainEqual({ code: "+1", name: "Estados Unidos" });
    expect(countryCodes).toContainEqual({ code: "+61", name: "Australia" });
    expect(countryCodes).toContainEqual({ code: "+81", name: "Japon" });
    expect(countryCodes).toContainEqual({ code: "+7", name: "Kazajistan" });
  });

  it("excludes Antigua y Barbuda so the +1 selector keeps Estados Unidos available", () => {
    expect(countryCodes).not.toContainEqual({ code: "+1", name: "Antigua y Barbuda" });
  });

  it("keeps all country code entries populated", () => {
    for (const entry of countryCodes) {
      expect(entry.code.trim()).not.toBe("");
      expect(entry.name.trim()).not.toBe("");
    }
  });

  it("sorts country code entries alphabetically by country name", () => {
    const sortedNames = countryCodes
      .map((entry) => entry.name)
      .toSorted((a, b) => a.localeCompare(b, "es", { sensitivity: "base" }));

    expect(countryCodes.map((entry) => entry.name)).toEqual(sortedNames);
  });
});
