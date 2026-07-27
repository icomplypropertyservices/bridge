export const UPSTREAM: string
export function sanitizeError(msg: string): string
export function rewriteLogoHosts(text: string): string
export function buildConfigJson(env: Record<string, string | undefined>): {
  platformFeeBps: number
  platformFeePercent: string
  brand: string
  bridgeReady: boolean
}
export function proxyBridge(
  req: { method: string; path: string; query: URLSearchParams; body?: string },
  env: Record<string, string | undefined>,
): Promise<{ status: number; body: string; contentType: string; cacheControl?: string }>
