import { describe, expect, it } from "vitest";
import { countryCodes } from "./countryCodes";

describe("countryCodes", () => {
  it("includes Colombia and the main dialing codes used by the checkout", () => {
    expect(countryCodes).toContainEqual({ code: "+57", name: "Colombia" });
    expect(countryCodes).toContainEqual({ code: "+1", name: "Estados Unidos" });
  });

  it("keeps all country code entries populated", () => {
    for (const entry of countryCodes) {
      expect(entry.code.trim()).not.toBe("");
      expect(entry.name.trim()).not.toBe("");
    }
  });
});
