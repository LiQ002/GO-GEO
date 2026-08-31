export type AppMode = 'operator' | 'client'

function resolveAppMode(value: string | undefined): AppMode {
  if (!value) return 'client'
  if (value === 'client' || value === 'operator') return value
  throw new Error(`Invalid NEXT_PUBLIC_APP_MODE: ${value}`)
}

export const appMode = resolveAppMode(process.env.NEXT_PUBLIC_APP_MODE)

export function isOperatorMode(): boolean {
  return appMode === 'operator'
}

export function isClientMode(): boolean {
  return appMode === 'client'
}
