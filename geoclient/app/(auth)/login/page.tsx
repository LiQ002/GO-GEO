import { isOperatorMode } from '@/lib/app-mode'
import ClientLogin from '@/components/pages/client/Login'
import OperatorLogin from '@/components/pages/operator/Login'

export default function LoginPage() {
  return isOperatorMode() ? <OperatorLogin /> : <ClientLogin />
}
