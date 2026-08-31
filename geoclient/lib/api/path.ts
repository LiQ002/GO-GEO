import type { paths as legacyPaths } from './generated/openapi'
import type { paths as userPaths } from './generated/user-openapi'

export type ApiPathTemplate = keyof legacyPaths | keyof userPaths

type PathParameterNames<Path extends string> =
  Path extends `${string}{${infer Parameter}}${infer Rest}`
    ? Parameter | PathParameterNames<Rest>
    : never

type PathParameters<Path extends string> = {
  [Parameter in PathParameterNames<Path>]: string | number
}

type PathArguments<Path extends string> =
  [PathParameterNames<Path>] extends [never] ? [] : [parameters: PathParameters<Path>]

export function apiPath<Path extends ApiPathTemplate>(
  template: Path,
  ...args: PathArguments<Path>
): string {
  const parameters = (args[0] ?? {}) as Record<string, string | number>
  return template.replace(/\{([^}]+)\}/g, (_placeholder, parameter: string) => {
    const value = parameters[parameter]
    if (value === undefined) {
      throw new Error('Missing API path parameter: ' + parameter)
    }
    return encodeURIComponent(String(value))
  })
}
