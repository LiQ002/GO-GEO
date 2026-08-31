type RequestMetadata = Pick<Request, "headers" | "url">;

/** Return the browser-facing origin for direct and reverse-proxied requests. */
export function requestOrigin(request: RequestMetadata) {
  const internalURL = new URL(request.url);
  const protocol = forwardedProtocol(request) ?? internalURL.protocol;
  const host =
    firstHeaderValue(request.headers.get("x-forwarded-host")) ??
    request.headers.get("host");

  if (!host) return internalURL.origin;
  try {
    return new URL(`${protocol}//${host}`).origin;
  } catch {
    return internalURL.origin;
  }
}

/**
 * Secure cookies must not be set for an HTTP origin, otherwise the browser
 * silently ignores them.
 */
export function isSecureRequest(request: RequestMetadata) {
  return (
    (forwardedProtocol(request) ?? new URL(request.url).protocol) === "https:"
  );
}

/** Reject cross-origin mutations without confusing a proxy origin with the public one. */
export function isSameOriginMutation(
  request: Pick<Request, "headers" | "method" | "url">,
) {
  if (request.method === "GET" || request.method === "HEAD") return true;

  const originHeader = request.headers.get("origin");
  if (!originHeader) return true;

  try {
    const origin = new URL(originHeader);
    return origin.origin !== "null" && origin.origin === requestOrigin(request);
  } catch {
    return false;
  }
}

function forwardedProtocol(request: RequestMetadata) {
  const protocol = firstHeaderValue(
    request.headers.get("x-forwarded-proto"),
  )?.toLowerCase();
  if (protocol === "http" || protocol === "https") return `${protocol}:`;
  return undefined;
}

function firstHeaderValue(value: string | null) {
  return value?.split(",", 1)[0]?.trim() || undefined;
}
