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

  it("keeps all country code entries populated", () => {
    for (const entry of countryCodes) {
      expect(entry.code.trim()).not.toBe("");
      expect(entry.name.trim()).not.toBe("");
    }
  });
});
