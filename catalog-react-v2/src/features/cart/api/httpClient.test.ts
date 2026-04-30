import { describe, expect, it, vi } from "vitest";
import { getJson } from "../../../shared/api/httpClient";
import { createJsonResponse } from "../../../test/testUtils";

describe("getJson", () => {
  it("returns parsed json when the response is ok", async () => {
    const fetchMock = vi.fn().mockResolvedValue(createJsonResponse({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(getJson<{ ok: boolean }>("/api/demo")).resolves.toEqual({ ok: true });
  });

  it("throws when the response is not ok", async () => {
    const fetchMock = vi.fn().mockResolvedValue(createJsonResponse({}, { ok: false, status: 500 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(getJson("/api/demo")).rejects.toThrow("Error HTTP 500");
  });
});
