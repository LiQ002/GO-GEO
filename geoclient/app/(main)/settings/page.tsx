import ClientSettings from '@/components/pages/client/Settings'
import OperatorSettings from '@/components/pages/operator/Settings'
import { isOperatorMode } from '@/lib/app-mode'

export default function SettingsPage() {
  return isOperatorMode() ? <OperatorSettings /> : <ClientSettings />
}
