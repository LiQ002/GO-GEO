export const defaultAccessRefreshWindowMs = 5 * 60 * 1000;

export function accessTokenNeedsRefresh(
  accessToken: string | undefined,
  nowMs = Date.now(),
  refreshWindowMs = defaultAccessRefreshWindowMs,
) {
  const expiresAt = jwtExpirationMs(accessToken);
  return expiresAt === null || expiresAt <= nowMs + refreshWindowMs;
}

export function jwtExpirationMs(token: string | undefined): number | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3 || !parts[1]) return null;
  try {
    const payload = JSON.parse(
      Buffer.from(parts[1], "base64url").toString("utf8"),
    ) as { exp?: unknown };
    return typeof payload.exp === "number" && Number.isFinite(payload.exp)
      ? payload.exp * 1000
      : null;
  } catch {
    return null;
  }
}

type RefreshEntry<T> = {
  expiresAt: number;
  promise: Promise<T>;
};

export class RefreshCoordinator<T> {
  private readonly entries = new Map<string, RefreshEntry<T>>();
  private readonly now: () => number;
  private readonly retainMs: number;

  constructor(retainMs = 10_000, now: () => number = Date.now) {
    this.retainMs = retainMs;
    this.now = now;
  }

  run(
    key: string,
    refresh: () => Promise<T>,
    shouldRetain: (result: T) => boolean,
  ): Promise<T> {
    const now = this.now();
    for (const [entryKey, entry] of this.entries) {
      if (entry.expiresAt <= now) this.entries.delete(entryKey);
    }
    const existing = this.entries.get(key);
    if (existing) {
      return existing.promise;
    }

    const entry: RefreshEntry<T> = {
      expiresAt: Number.POSITIVE_INFINITY,
      promise: refresh(),
    };
    this.entries.set(key, entry);
    void entry.promise.then(
      (result) => {
        if (this.entries.get(key) !== entry) return;
        if (shouldRetain(result)) {
          entry.expiresAt = this.now() + this.retainMs;
          return;
        }
        this.entries.delete(key);
      },
      () => {
        if (this.entries.get(key) === entry) this.entries.delete(key);
      },
    );
    return entry.promise;
  }
}
