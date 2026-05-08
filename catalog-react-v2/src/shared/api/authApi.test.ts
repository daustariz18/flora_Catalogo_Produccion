import { describe, expect, it, vi } from "vitest";
import { createJsonResponse } from "../../test/testUtils";
import { clearAccessTokens, login } from "./authApi";

describe("authApi", () => {
  it("posts credentials to /auth/login and stores tokens", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      createJsonResponse({
        access_token: "access-123",
        refresh_token: "refresh-456",
        token_type: "bearer",
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      login({
        email: "ana@correo.com",
        password: "secret",
        slug: "flora",
      }),
    ).resolves.toEqual({
      access_token: "access-123",
      refresh_token: "refresh-456",
      token_type: "bearer",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/auth/login"),
      expect.objectContaining({
        method: "POST",
      }),
    );
    expect(localStorage.getItem("petalops-access-token")).toBe("access-123");
    expect(localStorage.getItem("petalops-refresh-token")).toBe("refresh-456");
  });

  it("returns a friendly message on unauthorized login", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      createJsonResponse({ detail: "Unauthorized" }, { ok: false, status: 401 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      login({
        email: "ana@correo.com",
        password: "wrong",
        slug: "flora",
      }),
    ).rejects.toThrow("No pudimos iniciar sesion. Verifica tu correo, contraseña y slug del tenant.");
  });

  it("clears stored tokens on logout", () => {
    localStorage.setItem("petalops-access-token", "access-123");
    localStorage.setItem("petalops-refresh-token", "refresh-456");

    clearAccessTokens();

    expect(localStorage.getItem("petalops-access-token")).toBeNull();
    expect(localStorage.getItem("petalops-refresh-token")).toBeNull();
  });
});
