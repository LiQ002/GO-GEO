export function createAuthorizationHeader(token: string): string {
  return `Bearer ${token}`
}
