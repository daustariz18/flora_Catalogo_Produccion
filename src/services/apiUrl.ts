const RAW_API_URL = (import.meta.env.VITE_API_URL as string | undefined)?.trim() ?? ''

export function getApiBaseUrl(): string {
  return RAW_API_URL.replace(/\/$/, '')
}

export function hasApiBaseUrl(): boolean {
  return getApiBaseUrl().length > 0
}

function isAbsoluteUrl(value: string): boolean {
  return /^[a-z][a-z\d+\-.]*:\/\//i.test(value)
}

function normalizePath(path: string): string {
  const trimmed = path.trim()
  if (!trimmed) return ''
  if (isAbsoluteUrl(trimmed)) return trimmed
  return `/${trimmed.replace(/^\/+/, '')}`
}

function baseHasApiPrefix(baseUrl: string): boolean {
  return /\/api\/?$/i.test(baseUrl)
}

function stripDuplicateApiPrefix(path: string): string {
  return path.replace(/^\/api(?=\/|$)/i, '')
}

export function buildApiUrl(path: string): string {
  const baseUrl = getApiBaseUrl()
  const normalizedPath = normalizePath(path)

  if (!baseUrl || !normalizedPath) {
    return normalizedPath
  }

  if (isAbsoluteUrl(normalizedPath)) {
    return normalizedPath
  }

  const pathForBase = baseHasApiPrefix(baseUrl)
    ? stripDuplicateApiPrefix(normalizedPath)
    : normalizedPath

  return `${baseUrl}${pathForBase}`
}
