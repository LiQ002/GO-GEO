import { redirect } from 'next/navigation'
import OperatorUsers from '@/components/pages/operator/Users'
import { isOperatorMode } from '@/lib/app-mode'

export default function UsersPage() {
  if (!isOperatorMode()) redirect('/dashboard')
  return <OperatorUsers />
}
