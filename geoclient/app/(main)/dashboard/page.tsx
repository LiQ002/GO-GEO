import ClientDashboard from '@/components/pages/client/Dashboard'
import OperatorDashboard from '@/components/pages/operator/Dashboard'
import { isOperatorMode } from '@/lib/app-mode'

export default function DashboardPage() {
  return isOperatorMode() ? <OperatorDashboard /> : <ClientDashboard />
}
