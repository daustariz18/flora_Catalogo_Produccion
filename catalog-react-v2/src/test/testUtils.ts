import { vi } from "vitest";

type MockJsonResponseOptions = {
  ok?: boolean;
  status?: number;
  contentType?: string;
};

export function createJsonResponse<T>(body: T, options: MockJsonResponseOptions = {}) {
  const ok = options.ok ?? true;
  const status = options.status ?? (ok ? 200 : 500);
  const contentType = options.contentType ?? "application/json";

  return {
    ok,
    status,
    headers: {
      get: (name: string) => (name.toLowerCase() === "content-type" ? contentType : null),
    },
    json: async () => body,
  } as Response;
}

export function mockFetchJson<T>(body: T, options: MockJsonResponseOptions = {}) {
  const fetchMock = vi.fn().mockResolvedValue(createJsonResponse(body, options));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}
