import { describe, expect, it } from "vitest";
import { formatCOP } from "./currency";

describe("formatCOP", () => {
  it("formats positive amounts in Colombian pesos", () => {
    expect(formatCOP(1234567)).toBe("$ 1.234.567");
  });

  it("formats zero without decimals", () => {
    expect(formatCOP(0)).toBe("$ 0");
  });
});
