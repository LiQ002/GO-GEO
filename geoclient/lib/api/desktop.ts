import { http } from './core'
import type { components } from './generated/openapi'
import { apiPath } from './path'

export type DesktopAccount = components['schemas']['DesktopAccountOut']
type DesktopAccountList = components['schemas']['DesktopAccountListOut']

export async function getDesktopAccounts(
  enterpriseId: number,
  kind: 'media' | 'model' = 'media',
): Promise<DesktopAccount[]> {
  const { data } = await http.get<DesktopAccountList>(
    apiPath('/api/desktop/desktop/accounts/{enterprise_id}', { enterprise_id: enterpriseId }),
    { params: { platform_type: kind === 'model' ? 'ai' : 'media' } },
  )
  return data.items
}

export async function getDesktopAccountSecret(
  enterpriseId: number,
  platform: string,
  kind: 'media' | 'model' = 'media',
): Promise<string | null> {
  const accounts = await getDesktopAccounts(enterpriseId, kind)
  return accounts.find((item) => item.platform === platform)?.cookie_encrypted?.trim() || null
}
