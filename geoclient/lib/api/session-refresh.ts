export const DEFAULT_ACCESS_REFRESH_WINDOW_MS = 5 * 60 * 1000

export type SessionRefreshKind = 'not-needed' | 'success' | 'invalid' | 'unavailable'

export function authRefreshPath(operatorMode: boolean): string {
  return operatorMode
    ? '/api/admin/v1/auth/refresh'
    : '/api/user/v1/auth/refresh'
}

export function accessTokenNeedsRefresh(
  accessToken: string | null | undefined,
  nowMs = Date.now(),
  refreshWindowMs = DEFAULT_ACCESS_REFRESH_WINDOW_MS,
): boolean {
  const expiresAt = jwtExpirationMs(accessToken)
  return expiresAt === null || expiresAt <= nowMs + refreshWindowMs
}

export function jwtExpirationMs(token: string | null | undefined): number | null {
  if (!token) return null
  const parts = token.split('.')
  if (parts.length !== 3 || !parts[1]) return null

  try {
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')
    const payload = JSON.parse(atob(padded)) as { exp?: unknown }
    return typeof payload.exp === 'number' && Number.isFinite(payload.exp)
      ? payload.exp * 1000
      : null
  } catch {
    return null
  }
}

type RefreshEntry<T> = {
  expiresAt: number
  promise: Promise<T>
}

/** Merge concurrent refreshes for one rotating refresh token. */
export class RefreshCoordinator<T> {
  private readonly entries = new Map<string, RefreshEntry<T>>()

  constructor(
    private readonly retainMs = 10_000,
    private readonly now: () => number = Date.now,
  ) {}

  run(
    key: string,
    refresh: () => Promise<T>,
    shouldRetain: (result: T) => boolean,
  ): Promise<T> {
    const now = this.now()
    for (const [entryKey, entry] of this.entries) {
      if (entry.expiresAt <= now) this.entries.delete(entryKey)
    }

    const existing = this.entries.get(key)
    if (existing) return existing.promise

    const entry: RefreshEntry<T> = {
      expiresAt: Number.POSITIVE_INFINITY,
      promise: refresh(),
    }
    this.entries.set(key, entry)
    void entry.promise.then(
      (result) => {
        if (this.entries.get(key) !== entry) return
        if (shouldRetain(result)) {
          entry.expiresAt = this.now() + this.retainMs
          return
        }
        this.entries.delete(key)
      },
      () => {
        if (this.entries.get(key) === entry) this.entries.delete(key)
      },
    )
    return entry.promise
  }
}
